// ================================================================
//  BioXape — Auth Routes
//  FILE: routes/auth.js
//  Endpoints:
//    POST /api/auth/register        — invite-based registration
//    POST /api/auth/login           — email + password login
//    GET  /api/auth/google          — Google OAuth initiate
//    GET  /api/auth/google/callback — Google OAuth callback
//    GET  /api/auth/me              — get current user profile
//    POST /api/auth/logout          — logout
//    POST /api/auth/forgot-password — send reset email
//    POST /api/auth/reset-password  — reset with token
// ================================================================

const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { generateToken, protect } = require('../middleware/authMiddleware');
const { sendEmail }   = require('../utils/emailSender');
const { google }      = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const crypto          = require('crypto');
const { uploadPhoto } = require('../config/cloudinary');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact admin.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Account pending activation. Check your email for invite.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
      user: user.toPublicProfile()
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ── POST /api/auth/register (invite-based) ───────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, inviteToken } = req.body;

    if (!name || !email || !password || !inviteToken) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      inviteToken,
      inviteExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invite link.' });
    }

    user.name           = name.trim();
    user.passwordHash   = password;   // pre-save hook hashes it
    user.status         = 'active';
    user.inviteToken    = null;
    user.inviteExpires  = null;
    await user.save();

    const token = generateToken(user._id);
    return res.json({ success: true, token, user: user.toPublicProfile() });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ── POST /api/auth/google (Google One-Tap / Button Login Verification) ──
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required.' });
    }

    // Verify Google ID token using google-auth-library Client
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture: photoUrl } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Auto-create account for Google login if it matches ADMIN_EMAIL
      const role = email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
        ? 'admin' : 'author';

      user = await User.create({
        name,
        email:     email.toLowerCase(),
        googleId,
        photoUrl:  photoUrl || '',
        role,
        status:    'active',
      });
    } else {
      // Update Google ID if missing
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.photoUrl) user.photoUrl = photoUrl || '';
        await user.save();
      }
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact admin.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
      user: user.toPublicProfile()
    });
  } catch (err) {
    console.error('Google One-Tap Login error:', err);
    return res.status(500).json({ success: false, message: 'Google authentication failed: ' + err.message });
  }
});

// ── GET /api/auth/google ──────────────────────────────────────
router.get('/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account'
  });
  res.redirect(authUrl);
});

// ── GET /api/auth/google/callback ────────────────────────────
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.FRONTEND_URL}?error=google_auth_failed`);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    let user = await User.findOne({ email: googleUser.email.toLowerCase() });

    if (!user) {
      // Auto-create account for Google login
      // Check if this is the admin email
      const role = googleUser.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
        ? 'admin' : 'author';

      user = await User.create({
        name:      googleUser.name,
        email:     googleUser.email.toLowerCase(),
        googleId:  googleUser.id,
        photoUrl:  googleUser.picture || '',
        role,
        status:    'active',
      });
    } else {
      // Update Google ID if missing
      if (!user.googleId) {
        user.googleId = googleUser.id;
        if (!user.photoUrl) user.photoUrl = googleUser.picture || '';
        await user.save();
      }
    }

    if (user.status === 'suspended') {
      return res.redirect(`${process.env.FRONTEND_URL}?error=account_suspended`);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    // Redirect to frontend with token
    return res.redirect(`${process.env.FRONTEND_URL}/auth-success.html?token=${token}&role=${user.role}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    return res.redirect(`${process.env.FRONTEND_URL}?error=google_auth_failed`);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash -googleId -inviteToken -passwordResetToken')
      .populate('assignedEditorId', 'name email photoUrl')
      .populate('assignedAuthors', 'name email photoUrl role');

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', protect, (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });
    }

    const resetToken   = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);  // 1 hour

    user.passwordResetToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = resetExpires;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;

    await sendEmail({
      to:      user.email,
      subject: 'BioXape — Reset Your Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="background:#27a363;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Reset Password</a>
        <p>If you did not request this, ignore this email.</p>
      `
    });

    return res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    user.passwordHash         = password;   // hashed by pre-save hook
    user.passwordResetToken   = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/auth/update-profile ─────────────────────────────
// Updates user details and profile picture (Cloudinary integration)
router.put('/update-profile', protect, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const { name, phone, bio, twitter, linkedin, researchgate } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;

    // Update social links
    if (!user.socialLinks) user.socialLinks = {};
    if (twitter !== undefined) user.socialLinks.twitter = twitter;
    if (linkedin !== undefined) user.socialLinks.linkedin = linkedin;
    if (researchgate !== undefined) user.socialLinks.researchgate = researchgate;

    // Handle Cloudinary profile photo upload
    if (req.file) {
      user.photoUrl = req.file.path;
    }

    await user.save();
    return res.json({ success: true, user: user.toPublicProfile() });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile: ' + err.message });
  }
});

module.exports = router;

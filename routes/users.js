// ================================================================
//  BioXape — Users Routes
//  FILE: routes/users.js
//  All routes protected. Admin-only unless noted.
//  GET  /api/users              — list all users (admin)
//  GET  /api/users/:id          — get single user
//  POST /api/users/invite       — invite new author/editor (admin)
//  PUT  /api/users/:id          — update user profile
//  PUT  /api/users/:id/role     — promote/demote role (admin)
//  PUT  /api/users/:id/status   — suspend/activate (admin)
//  PUT  /api/users/:id/assign-editor — assign editor to author (admin)
//  PUT  /api/users/:id/assign-authors — assign authors to editor (admin)
//  DELETE /api/users/:id        — remove user (admin)
//  GET  /api/users/editors/list — list editors with their authors
// ================================================================

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const User     = require('../models/User');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const { sendEmail }        = require('../utils/emailSender');
const { sendWhatsApp }     = require('../utils/whatsappSender');
const { Notification }     = require('../models/index');

// All users routes require login
router.use(protect);

// ── GET /api/users — list all users ──────────────────────────
router.get('/', isAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};
    if (role)   filter.role   = role;
    if (status) filter.status = status;
    if (search) filter.$or    = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    const users = await User.find(filter)
      .select('-passwordHash -googleId -inviteToken -passwordResetToken')
      .populate('assignedEditorId', 'name email')
      .populate('assignedAuthors',  'name email')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/users/editors/list ───────────────────────────────
router.get('/editors/list', isAdmin, async (req, res) => {
  try {
    const editors = await User.find({ role: 'editor', status: 'active' })
      .select('name email photoUrl assignedAuthors postsPublished')
      .populate('assignedAuthors', 'name email');
    return res.json({ success: true, editors });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -googleId -inviteToken -passwordResetToken')
      .populate('assignedEditorId', 'name email photoUrl')
      .populate('assignedAuthors',  'name email photoUrl');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Non-admins can only see their own profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/users/invite ────────────────────────────────────
router.post('/invite', isAdmin, async (req, res) => {
  try {
    const { email, role, name } = req.body;

    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'Email and role are required.' });
    }
    if (!['editor', 'author'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be editor or author.' });
    }

    const inviteToken   = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);  // 48 hours

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (user) {
      if (user.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'A user with this email already exists and is active/suspended.' });
      }
      // If user exists but is pending, update their details to resend the invitation
      user.name = name || user.name;
      user.role = role;
      user.inviteToken = inviteToken;
      user.inviteExpires = inviteExpires;
      await user.save();
    } else {
      user = await User.create({
        name:         name || email.split('@')[0],
        email:        email.toLowerCase(),
        role,
        status:       'pending',
        inviteToken,
        inviteExpires,
      });
      isNewUser = true;
    }

    const inviteUrl = `${process.env.FRONTEND_URL}/register.html?token=${inviteToken}&email=${email}`;

    const emailResult = await sendEmail({
      to:      email,
      subject: `You are invited to join BioXape as ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#27a363;padding:24px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:white;margin:0;font-size:24px">Welcome to BioXape</h1>
          </div>
          <div style="background:#f8faf9;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e0ece5">
            <p style="color:#2d4a38">Hi ${name || 'there'},</p>
            <p style="color:#4a7060">You have been invited to join <strong>BioXape</strong> as a <strong>${role}</strong>.</p>
            <p style="color:#4a7060">Click the button below to set up your account. This link expires in 48 hours.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${inviteUrl}" style="background:#27a363;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Accept Invitation</a>
            </div>
            <p style="color:#7a9e8c;font-size:12px">If you were not expecting this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      `
    });

    if (!emailResult.success) {
      if (isNewUser) {
        await User.findByIdAndDelete(user._id);
      }
      return res.status(500).json({ success: false, message: `Failed to send invitation email: ${emailResult.error}` });
    }

    // In-app notification to admin confirming invite sent
    await Notification.create({
      toUserId:  req.user._id,
      fromName:  'BioXape System',
      type:      'invite_sent',
      message:   `Invite sent to ${email} as ${role}.`,
    });

    return res.json({
      success: true,
      message: `Invite sent to ${email}.`,
      userId:  user._id
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/:id — update profile ──────────────────────
router.put('/:id', async (req, res) => {
  try {
    // Only admin or the user themselves can update
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const allowed = ['name', 'bio', 'phone', 'photoUrl', 'expertise', 'socialLinks', 'notifPrefs'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-passwordHash -googleId -inviteToken -passwordResetToken');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/:id/role — promote/demote ─────────────────
router.put('/:id/role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['editor', 'author'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be editor or author.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot change admin role.' });

    const oldRole  = user.role;
    user.role = role;

    // If demoting editor to author, clear their assigned authors
    if (oldRole === 'editor' && role === 'author') {
      // Unassign all authors from this editor
      await User.updateMany(
        { assignedEditorId: user._id },
        { $unset: { assignedEditorId: '' } }
      );
      user.assignedAuthors = [];
    }

    // If promoting author to editor, remove them from their editor's list
    if (oldRole === 'author' && role === 'editor') {
      if (user.assignedEditorId) {
        await User.findByIdAndUpdate(user.assignedEditorId, {
          $pull: { assignedAuthors: user._id }
        });
        user.assignedEditorId = null;
      }
    }

    await user.save();

    // Notify the user
    await Notification.create({
      toUserId:  user._id,
      fromUserId: req.user._id,
      fromName:  req.user.name,
      type:      'role_changed',
      message:   `Your role has been changed from ${oldRole} to ${role} by admin.`,
    });

    await sendEmail({
      to:      user.email,
      subject: 'BioXape — Your Role Has Been Updated',
      html:    `<p>Hi ${user.name}, your role on BioXape has been updated to <strong>${role}</strong>.</p>`
    });

    return res.json({ success: true, message: `Role updated to ${role}.`, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/:id/status — suspend/activate ─────────────
router.put('/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active or suspended.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .select('-passwordHash -googleId');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await sendEmail({
      to:      user.email,
      subject: `BioXape — Your account has been ${status}`,
      html:    `<p>Hi ${user.name}, your BioXape account has been ${status}. Contact admin if you have questions.</p>`
    });

    return res.json({ success: true, message: `User ${status}.`, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/users/:id/assign-editor ─────────────────────────
router.put('/:id/assign-editor', isAdmin, async (req, res) => {
  try {
    const { editorId } = req.body;
    const author = await User.findById(req.params.id);
    if (!author) return res.status(404).json({ success: false, message: 'Author not found.' });

    const editor = await User.findById(editorId);
    if (!editor || editor.role !== 'editor') {
      return res.status(400).json({ success: false, message: 'Valid editor ID required.' });
    }

    // Remove from old editor
    if (author.assignedEditorId) {
      await User.findByIdAndUpdate(author.assignedEditorId, {
        $pull: { assignedAuthors: author._id }
      });
    }

    // Assign to new editor
    author.assignedEditorId = editorId;
    await author.save();

    await User.findByIdAndUpdate(editorId, {
      $addToSet: { assignedAuthors: author._id }
    });

    // Notify editor
    await Notification.create({
      toUserId:  editorId,
      fromUserId: req.user._id,
      fromName:  req.user.name,
      type:      'author_assigned',
      message:   `${author.name} has been assigned to you as an author.`,
    });

    return res.json({ success: true, message: `${author.name} assigned to ${editor.name}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/users/:id ────────────────────────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin.' });

    user.status = 'suspended';
    await user.save();

    return res.json({ success: true, message: 'User removed (suspended) successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// ================================================================
//  BioXape — Auth Middleware
//  FILE: middleware/authMiddleware.js
// ================================================================

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Verify JWT and attach user to req ─────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.bioxape_token) {
      token = req.cookies.bioxape_token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-passwordHash -googleId -inviteToken -passwordResetToken');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// ── Role guards ───────────────────────────────────────────────

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

const isEditor = (req, res, next) => {
  if (req.user && ['admin', 'editor'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Editor access required.' });
};

const isAuthor = (req, res, next) => {
  if (req.user && ['admin', 'editor', 'author'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Author access required.' });
};

// ── Generate JWT ──────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

module.exports = { protect, isAdmin, isEditor, isAuthor, generateToken };

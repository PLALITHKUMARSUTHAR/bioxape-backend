// ================================================================
//  BioXape — User Model
//  FILE: models/User.js
// ================================================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String, required: true, trim: true, maxlength: 100
  },
  email: {
    type: String, required: true, unique: true,
    lowercase: true, trim: true
  },
  passwordHash: {
    type: String, default: null   // null for Google OAuth users
  },
  googleId: {
    type: String, default: null, sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'author'],
    default: 'author'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'pending'
  },
  phone: {
    type: String, default: '', trim: true   // e.g. +919876543210
  },
  bio: {
    type: String, default: '', maxlength: 500
  },
  photoUrl: {
    type: String, default: ''
  },
  expertise: {
    type: [String], default: []   // e.g. ['CRISPR', 'Genomics']
  },
  socialLinks: {
    twitter:     { type: String, default: '' },
    linkedin:    { type: String, default: '' },
    researchgate:{ type: String, default: '' },
    website:     { type: String, default: '' }
  },
  // For authors: which editor reviews their posts
  assignedEditorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // For editors: which authors they are responsible for
  assignedAuthors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  postsPublished: { type: Number, default: 0 },
  totalReads:     { type: Number, default: 0 },
  notifPrefs: {
    email:    { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    inApp:    { type: Boolean, default: true }
  },
  // Subscription tier for blog readers
  subscriptionTier: {
    type: String,
    enum: ['free', 'pro', 'institutional'],
    default: 'free'
  },
  // Invite system
  inviteToken:   { type: String, default: null },
  inviteExpires: { type: Date,   default: null },
  passwordResetToken:   { type: String, default: null },
  passwordResetExpires: { type: Date,   default: null },
},
{
  timestamps: true   // adds createdAt and updatedAt automatically
});

// --- Hash password before saving ---
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// --- Compare password ---
userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// --- Safe public profile (no password) ---
userSchema.methods.toPublicProfile = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.googleId;
  delete obj.inviteToken;
  delete obj.inviteExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  body:         { type: String, required: true },
  author:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  category:     { type: mongoose.Schema.Types.ObjectId, ref: 'ForumCategory', required: true },
  tags:         [{ type: String, trim: true }],
  upvotes:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  downvotes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  isPinned:     { type: Boolean, default: false },
  isLocked:     { type: Boolean, default: false },
  views:        { type: Number, default: 0 },
}, { timestamps: true });

// Compound index for category filtering and sorted order
forumPostSchema.index({ category: 1, createdAt: -1 });

// Text index on title, body, and tags for text search
forumPostSchema.index({ title: 'text', body: 'text', tags: 'text' });

module.exports = mongoose.models.ForumPost || mongoose.model('ForumPost', forumPostSchema);

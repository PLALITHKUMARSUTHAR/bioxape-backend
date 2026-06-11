const mongoose = require('mongoose');

const forumCommentSchema = new mongoose.Schema({
  post:             { type: mongoose.Schema.Types.ObjectId, ref: 'ForumPost', required: true },
  author:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body:             { type: String, required: true },
  parentComment:    { type: mongoose.Schema.Types.ObjectId, ref: 'ForumComment', default: null },
  upvotes:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isAcceptedAnswer: { type: Boolean, default: false },
}, { timestamps: true });

// Index for post comments hierarchy
forumCommentSchema.index({ post: 1, parentComment: 1 });

module.exports = mongoose.models.ForumComment || mongoose.model('ForumComment', forumCommentSchema);

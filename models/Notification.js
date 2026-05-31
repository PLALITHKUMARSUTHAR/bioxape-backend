const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  toUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fromName:   { type: String, default: 'BioXApe System' },
  type: {
    type: String,
    enum: [
      'post_submitted', 'editor_approved', 'changes_requested',
      'admin_approved', 'admin_rejected', 'post_published',
      'role_changed', 'author_assigned', 'new_subscriber',
      'payment_received', 'invite_sent', 'general'
    ],
    required: true
  },
  postId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  postTitle: { type: String, default: '' },
  message:   { type: String, required: true },
  read:      { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ toUserId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

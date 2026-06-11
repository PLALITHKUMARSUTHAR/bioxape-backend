const mongoose = require('mongoose');

const forumCategorySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '🧬' },
  color:       { type: String, default: '#4F86C6' },
  postCount:   { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.models.ForumCategory || mongoose.model('ForumCategory', forumCategorySchema);

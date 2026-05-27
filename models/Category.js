const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  bloggerLabel:{ type: String, required: true },
  description: { type: String, default: '' },
  postCount:   { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);

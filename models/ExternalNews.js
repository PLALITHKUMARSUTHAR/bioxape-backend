const mongoose = require('mongoose');

const externalNewsSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  link:        { type: String, required: true, unique: true, trim: true },
  source:      { type: String, required: true, trim: true },
  publishedAt: { type: Date, default: Date.now },
  category:    { type: String, enum: ['breaking', 'research', 'industry', 'funding', 'event'], default: 'industry', required: true }
}, { timestamps: true });

module.exports = mongoose.models.ExternalNews || mongoose.model('ExternalNews', externalNewsSchema);

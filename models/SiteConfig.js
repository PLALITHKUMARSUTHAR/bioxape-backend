const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema({
  section: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'ticker','hero_featured','hero_stack','category_nav',
      'news_strip','trending','research_spotlight','interviews',
      'subscription_plans','courses','store','authors_display',
      'footer','adsense_slots'
    ]
  },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);

// ================================================================
//  BioXape — Post Model
//  FILE: models/Post.js
// ================================================================

const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  status:    String,
  comment:   String,
  byId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName:    String,
  byRole:    String,
  at:        { type: Date, default: Date.now }
}, { _id: false });

const postSchema = new mongoose.Schema({
  title: {
    type: String, required: true, trim: true, maxlength: 300
  },
  excerpt: {
    type: String, default: '', trim: true, maxlength: 500
  },
  bodyHtml: {
    type: String, default: ''   // converted from .docx by Mammoth on backend
  },
  docxFileUrl: {
    type: String, default: ''   // Cloudinary URL
  },
  docxPublicId: {
    type: String, default: ''   // Cloudinary public_id for deletion
  },
  coverImageUrl: {
    type: String, default: ''
  },
  coverPublicId: {
    type: String, default: ''
  },
  readTimeMinutes: { type: Number, default: 0 },
  wordCount:       { type: Number, default: 0 },

  // Categorisation
  category: {
    type: String, default: '', trim: true   // primary Blogger label
  },
  allCategories: {
    type: [String], default: []   // all Blogger labels
  },
  contentType: {
    type: String,
    enum: ['article', 'research_summary', 'product_review', 'interview', 'news'],
    default: 'article'
  },
  tags: { type: [String], default: [] },

  // People
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  editorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  editorName: { type: String, default: '' },

  // Pipeline status
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'editor_review',
      'changes_needed',
      'admin_review',
      'approved',
      'published',
      'rejected',
      'archived'
    ],
    default: 'draft'
  },

  // Feedback
  editorComment: { type: String, default: '' },
  adminComment:  { type: String, default: '' },

  // Full history of every status change
  revisionHistory: [revisionSchema],

  // Timestamps for each pipeline stage
  submittedAt:      { type: Date, default: null },
  editorReviewedAt: { type: Date, default: null },
  adminReviewedAt:  { type: Date, default: null },
  publishedAt:      { type: Date, default: null },

  // After publishing to Blogger
  bloggerPostId:  { type: String, default: '' },
  bloggerPostUrl: { type: String, default: '' },

  // Homepage display controls
  isFeatured:       { type: Boolean, default: false },
  isHeroStack:      { type: Boolean, default: false },
  heroStackPosition:{ type: Number,  default: 0 },
  isTrending:       { type: Boolean, default: false },

  // Engagement
  viewCount:    { type: Number, default: 0 },
  shareCount:   { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
},
{
  timestamps: true
});

// Index for fast queries
postSchema.index({ authorId: 1, status: 1 });
postSchema.index({ editorId: 1, status: 1 });
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ category: 1 });
postSchema.index({ isFeatured: 1 });

// Auto-calculate read time from HTML word count
postSchema.pre('save', function (next) {
  if (this.bodyHtml) {
    const words = this.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    this.wordCount = words;
    this.readTimeMinutes = Math.max(1, Math.ceil(words / 200));
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);

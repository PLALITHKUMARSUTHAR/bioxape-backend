// ================================================================
//  BioXApe — Notification Model
//  FILE: models/Notification.js
// ================================================================

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
},
{ timestamps: true });

notificationSchema.index({ toUserId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

// ================================================================
//  SiteConfig Model — one document per section
// ================================================================

const siteConfigSchema = new mongoose.Schema({
  section: {
    type: String,
    unique: true,
    enum: [
      'ticker', 'hero_featured', 'hero_stack', 'category_nav',
      'news_strip', 'trending', 'research_spotlight', 'interviews',
      'subscription_plans', 'courses', 'store', 'authors_display',
      'footer', 'adsense_slots', 'site_meta'
    ],
    required: true
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
},
{ timestamps: true });

const SiteConfig = mongoose.model('SiteConfig', siteConfigSchema);

// ================================================================
//  Category Model
// ================================================================

const categorySchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true, lowercase: true },
  displayName: { type: String, required: true, trim: true },
  bloggerLabel:{ type: String, required: true, trim: true },
  description: { type: String, default: '' },
  postCount:   { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
},
{ timestamps: true });

const Category = mongoose.model('Category', categorySchema);

// ================================================================
//  Subscription Model
// ================================================================

const subscriptionSchema = new mongoose.Schema({
  razorpaySubId:      { type: String, required: true, unique: true },
  razorpayCustomerId: { type: String, default: '' },
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email:              { type: String, required: true },
  plan: {
    type: String,
    enum: ['pro', 'institutional'],
    required: true
  },
  status: {
    type: String,
    enum: ['created', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created'
  },
  seats:             { type: Number, default: 1 },
  currentPeriodStart:{ type: Date, default: null },
  currentPeriodEnd:  { type: Date, default: null },
},
{ timestamps: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// ================================================================
//  StoreOrder Model
// ================================================================

const storeOrderSchema = new mongoose.Schema({
  razorpayOrderId:   { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  buyerEmail:        { type: String, required: true },
  buyerName:         { type: String, default: '' },
  buyerPhone:        { type: String, default: '' },
  product:           { type: String, required: true },
  productId:         { type: String, default: '' },
  amount:            { type: Number, required: true },  // in paise
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  deliveryUrl:  { type: String, default: '' },
  isDigital:    { type: Boolean, default: false },
},
{ timestamps: true });

const StoreOrder = mongoose.model('StoreOrder', storeOrderSchema);

module.exports = { Notification, SiteConfig, Category, Subscription, StoreOrder };

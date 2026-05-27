// ================================================================
//  BioXape — Upload Routes
//  FILE: routes/upload.js
//  POST /api/upload/docx     — upload Word file → Cloudinary
//  POST /api/upload/cover    — upload cover image → Cloudinary
//  POST /api/upload/photo    — upload profile photo → Cloudinary
//  POST /api/upload/docx-preview — convert .docx to HTML (Mammoth)
// ================================================================

const express  = require('express');
const router   = express.Router();
const mammoth  = require('mammoth');
const { protect } = require('../middleware/authMiddleware');
const { uploadDocx, uploadCover, uploadPhoto, cloudinary } = require('../config/cloudinary');

router.use(protect);

// ── POST /api/upload/docx ────────────────────────────────────
router.post('/docx', uploadDocx.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    return res.json({
      success:   true,
      fileUrl:   req.file.path,
      publicId:  req.file.filename,
      fileName:  req.file.originalname,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/upload/cover ───────────────────────────────────
router.post('/cover', uploadCover.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    return res.json({
      success:  true,
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/upload/photo ───────────────────────────────────
router.post('/photo', uploadPhoto.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    return res.json({
      success:  true,
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/upload/docx-preview ────────────────────────────
// Downloads the .docx from Cloudinary, converts to HTML with Mammoth
router.post('/docx-preview', async (req, res) => {
  try {
    const { docxUrl } = req.body;
    if (!docxUrl) return res.status(400).json({ success: false, message: 'docxUrl is required.' });

    const axios    = require('axios');
    const response = await axios.get(docxUrl, { responseType: 'arraybuffer' });
    const buffer   = Buffer.from(response.data);

    const result = await mammoth.convertToHtml({ buffer });
    return res.json({
      success: true,
      html:    result.value,
      warnings: result.messages
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to convert document: ' + err.message });
  }
});

module.exports = router;


// ================================================================
//  BioXape — Razorpay Subscription Routes
//  FILE: routes/subscribe.js
//  POST /api/subscribe/create   — create Razorpay subscription
//  POST /api/subscribe/webhook  — Razorpay payment webhook
//  GET  /api/subscribe/status   — get my subscription status
// ================================================================

const subscribeRouter = express.Router();
const Razorpay        = require('razorpay');
const crypto          = require('crypto');
const { Subscription } = require('../models/index');
const User            = require('../models/User');
const { sendEmail }   = require('../utils/emailSender');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── POST /api/subscribe/create ───────────────────────────────
subscribeRouter.post('/create', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['pro', 'institutional'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Plan must be pro or institutional.' });
    }

    const planId = plan === 'pro'
      ? process.env.RAZORPAY_PRO_PLAN_ID
      : process.env.RAZORPAY_INST_PLAN_ID;

    const subscription = await razorpay.subscriptions.create({
      plan_id:        planId,
      customer_notify: 1,
      total_count:    12,  // 12 months
      notes: {
        userId: req.user._id.toString(),
        email:  req.user.email,
        plan,
      }
    });

    return res.json({
      success:        true,
      subscriptionId: subscription.id,
      razorpayKeyId:  process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/subscribe/webhook ──────────────────────────────
subscribeRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body      = req.body.toString();

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSig) {
      return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    const event = JSON.parse(body);

    if (event.event === 'subscription.activated') {
      const sub  = event.payload.subscription.entity;
      const user = await User.findOne({ email: sub.notes.email });

      if (user) {
        user.subscriptionTier = sub.notes.plan || 'pro';
        await user.save();

        await Subscription.findOneAndUpdate(
          { razorpaySubId: sub.id },
          {
            razorpaySubId:      sub.id,
            userId:             user._id,
            email:              user.email,
            plan:               sub.notes.plan,
            status:             'active',
            currentPeriodEnd:   new Date(sub.current_end * 1000),
          },
          { upsert: true, new: true }
        );

        await sendEmail({
          to:      user.email,
          subject: 'Welcome to BioXape Pro!',
          html:    `<h2>You are now a BioXape Pro member!</h2><p>Hi ${user.name}, your subscription is active. Enjoy unlimited access to all research summaries and ad-free reading.</p>`
        });
      }
    }

    if (event.event === 'subscription.cancelled') {
      const sub  = event.payload.subscription.entity;
      await Subscription.findOneAndUpdate({ razorpaySubId: sub.id }, { status: 'cancelled' });
      const user = await User.findOne({ email: sub.notes.email });
      if (user) { user.subscriptionTier = 'free'; await user.save(); }
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/subscribe/status ────────────────────────────────
subscribeRouter.get('/status', protect, async (req, res) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user._id, status: 'active' });
    return res.json({
      success: true,
      tier:    req.user.subscriptionTier,
      subscription: sub || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ================================================================
//  BioXape — Categories Routes
//  FILE: routes/categories.js
// ================================================================

const catRouter = express.Router();
const { Category } = require('../models/index');

// GET /api/categories — public
catRouter.get('/', async (req, res) => {
  try {
    const cats = await Category.find({ active: true }).sort({ order: 1 });
    return res.json({ success: true, categories: cats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/categories — admin only
catRouter.post('/', protect, isAdmin, async (req, res) => {
  try {
    const { displayName, bloggerLabel, description, order } = req.body;
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const cat  = await Category.create({ slug, displayName, bloggerLabel, description, order: order || 0 });
    return res.status(201).json({ success: true, category: cat });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/categories/:id — admin only
catRouter.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.json({ success: true, category: cat });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/categories/:id — admin only
catRouter.delete('/:id', protect, isAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const { protect: _protect, isAdmin: _isAdmin } = require('../middleware/authMiddleware');

module.exports = {
  uploadRouter:     router,
  subscribeRouter,
  catRouter
};

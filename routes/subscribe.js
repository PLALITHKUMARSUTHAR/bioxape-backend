const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailSender');

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/subscribe/create — create Razorpay subscription
router.post('/create', protect, async (req, res) => {
  try {
    const { plan } = req.body; // 'pro' or 'institutional'
    if (!['pro', 'institutional'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }
    const planId = plan === 'pro'
      ? process.env.RAZORPAY_PRO_PLAN_ID
      : process.env.RAZORPAY_INST_PLAN_ID;

    if (!planId) return res.status(503).json({ success: false, message: 'Payments not configured yet' });

    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: plan === 'institutional' ? 15 : 1,
      total_count: 12,
      notes: { userId: req.user._id.toString(), email: req.user.email }
    });

    res.json({ success: true, subscriptionId: subscription.id, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/subscribe/webhook — Razorpay webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSig) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = JSON.parse(body);
    const payload = event.payload?.subscription?.entity;

    if (!payload) return res.status(200).json({ received: true });

    const notes = payload.notes || {};
    const userId = notes.userId;

    switch (event.event) {
      case 'subscription.activated':
        await Subscription.findOneAndUpdate(
          { razorpaySubId: payload.id },
          {
            razorpaySubId: payload.id,
            userId,
            email: notes.email || '',
            plan: payload.plan_id === process.env.RAZORPAY_PRO_PLAN_ID ? 'pro' : 'institutional',
            status: 'active',
            seats: payload.quantity || 1,
            currentPeriodStart: new Date(payload.current_start * 1000),
            currentPeriodEnd: new Date(payload.current_end * 1000)
          },
          { upsert: true, new: true }
        );
        if (userId) {
          await User.findByIdAndUpdate(userId, { subscriptionTier: payload.plan_id === process.env.RAZORPAY_PRO_PLAN_ID ? 'pro' : 'institutional' });
        }
        break;

      case 'subscription.cancelled':
      case 'subscription.expired':
        await Subscription.findOneAndUpdate({ razorpaySubId: payload.id }, { status: event.event.split('.')[1] });
        if (userId) await User.findByIdAndUpdate(userId, { subscriptionTier: 'free' });
        break;

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/subscribe/status — current user's subscription
router.get('/status', protect, async (req, res) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user._id, status: 'active' });
    res.json({ success: true, subscription: sub, tier: req.user.subscriptionTier || 'free' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subscribe/all — admin only
router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const subs = await Subscription.find().populate('userId', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, data: subs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

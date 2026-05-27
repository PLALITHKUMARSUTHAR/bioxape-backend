// ================================================================
//  BioXape — Site Config Routes
//  FILE: routes/site.js
//  GET  /api/site/all         — all sections (public, for blog)
//  GET  /api/site/:section    — single section
//  PUT  /api/site/:section    — update section (admin only)
//  POST /api/site/seed        — seed default data (admin only)
// ================================================================

const express    = require('express');
const siteRouter = express.Router();
const { SiteConfig } = require('../models/index');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const defaultSiteData = require('../utils/defaultSiteData');

// ── GET /api/site/all — PUBLIC ────────────────────────────────
siteRouter.get('/all', async (req, res) => {
  try {
    const configs = await SiteConfig.find({});
    const result  = {};
    configs.forEach(c => { result[c.section] = c.data; });
    return res.json({ success: true, config: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/site/:section — PUBLIC ──────────────────────────
siteRouter.get('/:section', async (req, res) => {
  try {
    const config = await SiteConfig.findOne({ section: req.params.section });
    if (!config) return res.status(404).json({ success: false, message: 'Section not found.' });
    return res.json({ success: true, data: config.data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/site/:section — ADMIN ONLY ──────────────────────
siteRouter.put('/:section', protect, isAdmin, async (req, res) => {
  try {
    const config = await SiteConfig.findOneAndUpdate(
      { section: req.params.section },
      { data: req.body.data, updatedBy: req.user._id },
      { new: true, upsert: true }
    );
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/site/seed — ADMIN ONLY — run once on setup ─────
siteRouter.post('/seed', protect, isAdmin, async (req, res) => {
  try {
    const sections = Object.keys(defaultSiteData);
    for (const section of sections) {
      await SiteConfig.findOneAndUpdate(
        { section },
        { data: defaultSiteData[section], updatedBy: req.user._id },
        { upsert: true }
      );
    }
    return res.json({ success: true, message: `Seeded ${sections.length} site config sections.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = siteRouter;


// ================================================================
//  BioXape — Notifications Routes
//  FILE: routes/notify.js
// ================================================================

const notifyRouter  = express.Router();
const { Notification } = require('../models/index');

notifyRouter.use(protect);

// GET /api/notify — get my notifications
notifyRouter.get('/', async (req, res) => {
  try {
    const { unread, limit = 20 } = req.query;
    const filter = { toUserId: req.user._id };
    if (unread === 'true') filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ toUserId: req.user._id, read: false });

    return res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notify/:id/read
notifyRouter.put('/:id/read', async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, toUserId: req.user._id },
      { read: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notify/read-all
notifyRouter.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ toUserId: req.user._id, read: false }, { read: true });
    return res.json({ success: true, message: 'All marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { siteRouter, notifyRouter };

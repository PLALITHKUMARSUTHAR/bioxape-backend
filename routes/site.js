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
    return res.json({ success: true, data: result });
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

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
const { SiteConfig, Category, ExternalNews } = require('../models/index');
const { protect, isAdmin } = require('../middleware/authMiddleware');
const defaultSiteData = require('../utils/defaultSiteData');

// ── CATEGORIES ROUTING ──────────────────────────────────────────

// GET /api/site/categories — Protected (logged-in users can load categories for dropdowns)
siteRouter.get('/categories', protect, async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ order: 1 });
    return res.json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/site/categories — Admin Only
siteRouter.post('/categories', protect, isAdmin, async (req, res) => {
  try {
    const { displayName, bloggerLabel, description, order, slug } = req.body;
    if (!displayName || !bloggerLabel) {
      return res.status(400).json({ success: false, message: 'Display name and Blogger label are required.' });
    }
    const finalSlug = slug || bloggerLabel.toLowerCase().replace(/\s+/g, '-');
    const category = await Category.create({
      displayName,
      bloggerLabel,
      description: description || '',
      order: order || 0,
      slug: finalSlug
    });
    return res.json({ success: true, data: category });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/site/categories/:id — Admin Only
siteRouter.put('/categories/:id', protect, isAdmin, async (req, res) => {
  try {
    const allowed = ['displayName', 'bloggerLabel', 'description', 'order', 'slug', 'active'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.json({ success: true, data: category });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/site/categories/:id — Admin Only
siteRouter.delete('/categories/:id', protect, isAdmin, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── CONFIG & ADSENSE ROUTING ────────────────────────────────────

// GET /api/site/config/:section — Public/Protected (Returns the full SiteConfig document to support frontend's .data.data paths)
siteRouter.get('/config/:section', async (req, res) => {
  try {
    const config = await SiteConfig.findOne({ section: req.params.section });
    if (!config) return res.status(404).json({ success: false, message: 'Section not found.' });
    return res.json({ success: true, data: config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/site/config/:section — Admin Only
siteRouter.put('/config/:section', protect, isAdmin, async (req, res) => {
  try {
    const config = await SiteConfig.findOneAndUpdate(
      { section: req.params.section },
      { data: req.body.data, updatedBy: req.user._id },
      { new: true, upsert: true }
    );
    return res.json({ success: true, config, data: config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/site/adsense — Admin Only (saves slot settings in the adsense_slots section)
siteRouter.put('/adsense', protect, isAdmin, async (req, res) => {
  try {
    const { slot, code, active } = req.body;
    if (!slot) return res.status(400).json({ success: false, message: 'Slot name is required.' });

    let config = await SiteConfig.findOne({ section: 'adsense_slots' });
    if (!config) {
      config = new SiteConfig({ section: 'adsense_slots', data: {} });
    }
    // Update specific slot
    if (!config.data) config.data = {};
    config.data[slot] = { code, active };
    config.markModified('data');
    await config.save();

    return res.json({ success: true, message: 'AdSense slot saved successfully.', data: config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/site/news-feed — Public (fetches scraped biotechnology news)
siteRouter.get('/news-feed', async (req, res) => {
  try {
    const { category, limit } = req.query;
    const filter = {};
    if (category) {
      filter.category = category;
    }
    
    const maxLimit = parseInt(limit, 10) || 50;
    const news = await ExternalNews.find(filter)
      .sort({ publishedAt: -1 })
      .limit(maxLimit);
      
    return res.json({ success: true, data: news });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

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

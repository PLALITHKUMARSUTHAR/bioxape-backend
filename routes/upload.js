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
router.post('/docx', uploadDocx.single('docx'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    return res.json({
      success:   true,
      url:       req.file.path,
      fileUrl:   req.file.path,
      publicId:  req.file.filename,
      fileName:  req.file.originalname,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/upload/cover ───────────────────────────────────
router.post('/cover', uploadCover.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    return res.json({
      success:  true,
      url:      req.file.path,
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
      url:      req.file.path,
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

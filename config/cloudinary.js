// ================================================================
//  BioXape — Cloudinary Configuration
//  FILE: config/cloudinary.js
// ================================================================

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Storage for post DOCX files ---
const docxStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'bioxape/posts/docx',
    resource_type: 'raw',
    public_id:     `post_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`,
  }),
});

// --- Storage for cover images ---
const coverStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'bioxape/posts/covers',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 1200, height: 630, crop: 'fill', quality: 'auto' }],
  },
});

// --- Storage for profile photos ---
const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'bioxape/users/photos',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

// --- Storage for store / course files ---
const assetStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'bioxape/store',
    resource_type: 'raw',
  }),
});

// Multer upload handlers
const uploadDocx   = multer({ storage: docxStorage,  limits: { fileSize: 20 * 1024 * 1024 } });
const uploadCover  = multer({ storage: coverStorage, limits: { fileSize: 5  * 1024 * 1024 } });
const uploadPhoto  = multer({ storage: photoStorage, limits: { fileSize: 3  * 1024 * 1024 } });
const uploadAsset  = multer({ storage: assetStorage, limits: { fileSize: 50 * 1024 * 1024 } });

module.exports = { cloudinary, uploadDocx, uploadCover, uploadPhoto, uploadAsset };

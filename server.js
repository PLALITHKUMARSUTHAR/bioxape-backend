require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');

// ── Connect MongoDB ──────────────────────────────────────────
connectDB();

const app = express();

// ── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));

// Rate limiting — 2000 requests per 15 minutes per IP (relaxed for active developer testing and multi-dashboard polling)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  'https://dashboard.bioxape.com',
  'https://www.bioxape.com',
  'https://bioxape.com',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin || 
      origin === 'null' || 
      origin.startsWith('http://localhost') || 
      origin.startsWith('http://127.0.0.1') || 
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── Body Parsers ─────────────────────────────────────────────
// Raw body for Razorpay webhook signature verification
app.use('/api/subscribe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/posts',     require('./routes/posts'));
app.use('/api/site',      require('./routes/site'));
app.use('/api/notify',    require('./routes/notify'));
app.use('/api/upload',    require('./routes/upload'));
app.use('/api/subscribe', require('./routes/subscribe'));
app.use('/api/store',     require('./routes/store'));

// ── Health Check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BioXApe API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'healthy', uptime: process.uptime() });
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ── Seed default site config on first boot ───────────────────
const SiteConfig = require('./models/SiteConfig');
const Category = require('./models/Category');
const Post = require('./models/Post');
const defaultSiteData = require('./utils/defaultSiteData');

const seedDefaults = async () => {
  try {
    console.log('🌱 Checking site configuration sections...');
    for (const [section, data] of Object.entries(defaultSiteData)) {
      if (section === 'category_nav' || section === 'research_spotlight') {
        console.log(`🌱 Updating/Seeding section: ${section}...`);
        await SiteConfig.findOneAndUpdate({ section }, { data }, { upsert: true });
      } else {
        const exists = await SiteConfig.findOne({ section });
        if (!exists) {
          console.log(`🌱 Seeding missing section: ${section}...`);
          await SiteConfig.create({ section, data });
        }
      }
    }
    
    console.log('🌱 Syncing Category collection...');
    const catNavItems = defaultSiteData.category_nav.items;
    await Category.deleteMany({});
    for (const item of catNavItems) {
      await Category.create({
        displayName: item.label,
        bloggerLabel: item.bloggerLabel,
        slug: item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        order: item.order,
        active: true
      });
    }
    console.log('✅ Category collection synced successfully');

    console.log('🌱 Migrating existing posts categories...');
    const oldBiopharma = [
      "Biopharmaceuticals & Drug Discovery",
      "Biopharmaceuticals and Drug Discovery",
      "biopharmaceuticals & drug discovery",
      "biopharmaceuticals and drug discovery"
    ];
    const oldSynbio = [
      "Synthetic Biology & Protein Engineering",
      "Synthetic Biology and Protein Engineering",
      "synthetic biology & protein engineering",
      "synthetic biology and protein engineering"
    ];
    const oldClinicalNews = [
      "Clinical Trials & Industry News",
      "Clinical Trials and Industry News",
      "clinical trials & industry news",
      "clinical trials and industry news"
    ];

    const upPrimaryBiopharma = await Post.updateMany(
      { category: { $in: oldBiopharma } },
      { category: "Biopharmaceuticals" }
    );
    const upPrimarySynbio = await Post.updateMany(
      { category: { $in: oldSynbio } },
      { category: "Synthetic Biology" }
    );

    const upAllBiopharma = await Post.updateMany(
      { allCategories: { $in: oldBiopharma } },
      { $set: { "allCategories.$[elem]": "Biopharmaceuticals" } },
      { arrayFilters: [{ "elem": { $in: oldBiopharma } }] }
    );
    const upAllSynbio = await Post.updateMany(
      { allCategories: { $in: oldSynbio } },
      { $set: { "allCategories.$[elem]": "Synthetic Biology" } },
      { arrayFilters: [{ "elem": { $in: oldSynbio } }] }
    );

    const postsToMigrate = await Post.find({
      $or: [
        { category: { $in: oldClinicalNews } },
        { allCategories: { $in: oldClinicalNews } }
      ]
    });
    
    let migratedClinicalNewsCount = 0;
    for (const post of postsToMigrate) {
      let isClinical = false;
      const text = ((post.title || "") + " " + (post.excerpt || "")).toLowerCase();
      if (text.includes("trial") || text.includes("clinical") || text.includes("fda") || text.includes("patient") || text.includes("phase")) {
        isClinical = true;
      }
      const newCat = isClinical ? "Clinical Trials" : "Industry News";
      
      if (oldClinicalNews.includes(post.category)) {
        post.category = newCat;
      }
      post.allCategories = post.allCategories.map(cat => 
        oldClinicalNews.includes(cat) ? newCat : cat
      );
      post.markModified('allCategories');
      await post.save();
      migratedClinicalNewsCount++;
    }

    console.log(`✅ Category migrations complete: Primary (${upPrimaryBiopharma.modifiedCount} biopharma, ${upPrimarySynbio.modifiedCount} synbio), allCategories (${upAllBiopharma.modifiedCount} biopharma, ${upAllSynbio.modifiedCount} synbio), Clinical/News split (${migratedClinicalNewsCount} posts)`);
    console.log('✅ Site config checks complete');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};
seedDefaults();

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 BioXApe API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}`);
});

module.exports = app;

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
const defaultSiteData = require('./utils/defaultSiteData');

const seedDefaults = async () => {
  try {
    const count = await SiteConfig.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding default site configuration...');
      for (const [section, data] of Object.entries(defaultSiteData)) {
        await SiteConfig.create({ section, data });
      }
      console.log('✅ Default site config seeded successfully');
    }
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

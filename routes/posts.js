// ================================================================
//  BioXape — Posts Routes
//  FILE: routes/posts.js
//  GET    /api/posts                — list posts (filtered by role)
//  GET    /api/posts/:id            — get single post
//  POST   /api/posts                — create draft (author)
//  PUT    /api/posts/:id            — update draft (author)
//  POST   /api/posts/:id/submit     — submit to editor (author)
//  PUT    /api/posts/:id/review     — editor reviews (approve/changes)
//  PUT    /api/posts/:id/decision   — admin approve/reject + publish
//  PUT    /api/posts/:id/feature    — mark as featured/hero (admin)
//  DELETE /api/posts/:id            — delete draft (author/admin)
//  GET    /api/posts/public/feed    — public post feed for blog
// ================================================================

const express  = require('express');
const router   = express.Router();
const Post     = require('../models/Post');
const User     = require('../models/User');
const { protect, isAdmin, isEditor, isAuthor } = require('../middleware/authMiddleware');
const { Notification, Category, SiteConfig } = require('../models/index');
const { sendEmail }    = require('../utils/emailSender');
const { sendWhatsApp } = require('../utils/whatsappSender');

// ── Helper: send all 3 notification types ────────────────────
async function notifyUser(userId, payload) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // In-app notification
    if (user.notifPrefs.inApp) {
      await Notification.create({ toUserId: userId, ...payload });
    }

    // Email
    if (user.notifPrefs.email && user.email) {
      await sendEmail({
        to:      user.email,
        subject: `BioXApe — ${payload.message}`,
        html:    `<p>Hi ${user.name},</p><p>${payload.message}</p>${payload.postTitle ? `<p><strong>Post:</strong> ${payload.postTitle}</p>` : ''}<p><a href="${process.env.FRONTEND_URL}">Open Dashboard</a></p>`
      });
    }

    // WhatsApp
    if (user.notifPrefs.whatsapp && user.phone) {
      await sendWhatsApp({
        phone:   user.phone,
        message: `BioXApe: ${payload.message}${payload.postTitle ? ' | Post: ' + payload.postTitle : ''}`
      });
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

const CATEGORY_MAP = {
  "Genomics & Gene Editing": [
    "genomics & gene editing", "genomics", "gene editing", "crispr", "sequencing", 
    "dna", "rna", "crispr-cas9", "genetic engineering", "base editing", "prime editing", "base-editing"
  ],
  "Biopharmaceuticals": [
    "biopharmaceuticals & drug discovery", "biopharmaceuticals", "drug discovery", 
    "biopharma", "vaccines", "therapeutics", "car-t", "monoclonal antibodies", "pharmacology", "medicine"
  ],
  "Bioinformatics": [
    "bioinformatics", "computational biology", "data analysis", "genomics data", 
    "biostats", "sequence alignment", "databases", "molecular modeling", "python biology"
  ],
  "Synthetic Biology": [
    "synthetic biology & protein engineering", "synthetic biology", "protein engineering", 
    "enzyme design", "artificial cells", "genetic circuits", "metabolic engineering", "alphafold", "de novo design"
  ],
  "Industrial Biotechnology": [
    "industrial biotechnology", "industrial biotech", "biofuels", "fermentation", 
    "bioplastics", "bioreactors", "enzymes", "bioprocessing", "industrial enzymes"
  ],
  "Agricultural Biotechnology": [
    "agricultural biotechnology", "agricultural biotech", "agritech", "gm crops", 
    "plant genetics", "pest resistance", "crop yield", "crispr plants", "biofertilizers"
  ],
  "Clinical Trials": [
    "clinical trials", "clinical trial", "fda approval", "fda", "clinical phases", 
    "phase i", "phase ii", "phase iii", "therapeutics trials", "approvals"
  ],
  "Industry News": [
    "industry news", "biotech business", "market trends", "funding", "patents", 
    "biotech policy", "regulatory", "acquisition", "venture capital", "startup", "ma"
  ]
};

function resolveCategoryQuery(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  for (const [category, synonyms] of Object.entries(CATEGORY_MAP)) {
    if (synonyms.some(syn => q.includes(syn) || syn.includes(q))) {
      return category;
    }
  }
  return null;
}

// ── GET /api/posts/public/feed ────────────────────────────────
// Public — no auth — used by Blogger template to fetch posts
router.get('/public/feed', async (req, res) => {
  try {
    const { category, search, q, limit = 10, page = 1 } = req.query;
    const filter = { status: { $in: ['published', 'approved'] } };
    
    const searchQuery = (search || q || '').trim();

    if (searchQuery) {
      // Resolve alternative words to category first
      const resolvedCategory = resolveCategoryQuery(searchQuery);
      if (resolvedCategory) {
        // Find by category terms
        const catDoc = await Category.findOne({ displayName: resolvedCategory });
        const categoryTerms = [resolvedCategory];
        if (catDoc) {
          if (catDoc.displayName) categoryTerms.push(catDoc.displayName);
          if (catDoc.bloggerLabel) categoryTerms.push(catDoc.bloggerLabel);
        }
        filter.$or = [
          { category: { $in: categoryTerms } },
          { allCategories: { $in: categoryTerms } }
        ];
      } else {
        // Normal text query search across title, excerpt, and tags
        filter.$or = [
          { title: { $regex: searchQuery, $options: 'i' } },
          { excerpt: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } }
        ];
      }
    } else if (category) {
      // Resolve category to support mappings (e.g. bloggerLabel "CRISPR" <-> displayName "CRISPR & Gene Editing")
      const catDoc = await Category.findOne({
        $or: [
          { bloggerLabel: category },
          { displayName: category },
          { slug: category }
        ]
      });

      let matchedDisplayName = null;
      const navConfig = await SiteConfig.findOne({ section: 'category_nav' });
      if (navConfig && navConfig.data && navConfig.data.items) {
        const item = navConfig.data.items.find(i => i.bloggerLabel === category || i.label === category);
        if (item) matchedDisplayName = item.label;
      }

      const categoryTerms = [category];
      if (catDoc) {
        if (catDoc.displayName) categoryTerms.push(catDoc.displayName);
        if (catDoc.bloggerLabel) categoryTerms.push(catDoc.bloggerLabel);
      }
      if (matchedDisplayName) {
        categoryTerms.push(matchedDisplayName);
      }

      filter.$or = [
        { category: { $in: categoryTerms } },
        { allCategories: { $in: categoryTerms } }
      ];
    }

    const posts = await Post.find(filter)
      .select('title excerpt coverImageUrl category allCategories contentType tags authorName readTimeMinutes viewCount publishedAt bloggerPostUrl isFeatured isTrending')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Post.countDocuments(filter);
    return res.json({ success: true, total, page: parseInt(page), posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/posts/public/:id ──────────────────────────────────
// Public — no auth — get single post by ID for standalone reader
router.get('/public/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    if (!['published', 'approved'].includes(post.status)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    
    // Increment view count
    post.viewCount = (post.viewCount || 0) + 1;
    await post.save();
    
    return res.json({ success: true, post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.use(protect);

// ── GET /api/posts/my-posts ──────────────────────────────────
// Returns the logged-in author's posts
router.get('/my-posts', isAuthor, async (req, res) => {
  try {
    const { status, limit, page = 1 } = req.query;
    const filter = { authorId: req.user._id };
    if (status) filter.status = status;

    let query = Post.find(filter).sort({ updatedAt: -1 });
    if (limit) query = query.limit(parseInt(limit));
    query = query.skip((parseInt(page) - 1) * (parseInt(limit) || 20));

    const posts = await query;
    return res.json({ success: true, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/posts/submit ────────────────────────────────────
// Creates a new post and immediately submits it for review
router.post('/submit', isAuthor, async (req, res) => {
  try {
    const { title, excerpt, category, allCategories, contentType, tags, bodyHtml, docxFileUrl, docxPublicId, coverImageUrl, coverPublicId, editorNote } = req.body;

    if (!title || !excerpt || !category) {
      return res.status(400).json({ success: false, message: 'Title, excerpt and category are required.' });
    }
    if (!docxFileUrl) {
      return res.status(400).json({ success: false, message: 'Please upload your Word document before submitting.' });
    }

    const author = await User.findById(req.user._id);
    const editorId = author.assignedEditorId || null;
    let editorName = '';
    if (editorId) {
      const editor = await User.findById(editorId);
      if (editor) editorName = editor.name;
    }

    const post = await Post.create({
      title, excerpt, category,
      allCategories: allCategories || [category],
      contentType:   contentType || 'article',
      tags:          tags || [],
      bodyHtml:      bodyHtml || '',
      docxFileUrl,
      docxPublicId:  docxPublicId || '',
      coverImageUrl: coverImageUrl || '',
      coverPublicId: coverPublicId || '',
      authorId:      req.user._id,
      authorName:    req.user.name,
      editorId,
      editorName,
      status:        editorId ? 'submitted' : 'admin_review',
      submittedAt:   new Date(),
      editorNote:    editorNote || '',
      revisionHistory: [{
        status: 'submitted', comment: editorNote || 'Submitted for review.',
        byId: req.user._id, byName: req.user.name, byRole: 'author'
      }]
    });

    // Notify appropriate reviewer
    if (editorId) {
      await notifyUser(editorId, {
        fromUserId: req.user._id,
        fromName:   req.user.name,
        type:       'post_submitted',
        postId:     post._id,
        postTitle:  post.title,
        message:    `${req.user.name} submitted a post for your review: "${post.title}"`,
      });
    } else {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        await notifyUser(admin._id, {
          fromUserId: req.user._id,
          fromName:   req.user.name,
          type:       'post_submitted',
          postId:     post._id,
          postTitle:  post.title,
          message:    `${req.user.name} submitted a post (no editor assigned): "${post.title}"`,
        });
      }
    }

    return res.status(201).json({ success: true, post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/posts/editor-queue ──────────────────────────────
// Returns posts assigned to the editor (or all if admin)
router.get('/editor-queue', isEditor, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') {
      filter.editorId = req.user._id;
    }
    const posts = await Post.find(filter)
      .populate('authorId', 'role')
      .sort({ updatedAt: -1 });

    // Sort in-memory: editor posts first, then by updatedAt desc
    const sorted = [...posts].sort((a, b) => {
      const aRole = (a.authorId && a.authorId.role === 'editor') ? 1 : 0;
      const bRole = (b.authorId && b.authorId.role === 'editor') ? 1 : 0;
      if (aRole !== bRole) return bRole - aRole;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return res.json({ success: true, data: sorted });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/editor-review ──────────────────────────
// Editor decides: approve (sends to admin), changes_needed, or rejected
router.put('/:id/editor-review', isEditor, async (req, res) => {
  try {
    const { status, editorComment } = req.body;
    if (!['admin_review', 'changes_needed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status for editor review.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (req.user.role !== 'admin') {
      const isAssigned = post.editorId && post.editorId.toString() === req.user._id.toString();
      if (!isAssigned) return res.status(403).json({ success: false, message: 'This post is not assigned to you.' });
    }

    post.status           = status;
    post.editorComment    = editorComment || '';
    post.editorReviewedAt = new Date();

    post.revisionHistory.push({
      status,
      comment: editorComment || `Reviewed by editor: ${status}`,
      byId: req.user._id,
      byName: req.user.name,
      byRole: req.user.role
    });

    await post.save();

    // Send notifications
    if (status === 'admin_review') {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        await notifyUser(admin._id, {
          fromUserId: req.user._id, fromName: req.user.name,
          type: 'editor_approved', postId: post._id, postTitle: post.title,
          message: `Editor ${req.user.name} approved "${post.title}". Ready for your review.`,
        });
      }
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'editor_approved', postId: post._id, postTitle: post.title,
        message: `Your post "${post.title}" was approved by the editor and sent to admin.`,
      });
    } else if (status === 'changes_needed') {
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'changes_requested', postId: post._id, postTitle: post.title,
        message: `Changes requested for "${post.title}": ${editorComment || 'See editor comments.'}`,
      });
    } else if (status === 'rejected') {
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'admin_rejected', postId: post._id, postTitle: post.title,
        message: `Your post "${post.title}" was rejected by the editor. Reason: ${editorComment || 'See comments.'}`,
      });
    }

    return res.json({ success: true, message: `Post reviewed successfully.`, post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/posts/admin-queue ────────────────────────────────
// Returns all posts for the admin review queue and dashboard stats
router.get('/admin-queue', isAdmin, async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate('authorId', 'role')
      .sort({ updatedAt: -1 });

    // Sort in-memory: editor posts first, then by updatedAt desc
    const sorted = [...posts].sort((a, b) => {
      const aRole = (a.authorId && a.authorId.role === 'editor') ? 1 : 0;
      const bRole = (b.authorId && b.authorId.role === 'editor') ? 1 : 0;
      if (aRole !== bRole) return bRole - aRole;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return res.json({ success: true, data: sorted });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/posts/all ────────────────────────────────────────
// Returns all posts with optional status filter
router.get('/all', isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const posts = await Post.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/admin-approve ──────────────────────────
// Admin approves and publishes a post to Blogger
router.put('/:id/admin-approve', isAdmin, async (req, res) => {
  try {
    const { allCategories, adminComment } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.adminComment    = adminComment || '';
    post.adminReviewedAt = new Date();
    post.status          = 'approved';
    post.publishedAt     = new Date();

    if (allCategories) {
      post.allCategories = allCategories;
      if (allCategories.length > 0) post.category = allCategories[0];
    }

    post.revisionHistory.push({
      status: 'approved', comment: adminComment || 'Approved by admin.',
      byId: req.user._id, byName: req.user.name, byRole: 'admin'
    });

    // Native Local Publishing (Bypassing Blogger completely)
    post.bloggerPostId  = `local-${post._id}`;
    post.bloggerPostUrl = `/post.html?id=${post._id}`;
    post.status         = 'published';
    post.revisionHistory.push({
      status: 'published', comment: 'Published directly to local standalone site.',
      byId: req.user._id, byName: req.user.name, byRole: 'admin'
    });

    // Update author stats
    await User.findByIdAndUpdate(post.authorId, { $inc: { postsPublished: 1 } });

    await post.save();

    // Notify author
    await notifyUser(post.authorId, {
      fromUserId: req.user._id, fromName: req.user.name,
      type: 'post_published', postId: post._id, postTitle: post.title,
      message: `🎉 Your post "${post.title}" has been approved and published on BioXApe!${post.bloggerPostUrl ? ' View it at: ' + post.bloggerPostUrl : ''}`,
    });

    // Notify editor
    if (post.editorId) {
      await notifyUser(post.editorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'admin_approved', postId: post._id, postTitle: post.title,
        message: `Admin published "${post.title}" — great review work!`,
      });
    }

    return res.json({ success: true, message: 'Post approved and published.', post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/admin-reject ───────────────────────────
// Admin rejects the post with an explanation
router.put('/:id/admin-reject', isAdmin, async (req, res) => {
  try {
    const { adminComment } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.status          = 'rejected';
    post.adminComment    = adminComment || '';
    post.adminReviewedAt = new Date();

    post.revisionHistory.push({
      status: 'rejected', comment: adminComment || 'Rejected by admin.',
      byId: req.user._id, byName: req.user.name, byRole: 'admin'
    });

    await post.save();

    // Notify author
    await notifyUser(post.authorId, {
      fromUserId: req.user._id, fromName: req.user.name,
      type: 'admin_rejected', postId: post._id, postTitle: post.title,
      message: `Your post "${post.title}" was not approved by admin. Reason: ${adminComment || 'See comments.'}`,
    });

    return res.json({ success: true, message: 'Post rejected.', post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/admin-request-changes ───────────────────
// Admin requests changes from the author
router.put('/:id/admin-request-changes', isAdmin, async (req, res) => {
  try {
    const { adminComment } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.status          = 'changes_needed';
    post.adminComment    = adminComment || '';
    post.adminReviewedAt = new Date();

    post.revisionHistory.push({
      status: 'changes_needed', comment: adminComment || 'Changes requested by admin.',
      byId: req.user._id, byName: req.user.name, byRole: 'admin'
    });

    await post.save();

    // Notify author
    await notifyUser(post.authorId, {
      fromUserId: req.user._id, fromName: req.user.name,
      type: 'changes_requested', postId: post._id, postTitle: post.title,
      message: `Changes requested by admin for "${post.title}": ${adminComment || 'See admin comments.'}`,
    });

    // Notify editor (if assigned)
    if (post.editorId) {
      await notifyUser(post.editorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'general', postId: post._id, postTitle: post.title,
        message: `Admin requested changes for "${post.title}".`,
      });
    }

    return res.json({ success: true, message: 'Changes requested successfully.', post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


// ── GET /api/posts — list posts filtered by role ──────────────
router.get('/', async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    let filter = {};

    if (req.user.role === 'author') {
      filter.authorId = req.user._id;
    } else if (req.user.role === 'editor') {
      filter.editorId = req.user._id;
    }
    // admin sees all

    if (status)   filter.status   = status;
    if (category) filter.category = category;

    const posts = await Post.find(filter)
      .select('-bodyHtml')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Post.countDocuments(filter);
    return res.json({ success: true, total, posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/posts/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    // Access control
    const isOwner   = post.authorId.toString() === req.user._id.toString();
    const isAssigned = post.editorId && post.editorId.toString() === req.user._id.toString();
    if (req.user.role === 'author' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'editor' && !isOwner && !isAssigned) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/posts — create draft ───────────────────────────
router.post('/', isAuthor, async (req, res) => {
  try {
    const { title, excerpt, category, allCategories, contentType, tags, bodyHtml, docxFileUrl, docxPublicId, coverImageUrl, coverPublicId } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required to save draft.' });
    }

    // Auto-assign editor
    const author = await User.findById(req.user._id);
    const editorId = author.assignedEditorId || null;
    let editorName = '';
    if (editorId) {
      const editor = await User.findById(editorId);
      if (editor) editorName = editor.name;
    }

    const post = await Post.create({
      title, excerpt, category,
      allCategories: allCategories || [category],
      contentType:   contentType || 'article',
      tags:          tags || [],
      bodyHtml:      bodyHtml || '',
      docxFileUrl:   docxFileUrl || '',
      docxPublicId:  docxPublicId || '',
      coverImageUrl: coverImageUrl || '',
      coverPublicId: coverPublicId || '',
      authorId:  req.user._id,
      authorName: req.user.name,
      editorId,
      editorName,
      status: 'draft',
    });

    return res.status(201).json({ success: true, post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id — update draft ────────────────────────
router.put('/:id', isAuthor, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!['draft', 'changes_needed'].includes(post.status) && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Post cannot be edited in its current state.' });
    }

    const allowed = ['title', 'excerpt', 'bodyHtml', 'docxFileUrl', 'docxPublicId', 'coverImageUrl', 'coverPublicId', 'category', 'allCategories', 'contentType', 'tags'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) post[field] = req.body[field];
    });

    await post.save();
    return res.json({ success: true, post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/posts/:id/submit — author submits to editor ────
router.post('/:id/submit', isAuthor, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!['draft', 'changes_needed'].includes(post.status)) {
      return res.status(400).json({ success: false, message: 'Only drafts or posts needing changes can be submitted.' });
    }

    // Update draft with any new modifications sent in the submit body (e.g. newly uploaded docx, category, title, excerpt)
    const allowed = ['title', 'excerpt', 'bodyHtml', 'docxFileUrl', 'docxPublicId', 'coverImageUrl', 'coverPublicId', 'category', 'allCategories', 'contentType', 'tags', 'editorNote'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) post[field] = req.body[field];
    });
    await post.save();

    if (!post.title || !post.excerpt || !post.category) {
      return res.status(400).json({ success: false, message: 'Please fill in Title, Excerpt, and Category before submitting.' });
    }

    if (!post.docxFileUrl) {
      return res.status(400).json({ success: false, message: 'Please upload your Word document before submitting.' });
    }

    post.status      = 'submitted';
    post.submittedAt = new Date();
    post.revisionHistory.push({
      status: 'submitted', comment: 'Submitted for editor review.',
      byId: req.user._id, byName: req.user.name, byRole: 'author'
    });
    await post.save();

    // Notify editor
    if (post.editorId) {
      await notifyUser(post.editorId, {
        fromUserId: req.user._id,
        fromName:   req.user.name,
        type:       'post_submitted',
        postId:     post._id,
        postTitle:  post.title,
        message:    `${req.user.name} submitted a post for your review: "${post.title}"`,
      });
    } else {
      // No editor assigned — go directly to admin
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        await notifyUser(admin._id, {
          fromUserId: req.user._id,
          fromName:   req.user.name,
          type:       'post_submitted',
          postId:     post._id,
          postTitle:  post.title,
          message:    `${req.user.name} submitted a post (no editor assigned): "${post.title}"`,
        });
      }
      post.status = 'admin_review';
      await post.save();
    }

    return res.json({ success: true, message: 'Post submitted for review.', post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/review — editor decision ──────────────
router.put('/:id/review', isEditor, async (req, res) => {
  try {
    const { decision, comment } = req.body;
    // decision: 'approve' | 'request_changes'

    if (!['approve', 'request_changes'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approve or request_changes.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (req.user.role !== 'admin') {
      const isAssigned = post.editorId && post.editorId.toString() === req.user._id.toString();
      if (!isAssigned) return res.status(403).json({ success: false, message: 'This post is not assigned to you.' });
    }

    post.editorComment    = comment || '';
    post.editorReviewedAt = new Date();

    if (decision === 'approve') {
      post.status = 'admin_review';
      post.revisionHistory.push({
        status: 'admin_review', comment: comment || 'Approved by editor.',
        byId: req.user._id, byName: req.user.name, byRole: 'editor'
      });

      // Notify admin
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        await notifyUser(admin._id, {
          fromUserId: req.user._id, fromName: req.user.name,
          type: 'editor_approved', postId: post._id, postTitle: post.title,
          message: `Editor ${req.user.name} approved "${post.title}". Ready for your review.`,
        });
      }

      // Notify author
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'editor_approved', postId: post._id, postTitle: post.title,
        message: `Your post "${post.title}" was approved by the editor and sent to admin.`,
      });

    } else {
      post.status = 'changes_needed';
      post.revisionHistory.push({
        status: 'changes_needed', comment: comment || '',
        byId: req.user._id, byName: req.user.name, byRole: 'editor'
      });

      // Notify author
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'changes_requested', postId: post._id, postTitle: post.title,
        message: `Changes requested for "${post.title}": ${comment || 'See editor comments.'}`,
      });
    }

    await post.save();
    return res.json({ success: true, message: `Post ${decision === 'approve' ? 'sent to admin' : 'returned to author'}.`, post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/decision — admin final decision ────────
router.put('/:id/decision', isAdmin, async (req, res) => {
  try {
    const { decision, comment, category, allCategories } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approve or reject.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    post.adminComment    = comment || '';
    post.adminReviewedAt = new Date();

    // Admin can update categories at approval time
    if (category)      post.category      = category;
    if (allCategories) post.allCategories = allCategories;

    if (decision === 'approve') {
      post.status      = 'approved';
      post.publishedAt = new Date();
      post.revisionHistory.push({
        status: 'approved', comment: comment || 'Approved by admin.',
        byId: req.user._id, byName: req.user.name, byRole: 'admin'
      });

      // Native Local Publishing (Bypassing Blogger completely)
      post.bloggerPostId  = `local-${post._id}`;
      post.bloggerPostUrl = `/post.html?id=${post._id}`;
      post.status         = 'published';
      post.revisionHistory.push({
        status: 'published', comment: 'Published directly to local standalone site.',
        byId: req.user._id, byName: req.user.name, byRole: 'admin'
      });

      // Update author stats
      await User.findByIdAndUpdate(post.authorId, { $inc: { postsPublished: 1 } });

      await post.save();

      // Notify author
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'post_published', postId: post._id, postTitle: post.title,
        message: `🎉 Your post "${post.title}" has been approved and published on BioXApe!${post.bloggerPostUrl ? ' View it at: ' + post.bloggerPostUrl : ''}`,
      });

      // Notify editor
      if (post.editorId) {
        await notifyUser(post.editorId, {
          fromUserId: req.user._id, fromName: req.user.name,
          type: 'admin_approved', postId: post._id, postTitle: post.title,
          message: `Admin published "${post.title}" — great review work!`,
        });
      }

    } else {
      // Reject
      post.status = 'rejected';
      post.revisionHistory.push({
        status: 'rejected', comment: comment || 'Rejected by admin.',
        byId: req.user._id, byName: req.user.name, byRole: 'admin'
      });
      await post.save();

      // Notify author
      await notifyUser(post.authorId, {
        fromUserId: req.user._id, fromName: req.user.name,
        type: 'admin_rejected', postId: post._id, postTitle: post.title,
        message: `Your post "${post.title}" was not approved. Reason: ${comment || 'See admin comments.'}`,
      });
    }

    return res.json({ success: true, message: `Post ${decision === 'approve' ? 'approved and published' : 'rejected'}.`, post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/posts/:id/feature — set featured / hero ────────
router.put('/:id/feature', isAdmin, async (req, res) => {
  try {
    const { isFeatured, isHeroStack, heroStackPosition, isTrending } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    if (isFeatured !== undefined) {
      // Only one post can be featured hero at a time
      if (isFeatured) await Post.updateMany({ isFeatured: true }, { isFeatured: false });
      post.isFeatured = isFeatured;
    }
    if (isHeroStack      !== undefined) post.isHeroStack       = isHeroStack;
    if (heroStackPosition !== undefined) post.heroStackPosition = heroStackPosition;
    if (isTrending       !== undefined) post.isTrending        = isTrending;

    await post.save();
    return res.json({ success: true, post, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/posts/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const isOwner = post.authorId.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!['draft', 'changes_needed', 'rejected'].includes(post.status) && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Only draft or rejected posts can be deleted.' });
    }

    const reason = req.body?.reason || req.query?.reason || '';
    if (reason && req.user.role === 'admin') {
      await notifyUser(post.authorId, {
        fromUserId: req.user._id,
        fromName:   req.user.name,
        type:       'admin_rejected',
        postId:     null,
        postTitle:  post.title,
        message:    `Your post "${post.title}" was removed by the administrator. Reason: ${reason}`,
      });
      if (post.editorId) {
        await notifyUser(post.editorId, {
          fromUserId: req.user._id,
          fromName:   req.user.name,
          type:       'general',
          postId:     null,
          postTitle:  post.title,
          message:    `The post "${post.title}" assigned to you was removed by the administrator. Reason: ${reason}`,
        });
      }
    }

    await Post.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Post deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

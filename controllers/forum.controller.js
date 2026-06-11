const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumPost = require('../models/ForumPost');
const ForumComment = require('../models/ForumComment');
const User = require('../models/User');

// Helper to build a nested comment tree
function buildTree(comments) {
  const map = {};
  const roots = [];
  comments.forEach(c => {
    map[c._id.toString()] = { ...c.toObject(), replies: [] };
  });
  comments.forEach(c => {
    if (c.parentComment) {
      const parent = map[c.parentComment.toString()];
      if (parent) {
        parent.replies.push(map[c._id.toString()]);
      } else {
        roots.push(map[c._id.toString()]);
      }
    } else {
      roots.push(map[c._id.toString()]);
    }
  });
  return roots;
}

// ── Category Controllers ──────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const categories = await ForumCategory.find().sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, slug, description, icon, color } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and slug are required' });
    }
    const category = await ForumCategory.create({ name, slug, description, icon, color });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Post Controllers ──────────────────────────────────────────

exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;
    const { category, tag, sort } = req.query;

    const matchQuery = {};

    if (category) {
      let categoryDoc;
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryDoc = await ForumCategory.findById(category);
      } else {
        categoryDoc = await ForumCategory.findOne({ slug: category });
      }
      if (categoryDoc) {
        matchQuery.category = categoryDoc._id;
      } else {
        return res.json({ success: true, data: [], total: 0, page, totalPages: 0 });
      }
    }

    if (tag) {
      matchQuery.tags = tag;
    }

    // Use aggregation to count total and sort by array size for 'top'
    const countPipeline = [{ $match: matchQuery }, { $count: 'count' }];
    const countRes = await ForumPost.aggregate(countPipeline);
    const total = countRes[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          upvotesCount: { $size: { $ifNull: ["$upvotes", []] } }
        }
      }
    ];

    if (sort === 'top') {
      pipeline.push({ $sort: { upvotesCount: -1, createdAt: -1 } });
    } else if (sort === 'comments') {
      pipeline.push({ $sort: { commentCount: -1, createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push({ $skip: skip }, { $limit: limit });

    const posts = await ForumPost.aggregate(pipeline);
    
    // Populate fields manually since aggregate doesn't do Mongoose populate
    const populatedPosts = await ForumPost.populate(posts, [
      { path: 'author', select: 'name avatar role' },
      { path: 'category', select: 'name slug color icon' }
    ]);

    res.json({
      success: true,
      data: populatedPosts,
      total,
      page,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await ForumPost.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    )
    .populate('author', 'name avatar role')
    .populate('category', 'name slug color icon');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPost = async (req, res) => {
  try {
    const { title, body, category: categoryId, tags } = req.body;
    if (!title || !body || !categoryId) {
      return res.status(400).json({ success: false, message: 'Title, body, and category are required' });
    }

    const post = await ForumPost.create({
      title,
      body,
      author: req.user._id,
      category: categoryId,
      tags: tags || []
    });

    await ForumCategory.findByIdAndUpdate(categoryId, { $inc: { postCount: 1 } });

    const populated = await post.populate([
      { path: 'author', select: 'name avatar role' },
      { path: 'category', select: 'name slug color icon' }
    ]);

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check authorization: author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this post' });
    }

    const { title, body, tags, isPinned, isLocked } = req.body;
    if (title) post.title = title;
    if (body) post.body = body;
    if (tags) post.tags = tags;

    // Admin-only fields
    if (req.user.role === 'admin') {
      if (isPinned !== undefined) post.isPinned = isPinned;
      if (isLocked !== undefined) post.isLocked = isLocked;
    }

    await post.save();

    const populated = await post.populate([
      { path: 'author', select: 'name avatar role' },
      { path: 'category', select: 'name slug color icon' }
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check authorization: author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await ForumPost.findByIdAndDelete(req.params.id);
    await ForumCategory.findByIdAndUpdate(post.category, { $inc: { postCount: -1 } });
    
    // Clean up comments for this post
    await ForumComment.deleteMany({ post: post._id });

    res.json({ success: true, message: 'Post and comments deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.votePost = async (req, res) => {
  try {
    const { type } = req.body;
    const userId = req.user._id;

    if (type !== 'up' && type !== 'down') {
      return res.status(400).json({ success: false, message: "Vote type must be 'up' or 'down'" });
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const alreadyUpvoted = post.upvotes.includes(userId);
    const alreadyDownvoted = post.downvotes.includes(userId);

    if (type === 'up') {
      alreadyUpvoted
        ? post.upvotes.pull(userId)
        : (post.upvotes.addToSet(userId), post.downvotes.pull(userId));
    } else {
      alreadyDownvoted
        ? post.downvotes.pull(userId)
        : (post.downvotes.addToSet(userId), post.upvotes.pull(userId));
    }

    await post.save();
    res.json({ success: true, upvotes: post.upvotes, downvotes: post.downvotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPostsByCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const category = await ForumCategory.findOne({ slug });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const total = await ForumPost.countDocuments({ category: category._id });
    const totalPages = Math.ceil(total / limit);

    const posts = await ForumPost.find({ category: category._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name avatar role')
      .populate('category', 'name slug color icon');

    res.json({
      success: true,
      data: posts,
      total,
      page,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Comment Controllers ───────────────────────────────────────

exports.getComments = async (req, res) => {
  try {
    const comments = await ForumComment.find({ post: req.params.id })
      .populate('author', 'name avatar role')
      .sort({ createdAt: 1 });

    const tree = buildTree(comments);
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { body, parentComment } = req.body;
    if (!body) {
      return res.status(400).json({ success: false, message: 'Comment body is required' });
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.isLocked) {
      return res.status(400).json({ success: false, message: 'This thread is locked' });
    }

    const comment = await ForumComment.create({
      post: req.params.id,
      author: req.user._id,
      body,
      parentComment: parentComment || null
    });

    await ForumPost.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } });

    const populated = await comment.populate('author', 'name avatar role');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const comment = await ForumComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { body } = req.body;
    if (!body) {
      return res.status(400).json({ success: false, message: 'Body is required' });
    }

    comment.body = body;
    await comment.save();

    const populated = await comment.populate('author', 'name avatar role');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await ForumComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await ForumComment.findByIdAndDelete(req.params.id);
    await ForumPost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } });

    // Also delete any replies recursively (or set their parentComment to null/delete them)
    // To keep it simple, we delete all child comments whose parentComment is this comment
    const deletedReplies = await ForumComment.deleteMany({ parentComment: comment._id });
    if (deletedReplies.deletedCount > 0) {
      await ForumPost.findByIdAndUpdate(comment.post, { $inc: { commentCount: -deletedReplies.deletedCount } });
    }

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.voteComment = async (req, res) => {
  try {
    const userId = req.user._id;
    const comment = await ForumComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const alreadyUpvoted = comment.upvotes.includes(userId);
    if (alreadyUpvoted) {
      comment.upvotes.pull(userId);
    } else {
      comment.upvotes.addToSet(userId);
    }

    await comment.save();
    res.json({ success: true, upvotes: comment.upvotes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.acceptComment = async (req, res) => {
  try {
    const comment = await ForumComment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const post = await ForumPost.findById(comment.post);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found for this comment' });
    }

    // Auth check: post author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the post author or admin can accept an answer' });
    }

    // Toggle accept status
    const isNowAccepted = !comment.isAcceptedAnswer;

    // Reset all other comments for this post to false
    if (isNowAccepted) {
      await ForumComment.updateMany({ post: post._id }, { $set: { isAcceptedAnswer: false } });
    }

    comment.isAcceptedAnswer = isNowAccepted;
    await comment.save();

    res.json({ success: true, data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Search & Trending Controllers ─────────────────────────────

exports.searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query parameter q is required' });
    }

    const posts = await ForumPost.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .populate('author', 'name avatar role')
    .populate('category', 'name slug color icon');

    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTrending = async (req, res) => {
  try {
    // Trending: top 5 by upvotes+views this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const posts = await ForumPost.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $addFields: {
          upvotesSize: { $size: { $ifNull: ["$upvotes", []] } }
        }
      },
      {
        $addFields: {
          popularityScore: { $add: ["$upvotesSize", "$views"] }
        }
      },
      {
        $sort: { popularityScore: -1 }
      },
      {
        $limit: 5
      }
    ]);

    const populated = await ForumPost.populate(posts, [
      { path: 'author', select: 'name avatar role' },
      { path: 'category', select: 'name slug color icon' }
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

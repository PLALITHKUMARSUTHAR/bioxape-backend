const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forum.controller');
const { protect, isAdmin } = require('../middleware/auth.middleware');

// Category Routes
router.get('/categories', forumController.getCategories);
router.post('/categories', protect, isAdmin, forumController.createCategory);

// Search & Trending Routes
router.get('/search', forumController.searchPosts);
router.get('/trending', forumController.getTrending);

// Post Routes
router.get('/posts', forumController.getPosts);
router.get('/posts/:id', forumController.getPostById);
router.post('/posts', protect, forumController.createPost);
router.put('/posts/:id', protect, forumController.updatePost);
router.delete('/posts/:id', protect, forumController.deletePost);
router.post('/posts/:id/vote', protect, forumController.votePost);
router.get('/posts/category/:slug', forumController.getPostsByCategory);

// Comment Routes
router.get('/posts/:id/comments', forumController.getComments);
router.post('/posts/:id/comments', protect, forumController.createComment);
router.put('/comments/:id', protect, forumController.updateComment);
router.delete('/comments/:id', protect, forumController.deleteComment);
router.post('/comments/:id/vote', protect, forumController.voteComment);
router.post('/comments/:id/accept', protect, forumController.acceptComment);

module.exports = router;

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');

const run = async () => {
  try {
    await connectDB();
    const posts = await ForumPost.find()
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(3)
      .populate('author', 'name role');
      
    console.log('--- DATABASE POSTS ---');
    posts.forEach((p, i) => {
      console.log(`Post ${i+1}: "${p.title}"`);
      console.log(`  ID: ${p._id}`);
      console.log(`  createdAt: ${p.createdAt} (${typeof p.createdAt})`);
      console.log(`  author: ${p.author?.name} (Role: ${p.author?.role})`);
    });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};
run();

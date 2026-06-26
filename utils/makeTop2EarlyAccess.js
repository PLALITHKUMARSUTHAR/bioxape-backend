require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();

    console.log('🔍 Fetching top 2 posts...');
    const posts = await ForumPost.find()
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(2);

    if (posts.length === 0) {
      console.log('❌ No posts found in database.');
      process.exit(0);
    }

    console.log(`Found ${posts.length} posts to update.`);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`Updating post ${i + 1}: "${post.title}"`);
      
      // Update createdAt to now
      post.createdAt = new Date();
      await post.save();

      // Find author and update role to 'editor' if not already editor or admin
      const author = await User.findById(post.author);
      if (author) {
        if (author.role !== 'admin' && author.role !== 'editor') {
          author.role = 'editor';
          await author.save();
          console.log(`   - Updated author "${author.name}" role to 'editor'`);
        }
      }
    }

    console.log('✅ Top 2 posts successfully updated to Early Access status!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating posts:', error);
    process.exit(1);
  }
};

run();

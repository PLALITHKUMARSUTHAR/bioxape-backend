require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const Post = require('../models/Post');
const User = require('../models/User');

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectDB();

    console.log('🔍 Fetching top 2 blog posts...');
    const posts = await Post.find({ status: { $in: ['published', 'approved'] } })
      .sort({ publishedAt: -1 })
      .limit(2);

    if (posts.length === 0) {
      console.log('❌ No published/approved posts found in database.');
      process.exit(0);
    }

    console.log(`Found ${posts.length} blog posts to update.`);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`Updating blog post ${i + 1}: "${post.title}"`);
      
      // Update publishedAt to now using raw MongoDB collection update
      await Post.collection.updateOne({ _id: post._id }, { $set: { publishedAt: new Date() } });

      // Find author and update role to 'editor' if not already editor or admin
      const author = await User.findById(post.authorId);
      if (author) {
        if (author.role !== 'admin' && author.role !== 'editor') {
          author.role = 'editor';
          await author.save();
          console.log(`   - Updated author "${author.name}" role to 'editor'`);
        }
      }
    }

    console.log('✅ Top 2 blog posts successfully updated to Early Access status!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating posts:', error);
    process.exit(1);
  }
};

run();

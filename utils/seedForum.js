require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const ForumCategory = require('../models/ForumCategory');

const categories = [
  { name: "General Discussion", slug: "general",       icon: "🧬", color: "#4F86C6" },
  { name: "Research & Papers",  slug: "research",      icon: "📄", color: "#5BAD6F" },
  { name: "Tools & Methods",    slug: "tools",         icon: "🔬", color: "#E88B3A" },
  { name: "Career & Education", slug: "career",        icon: "🎓", color: "#9B59B6" },
  { name: "Announcements",      slug: "announcements", icon: "📢", color: "#E74C3C" }
];

const seedForum = async () => {
  try {
    console.log('🌱 Connecting to database...');
    await connectDB();

    console.log('🌱 Seeding Forum Categories...');
    for (const cat of categories) {
      const result = await ForumCategory.findOneAndUpdate(
        { slug: cat.slug },
        { $set: cat },
        { upsert: true, new: true }
      );
      console.log(`   - Seeding/Updating: ${result.name} (${result.slug})`);
    }

    console.log('✅ Forum seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding forum:', error);
    process.exit(1);
  }
};

seedForum();

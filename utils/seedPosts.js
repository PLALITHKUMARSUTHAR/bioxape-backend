require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const ForumCategory = require('../models/ForumCategory');
const ForumPost = require('../models/ForumPost');
const ForumComment = require('../models/ForumComment');
const User = require('../models/User');

const seedPosts = async () => {
  try {
    console.log('🌱 Connecting to database...');
    await connectDB();

    // 1. Get or create the author user "dhamu1"
    let user = await User.findOne({ 
      $or: [
        { email: 'dhamu1@bioxape.com' },
        { name: 'dhamu1' }
      ] 
    });

    if (!user) {
      console.log('🌱 Creating user "dhamu1" for sample posts...');
      user = await User.create({
        name: 'dhamu1',
        email: 'dhamu1@bioxape.com',
        role: 'author',
        status: 'active',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv' // placeholder hash
      });
    } else {
      // Ensure the name is exactly dhamu1
      user.name = 'dhamu1';
      await user.save();
    }

    console.log(`🌱 Using author user: ${user.name} (${user._id})`);

    // 2. Fetch categories
    const categories = await ForumCategory.find();
    if (categories.length === 0) {
      console.log('❌ No categories found. Please run seed:forum first.');
      process.exit(1);
    }

    const generalCat = categories.find(c => c.slug === 'general') || categories[0];
    const researchCat = categories.find(c => c.slug === 'research') || categories[0];
    const toolsCat = categories.find(c => c.slug === 'tools') || categories[0];

    // 3. Clear existing posts and comments to start fresh
    await ForumPost.deleteMany({});
    await ForumComment.deleteMany({});
    
    // Reset all category post counts
    await ForumCategory.updateMany({}, { $set: { postCount: 0 } });

    console.log('🌱 Creating sample forum posts...');

    // Post 1: CRISPR Gene Editing
    const post1 = await ForumPost.create({
      title: 'The Future of CRISPR-Cas12 in Mammalian Genome Editing',
      body: `CRISPR-Cas12a (formerly Cpf1) has emerged as a powerful alternative to Cas9, offering distinct advantages such as a T-rich PAM requirement (TTTV) and a staggered cleavage pattern. 

In our latest trials, we observed higher specificity and fewer off-target mutations when targeting transcriptional enhancers in human embryonic stem cells.

What are your thoughts on the efficiency comparisons of Cas12a vs Cas9 in high-throughput screens? Do you see Cas12a becoming the dominant tool for therapeutic editings?`,
      author: user._id,
      category: researchCat._id,
      tags: ['CRISPR', 'GenomeEditing', 'Cas12a', 'Research'],
      views: 142,
      isPinned: true
    });
    await ForumCategory.findByIdAndUpdate(researchCat._id, { $inc: { postCount: 1 } });

    // Post 2: Bioinformatics tools
    const post2 = await ForumPost.create({
      title: 'Comparing AlphaFold 3 vs ESM3 for De Novo Protein Design',
      body: `With the recent publications and open-access releases of AlphaFold 3 and Evolutionary Scale Modeling (ESM3), de novo protein design is entering a new paradigm. 

AlphaFold 3 offers superior coordination dynamics for nucleic acids, ions, and chemical modifications. On the other hand, ESM3's generative capability allows for prompt-based generation of proteins matching complex structural prompts.

Which tool has your lab integrated into your drug discovery pipeline? Are there specific edge cases where ESM3 underperforms compared to traditional Rosetta-based designs?`,
      author: user._id,
      category: toolsCat._id,
      tags: ['ProteinDesign', 'AlphaFold', 'ESM3', 'Bioinformatics'],
      views: 89
    });
    await ForumCategory.findByIdAndUpdate(toolsCat._id, { $inc: { postCount: 1 } });

    // Post 3: General discussion
    const post3 = await ForumPost.create({
      title: 'Welcome to the BioXApe Biotechnology Forum!',
      body: `Welcome everyone to the official BioXApe community forum! 🧬

This space is created for scientists, bioinformaticians, students, and biotechnology enthusiasts to connect, collaborate, and share ideas.

Feel free to start threads on:
* CRISPR & Gene Editing
* Bioinformatics & AI in Drug Discovery
* Clinical trials updates
* Lab protocols and methodology troubleshooting

Please introduce yourself below and tell us about your research area!`,
      author: user._id,
      category: generalCat._id,
      tags: ['Welcome', 'Announcements', 'Community'],
      views: 250,
      isPinned: true
    });
    await ForumCategory.findByIdAndUpdate(generalCat._id, { $inc: { postCount: 1 } });

    // 4. Add some sample comments
    console.log('🌱 Adding sample comments...');
    
    // Comment on welcome post
    await ForumComment.create({
      post: post3._id,
      author: user._id,
      body: 'I will start! I am Sarah, working on synthetic biology and metabolic engineering. Really excited to build this community together!'
    });
    await ForumPost.findByIdAndUpdate(post3._id, { $inc: { commentCount: 1 } });

    // Comment on AlphaFold post
    await ForumComment.create({
      post: post2._id,
      author: user._id,
      body: 'In our experience, ESM3 is incredibly fast for generating initial backbones, but we still run Rosetta energy minimization steps afterwards to verify stability.',
      isAcceptedAnswer: true
    });
    await ForumPost.findByIdAndUpdate(post2._id, { $inc: { commentCount: 1 } });

    console.log('✅ Sample posts and comments seeded successfully under author "dhamu1"!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding posts:', error);
    process.exit(1);
  }
};

seedPosts();

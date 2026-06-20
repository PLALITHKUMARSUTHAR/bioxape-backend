const Parser = require('rss-parser');
const ExternalNews = require('../models/ExternalNews');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 15000
});

const SENSITIVE_FILTER_REGEX = /\b(sex|sexual|sexuality|lgbtq?|gay|lesbian|bisexual|queer|transgender|pride|homosexual|homosexuality|homophobia|transphobia|gender-?identity)\b/i;

function shouldFilterArticle(title, excerpt = '') {
  const text = `${title} ${excerpt}`;
  return SENSITIVE_FILTER_REGEX.test(text);
}

const FEEDS = [
  { source: 'BioPharma Dive', url: 'https://www.biopharmadive.com/feeds/news/' },
  { source: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top/science.xml' },
  { source: 'GEN', url: 'https://www.genengnews.com/feed/' },
  { source: 'Endpoints News', url: 'https://endpts.com/feed/' }
];

function classifyNews(title, excerpt = '') {
  const text = `${title} ${excerpt}`.toLowerCase();

  // 1. breaking
  const breakingKeywords = [
    'breaking', 'urgent', 'alert', 'approves', 'approval', 'clearance',
    'rejects', 'rejection', 'halts', 'suspends', 'suspension',
    'recalls', 'recall', 'acquires', 'merger', 'acquisition', 'buyout',
    'breakthrough', 'fast track', 'fda'
  ];
  if (breakingKeywords.some(keyword => text.includes(keyword))) {
    return 'breaking';
  }

  // 2. funding
  const fundingKeywords = [
    'funding', 'series a', 'series b', 'series c', 'series d', 'raised',
    'raises', 'seed round', 'ipo', 'public offering', 'million', 'billion',
    'financing', 'vc ', 'venture capital', 'investment', 'invests', 'grant',
    'financial', 'funds', 'fundraising'
  ];
  if (fundingKeywords.some(keyword => text.includes(keyword))) {
    return 'funding';
  }

  // 3. event
  const eventKeywords = [
    'event', 'conference', 'summit', 'webinar', 'symposium', 'exhibition',
    'forum', 'meeting', 'showcase', 'congress', 'annual meeting', 'presentation',
    'presents at', 'presenting at', 'panel', 'keynote', 'workshop'
  ];
  if (eventKeywords.some(keyword => text.includes(keyword))) {
    return 'event';
  }

  // 4. research
  const researchKeywords = [
    'research', 'science', 'study', 'trials', 'trial', 'phase 1', 'phase 2',
    'phase 3', 'phase i', 'phase ii', 'phase iii', 'preclinical', 'clinical data',
    'discovery', 'nature', 'cell', 'journal', 'scientists', 'gene editing',
    'crispr', 'dna', 'rna', 'therapeutic', 'mechanism', 'efficacy', 'academic', 'university'
  ];
  if (researchKeywords.some(keyword => text.includes(keyword))) {
    return 'research';
  }

  // 5. industry (default)
  return 'industry';
}

async function runScraper() {
  console.log('⏰ Starting news scraper at:', new Date().toISOString());
  
  // Cleanup any existing database articles matching sensitive keywords
  try {
    const deleteRes = await ExternalNews.deleteMany({
      title: { $regex: SENSITIVE_FILTER_REGEX }
    });
    if (deleteRes.deletedCount > 0) {
      console.log(`🧹 Deleted ${deleteRes.deletedCount} existing database articles containing sensitive terms.`);
    }
  } catch (cleanError) {
    console.error('❌ Error cleaning existing sensitive articles:', cleanError.message);
  }

  let newArticlesCount = 0;

  for (const feed of FEEDS) {
    try {
      console.log(`📡 Fetching feed: ${feed.source} (${feed.url})`);
      const feedData = await parser.parseURL(feed.url);
      console.log(`📦 Got ${feedData.items.length} items from ${feed.source}`);

      for (const item of feedData.items) {
        if (!item.title || !item.link) continue;

        if (shouldFilterArticle(item.title, item.contentSnippet || item.content || '')) {
          console.log(`🚫 Filtered out article matching sensitive keywords: "${item.title}"`);
          continue;
        }

        const category = classifyNews(item.title, item.contentSnippet || item.content || '');
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        // Perform upsert based on the link (we use link as a unique identifier)
        const res = await ExternalNews.findOneAndUpdate(
          { link: item.link.trim() },
          {
            $setOnInsert: {
              title: item.title.trim(),
              link: item.link.trim(),
              source: feed.source,
              publishedAt,
              category
            }
          },
          { upsert: true, new: false } // new: false lets us check if it was inserted (res will be null) or updated
        );

        if (!res) {
          newArticlesCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching/parsing feed ${feed.source}:`, error.message);
    }
  }

  console.log(`✅ News scraper finished. Added ${newArticlesCount} new articles.`);

  // Prune database: keep only the latest 300 articles overall to prevent DB bloat
  try {
    const keepLimit = 300;
    const count = await ExternalNews.countDocuments({});
    if (count > keepLimit) {
      const skipCount = keepLimit;
      const oldestToKeep = await ExternalNews.find({})
        .sort({ publishedAt: -1 })
        .skip(skipCount)
        .limit(1);

      if (oldestToKeep.length > 0) {
        const thresholdDate = oldestToKeep[0].publishedAt;
        const deleteResult = await ExternalNews.deleteMany({ publishedAt: { $lt: thresholdDate } });
        console.log(`🧹 Pruned ${deleteResult.deletedCount} old news articles.`);
      }
    }
  } catch (pruneError) {
    console.error('❌ Error pruning external news database:', pruneError.message);
  }
}

module.exports = { runScraper, FEEDS };

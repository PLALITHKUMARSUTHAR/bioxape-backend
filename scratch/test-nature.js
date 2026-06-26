const Parser = require('rss-parser');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  },
  timeout: 10000
});

async function test() {
  try {
    console.log("Fetching Nature Biotechnology feed...");
    const feed = await parser.parseURL('https://www.nature.com/nbt.rss');
    console.log("Success! Got items:", feed.items.length);
    console.log("First item:", feed.items[0].title, feed.items[0].link);
  } catch (err) {
    console.error("Failed to parse Nature Biotech feed:", err.message);
  }
}

test();

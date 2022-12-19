const Parser = require('rss-parser');
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    }
});

async function parseRSSFeed(url) {
    const feed = await parser.parseURL(url);
    return feed.items;
}

async function parseFullRSSFeed(url) {
    const feed = await parser.parseURL(url);
    return feed.items;
}

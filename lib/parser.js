const Parser = require('rss-parser');
const logger = require("./logger");
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    }
});

async function parseRSSFeed(url) {
    try {
        const feed = await parser.parseURL(url);
        return feed.items;
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        return [];
    }

}

async function parseFullRSSFeed(url) {
    try {
        const feed = await parser.parseURL(url);
        return feed.items;
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        return [];
    }
}

module.exports = {
    parseRSSFeed,
    parseFullRSSFeed
}

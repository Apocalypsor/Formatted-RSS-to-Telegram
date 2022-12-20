const Parser = require('rss-parser');
const logger = require("./logger");
const {config} = require("./config");

const parser = new Parser({
    customFields: {
        item: [
            'author',
            ['ns0:encoded', 'content_full'],
        ],
    },
    timeout: 10000,
    headers: {
        'User-Agent': config.userAgent,
    }
});

async function parseRSSFeed(url) {
    try {
        logger.debug(`Parsing RSS feed ${url}`);
        const feed = await parser.parseURL(url);
        return feed.items.reverse();
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        if (config.puppeteerWSEndpoint) {
            logger.info('Trying to parse RSS feed using puppeteer');
            const html = await require('./puppeteer/get').puppeteerGet(url)();
            const regex = new RegExp(/(<rss[\s\S]+\/rss>)/g);
            const match = regex.exec(html);
            const feed = await parser.parseString(match[0]);
            logger.info('Successfully parsed RSS feed using puppeteer');
            return feed.items.reverse();
        } else {
            logger.error('Puppeteer is not configured, skipping');
            return [];
        }
    }
}

async function parseFullRSSFeed(url) {
    try {
        url = config.morss + url;
        const feed = await parser.parseURL(url);
        return feed.items.reverse();
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        return [];
    }
}

module.exports = {
    parseRSSFeed,
    parseFullRSSFeed
}

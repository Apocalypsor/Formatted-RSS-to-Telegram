const Parser = require('rss-parser');
const logger = require("./logger");
const {config} = require("./config");
const getClient = require("./client");
const {parseIPFromURL, isIntranet} = require("./tools");

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
        const ip = await parseIPFromURL(url);
        const proxy = !isIntranet(ip);
        logger.debug(`Parsed IP for ${url}: ${ip}, use proxy: ${proxy}`);
        const resp = await getClient(proxy).get(url);
        const feed = await parser.parseString(resp.data);
        return feed.items.reverse();
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        if (config.puppeteerWSEndpoint) {
            logger.info('Trying to parse RSS feed using puppeteer');
            const html = await require('./puppeteer/get').puppeteerGet(url)();
            const regex = new RegExp(/(<rss[\s\S]+\/rss>)/g);
            let match = regex.exec(html);
            if (!match) {
                const regex = new RegExp(/(<feed[\s\S]+\/feed>)/g);
                match = regex.exec(html);
            }
            if (match) {
                const feed = await parser.parseString(match[0]);
                logger.info('Successfully parsed RSS feed using puppeteer');
                return feed.items.reverse();
            } else {
                logger.error('Failed to parse RSS feed using puppeteer');
                return [];
            }
        } else {
            logger.error('Puppeteer is not configured, skipping');
            return [];
        }
    }
}

async function parseFullRSSFeed(url) {
    url = config.morss + url;
    return await parseRSSFeed(url);
}

module.exports = {
    parseRSSFeed,
    parseFullRSSFeed
}

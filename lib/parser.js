const Parser = require("rss-parser");
const logger = require("@lib/logger");
const { config } = require("@lib/config");
const getClient = require("@lib/client");
const { parseIPFromURL, isIntranet, htmlDecode } = require("@lib/tools");

const parser = new Parser({
    customFields: {
        // @ts-ignore
        item: ["author", ["ns0:encoded", "content_full"]],
    },
    timeout: 10000,
    headers: {
        "User-Agent": config.userAgent,
    },
});

const parseRSSFeed = async (url) => {
    try {
        logger.debug(`Parsing RSS feed ${url}`);
        const ip = await parseIPFromURL(url);
        const proxy = !isIntranet(ip);
        logger.debug(`Parsed IP for ${url}: ${ip}`);
        const resp = await getClient(proxy).get(url);
        const feed = await parser.parseString(resp.data);
        return feed.items.reverse();
    } catch (e) {
        logger.error(`Failed to parse RSS feed ${url}:\n${e}`);
        if (config.flaresolverr) {
            logger.info("Trying to parse RSS feed using FlareSolver");
            const htmlRaw = (
                await getClient().post(`${config.flaresolverr}/v1`, {
                    cmd: "request.get",
                    url: url,
                    maxTimeout: 60000,
                })
            ).data.solution.response;
            const html = htmlDecode(htmlRaw);
            console.log(html);
            const regex = new RegExp(/(<rss[\s\S]+\/rss>)/g);
            let match = regex.exec(html);
            if (!match) {
                const regex = new RegExp(/(<feed[\s\S]+\/feed>)/g);
                match = regex.exec(html);
            }
            if (match) {
                const feed = await parser.parseString(match[0]);
                logger.info("Successfully parsed RSS feed using puppeteer");
                return feed.items.reverse();
            } else {
                logger.error("Failed to parse RSS feed using puppeteer");
                return [];
            }
        } else {
            logger.error("FlareSolver is not configured, skipping");
            return [];
        }
    }
};

const parseFullRSSFeed = async (url) => {
    url = config.morss + url;
    return await parseRSSFeed(url);
};

module.exports = {
    parseRSSFeed,
    parseFullRSSFeed,
};

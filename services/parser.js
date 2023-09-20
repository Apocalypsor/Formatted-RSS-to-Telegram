const Parser = require("rss-parser");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const logger = require("@utils/logger");
const { config } = require("@utils/config");
const getClient = require("@utils/client");
const { parseIPFromURL, isIntranet, htmlDecode } = require("@utils/tools");

const parser = new Parser({
    customFields: {
        item: ["author", ["ns0:encoded", "content_full"]],
    },
    timeout: 10000,
    headers: {
        "User-Agent": config.userAgent,
    },
});

const parseRSSFeed = async (url, full = false) => {
    try {
        logger.debug(`Parsing RSS ${full ? "Full" : ""} feed ${url}`);
        let htmlResp;
        if (full) {
            const execOutput = await exec(`morss --clip "${url}"`);
            htmlResp = execOutput.stdout;
        } else {
            const ip = await parseIPFromURL(url);
            const proxy = !isIntranet(ip);
            logger.debug(`Parsed IP for ${url}: ${ip}`);
            htmlResp = (await getClient(proxy).get(url)).data;
        }
        const feed = await parser.parseString(htmlResp);
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

            if (html) {
                const feed = await parser.parseString(html);
                logger.info("Successfully parsed RSS feed using FlareSolver");
                return feed.items.reverse();
            } else {
                logger.error("Failed to parse RSS feed using FlareSolver");
                return null;
            }
        } else {
            logger.error("FlareSolver is not configured, skipping");
            return null;
        }
    }
};

module.exports = {
    parseRSSFeed,
};

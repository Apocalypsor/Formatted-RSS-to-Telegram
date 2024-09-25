import { config } from "@config";
import { getClient } from "@utils/client";
import {
    htmlDecode,
    isIntranet,
    mapError,
    parseIPFromURL,
} from "@utils/helpers";
import logger from "@utils/logger";
import Parser from "rss-parser";
import { promisify } from "util";

const exec = promisify(require("child_process").exec);

const parser = new Parser({
    customFields: {
        item: ["author", "ns0:encoded", "content_full"],
    },
    timeout: 10000,
    headers: {
        "User-Agent": config.userAgent,
    },
});

const parseRSSFeed = async (url: string, full = false): Promise<any> => {
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
        logger.warn(`Failed to parse RSS feed ${url}: ${mapError(e)}`);
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
                logger.warn("Failed to parse RSS feed using FlareSolver");
                return null;
            }
        } else {
            logger.warn("FlareSolver is not configured, skipping");
            return null;
        }
    }
};

export { parseRSSFeed };

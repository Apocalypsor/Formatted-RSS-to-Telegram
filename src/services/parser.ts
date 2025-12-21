import { config } from "@config";
import {
    fetchWithFlareSolver,
    getClient,
    htmlDecode,
    isIntranet,
    logger,
    mapError,
    parseIPFromURL,
} from "@utils";
import Parser from "rss-parser";

/**
 * Fetch full content for an article URL
 * First tries direct fetch, falls back to FlareSolver if that fails
 */
const fetchFullContent = async (url: string): Promise<string | null> => {
    try {
        logger.debug(`Fetching full content directly for ${url}`);
        const ip = await parseIPFromURL(url);
        const client = await getClient(!isIntranet(ip));
        const response = await client.get(url);
        if (
            response.status === 200 &&
            response.data &&
            typeof response.data === "string" &&
            response.data.includes("<html")
        ) {
            return response.data;
        } else {
            throw new Error(
                `Unexpected format or status code ${response.status}`,
            );
        }
    } catch (e) {
        // If direct fetch fails, try FlareSolver
        logger.debug(`Direct fetch failed, trying FlareSolver for ${url}`);
        const result = await fetchWithFlareSolver(url);
        if (!result) {
            logger.warn(
                `Failed to fetch full content for ${url}: ${mapError(e)}`,
            );
            return null;
        }
        return result;
    }
};

/**
 * Process RSS items and optionally fetch full content for each
 */
const processItems = async (
    items: {
        link?: string;
        content?: string;
        contentSnippet?: string;
    }[],
    full: boolean,
) => {
    if (!full) {
        return items;
    }

    for (const item of items) {
        if (item.link) {
            const fullContent = await fetchFullContent(item.link);
            if (fullContent) {
                item.content = fullContent;
                item.contentSnippet = fullContent.substring(0, 200);
            }
        }
    }
    return items;
};

export const parseRSSFeed = async (url: string, full = false) => {
    const parser = new Parser({
        customFields: {
            item: ["author", "ns0:encoded", "content_full"],
        },
        timeout: 10000,
        headers: {
            "User-Agent": config.userAgent,
        },
    });

    try {
        logger.debug(`Parsing RSS ${full ? "Full" : ""} feed ${url}`);

        const ip = await parseIPFromURL(url);
        logger.debug(`Parsed IP for ${url}: ${ip}`);
        const client = await getClient(!isIntranet(ip));
        const htmlResp = (await client.get(url)).data;

        const feed = await parser.parseString(htmlResp);
        const items = feed.items.reverse();
        return await processItems(items, full);
    } catch (e) {
        logger.warn(
            `Failed to parse RSS feed ${url}: ${mapError(e)}, falling back to FlareSolver`,
        );

        const html = await fetchWithFlareSolver(url);
        if (!html) {
            logger.warn("FlareSolver returned no content");
            return null;
        }

        const decoded = htmlDecode(html);
        if (!decoded) {
            logger.warn("Failed to decode RSS feed from FlareSolver response");
            return null;
        }

        const feed = await parser.parseString(decoded);
        logger.info("Successfully parsed RSS feed using FlareSolver");
        const items = feed.items.reverse();
        return await processItems(items, full);
    }
};

import { LoadRSSFileError, RSSFileNotFoundError } from "@errors";
import { expandArrayInObject } from "@utils";
import fs from "fs";
import { parse } from "yaml";
import { type RSS, RSSItemSchema } from "./schema";
import { DEFAULT_DATA_PATH, DEFAULT_RSS_FILE } from "@consts";

const parseRSS = (rss: unknown): RSS[] => {
    if (!rss || !Array.isArray(rss) || rss.length === 0) {
        throw new Error("RSS array is empty or invalid");
    }

    const parsedRSS: RSS[] = [];

    for (const rssItem of rss) {
        // Handle array expansion for url
        let rssExpandUrl: unknown[] = [];
        if (Array.isArray(rssItem.url)) {
            rssExpandUrl = expandArrayInObject(rssItem, "url");
        } else {
            rssExpandUrl.push(rssItem);
        }

        // Handle array expansion for sendTo
        let rssExpandSendTo: unknown[] = [];
        if (Array.isArray(rssItem.sendTo)) {
            for (const item of rssExpandUrl) {
                rssExpandSendTo = rssExpandSendTo.concat(
                    expandArrayInObject(item, "sendTo"),
                );
            }
        } else {
            rssExpandSendTo = rssExpandUrl;
        }

        // Validate and parse each expanded item with Zod
        for (const item of rssExpandSendTo) {
            const validated = RSSItemSchema.parse(item);
            parsedRSS.push(validated);
        }
    }

    return parsedRSS;
};

export const loadRSSFile = (rssFile: string | undefined): RSS[] => {
    const rssPath = DEFAULT_DATA_PATH + (rssFile || DEFAULT_RSS_FILE);
    if (!fs.existsSync(rssPath)) {
        throw new RSSFileNotFoundError(rssPath);
    }

    try {
        const parsed = parse(fs.readFileSync(rssPath, "utf8"), {
            merge: true,
        });
        return parseRSS(parsed?.rss);
    } catch (e) {
        console.error(e);
        throw new LoadRSSFileError(rssPath, e);
    }
};

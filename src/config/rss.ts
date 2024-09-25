import { RSS, RSSFilter, RSSRule } from "@config/interfaces/rss.interfaces";
import {
    InvalidRSSFilterError,
    InvalidRSSItemError,
    InvalidRSSRuleError,
    LoadRSSFileError,
    RSSFileNotFoundError,
} from "@errors/config";
import { expandArrayInObject } from "@utils/helpers";
import fs from "fs";
import { parse } from "yaml";

const parseRSSRule = (rule: any): RSSRule => {
    const mustHave = ["obj", "type", "matcher", "dest"];
    for (const mustHaveKey of mustHave) {
        if (
            !rule.hasOwnProperty(mustHaveKey) ||
            (mustHaveKey === "type" &&
                !["regex", "func"].includes(rule[mustHaveKey]))
        ) {
            throw new InvalidRSSRuleError(rule.obj, rule.dest);
        }
    }

    return {
        obj: rule.obj,
        type: rule.type,
        matcher: rule.matcher,
        dest: rule.dest,
    };
};

const parseRSSFilter = (filter: any): RSSFilter => {
    const mustHave = ["obj", "type", "matcher"];
    for (const mustHaveKey of mustHave) {
        if (
            !filter.hasOwnProperty(mustHaveKey) ||
            (mustHaveKey === "type" &&
                !["out", "in"].includes(filter[mustHaveKey]))
        ) {
            throw new InvalidRSSFilterError(filter.obj);
        }
    }

    return {
        obj: filter.obj,
        type: filter.type,
        matcher: filter.matcher,
    };
};

const parseRSSItem = (rssItem: any): RSS => {
    const mustHave = ["name", "url", "sendTo", "text"];
    for (const mustHaveKey of mustHave) {
        if (!rssItem.hasOwnProperty(mustHaveKey)) {
            throw new InvalidRSSItemError(rssItem);
        }
    }

    return {
        name: rssItem.name,
        url: rssItem.url,
        sendTo: rssItem.sendTo,
        embedMedia: rssItem.embedMedia || false,
        disableNotification: rssItem.disableNotification || false,
        disableWebPagePreview: rssItem.disableWebPagePreview || false,
        fullText: rssItem.fullText || false,
        rules: rssItem.rules ? rssItem.rules.map(parseRSSRule) : [],
        filters: rssItem.filters ? rssItem.filters.map(parseRSSFilter) : [],
        text: rssItem.text,
    };
};

const parseRSS = (rss: any): RSS[] => {
    if (!rss || rss.length === 0) {
        throw new InvalidRSSItemError(rss);
    }

    const parsedRSS: RSS[] = [];
    for (const rssItem of rss) {
        if (rssItem.url && rssItem.name && rssItem.sendTo && rssItem.text) {
            let rssExpandUrl: any[] = [];
            if (Array.isArray(rssItem.url)) {
                rssExpandUrl = expandArrayInObject(rssItem, "url");
            } else {
                rssExpandUrl.push(rssItem);
            }

            let rssExpandSendTo: any[] = [];
            if (Array.isArray(rssItem.sendTo)) {
                for (const item of rssExpandUrl) {
                    rssExpandSendTo = rssExpandSendTo.concat(
                        expandArrayInObject(item, "sendTo"),
                    );
                }
            } else {
                rssExpandSendTo = rssExpandUrl;
            }

            for (const item of rssExpandSendTo) {
                parsedRSS.push(parseRSSItem(item));
            }
        } else {
            throw new InvalidRSSItemError(rssItem);
        }
    }
    return parsedRSS;
};

const loadRSSFile = (rssFile: string | undefined): RSS[] => {
    const rssPath = "./config/" + (rssFile || "rss.yaml");
    if (!fs.existsSync(rssPath)) {
        throw new RSSFileNotFoundError(rssPath);
    } else {
        try {
            const parsed = parse(fs.readFileSync(rssPath, "utf8"), {
                merge: true,
            });
            return parseRSS(parsed?.rss);
        } catch (e) {
            throw new LoadRSSFileError(rssPath, e);
        }
    }
};

export { loadRSSFile, parseRSS, parseRSSFilter, parseRSSItem, parseRSSRule };

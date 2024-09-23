import { Telegram } from "@config/interfaces/config.interfaces";
import { RSS, RSSFilter, RSSRule } from "@config/interfaces/rss.interfaces";
import {
    addHistory,
    getFirstHistoryByURL,
    getHistory,
    updateExpire,
    updateHistory,
} from "@database/db";
import { parseRSSFeed } from "@services/parser";
import { render } from "@services/render";
import { edit, getSender, notify, send } from "@services/sender";
import { getObj, hash, mapError } from "@utils/helpers";
import logger from "@utils/logger";

const history = new Set();
const uninitialized = new Set();

const processRSS = async (rssItem: RSS) => {
    const sender = getSender(rssItem.sendTo);
    if (!sender) {
        logger.warn(
            `Sender ${rssItem.sendTo} for ${rssItem.name} not found, skipping.`,
        );
        return;
    }

    logger.info(`Processing RSS item: ${rssItem.name} (${rssItem.url})`);
    let rssContent;
    if (rssItem.fullText) {
        rssContent = await parseRSSFeed(rssItem.url, true);
    } else {
        rssContent = await parseRSSFeed(rssItem.url);
    }

    if (!rssContent) {
        const expireCount = await updateExpire(rssItem.url);
        logger.warn(
            `RSS item ${rssItem.name} (${rssItem.url}) is expired, expire count: ${expireCount}`,
        );
        if (expireCount >= 16 && Math.log2(expireCount) % 1 === 0) {
            await notify(rssItem.url);
        }
    } else {
        await updateExpire(rssItem.url, true);

        for (let item of rssContent) {
            await processItem(rssItem, sender, item);
        }
    }

    history.clear();
};

const processItem = async (rssItem: RSS, sender: Telegram, item: any) => {
    for (let key in item) {
        if (typeof item[key] === "string") {
            item[key] = item[key].replace(/^\s+|\s+$/g, "").trim();
        }
    }

    if (processFilters(rssItem.filters, item)) return;
    processRules(rssItem.rules, item);
    item.rss_name = rssItem.name;
    item.rss_url = rssItem.url;

    const uniqueHash = hash(rssItem.url) + hash(item.link);
    if (history.has(uniqueHash)) return;
    history.add(uniqueHash);

    const text = render(rssItem.text, item, sender.parseMode);

    const text_hash = hash(text);

    // check if this url has been initialized
    let initialized = !uninitialized.has(rssItem.url);
    if (initialized) {
        initialized = !!(await getFirstHistoryByURL(rssItem.url));
        if (!initialized) {
            uninitialized.add(rssItem.url);
        }
    }

    const existed = await getHistory(uniqueHash, rssItem.url, sender.chatId);

    logger.debug(`Processing item: ${JSON.stringify(rssItem)})`);
    const tmpSender = {
        ...sender,
        disableNotification:
            rssItem.disableNotification || sender.disableNotification,
        disableWebPagePreview:
            rssItem.disableWebPagePreview || sender.disableWebPagePreview,
    };
    logger.debug(`Sender: ${JSON.stringify(tmpSender)})`);
    if (!existed) {
        try {
            const messageId = await send(tmpSender, text, !!initialized);
            if (messageId) {
                await addHistory(
                    uniqueHash,
                    rssItem.url,
                    text_hash,
                    sender.name,
                    messageId,
                    sender.chatId,
                    "",
                );
            }
        } catch (e) {
            logger.error(`Failed to send RSS item: ${mapError(e)}`);
        }
    } else {
        let messageId = existed.telegram_message_id;
        if (messageId > 0 && text_hash !== existed.text_hash) {
            try {
                await edit(tmpSender, messageId, text);
                await updateHistory(existed.id, text_hash, messageId);
            } catch (e) {
                logger.error(`Failed to edit RSS item: ${mapError(e)}`);
            }
        }
    }
};

const processRules = (rules: RSSRule[], content: any) => {
    for (let rule of rules) {
        const obj = getObj(content, rule.obj);
        if (obj) {
            if (rule.type === "regex") {
                const regex = new RegExp(rule.matcher);
                const match = regex.exec(obj);
                if (match) {
                    match.shift();
                    if (match.length === 1) {
                        content[rule.dest] = match[0];
                    } else {
                        content[rule.dest] = match;
                    }
                }
            } else if (rule.type === "func") {
                const func = new Function("obj", rule.matcher);
                const result = func(content);
                if (result) {
                    content[rule.dest] = result;
                }
            }
        }
    }
};

const processFilters = (filters: RSSFilter[], content: any): boolean => {
    let filterOut = false;
    for (let filter of filters) {
        const obj = getObj(content, filter.obj);
        if (!obj) continue;
        if (filter.type === "in") {
            filterOut = true;
            const regex = new RegExp(filter.matcher);
            const match = regex.exec(obj);
            if (match) {
                filterOut = false;
                break;
            }
        } else if (filter.type === "out") {
            filterOut = false;
            const regex = new RegExp(filter.matcher);
            const match = regex.exec(obj);
            if (match) {
                filterOut = true;
                break;
            }
        }

        if (filterOut) break;
    }

    return filterOut;
};

export default processRSS;

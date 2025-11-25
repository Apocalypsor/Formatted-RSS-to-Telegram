import { getFirstHistoryByURL, getHistory, updateExpire } from "@database";
import { parseRSSFeed } from "./parser";
import { render } from "./render";
import { getSender, notify } from "./sender";
import { messageQueue } from "./queue";
import { extractMediaUrls, getObj, hash, logger, trimWhiteSpace } from "@utils";
import type { RSS, RSSFilter, RSSRule, Telegram } from "@config";
import {
    RSS_FILTER_TYPE,
    RSS_RULE_TYPE,
    TELEGRAM_MESSAGE_LIMIT,
} from "@consts";

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
    const rssContent = await parseRSSFeed(rssItem.url, rssItem.fullText);

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

        for (const item of rssContent) {
            await processItem(rssItem, sender, item);
        }
    }

    uninitialized.clear();
};

const processItem = async (rssItem: RSS, sender: Telegram, item: unknown) => {
    const itemObj = item as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const key in itemObj) {
        if (typeof itemObj[key] === "string") {
            itemObj[key] = trimWhiteSpace(itemObj[key]);
        }
    }

    // process filters and rules
    if (processFilters(rssItem.filters, itemObj)) return;
    processRules(rssItem.rules, itemObj);

    // process media
    let mediaUrls = undefined;
    if (rssItem.embedMedia) {
        mediaUrls = extractMediaUrls(itemObj.content).filter((item) =>
            rssItem.embedMediaExclude.some(
                (exclude) => !new RegExp(exclude).test(item.url),
            ),
        );
    }

    // truncate contentSnippet if it's too long
    if (
        itemObj.contentSnippet &&
        itemObj.contentSnippet.length > TELEGRAM_MESSAGE_LIMIT - 100
    ) {
        itemObj.contentSnippet =
            itemObj.contentSnippet.slice(0, TELEGRAM_MESSAGE_LIMIT - 100) +
            "...";
    }

    itemObj.rss_name = rssItem.name;
    itemObj.rss_url = rssItem.url;

    const uniqueHash = hash(rssItem.url) + hash(itemObj.link);
    const text = render(rssItem.text, itemObj, sender.parseMode);

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
        // Enqueue send task (fire-and-forget) with deduplication
        messageQueue.enqueueSend(
            tmpSender,
            text,
            initialized,
            mediaUrls,
            uniqueHash, // Use uniqueHash for deduplication in queue
            // History metadata for saving after message is sent
            {
                uniqueHash,
                url: rssItem.url,
                textHash: text_hash,
                senderName: sender.name,
                chatId: sender.chatId,
            },
        );
    } else {
        const messageId = existed.telegram_message_id;
        if (messageId > 0 && text_hash !== existed.text_hash) {
            // Enqueue edit task (fire-and-forget) with deduplication
            messageQueue.enqueueEdit(
                tmpSender,
                messageId,
                text,
                uniqueHash, // Use uniqueHash for deduplication in queue
                // History metadata for updating after message is edited
                {
                    historyId: existed.id,
                    textHash: text_hash,
                },
            );
        }
    }
};

const processRules = (rules: RSSRule[], content: unknown) => {
    const contentObj = content as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const rule of rules) {
        const obj = getObj(contentObj, rule.obj);
        if (obj) {
            if (rule.type === RSS_RULE_TYPE.REGEX) {
                const regex = new RegExp(rule.matcher);
                const match = regex.exec(obj);
                if (match) {
                    match.shift();
                    if (match.length === 1) {
                        contentObj[rule.dest] = match[0];
                    } else {
                        contentObj[rule.dest] = match;
                    }
                }
            } else if (rule.type === RSS_RULE_TYPE.FUNC) {
                const func = new Function("obj", rule.matcher);
                const result = func(content);
                if (result) {
                    contentObj[rule.dest] = result;
                }
            }
        }
    }
};

const processFilters = (filters: RSSFilter[], content: unknown): boolean => {
    const contentObj = content as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

    let filterOut = false;
    for (const filter of filters) {
        const obj = getObj(contentObj, filter.obj);
        if (!obj) continue;
        if (filter.type === RSS_FILTER_TYPE.IN) {
            filterOut = true;
            const regex = new RegExp(filter.matcher);
            const match = regex.exec(obj);
            if (match) {
                filterOut = false;
                break;
            }
        } else if (filter.type === RSS_FILTER_TYPE.OUT) {
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
export * from "./queue";

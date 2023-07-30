const { parseRSSFeed, parseFullRSSFeed } = require("@services/parser");
const { render } = require("@services/render");
const { getSender, send, edit, notify } = require("@services/sender");
const {
    updateExpire,
    getHistory,
    addHistory,
    updateHistory,
} = require("@utils/db");
const { getObj, hash } = require("@utils/tools");
const logger = require("@utils/logger");
const { EDIT_STATUS } = require("@consts/status");

const history = new Set();

const process = async (rssItem) => {
    const sender = getSender(rssItem.sendTo);
    if (!sender) {
        logger.warn(
            `Sender ${rssItem.sendTo} for ${rssItem.name} not found, skipping.`
        );
        return;
    }

    logger.info(`Processing RSS item: ${rssItem.name} (${rssItem.url})`);
    let rssContent;
    if (rssItem.fullText) {
        rssContent = await parseFullRSSFeed(rssItem.url);
    } else {
        rssContent = await parseRSSFeed(rssItem.url);
    }

    if (rssContent.length === 0) {
        const expireCount = await updateExpire(rssItem.url);
        logger.warn(
            `RSS item ${rssItem.name} (${rssItem.url}) is expired for ${expireCount} times, skipping.`
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

const processItem = async (rssItem, sender, item) => {
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
    const existed = await getHistory(uniqueHash, rssItem.url, sender.chatId);

    logger.debug(`Processing item: ${JSON.stringify(rssItem)})`);
    const tmpSender = { ...sender };
    tmpSender.disableNotification =
        rssItem.disableNotification || sender.disableNotification;
    tmpSender.disableWebPagePreview =
        rssItem.disableWebPagePreview || sender.disableWebPagePreview;
    logger.debug(`Sender: ${JSON.stringify(tmpSender)})`);
    if (!existed) {
        const messageId = await send(tmpSender, text);
        if (messageId) {
            await addHistory(
                uniqueHash,
                rssItem.url,
                text_hash,
                sender.name,
                messageId,
                sender.chatId,
                ""
            );
        }
    } else {
        let messageId = existed.telegram_message_id;
        if (messageId > 0 && text_hash !== existed.text_hash) {
            const editResp = await edit(tmpSender, messageId, text);
            if (editResp === EDIT_STATUS.NOT_FOUND) {
                messageId = -1;
            } else if (editResp === EDIT_STATUS.ERROR) {
                return;
            }

            await updateHistory(existed.id, text_hash, messageId);
        }
    }
};

const processRules = (rules, content) => {
    if (rules.length > 0) {
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
    }
};

const processFilters = (filters, content) => {
    let filterOut = false;
    if (filters.length > 0) {
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
    }

    return filterOut;
};

module.exports = {
    process,
};

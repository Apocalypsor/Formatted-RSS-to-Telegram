const {parseRSSFeed, parseFullRSSFeed} = require('../lib/parser');
const {updateExpire, getHistory, addHistory, updateHistory} = require("./db");
const {getObj, hash} = require("./tools");
const {render} = require("./render");
const {getSender, send, edit} = require("./sender");
const {editStatus} = require("../model/status");
const logger = require("./logger");

async function process(rssItem) {
    const sender = getSender(rssItem.sendTo);
    if (!sender) return;

    logger.info(`Processing RSS item: ${rssItem.name}`);
    let rssContent;
    if (rssItem.fullText) {
        rssContent = await parseFullRSSFeed(rssItem.url);
    } else {
        rssContent = await parseRSSFeed(rssItem.url);
    }

    if (rssContent.length === 0) {
        await updateExpire(rssItem.url);
    } else {
        await updateExpire(rssItem.url, true);

        for (let item of rssContent) {
            await processItem(rssItem, sender, item);
        }
    }
}

async function processItem(rssItem, sender, item) {
    for (let key in item) {
        if (typeof item[key] === 'string') {
            item[key] = item[key].replace(/^\s+|\s+$/g, '').trim();
        }
    }

    if (processFilters(rssItem.filters, item)) return;
    processRules(rssItem.rules, item);
    item.rss_name = rssItem.name;
    item.rss_url = rssItem.url;

    const uniqueHash = hash(rssItem.url) + hash(item.link);
    const text = render(rssItem.text, item, sender.parseMode);


    const text_hash = hash(text);
    const existed = await getHistory(uniqueHash, rssItem.url, sender.chatId);
    if (!existed) {
        logger.debug(`RSS content for RSS item ${rssItem.name}: ${JSON.stringify(item)}`);
        logger.debug(`Rendered text for RSS item ${rssItem.name}:\n${text}`);
        const messageId = await send(sender, text);
        if (messageId) {
            await addHistory(uniqueHash, rssItem.url, text_hash, sender.name, messageId, sender.chatId, '');
        }
    } else {
        let messageId = existed.telegram_message_id;
        if (messageId > 0 && text_hash !== existed.text_hash) {
            const editResp = await edit(sender, messageId, text);
            if (editResp === editStatus.NOT_FOUND) {
                messageId = -1;
            } else if (editResp === editStatus.ERROR) {
                return;
            }

            await updateHistory(existed.id, text_hash, messageId);
        }
    }
}

function processRules(rules, content) {
    if (rules.length > 0) {
        for (let rule of rules) {
            const obj = getObj(content, rule.obj);
            if (obj) {
                if (rule.type === 'regex') {
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
                } else if (rule.type === 'func') {
                    const func = new Function('obj', rule.matcher);
                    const result = func(content);
                    if (result) {
                        content[rule.dest] = result;
                    }
                }
            }
        }
    }
}

function processFilters(filters, content) {
    let filterOut = false;
    if (filters.length > 0) {
        for (let filter of filters) {
            const obj = getObj(content, filter.obj);
            if (!obj) continue;
            if (filter.type === 'in') {
                filterOut = true;
                const regex = new RegExp(filter.matcher);
                const match = regex.exec(obj);
                if (match) {
                    filterOut = false;
                    break;
                }
            } else if (filter.type === 'out') {
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
}

module.exports = {
    process
}
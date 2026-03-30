import type { RSS, RSSFilter, RSSRule, Telegram } from "@config";
import {
  EXPIRE_NOTIFY_THRESHOLD,
  type MEDIA_TYPE,
  RSS_FILTER_TYPE,
  RSS_RULE_TYPE,
  TELEGRAM_MESSAGE_LIMIT,
} from "@consts";
import {
  addHistory,
  getFirstHistoryByURL,
  getHistory,
  updateExpire,
} from "@database";
import { extractMediaUrls, getCachedRegex, getObj, hash, logger } from "@utils";
import * as _ from "lodash-es";
import { resolveMatcherPattern } from "./matcher";
import { parseRSSFeed } from "./parser";
import { messageQueue } from "./queue";
import { render } from "./render";
import { getSender, notify } from "./sender";

const uninitialized = new Set();
let firstRun = false;

export const setFirstRun = (value: boolean) => {
  firstRun = value;
};

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
    if (
      expireCount >= EXPIRE_NOTIFY_THRESHOLD &&
      Math.log2(expireCount) % 1 === 0
    ) {
      await notify(rssItem.url);
    }
  } else {
    await updateExpire(rssItem.url, true);

    for (const item of rssContent) {
      await processItem(rssItem, sender, item);
    }
  }

  uninitialized.delete(rssItem.url);
};

const processItem = async (rssItem: RSS, sender: Telegram, item: unknown) => {
  const itemObj = _.mapValues(item as Record<string, unknown>, (v) =>
    _.isString(v) ? v.trim() : v,
  );

  // process filters and rules
  if (await processFilters(rssItem.filters, itemObj)) return;
  processRules(rssItem.rules, itemObj);

  // process media
  let mediaUrls: { type: MEDIA_TYPE; url: string }[] | undefined;
  if (rssItem.embedMedia) {
    mediaUrls = extractMediaUrls(itemObj.content as string).filter((item) =>
      rssItem.embedMediaExclude.every(
        (exclude) => !getCachedRegex(exclude).test(item.url),
      ),
    );
  }

  // truncate contentSnippet if it's too long
  if (itemObj.contentSnippet) {
    itemObj.contentSnippet = _.truncate(itemObj.contentSnippet as string, {
      length: TELEGRAM_MESSAGE_LIMIT - 100,
    });
  }

  itemObj.rss_name = rssItem.name;
  itemObj.rss_url = rssItem.url;

  const uniqueHash = hash(rssItem.url) + hash(itemObj.link as string);
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

  const existed = await getHistory(uniqueHash);

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
    // If not initialized or first run, directly save history without going through queue
    if (!initialized || firstRun) {
      logger.info(
        `Skipping queue for ${rssItem.name} (initialization), saving history directly.`,
      );
      await addHistory(
        uniqueHash,
        rssItem.url,
        text_hash,
        sender.name,
        BigInt(-1),
        sender.chatId,
      );
    } else {
      // Enqueue send task (fire-and-forget) with deduplication
      messageQueue.enqueueSend(tmpSender, text, mediaUrls, {
        uniqueHash,
        textHash: text_hash,
        url: rssItem.url,
        senderName: sender.name,
        chatId: sender.chatId,
      });
    }
  } else {
    const messageId = existed.telegram_message_id;
    if (messageId > 0 && text_hash !== existed.text_hash) {
      // Enqueue edit task (fire-and-forget) with deduplication
      messageQueue.enqueueEdit(tmpSender, messageId, text, {
        uniqueHash,
        textHash: text_hash,
        historyId: existed.id,
      });
    }
  }
};

const processRules = (rules: RSSRule[], content: unknown) => {
  const contentObj = content as Record<string, unknown>;

  for (const rule of rules) {
    const obj = getObj(contentObj, rule.obj);
    if (obj) {
      if (rule.type === RSS_RULE_TYPE.REGEX) {
        const regex = getCachedRegex(rule.matcher);
        const match = regex.exec(obj as string);
        if (match) {
          match.shift();
          if (match.length === 1) {
            contentObj[rule.dest] = match[0];
          } else {
            contentObj[rule.dest] = match;
          }
        }
      } else if (rule.type === RSS_RULE_TYPE.FUNC) {
        try {
          const func = new Function("obj", rule.matcher);
          const result = func(content);
          if (result) {
            contentObj[rule.dest] = result;
          }
        } catch (e) {
          logger.warn(
            `Failed to execute FUNC rule (dest: ${rule.dest}): ${e instanceof Error ? e.message : e}`,
          );
        }
      }
    }
  }
};

const processFilters = async (
  filters: RSSFilter[],
  content: unknown,
): Promise<boolean> => {
  const contentObj = content as Record<string, unknown>;

  let filterOut = false;
  for (const filter of filters) {
    const obj = getObj(contentObj, filter.obj);
    if (!obj) continue;
    const pattern = await resolveMatcherPattern(filter.matcher);
    const regex = getCachedRegex(pattern);
    if (filter.type === RSS_FILTER_TYPE.IN) {
      filterOut = true;
      if (regex.exec(obj as string)) {
        filterOut = false;
        break;
      }
    } else if (filter.type === RSS_FILTER_TYPE.OUT) {
      filterOut = false;
      if (regex.exec(obj as string)) {
        filterOut = true;
        break;
      }
    }
  }

  return filterOut;
};

export default processRSS;
export * from "./queue";

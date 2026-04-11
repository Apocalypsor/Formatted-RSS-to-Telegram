import type { RSS, Telegram } from "@config";
import {
  EXPIRE_NOTIFY_THRESHOLD,
  type MEDIA_TYPE,
  TELEGRAM_MESSAGE_LIMIT,
} from "@consts";
import {
  addHistory,
  getFirstHistoryByURL,
  getHistory,
  updateExpire,
} from "@database";
import { hash, logger } from "@utils";
import * as _ from "lodash-es";
import { parseRSSFeed } from "./parser";
import {
  buildEffectiveSender,
  extractFilteredMedia,
  normalizeItem,
  processFilters,
  processRules,
} from "./pipeline";
import { messageQueue } from "./queue";
import { render } from "./render";
import { getSender, notify } from "./sender";

const createProcessor = () => {
  const initCache = new Map<string, boolean>();
  let firstRun = false;

  const isUrlInitialized = (url: string): boolean => {
    const cached = initCache.get(url);
    if (cached !== undefined) return cached;
    const hasHistory = !!getFirstHistoryByURL(url);
    initCache.set(url, hasHistory);
    return hasHistory;
  };

  const processItem = async (rssItem: RSS, sender: Telegram, item: unknown) => {
    const itemObj = normalizeItem(item);

    if (await processFilters(rssItem.filters, itemObj)) return;
    processRules(rssItem.rules, itemObj);

    const mediaUrls: { type: MEDIA_TYPE; url: string }[] | undefined =
      rssItem.embedMedia
        ? extractFilteredMedia(rssItem, itemObj.content as string)
        : undefined;

    if (itemObj.contentSnippet) {
      itemObj.contentSnippet = _.truncate(itemObj.contentSnippet as string, {
        length: TELEGRAM_MESSAGE_LIMIT - 100,
      });
    }

    itemObj.rss_name = rssItem.name;
    itemObj.rss_url = rssItem.url;

    const uniqueHash = hash(rssItem.url) + hash(itemObj.link as string);
    const text = render(rssItem.text, itemObj, sender.parseMode);
    const textHash = hash(text);

    const initialized = isUrlInitialized(rssItem.url);
    const existed = getHistory(uniqueHash);
    const effectiveSender = buildEffectiveSender(rssItem, sender);

    logger.debug(`Processing item: ${JSON.stringify(itemObj)}`);
    logger.debug(`Sender: ${JSON.stringify(effectiveSender)}`);

    if (!existed) {
      if (!initialized || firstRun) {
        logger.info(
          `Skipping queue for ${rssItem.name} (initialization), saving history directly.`,
        );
        addHistory(
          uniqueHash,
          rssItem.url,
          textHash,
          sender.name,
          -1,
          sender.chatId,
        );
      } else {
        messageQueue.enqueueSend(effectiveSender, text, mediaUrls, {
          uniqueHash,
          textHash,
          url: rssItem.url,
          senderName: sender.name,
          chatId: sender.chatId,
        });
      }
      return;
    }

    const messageId = existed.telegramMessageId;
    if (messageId > 0 && textHash !== existed.textHash) {
      messageQueue.enqueueEdit(effectiveSender, messageId, text, {
        uniqueHash,
        textHash,
        historyId: existed.id,
      });
    }
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
      const expireCount = updateExpire(rssItem.url);
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
      updateExpire(rssItem.url, true);

      for (const item of rssContent) {
        await processItem(rssItem, sender, item);
      }
    }

    initCache.delete(rssItem.url);
  };

  return {
    processRSS,
    setFirstRun: (value: boolean) => {
      firstRun = value;
    },
  };
};

const processor = createProcessor();

export const setFirstRun = processor.setFirstRun;
export default processor.processRSS;
export * from "./queue";

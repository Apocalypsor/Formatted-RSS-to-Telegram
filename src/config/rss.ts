import fs from "node:fs";
import { DEFAULT_DATA_PATH, DEFAULT_RSS_FILE } from "@consts";
import { LoadRSSFileError, RSSFileNotFoundError } from "@errors";
import * as _ from "lodash-es";
import { parse } from "yaml";
import { type RSS, RSSItemSchema } from "./schema";

// Expand one item whose `key` is an array into N items, one per array value.
// Used to let a single RSS config entry fan out across multiple URLs / senders.
const expandArrayInObject = (
  obj: unknown,
  key: string | number,
): Record<string, unknown>[] => {
  if (!obj) return [];
  const rec = obj as Record<string, unknown>;
  const val = rec[key];
  if (!Array.isArray(val)) return [{ ...rec }];
  const rest = _.omit(rec, [key]);
  return val.map((item: unknown) => ({ ...rest, [key]: item }));
};

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

import type { RSS, RSSFilter, RSSRule, Telegram } from "@config";
import { MEDIA_TYPE, RSS_FILTER_TYPE, RSS_RULE_TYPE } from "@consts";
import { getCachedRegex, logger, mapError } from "@utils";
import * as _ from "lodash-es";
import { resolveMatcherPattern } from "./matcher";

export type ItemObj = Record<string, unknown>;

export const normalizeItem = (item: unknown): ItemObj =>
  _.mapValues(item as ItemObj, (v) => (_.isString(v) ? v.trim() : v));

const extractMediaUrls = (
  htmlContent: string,
  baseUrl?: string,
): { type: MEDIA_TYPE; url: string }[] => {
  let baseUrlFormatted = {
    origin: "",
    pathname: "",
  };

  if (baseUrl) {
    try {
      baseUrlFormatted = new URL(baseUrl);
    } catch (error) {
      logger.debug(
        `Failed to parse base URL in extractMediaUrls: ${mapError(error)}`,
      );
    }
  }

  const uncommentedHtml = htmlContent.replace(/<!--[\s\S]*?-->/g, "");
  const imgRegex =
    /<(img|video|source)\s+[^>]*src\s*=\s*(['"])(.*?)(['"]).*?>/gi;
  const imgUrls: { type: MEDIA_TYPE; url: string }[] = [];
  for (
    let match = imgRegex.exec(uncommentedHtml);
    match !== null;
    match = imgRegex.exec(uncommentedHtml)
  ) {
    if (
      /class\s*=\s*(['"]).*(emoji|avatar|site-icon|thumbnail)/i.test(match[0])
    ) {
      continue;
    }

    let imgUrl = match[3];
    if (!imgUrl) {
      continue;
    }
    if (imgUrl.startsWith("./")) {
      imgUrl =
        baseUrlFormatted.origin +
        baseUrlFormatted.pathname.replace(/\/$/, "") +
        "/" +
        imgUrl.slice(2);
    } else if (imgUrl.startsWith("/")) {
      imgUrl = baseUrlFormatted.origin + imgUrl;
    }

    imgUrls.push({
      type:
        match[1]?.toLowerCase() === "img" ? MEDIA_TYPE.PHOTO : MEDIA_TYPE.VIDEO,
      url: imgUrl,
    });
  }

  return imgUrls;
};

export const extractFilteredMedia = (rssItem: RSS, content: string) =>
  extractMediaUrls(content).filter((media) =>
    rssItem.embedMediaExclude.every(
      (exclude) => !getCachedRegex(exclude).test(media.url),
    ),
  );

export const buildEffectiveSender = (
  rssItem: RSS,
  sender: Telegram,
): Telegram => ({
  ...sender,
  disableNotification:
    rssItem.disableNotification || sender.disableNotification,
  disableWebPagePreview:
    rssItem.disableWebPagePreview || sender.disableWebPagePreview,
});

export const processRules = (rules: RSSRule[], content: unknown) => {
  const contentObj = content as Record<string, unknown>;

  for (const rule of rules) {
    const obj = _.get(contentObj, rule.obj);
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

export const processFilters = async (
  filters: RSSFilter[],
  content: unknown,
): Promise<boolean> => {
  const contentObj = content as Record<string, unknown>;

  let filterOut = false;
  for (const filter of filters) {
    const obj = _.get(contentObj, filter.obj);
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

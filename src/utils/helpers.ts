import { createHash } from "node:crypto";
import dns from "node:dns";
import fs from "node:fs";
import { MEDIA_TYPE } from "@consts";
import * as cheerio from "cheerio";
import * as _ from "lodash-es";
import { getClient } from "./client";
import { logger } from "./logger";

export const hash = (string: string): string => {
  return createHash("sha256").update(string).digest("hex");
};

export const expandArrayInObject = (
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

export const getObj = (obj: object, path: string): unknown => _.get(obj, path);

export const createDirIfNotExists = async (dir: fs.PathLike) => {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
};

export const parseIPFromURL = async (url: string | URL): Promise<string> => {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    dns.lookup(parsed.hostname, (err, address) => {
      if (err) {
        reject(err);
      } else {
        resolve(address);
      }
    });
  });
};

export const isIntranet = (ip: string): boolean => {
  // IPv6 loopback and private ranges
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  // IPv4 loopback
  if (parts[0] === "127") return true;
  // 10.0.0.0/8
  if (parts[0] === "10") return true;
  // 172.16.0.0/12
  if (
    parts[0] === "172" &&
    parts[1] &&
    parseInt(parts[1], 10) >= 16 &&
    parseInt(parts[1], 10) <= 31
  ) {
    return true;
  }
  // 192.168.0.0/16
  return parts[0] === "192" && parts[1] === "168";
};

export const htmlDecode = (input: string): string | null => {
  const $ = cheerio.load(input, { xml: false });
  const text = $("body").text();
  if (!text) return null;
  const rssMatch = text.match(/<rss[\s\S]+<\/rss>/);
  if (rssMatch) return rssMatch[0];
  const feedMatch = text.match(/<feed[\s\S]+<\/feed>/);
  return feedMatch ? feedMatch[0] : null;
};

export const mapError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  } else {
    return JSON.stringify(error);
  }
};

const regexCache = new Map<string, RegExp>();
const REGEX_CACHE_CAPACITY = 1000;

export const getCachedRegex = (pattern: string): RegExp => {
  const cached = regexCache.get(pattern);
  if (cached) {
    regexCache.delete(pattern);
    regexCache.set(pattern, cached);
    return cached;
  }
  if (regexCache.size >= REGEX_CACHE_CAPACITY) {
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  const regex = new RegExp(pattern);
  regexCache.set(pattern, regex);
  return regex;
};

export const getHostIPInfo = async (): Promise<string | null> => {
  const client = await getClient(true);
  try {
    const resp = await client
      .get("https://api.dov.moe/ip")
      .json<{ data?: unknown }>();
    if (resp?.data) return JSON.stringify(resp.data);
  } catch {
    // fall through to fallback
  }
  try {
    return await client.get("https://1.1.1.1/cdn-cgi/trace").text();
  } catch {
    return null;
  }
};

export const extractMediaUrls = (
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

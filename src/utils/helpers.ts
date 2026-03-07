/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "crypto";
import dns from "dns";
import fs from "fs";
import * as cheerio from "cheerio";
import { logger } from "./logger";

import { MEDIA_TYPE } from "@consts";

export const hash = (string: string): string => {
    return createHash("sha256").update(string).digest("hex");
};

export const expandArrayInObject = (obj: any, key: string | number): any[] => {
    if (!obj) {
        return [];
    }

    const newObj = { ...obj };
    if (!Array.isArray(obj[key])) {
        return [newObj];
    }

    const arr = newObj[key];
    delete newObj[key];
    return arr.map((item: any) => {
        return { ...newObj, [key]: item };
    });
};

export const getObj = (obj: any, s: string) => {
    const paths = s.split(".");
    let result = obj;
    for (const path of paths) {
        if (result === undefined) {
            break;
        }

        const pathInt = parseInt(path);
        if (isNaN(pathInt)) {
            result = result[path];
        } else {
            result = result[pathInt];
        }
    }

    return result;
};

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
        parseInt(parts[1]) >= 16 &&
        parseInt(parts[1]) <= 31
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
    const rssMatch = text.match(/<rss[\s\S]+?<\/rss>/);
    if (rssMatch) return rssMatch[0];
    const feedMatch = text.match(/<feed[\s\S]+?<\/feed>/);
    return feedMatch ? feedMatch[0] : null;
};

export const trimWhiteSpace = (input: string): string => {
    return input.trim();
};

export const mapError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    } else {
        return JSON.stringify(error);
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
    let match;

    while ((match = imgRegex.exec(uncommentedHtml)) !== null) {
        if (
            /class\s*=\s*(['"]).*(emoji|avatar|site-icon|thumbnail)/gi.test(
                match[0],
            )
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
            type: match[1] === "img" ? MEDIA_TYPE.PHOTO : MEDIA_TYPE.VIDEO,
            url: imgUrl,
        });
    }

    return imgUrls;
};

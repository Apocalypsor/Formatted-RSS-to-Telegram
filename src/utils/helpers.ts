/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "crypto";
import dns from "dns";
import fs from "fs";
import { JSDOM } from "jsdom";
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
    const parts = ip.split(".");
    if (parts[0] === "10") {
        return true;
    }

    if (
        parts[0] === "172" &&
        parts[1] &&
        parseInt(parts[1]) >= 16 &&
        parseInt(parts[1]) <= 31
    ) {
        return true;
    }

    return parts[0] === "192" && parts[1] === "168";
};

export const htmlDecode = (input: string): string | null => {
    const doc = new JSDOM(input);
    const body = doc.window.document.body.textContent;
    if (!body) {
        return null;
    }
    const regex = new RegExp(/(<rss[\s\S]+\/rss>)/g);
    let match = regex.exec(body);
    if (!match) {
        const regex = new RegExp(/(<feed[\s\S]+\/feed>)/g);
        match = regex.exec(body);
    }
    if (match) {
        return match[0];
    } else {
        return null;
    }
};

export const trimWhiteSpace = (input: string): string => {
    return input.replace(/^\s+|\s+$/g, "").trim();
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

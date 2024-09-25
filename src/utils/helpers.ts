import { createHash } from "crypto";
import dns from "dns";
import fs from "fs";
import { JSDOM } from "jsdom";

const hash = (string: string): string => {
    return createHash("sha256").update(string).digest("hex");
};

const expandArrayInObject = (
    obj: { [x: string]: any },
    key: string | number,
): { [x: string]: any }[] => {
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

const getObj = (obj: any, s: string) => {
    const paths = s.split(".");
    let result = obj;
    for (let path of paths) {
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

const createDirIfNotExists = async (dir: fs.PathLike) => {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
};

const parseIPFromURL = async (url: string | URL): Promise<string> => {
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

const isIntranet = (ip: string): boolean => {
    const parts = ip.split(".");
    if (parts[0] === "10") {
        return true;
    }
    if (
        parts[0] === "172" &&
        parseInt(parts[1]) >= 16 &&
        parseInt(parts[1]) <= 31
    ) {
        return true;
    }
    return parts[0] === "192" && parts[1] === "168";
};

const htmlDecode = (input: string): string | null => {
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

const mapError = (error: any): string => {
    if (error instanceof Error) {
        return error.message;
    } else {
        return JSON.stringify(error);
    }
};

const extractMediaUrls = (
    htmlContent: string,
): { type: "photo" | "video"; url: string }[] => {
    const uncommentedHtml = htmlContent.replace(/<!--[\s\S]*?-->/g, "");
    const imgRegex = /<(img|video|source)\s+[^>]*src *= *(['"])(.*?)\2/gi;
    const imgUrls: { type: "photo" | "video"; url: string }[] = [];
    let match;

    while ((match = imgRegex.exec(uncommentedHtml)) !== null) {
        imgUrls.push({
            type: match[1] === "img" ? "photo" : "video",
            url: match[3],
        });
    }

    return imgUrls;
};

export {
    hash,
    expandArrayInObject,
    getObj,
    createDirIfNotExists,
    parseIPFromURL,
    isIntranet,
    htmlDecode,
    mapError,
    extractMediaUrls,
};

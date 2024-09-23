import { createHash } from "crypto";
import dns from "dns";
import { JSDOM } from "jsdom";
import fs from "node:fs";

const hash = (string: string): string => {
    return createHash("sha256").update(string).digest("hex");
};

const expandArrayInObject = (
    obj: { [x: string]: any },
    key: string | number,
): { [x: string]: any }[] => {
    const newObj = { ...obj };
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
        if (Array.isArray(result)) {
            const pathInt = parseInt(path);
            if (Number.isInteger(pathInt) && pathInt < result.length) {
                result = result[pathInt];
            } else {
                return null;
            }
        } else if (typeof result === "object") {
            if (result.hasOwnProperty(path)) {
                result = result[path];
            } else {
                const pathInt = parseInt(path);
                if (
                    Number.isInteger(pathInt) &&
                    result.hasOwnProperty(pathInt)
                ) {
                    result = result[pathInt];
                } else {
                    return null;
                }
            }
        } else {
            return null;
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

export {
    hash,
    expandArrayInObject,
    getObj,
    createDirIfNotExists,
    parseIPFromURL,
    isIntranet,
    htmlDecode,
    mapError,
};

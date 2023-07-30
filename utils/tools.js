const { createHash } = require("crypto");
const fs = require("fs");
const dns = require("dns");
const { JSDOM } = require("jsdom");

const hash = (string) => {
    return createHash("sha256").update(string).digest("hex");
};

const expandArrayInObject = (obj, key) => {
    const tmp = [];
    if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
            const newObj = JSON.parse(JSON.stringify(obj));
            newObj[key] = item;
            tmp.push(newObj);
        }
    }

    return tmp;
};

const getObj = (obj, s) => {
    const paths = s.split(".");
    let result = obj;
    for (let path of paths) {
        if (Array.isArray(result)) {
            path = parseInt(path);
            if (Number.isInteger(path) && path < result.length) {
                result = result[path];
            } else {
                return null;
            }
        } else if (typeof result === "object") {
            if (result.hasOwnProperty(path)) {
                result = result[path];
            } else {
                path = parseInt(path);
                if (Number.isInteger(path) && result.hasOwnProperty(path)) {
                    result = result[path];
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

const isInteger = (strOrInt) => {
    return Number.isInteger(parseInt(strOrInt));
};

const createDirIfNotExists = async (dir) => {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
};

const parseIPFromURL = async (url) => {
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

const isIntranet = async (ip) => {
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

const htmlDecode = (input) => {
    var doc = new JSDOM(input);
    const body = doc.window.document.body.textContent;
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

module.exports = {
    hash,
    expandArrayInObject,
    getObj,
    createDirIfNotExists,
    parseIPFromURL,
    isIntranet,
    isInteger,
    htmlDecode,
};

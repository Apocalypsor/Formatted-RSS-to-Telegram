const {createHash} = require('crypto');
const fs = require("fs");
const dns = require("dns");

function hash(string) {
    return createHash('sha256').update(string).digest('hex');
}

function expandArrayInObject(obj, key) {
    const tmp = [];
    if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
            const newObj = JSON.parse(JSON.stringify(obj));
            newObj[key] = item;
            tmp.push(newObj);
        }
    }

    return tmp;
}

function getObj(obj, s) {
    const paths = s.split('.');
    let result = obj;
    for (let path of paths) {
        if (isNumeric(path)) {
            path = parseInt(path);
            if (Array.isArray(result) && path < result.length) {
                result = result[path];
            } else {
                return null;
            }
        } else {
            if (path in result) {
                result = result[path];
            } else {
                return null;
            }
        }
    }

    return result;
}

function isNumeric(str) {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
}

async function createDirIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, {recursive: true});
    }
}

async function parseIPFromURL(url) {
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
}

function isIntranet(ip) {
    const parts = ip.split('.');
    if (parts[0] === '10') {
        return true;
    }
    if (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) {
        return true;
    }
    return parts[0] === '192' && parts[1] === '168';
}

module.exports = {
    hash,
    expandArrayInObject,
    getObj,
    createDirIfNotExists,
    parseIPFromURL,
    isIntranet
}
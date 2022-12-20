const {createHash} = require('crypto');
const fs = require("fs");

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

module.exports = {
    hash,
    expandArrayInObject,
    getObj,
    createDirIfNotExists
}
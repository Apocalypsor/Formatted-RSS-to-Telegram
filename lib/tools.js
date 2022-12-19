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

module.exports = {
    expandArrayInObject,
}
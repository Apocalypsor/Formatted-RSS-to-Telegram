const dbLib = require('../lib/db');
const {parseRSSFeed, parseFullRSSFeed} = require('../lib/parser');

async function process(rssItem) {
    const db = await dbLib.get();
    let rssContent;
    if (rssItem.fullText) {
        rssContent = await parseFullRSSFeed(rssItem.url);
    } else {
        rssContent = await parseRSSFeed(rssItem.url);
    }

    console.log(rssContent);
    if (rssContent.length === 0) {
        const existingItem = db.exec(`
            SELECT *
            FROM expire
            WHERE url = '${rssItem.url}';
        `);
        if (existingItem.length === 0) {
            db.run(`
                INSERT INTO expire (url, expire)
                VALUES ('${rssItem.url}', 1);
            `);
        } else {
            db.run(`
                UPDATE expire
                SET expire = expire + 1
                WHERE url = ?
            `, [rssItem.url]);
        }

        await dbLib.write(db);
    }
}

module.exports = {
    process
}
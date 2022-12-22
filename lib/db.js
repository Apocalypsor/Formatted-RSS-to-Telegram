const fs = require('fs');
const initSqlJs = require('sql.js');
const logger = require("./logger");

const file = __dirname + (process.env.DB_FILE || '/../config/db.sqlite');

let db;

async function init() {
    const SQL = await initSqlJs();

    if (!fs.existsSync(file)) {
        logger.info(`Creating database file ${file}`);
        await fs.promises.open(file, "w");
    }

    const fileBuffer = await fs.promises.readFile(file);
    const db = new SQL.Database(fileBuffer);
    db.run(`
        CREATE TABLE IF NOT EXISTS history
        (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            unique_hash         VARCHAR(255) NOT NULL,
            url                 VARCHAR(255) NOT NULL,
            text_hash           VARCHAR(255) NOT NULL,
            telegram_name       VARCHAR(255) NOT NULL,
            telegram_message_id INTEGER      NOT NULL,
            telegram_chat_id    INTEGER      NOT NULL,
            telegraph_url       VARCHAR(255),
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expire
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            url        VARCHAR(255) NOT NULL,
            expire     INTEGER      NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await write(db);

    logger.info("database initialized");

    return db;
}

async function getHistory(uniqueHash, url, telegramChatId) {
    const db = await get();
    const result = db.exec(`
        SELECT *
        FROM history
        WHERE url = '${url}'
          AND unique_hash = '${uniqueHash}'
          AND telegram_chat_id = ${telegramChatId};
    `);

    if (result.length === 0) {
        return null;
    } else {
        const columns = result[0].columns;
        const values = result[0].values[0];
        const obj = {};
        for (let i = 0; i < columns.length; i++) {
            obj[columns[i]] = values[i];
        }
        return obj;
    }
}

async function addHistory(uniqueHash, url, textHash, telegramName, telegramMessageId, telegramChatId, telegraphUrl) {
    const db = await get();
    const sql = `
        INSERT INTO history (unique_hash, url, text_hash,
                             telegram_name, telegram_message_id,
                             telegram_chat_id, telegraph_url)
        VALUES ('${uniqueHash}', '${url}', '${textHash}',
                '${telegramName}', ${telegramMessageId},
                ${telegramChatId}, '${telegraphUrl}');
    `;

    db.run(sql);

    await write(db);
}

async function updateHistory(id, textHash, telegramMessageId) {
    const db = await get();
    const sql = `
        UPDATE history
        SET text_hash           = '${textHash}',
            telegram_message_id = ${telegramMessageId},
            updated_at          = CURRENT_TIMESTAMP
        WHERE id = ${id};
    `;

    db.run(sql);

    await write(db);
}

async function updateExpire(url, reset = false) {
    const db = await get();
    const existingItem = db.exec(`
        SELECT *
        FROM expire
        WHERE url = '${url}';
    `);

    if (existingItem.length === 0) {
        db.run(`
            INSERT INTO expire (url, expire)
            VALUES ('${url}', ${reset ? 0 : 1});
        `);
    } else {
        if (reset) {
            db.run(`
                UPDATE expire
                SET expire = 0
                WHERE url = '${url}';
            `);
        } else {
            db.run(`
                UPDATE expire
                SET expire = expire + 1
                WHERE url = '${url}';
            `);
        }
    }

    await write(db);
    return existingItem.length === 0 ? 1 : existingItem[0].values[0][2] + 1;
}

async function write(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.promises.writeFile(file, buffer);
}

async function get() {
    if (!db) {
        db = await init();
    }

    return db;
}

module.exports = {
    init, getHistory, addHistory, updateHistory, get, updateExpire,
}

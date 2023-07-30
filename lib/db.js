require("module-alias/register");
const fs = require("fs");
const initSqlJs = require("sql.js");
const logger = require("@lib/logger");

const file = __dirname + "/../config/" + (process.env.DB_FILE || "db.sqlite");

let db;

const init = async () => {
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
};

const getHistory = async (uniqueHash, url, telegramChatId) => {
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
};

const addHistory = async (
    uniqueHash,
    url,
    textHash,
    telegramName,
    telegramMessageId,
    telegramChatId,
    telegraphUrl
) => {
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
};

const updateHistory = async (id, textHash, telegramMessageId) => {
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
};

const updateExpire = async (url, reset = false) => {
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
};

const clean = async (numberOfDays = 30) => {
    const db = await get();
    db.run(`
        DELETE
        FROM history
        WHERE created_at < datetime('now', '-${numberOfDays} day');
    `);

    await write(db);
};

const write = async (db) => {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        await fs.promises.writeFile(file, buffer);
    } else {
        logger.error("db has not been initialized");
    }
};

const get = async () => {
    if (!db) {
        db = await init();
    }

    return db;
};

module.exports = {
    init,
    getHistory,
    addHistory,
    updateHistory,
    get,
    updateExpire,
    clean,
};

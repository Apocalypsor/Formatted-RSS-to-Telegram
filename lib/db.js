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
            url                 VARCHAR(255) NOT NULL,
            text_hash           VARCHAR(255) NOT NULL,
            telegram_name       VARCHAR(255) NOT NULL,
            telegram_message_id INTEGER      NOT NULL,
            telegram_chat_id    INTEGER      NOT NULL,
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

    console.log("database initialized");

    return db;
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
    init,
    write,
    get,
}

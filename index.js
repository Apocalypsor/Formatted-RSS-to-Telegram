const schedule = require('node-schedule');
const logger = require('./lib/logger');
const {rss} = require('./lib/config');
const {process} = require('./lib/process');
const {createDirIfNotExists} = require("./lib/tools");
const getClient = require("./lib/client");

require('dotenv').config();

async function main() {
    const ipInfo = await getClient(true).get("https://api.dov.moe/ip");
    logger.info(`IP: ${JSON.stringify(ipInfo.data)}`);
    await createDirIfNotExists('./logs/screenshots');
    for (let item of rss.rss) {
        try {
            await process(item);
        } catch (e) {
            logger.error(`Error while processing rss item ${item.name}: ${e.message}`);
        }
    }
}

main().then(() => {
    logger.info('Initial RSS processing finished');
    schedule.scheduleJob('*/10 * * * *', async function () {
        logger.info('Schedule job started');
        await main();
        logger.info('Schedule job finished');
    });
});

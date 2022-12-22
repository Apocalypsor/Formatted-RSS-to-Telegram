const schedule = require('node-schedule');
const logger = require('./lib/logger');
const {rss} = require('./lib/config');
const {process} = require('./lib/process');
const {createDirIfNotExists} = require("./lib/tools");
const getClient = require("./lib/client");
const {clean} = require("./lib/db");
const {config} = require('./lib/config');

require('dotenv').config();

async function getHostIPInfoThroughAPI() {
    try {
        const ipInfo = await getClient(true).get('https://api.dov.moe/ip');
        if (!ipInfo.data.success) return null;
        return JSON.stringify(ipInfo.data.data);
    } catch {
        return null;
    }
}

async function getHostIPInfoThroughCloudflare() {
    try {
        const ipInfo = await getClient(true).get('https://1.1.1.1/cdn-cgi/trace');
        return ipInfo.data;
    } catch {
        return null;
    }
}

async function getHostIPInfo() {
    const ipInfo = await getHostIPInfoThroughAPI();
    if (ipInfo) {
        return ipInfo;
    } else {
        return await getHostIPInfoThroughCloudflare();
    }
}

async function main() {
    const ipInfo = await getHostIPInfo();
    logger.info(`IP:\n${ipInfo}`);
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
    schedule.scheduleJob('0 0 */30 * *', async function () {
        logger.info('Start cleaning database');
        await clean(config.expireTime);
        logger.info('Finished cleaning database');
    });
}).catch(e => {
    logger.error(`Failed to start the initial RSS processing: ${e.message}`);
})

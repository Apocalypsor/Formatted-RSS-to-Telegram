const schedule = require('node-schedule');
const logger = require('./lib/logger');
const {rss} = require('./lib/config');
const {process} = require('./lib/process');

require('dotenv').config();

async function main() {
    for (let item of rss.rss) {
        try {
            await process(item);
        } catch (e) {
            logger.error('Error while processing rss item: ' + e.message);
        }
    }
}

main().then(() => {
    logger.info('RSS processing finished');
});

// schedule.scheduleJob('*/10 * * * *', async function () {
//     logger.info('Schedule job started');
//     await main();
// });
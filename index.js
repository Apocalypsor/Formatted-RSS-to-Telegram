require("module-alias/register");
const schedule = require("node-schedule");
const { process } = require("@services");
const logger = require("@utils/logger");
const { rss } = require("@utils/config");
const { config } = require("@utils/config");
const { createDirIfNotExists } = require("@utils/tools");
const getClient = require("@utils/client");
const { clean } = require("@utils/db");

require("dotenv").config();

const getHostIPInfoThroughAPI = async () => {
    try {
        const ipInfo = await getClient(true).get("https://api.dov.moe/ip");
        if (!ipInfo.data.success) return null;
        return JSON.stringify(ipInfo.data.data);
    } catch {
        return null;
    }
};

const getHostIPInfoThroughCloudflare = async () => {
    try {
        const ipInfo = await getClient(true).get(
            "https://1.1.1.1/cdn-cgi/trace",
        );
        return ipInfo.data;
    } catch {
        return null;
    }
};

const getHostIPInfo = async () => {
    const ipInfo = await getHostIPInfoThroughAPI();
    if (ipInfo) {
        return ipInfo;
    } else {
        return await getHostIPInfoThroughCloudflare();
    }
};

const main = async () => {
    const ipInfo = await getHostIPInfo();
    logger.info(`IP:\n${ipInfo}`);
    await createDirIfNotExists("./logs/screenshots");
    for (let item of rss.rss) {
        try {
            await process(item);
        } catch (e) {
            logger.error(
                `Error while processing rss item ${item.name}: ${e.message}`,
            );
        }
    }
};

main()
    .then(() => {
        logger.info("Initial RSS processing finished");
        logger.info(
            `Schedule job started, interval: ${config.interval} minutes`,
        );
        schedule.scheduleJob(`*/${config.interval} * * * *`, async function () {
            logger.info("Schedule job started");
            await main();
            logger.info("Schedule job finished");
        });
        schedule.scheduleJob("0 0 */30 * *", async function () {
            logger.info("Start cleaning database");
            await clean(config.expireTime);
            logger.info("Finished cleaning database");
        });
    })
    .catch((e) => {
        logger.error(
            `Failed to start the initial RSS processing: ${e.message}`,
        );
    });

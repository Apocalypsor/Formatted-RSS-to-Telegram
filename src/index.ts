import { config, rss } from "@config";
import { checkHistoryInitialized, clean } from "@database";
import processRSS, { messageQueue } from "@services";
import { createDirIfNotExists, getClient, logger, mapError } from "@utils";
import { scheduleJob } from "node-schedule";

// workaround for BigInt serialization
declare global {
    interface BigInt {
        toJSON: () => string;
    }
}

BigInt.prototype.toJSON = function () {
    return this.toString();
};

const getHostIPInfoThroughAPI = async () => {
    try {
        const client = await getClient(true);
        const ipInfo = await client.get("https://api.dov.moe/ip");
        if (!ipInfo.data.success) return null;
        return JSON.stringify(ipInfo.data.data);
    } catch {
        return null;
    }
};

const getHostIPInfoThroughCloudflare = async () => {
    try {
        const client = await getClient(true);
        const ipInfo = await client.get("https://1.1.1.1/cdn-cgi/trace");
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
    const firstRun = !(await checkHistoryInitialized());
    if (firstRun) {
        logger.info("First run detected, setting FIRST_RUN to true");
        process.env.FIRST_RUN = "true";
    }
    const ipInfo = await getHostIPInfo();
    logger.info(`IP:\n${ipInfo}`);
    await createDirIfNotExists("./config");
    await createDirIfNotExists("./logs/screenshots");

    for (const item of rss) {
        try {
            await processRSS(item);
        } catch (e) {
            logger.error(`Failed to process RSS item: ${mapError(e)}`);
        }
    }

    // Log queue status
    const queueSize = messageQueue.getQueueSize();
    if (queueSize > 0) {
        logger.info(`Message queue has ${queueSize} tasks pending`);
    }
};

// Recover pending tasks from database on startup
messageQueue
    .recoverPendingTasks()
    .then(() => main())
    .then(() => {
        logger.info("Initial RSS processing finished");
        logger.info(
            `Schedule job started, interval: ${config.interval} minutes`,
        );
        scheduleJob(`*/${config.interval} * * * *`, async function () {
            logger.info("Schedule job started");
            await main();
            logger.info("Schedule job finished");
        });
        scheduleJob("0 0 */30 * *", async function () {
            logger.info("Start cleaning database");
            await clean(config.expireTime);
            logger.info("Finished cleaning database");
        });
        // Clean up completed queue tasks daily at 3 AM
        scheduleJob("0 3 * * *", async function () {
            logger.info("Start cleaning completed queue tasks");
            await messageQueue.cleanupCompletedTasks(24);
            logger.info("Finished cleaning completed queue tasks");
        });
    })
    .catch((e) => {
        logger.error(
            `Failed to start the initial RSS processing: ${e.message}`,
        );
    });
export { MediaType } from "@consts";
export { TaskType } from "@consts";

import { config, rss } from "@config";
import { checkHistoryInitialized, clean } from "@database";
import processRSS, { messageQueue } from "@services";
import { createDirIfNotExists, getHostIPInfo, logger, mapError } from "@utils";
import { gracefulShutdown, scheduleJob } from "node-schedule";

// workaround for BigInt serialization
declare global {
    interface BigInt {
        toJSON: () => string;
    }
}

BigInt.prototype.toJSON = function () {
    return this.toString();
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

    await Promise.allSettled(
        rss.map(async (item) => {
            try {
                await processRSS(item);
            } catch (e) {
                logger.error(`Failed to process RSS item: ${mapError(e)}`);
            }
        }),
    );

    // Log queue status
    const queueSize = messageQueue.getQueueSize();
    if (queueSize > 0) {
        logger.info(`Message queue has ${queueSize} tasks pending`);
    }
};

// Graceful shutdown handler
const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await gracefulShutdown();
    await messageQueue.drain();
    logger.info("Shutdown complete");
    process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

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
        scheduleJob("0 3 * * *", async function () {
            logger.info("Start cleaning completed queue tasks");
            await messageQueue.cleanupCompletedTasks();
            logger.info("Finished cleaning completed queue tasks");
        });
    })
    .catch((e) => {
        logger.error(
            `Failed to start the initial RSS processing: ${e.message}`,
        );
    });

import { config, rss } from "@config";
import { checkHistoryInitialized, clean, initDatabase } from "@database";
import processRSS, { messageQueue, setFirstRun } from "@services";
import { createDirIfNotExists, getHostIPInfo, logger, mapError } from "@utils";
import { gracefulShutdown, scheduleJob } from "node-schedule";

const main = async () => {
  const isFirstRun = !(await checkHistoryInitialized());
  if (isFirstRun) {
    logger.info("First run detected");
    setFirstRun(true);
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

  // Clear FIRST_RUN after initialization completes
  if (isFirstRun) {
    setFirstRun(false);
    logger.info("First run completed");
  }

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

// Initialize database with optimized PRAGMA settings and recover pending tasks
initDatabase();
messageQueue.recoverPendingTasks();
main()
  .then(() => {
    logger.info("Initial RSS processing finished");
    logger.info(`Schedule job started, interval: ${config.interval} minutes`);
    scheduleJob(`*/${config.interval} * * * *`, async () => {
      logger.info("Schedule job started");
      await main();
      logger.info("Schedule job finished");
    });
    scheduleJob("0 0 */30 * *", async () => {
      logger.info("Start cleaning database");
      await clean(config.expireTime);
      logger.info("Finished cleaning database");
    });
    scheduleJob("0 3 * * *", async () => {
      logger.info("Start cleaning completed queue tasks");
      await messageQueue.cleanupCompletedTasks();
      logger.info("Finished cleaning completed queue tasks");
    });
  })
  .catch((e: Error) => {
    logger.error(`Failed to start the initial RSS processing: ${e.message}`);
  });

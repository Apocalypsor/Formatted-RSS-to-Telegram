import { config } from "@config/config";
import { rss } from "@config/rss";
import { checkHistoryInitialized, clean } from "@database/db";
import processRSS from "@services/index";
import { getClient } from "@utils/client";
import { createDirIfNotExists, mapError } from "@utils/helpers";
import logger from "@utils/logger";
import { scheduleJob } from "node-schedule";

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
    const firstRun = !(await checkHistoryInitialized());
    if (firstRun) {
        logger.info("First run detected, setting FIRST_RUN to true");
        process.env.FIRST_RUN = "true";
    }
    const ipInfo = await getHostIPInfo();
    logger.info(`IP:\n${ipInfo}`);
    await createDirIfNotExists("./config");
    await createDirIfNotExists("./logs/screenshots");
    for (let item of rss) {
        try {
            await processRSS(item);
        } catch (e) {
            logger.error(`Failed to process RSS item: ${mapError(e)}`);
        }
    }
};

main()
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
    })
    .catch((e) => {
        logger.error(
            `Failed to start the initial RSS processing: ${e.message}`,
        );
    });

const axios = require('axios');
const axiosRetry = require('axios-retry');

const {config} = require('./config');
const logger = require("./logger");

const client = axios.create({
    timeout: 10000,
    headers: {
        'User-Agent': config.userAgent,
    },
});

axiosRetry(client, {
    retryCondition: (e) => {
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(e) ||
            e.response.status === 429
        );
    },
    retryDelay: (retryCount, error) => {
        if (error.response) {
            const retry_after = error.response.headers["retry-after"];
            if (retry_after) {
                return retry_after;
            }
        }

        return axiosRetry.exponentialDelay(retryCount);
    }
});

client.interceptors.response.use((response) => response, (error) => {
    logger.debug('Error: ' + error.response.data.description);
    return Promise.reject(error);
});

module.exports = client;
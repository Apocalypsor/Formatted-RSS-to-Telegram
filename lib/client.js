const axios = require('axios');
const axiosRetry = require('axios-retry');

const {config} = require('./config');
const logger = require("./logger");

const client = axios.create({
    timeout: 10000,
    headers: {
        'user-agent': config.userAgent,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'max-age=0',
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
    logger.debug('Error: ' + error.message);
    return Promise.reject(error);
});

module.exports = client;
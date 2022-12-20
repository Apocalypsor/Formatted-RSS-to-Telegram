const axios = require('axios');
const axiosRetry = require('axios-retry');
const {SocksProxyAgent} = require('socks-proxy-agent');

const {config} = require('./config');
const logger = require("./logger");

const client = axios.create({
    timeout: 10000,
    headers: {
        'User-Agent': config.userAgent,
        'Accept-Encoding': 'gzip, deflate, compress',
        'Accept': 'application/rss+xml, application/json',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'max-age=0',
    }
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

function getClient(proxy = false) {
    if (config.proxy && proxy) {
        if (config.proxy.protocol === 'http') {
            client.defaults.proxy = {
                protocol: config.proxy.protocol,
                host: config.proxy.host,
                port: config.proxy.port,
                auth: {
                    username: config.proxy.auth.username,
                    password: config.proxy.auth.password,
                }
            };
        } else if (config.proxy.protocol === 'socks4' || config.proxy.protocol === 'socks5') {
            const auth = config.proxy.auth.username && config.proxy.auth.password ? `${config.proxy.auth.username}:${config.proxy.auth.password}@` : '';
            const proxyAgent = new SocksProxyAgent(`socks5://${auth}${config.proxy.host}:${config.proxy.port}`);
            client.defaults.httpsAgent = proxyAgent;
            client.defaults.httpAgent = proxyAgent;
        }
    } else {
        client.defaults.proxy = false;
        client.defaults.httpsAgent = false;
        client.defaults.httpAgent = false;
    }

    return client;
}

module.exports = getClient;
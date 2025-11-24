import { config } from "@config";
import logger from "@utils/logger";
import axios, { type AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { SocksProxyAgent } from "socks-proxy-agent";

const client = axios.create({
    timeout: 10000,
    headers: {
        "User-Agent": config.userAgent,
        "Accept-Encoding": "gzip, deflate, compress",
        "Accept": "application/rss+xml, application/json",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "Cache-Control": "max-age=0",
    },
});

axiosRetry(client, {
    retryCondition: (e) => {
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(e) ||
            e?.response?.status === 429
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
    },
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        let errMsg = `Error: ${error.message}`;
        if (error.response) {
            errMsg += ` - ${error.response.status} ${
                error.response.statusText
            } - ${JSON.stringify(error.response.data)}`;
        }
        logger.debug(errMsg);
        return Promise.reject(error);
    },
);

const getClient = (proxy = false): AxiosInstance => {
    if (config.proxy.enabled && proxy) {
        if (config.proxy.protocol === "http") {
            client.defaults.proxy = {
                protocol: config.proxy.protocol,
                host: config.proxy.host,
                port: config.proxy.port,
                auth: {
                    username: config.proxy.auth.username || "",
                    password: config.proxy.auth.password || "",
                },
            };
        } else if (
            config.proxy.protocol === "socks4" ||
            config.proxy.protocol === "socks5"
        ) {
            const auth =
                config.proxy.auth.username && config.proxy.auth.password
                    ? `${config.proxy.auth.username}:${config.proxy.auth.password}@`
                    : "";
            const proxyAgent = new SocksProxyAgent(
                `socks5://${auth}${config.proxy.host}:${config.proxy.port}`,
            );
            client.defaults.httpsAgent = proxyAgent;
            client.defaults.httpAgent = proxyAgent;
        }
    } else {
        client.defaults.proxy = false;
        client.defaults.httpsAgent = false;
        client.defaults.httpAgent = false;
    }

    return client;
};

export { getClient };

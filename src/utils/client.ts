import { logger } from "./logger";
import axios, { type AxiosInstance } from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { AXIOS_TIMEOUT } from "@consts";
import { mapError } from "./helpers";

// Cache for configured clients
let cachedClientWithProxy: AxiosInstance | null = null;
let cachedClientWithoutProxy: AxiosInstance | null = null;
let configLoaded = false;

const client = axios.create({
    timeout: AXIOS_TIMEOUT,
    headers: {
        "Accept-Encoding": "gzip, deflate, compress",
        "Accept": "application/rss+xml, application/json",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "Cache-Control": "max-age=0",
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
        logger.error(errMsg);
        return Promise.reject(error);
    },
);

export const getClient = async (proxy = false): Promise<AxiosInstance> => {
    // Return cached client if already configured
    if (configLoaded) {
        return proxy ? cachedClientWithProxy! : cachedClientWithoutProxy!;
    }

    // Lazy import to avoid circular dependency (only once)
    const { config } = await import("@config");

    // Set User-Agent header
    client.defaults.headers.common["User-Agent"] = config.userAgent;

    // Configure client with proxy
    if (config.proxy.enabled) {
        const clientWithProxy = axios.create({
            ...client.defaults,
            headers: {
                ...client.defaults.headers,
            },
        });

        // Copy interceptors
        clientWithProxy.interceptors.response.use(
            (response) => response,
            (error) => {
                let errMsg = `Error: ${error.message}`;
                if (error.response) {
                    errMsg += ` - ${error.response.status} ${
                        error.response.statusText
                    } - ${JSON.stringify(error.response.data)}`;
                }
                logger.error(errMsg);
                return Promise.reject(error);
            },
        );

        if (
            config.proxy.protocol === "http" ||
            config.proxy.protocol === "https"
        ) {
            const auth =
                config.proxy.auth.username && config.proxy.auth.password
                    ? `${config.proxy.auth.username}:${config.proxy.auth.password}@`
                    : "";
            const proxyAgent = new HttpsProxyAgent(
                `${config.proxy.protocol}://${auth}${config.proxy.host}:${config.proxy.port}`,
            );
            clientWithProxy.defaults.httpsAgent = proxyAgent;
            clientWithProxy.defaults.httpAgent = proxyAgent;
        } else if (
            config.proxy.protocol === "socks4" ||
            config.proxy.protocol === "socks5"
        ) {
            const auth =
                config.proxy.auth.username && config.proxy.auth.password
                    ? `${config.proxy.auth.username}:${config.proxy.auth.password}@`
                    : "";
            const proxyAgent = new SocksProxyAgent(
                `${config.proxy.protocol}://${auth}${config.proxy.host}:${config.proxy.port}`,
            );
            clientWithProxy.defaults.httpsAgent = proxyAgent;
            clientWithProxy.defaults.httpAgent = proxyAgent;
        }

        cachedClientWithProxy = clientWithProxy;
    } else {
        // If proxy not enabled, both cached clients point to the same instance
        cachedClientWithProxy = client;
    }

    // Client without proxy is always the base client
    cachedClientWithoutProxy = client;

    configLoaded = true;

    return proxy ? cachedClientWithProxy! : cachedClientWithoutProxy!;
};

/**
 * Fetch content using FlareSolver
 */
export const fetchWithFlareSolver = async (
    url: string,
): Promise<string | null> => {
    const { config } = await import("@config");

    if (!config.flaresolverr) {
        return null;
    }

    try {
        logger.debug(`Fetching with FlareSolver for ${url}`);
        const client = await getClient();
        return (
            await client.post(`${config.flaresolverr}/v1`, {
                cmd: "request.get",
                url: url,
                maxTimeout: 60000,
            })
        ).data?.solution?.response;
    } catch (e) {
        logger.warn(`FlareSolver failed for ${url}: ${mapError(e)}`);
        return null;
    }
};

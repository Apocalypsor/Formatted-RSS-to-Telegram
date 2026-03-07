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

const errorInterceptor = (error: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let errMsg = `Error: ${error.message}`;
    if (error.response) {
        errMsg += ` - ${error.response.status} ${
            error.response.statusText
        } - ${JSON.stringify(error.response.data)}`;
    }
    logger.error(errMsg);
    return Promise.reject(error);
};

const client = axios.create({
    timeout: AXIOS_TIMEOUT,
    headers: {
        "Accept-Encoding": "gzip, deflate, compress",
        "Accept": "application/rss+xml, application/json",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "Cache-Control": "max-age=0",
    },
});

client.interceptors.response.use((response) => response, errorInterceptor);

const buildProxyUrl = (proxy: {
    protocol: string;
    host: string;
    port: number;
    auth: { username: string; password: string };
}): string => {
    let auth = "";
    if (proxy.auth.username && proxy.auth.password) {
        const user = encodeURIComponent(proxy.auth.username);
        const pass = encodeURIComponent(proxy.auth.password);
        auth = `${user}:${pass}@`;
    }
    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};

export const getClient = async (proxy = false): Promise<AxiosInstance> => {
    // Return cached client if already configured
    if (configLoaded) {
        return proxy ? cachedClientWithProxy ?? client : cachedClientWithoutProxy ?? client;
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

        clientWithProxy.interceptors.response.use(
            (response) => response,
            errorInterceptor,
        );

        const proxyUrl = buildProxyUrl(config.proxy);

        const proxyAgent =
            config.proxy.protocol === "socks4" ||
            config.proxy.protocol === "socks5"
                ? new SocksProxyAgent(proxyUrl)
                : new HttpsProxyAgent(proxyUrl);

        clientWithProxy.defaults.httpsAgent = proxyAgent;
        clientWithProxy.defaults.httpAgent = proxyAgent;

        cachedClientWithProxy = clientWithProxy;
    } else {
        cachedClientWithProxy = client;
    }

    cachedClientWithoutProxy = client;
    configLoaded = true;

    return proxy ? cachedClientWithProxy ?? client : cachedClientWithoutProxy ?? client;
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
        const c = await getClient();
        return (
            await c.post(`${config.flaresolverr}/v1`, {
                cmd: "request.get",
                url: url,
                maxTimeout: AXIOS_TIMEOUT,
            })
        ).data?.solution?.response;
    } catch (e) {
        logger.warn(`FlareSolver failed for ${url}: ${mapError(e)}`);
        return null;
    }
};

import { HTTP_TIMEOUT } from "@consts";
import ky, { type KyInstance } from "ky";
import { mapError } from "./error";
import { logger } from "./logger";

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

const initClients = async (): Promise<{
  base: KyInstance;
  proxy: KyInstance;
}> => {
  const { config } = await import("@config");

  const base = ky.create({
    timeout: HTTP_TIMEOUT,
    headers: {
      "Accept-Encoding": "gzip, deflate, compress",
      Accept: "application/rss+xml, application/json",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      "Cache-Control": "max-age=0",
      "User-Agent": config.userAgent,
    },
    hooks: {
      beforeError: [
        (error) => {
          logger.error(`Error: ${error.message}`);
          return error;
        },
      ],
    },
  });

  const proxyClient = config.proxy.enabled
    ? base.extend({
        fetch: (input, init) => {
          const proxyUrl = buildProxyUrl(
            config.proxy as {
              protocol: string;
              host: string;
              port: number;
              auth: { username: string; password: string };
            },
          );
          return fetch(input, { ...init, proxy: proxyUrl } as RequestInit);
        },
      })
    : base;

  return { base, proxy: proxyClient };
};

const clients = initClients();

export const getClient = async (proxy = false): Promise<KyInstance> => {
  const c = await clients;
  return proxy ? c.proxy : c.base;
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
    const resp = await client
      .post(`${config.flaresolverr}/v1`, {
        json: {
          cmd: "request.get",
          url: url,
          maxTimeout: HTTP_TIMEOUT,
        },
      })
      .json<{ solution?: { response?: string } }>();
    return resp?.solution?.response ?? null;
  } catch (e) {
    logger.warn(`FlareSolver failed for ${url}: ${mapError(e)}`);
    return null;
  }
};

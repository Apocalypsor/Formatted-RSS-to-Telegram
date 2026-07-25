import { HTTP_TIMEOUT } from "@consts";
import ky, { type KyInstance } from "ky";
import { logger } from "../utils/logger";

interface ProxyConfig {
  protocol: string;
  host: string;
  port: number;
  auth: { username: string; password: string };
}

interface ClientPair {
  base: KyInstance;
  proxy: KyInstance;
}

const buildProxyUrl = (proxy: ProxyConfig): string => {
  let auth = "";
  if (proxy.auth.username && proxy.auth.password) {
    const user = encodeURIComponent(proxy.auth.username);
    const pass = encodeURIComponent(proxy.auth.password);
    auth = `${user}:${pass}@`;
  }
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};

export class KyClient {
  private clients?: Promise<ClientPair>;

  async getInstance(proxy = false): Promise<KyInstance> {
    this.clients ??= this.initClients();
    const clients = await this.clients;
    return proxy ? clients.proxy : clients.base;
  }

  private async initClients(): Promise<ClientPair> {
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
            const proxyUrl = buildProxyUrl(config.proxy as ProxyConfig);
            return fetch(input, { ...init, proxy: proxyUrl } as RequestInit);
          },
        })
      : base;

    return { base, proxy: proxyClient };
  }
}

export const kyClient = new KyClient();

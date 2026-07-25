import { HTTP_TIMEOUT } from "@consts";
import { mapError } from "../utils/error";
import { logger } from "../utils/logger";
import { type KyClient, kyClient } from "./ky";

export class FlareSolverrClient {
  constructor(
    private readonly http: Pick<KyClient, "getInstance"> = kyClient,
  ) {}

  async fetch(url: string): Promise<string | null> {
    const { config } = await import("@config");
    if (!config.flaresolverr) return null;

    try {
      logger.debug(`Fetching with FlareSolver for ${url}`);
      const client = await this.http.getInstance();
      const resp = await client
        .post(`${config.flaresolverr}/v1`, {
          json: {
            cmd: "request.get",
            url,
            maxTimeout: HTTP_TIMEOUT,
          },
        })
        .json<{ solution?: { response?: string } }>();
      return resp?.solution?.response ?? null;
    } catch (error) {
      logger.warn(`FlareSolver failed for ${url}: ${mapError(error)}`);
      return null;
    }
  }
}

export const flareSolverrClient = new FlareSolverrClient();

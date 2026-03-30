import type { RemoteMatcher } from "@config";
import { REMOTE_MATCHER_CACHE_TTL } from "@consts";
import { getClient, logger } from "@utils";

interface CachedPattern {
  pattern: string;
  fetchedAt: number;
}

const cache = new Map<string, CachedPattern>();

const NEVER_MATCH = "(?!.*)";

const fetchAndTransform = async (matcher: RemoteMatcher): Promise<string> => {
  const client = await getClient();
  const data = await client.get(matcher.url).text();

  if (!matcher.func) return data.trim();

  const fn = new Function("data", matcher.func);
  const result = fn(data);
  if (typeof result !== "string") {
    throw new Error(
      `Remote matcher func for ${matcher.url} returned ${typeof result}, expected string`,
    );
  }
  return result;
};

export const resolveMatcherPattern = async (
  matcher: string | RemoteMatcher,
): Promise<string> => {
  if (typeof matcher === "string") return matcher;

  const cached = cache.get(matcher.url);
  if (cached && Date.now() - cached.fetchedAt < REMOTE_MATCHER_CACHE_TTL) {
    return cached.pattern;
  }

  try {
    const pattern = await fetchAndTransform(matcher);
    cache.set(matcher.url, { pattern, fetchedAt: Date.now() });
    logger.debug(
      `Fetched remote matcher from ${matcher.url}: ${pattern.substring(0, 100)}`,
    );
    return pattern;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`Failed to fetch remote matcher from ${matcher.url}: ${msg}`);

    if (cached) {
      logger.warn(`Using stale cached matcher for ${matcher.url}`);
      return cached.pattern;
    }

    return NEVER_MATCH;
  }
};

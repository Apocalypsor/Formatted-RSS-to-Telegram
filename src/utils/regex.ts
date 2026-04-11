const regexCache = new Map<string, RegExp>();
const REGEX_CACHE_CAPACITY = 1000;

export const getCachedRegex = (pattern: string): RegExp => {
  const cached = regexCache.get(pattern);
  if (cached) {
    regexCache.delete(pattern);
    regexCache.set(pattern, cached);
    return cached;
  }
  if (regexCache.size >= REGEX_CACHE_CAPACITY) {
    const oldest = regexCache.keys().next().value;
    if (oldest !== undefined) regexCache.delete(oldest);
  }
  const regex = new RegExp(pattern);
  regexCache.set(pattern, regex);
  return regex;
};

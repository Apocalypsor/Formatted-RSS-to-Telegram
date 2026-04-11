import * as cheerio from "cheerio";

export const htmlDecode = (input: string): string | null => {
  const $ = cheerio.load(input, { xml: false });
  const text = $("body").text();
  if (!text) return null;
  const rssMatch = text.match(/<rss[\s\S]+<\/rss>/);
  if (rssMatch) return rssMatch[0];
  const feedMatch = text.match(/<feed[\s\S]+<\/feed>/);
  return feedMatch ? feedMatch[0] : null;
};

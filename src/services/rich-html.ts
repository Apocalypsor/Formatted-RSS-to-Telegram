import * as cheerio from "cheerio";
import { isTag } from "domhandler";

export interface RichHtmlOptions {
  baseUrl?: string;
  embedMedia: boolean;
  mediaExclude: string[];
}

const REMOVED_ELEMENTS = "script,style,noscript,iframe,svg,canvas,object,embed";
const MEDIA_ELEMENTS = "img,video,audio";

const ALLOWED_ELEMENTS = new Set([
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "code",
  "mark",
  "sub",
  "sup",
  "tg-spoiler",
  "tg-reference",
  "tg-emoji",
  "tg-time",
  "tg-math",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "pre",
  "footer",
  "hr",
  "ul",
  "ol",
  "li",
  "blockquote",
  "aside",
  "cite",
  "img",
  "video",
  "audio",
  "figure",
  "figcaption",
  "tg-map",
  "tg-collage",
  "tg-slideshow",
  "table",
  "caption",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "tg-math-block",
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "name"]),
  code: new Set(["class"]),
  ol: new Set(["start", "type", "reversed"]),
  li: new Set(["value", "type"]),
  img: new Set(["src", "alt", "tg-spoiler"]),
  video: new Set(["src", "tg-spoiler"]),
  audio: new Set(["src"]),
  "tg-emoji": new Set(["emoji-id"]),
  "tg-time": new Set(["unix", "format"]),
  "tg-map": new Set(["lat", "long", "zoom"]),
  table: new Set(["bordered", "striped"]),
  th: new Set(["colspan", "rowspan", "align", "valign"]),
  td: new Set(["colspan", "rowspan", "align", "valign"]),
  details: new Set(["open"]),
};

const resolveHttpUrl = (value: string, baseUrl?: string): string | null => {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const isExcluded = (url: string, patterns: string[]): boolean =>
  patterns.some((pattern) => new RegExp(pattern).test(url));

export const buildRichContent = (
  content: string,
  options: RichHtmlOptions,
): string => {
  const $ = cheerio.load(content, { xml: false }, false);
  $(REMOVED_ELEMENTS).remove();

  $(MEDIA_ELEMENTS).each((_, element) => {
    const media = $(element);
    if (!options.embedMedia) {
      media.remove();
      return;
    }

    const tag = element.tagName.toLowerCase();
    const lazyImageSource =
      tag === "img"
        ? (media.attr("data-src") ??
          media.attr("data-lazy-src") ??
          media.attr("data-original"))
        : undefined;
    const childSource =
      tag === "video" || tag === "audio"
        ? media.find("source[src]").first().attr("src")
        : undefined;
    const source = media.attr("src") ?? lazyImageSource ?? childSource;
    const resolved = source ? resolveHttpUrl(source, options.baseUrl) : null;

    if (!resolved || isExcluded(resolved, options.mediaExclude)) {
      media.remove();
      return;
    }

    media.attr("src", resolved);
    media.find("source").remove();
  });

  $("source").remove();

  $("*")
    .toArray()
    .forEach((element) => {
      if (!isTag(element)) {
        return;
      }

      const tag = element.tagName.toLowerCase();
      const node = $(element);
      if (!ALLOWED_ELEMENTS.has(tag)) {
        node.replaceWith(node.contents());
        return;
      }

      const allowed = ALLOWED_ATTRIBUTES[tag] ?? new Set<string>();
      for (const attribute of Object.keys(element.attribs)) {
        if (!allowed.has(attribute)) {
          node.removeAttr(attribute);
        }
      }
    });

  return $.root().html()?.trim() ?? "";
};

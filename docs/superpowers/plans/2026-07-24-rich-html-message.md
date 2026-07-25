# Per-Feed Rich HTML Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `parseMode: RichHTML` for Telegram senders and individual RSS subscriptions, preserving inline RSS media while keeping existing standard-message behavior compatible.

**Architecture:** Resolve an RSS-level `parseMode` override into the existing effective sender before rendering and queueing. Build normalized Rich HTML in a focused service, render RichHTML templates with HTML autoescaping, and select pure Telegram request builders by the resolved mode. The persistent queue continues to serialize the effective sender, so no database migration is needed.

**Tech Stack:** Bun, TypeScript, Zod, Nunjucks, Cheerio, ky, Bun test.

## Global Constraints

- Accept configured modes `Markdown`, `MarkdownV2`, `HTML`, and `RichHTML`.
- Normalize newly processed `Markdown` configuration to `MarkdownV2`; recovered queue tasks serialized with `Markdown` continue to send as legacy Markdown.
- Resolve the effective mode as `rss.parseMode ?? telegram.parseMode` before rendering and queue persistence.
- Standard modes keep the current `sendMessage`, single-media, and `sendMediaGroup` behavior.
- RichHTML uses `sendRichMessage`, embeds at most the normalized media already present in RSS content, and never sends a separate media group.
- RichHTML edits use `editMessageText` with `rich_message.html`.
- Do not change synchronous database APIs or queue reserve/finalize history behavior.
- Do not add a dependency or a database migration.
- Follow strict TDD: each production behavior is preceded by a focused failing test whose failure is observed.

---

## File structure

- `src/config/schema.ts`: validates sender and optional per-RSS parse modes.
- `src/services/pipeline.ts`: resolves effective sender settings and chooses standard media extraction versus RichHTML content preparation.
- `src/services/rich-html.ts`: sanitizes RSS HTML and normalizes inline media URLs for Telegram Rich HTML.
- `src/services/render.ts`: selects the autoescaped RichHTML Nunjucks environment.
- `src/services/telegram-request.ts`: pure Telegram send/edit request builders.
- `src/services/sender.ts`: performs HTTP calls using the pure request builders.
- `src/services/index.ts`: wires prepared RichHTML content into template data and the existing queue.
- `tests/services/*.test.ts`: behavior tests using Bun's built-in runner.
- `README.md`, `docs/config_sample.yaml`, `docs/rss_sample.yaml`: user-facing configuration and template examples.

---

### Task 1: Parse-mode validation and per-feed override

**Files:**
- Create: `tests/services/pipeline.test.ts`
- Modify: `src/config/schema.ts`
- Modify: `src/services/pipeline.ts`

**Interfaces:**
- Produces: `ParseModeSchema` accepting `Markdown | MarkdownV2 | HTML | RichHTML`.
- Produces: `RSS.parseMode?: ParseMode`.
- Produces: `buildEffectiveSender(rssItem: RSS, sender: Telegram): Telegram`, with a newly processed `Markdown` normalized to `MarkdownV2`.

- [ ] **Step 1: Write failing effective-mode tests**

```ts
import { describe, expect, test } from "bun:test";
import { RSSItemSchema, TelegramSchema } from "../../src/config/schema";
import { buildEffectiveSender } from "../../src/services/pipeline";

const senderInput = {
  name: "default",
  token: "token",
  chatId: 123,
};

const rssInput = {
  name: "feed",
  url: "https://example.com/feed.xml",
  sendTo: "default",
  text: "{{ title }}",
};

describe("buildEffectiveSender", () => {
  test("normalizes a newly configured Markdown sender to MarkdownV2", () => {
    const sender = TelegramSchema.parse({
      ...senderInput,
      parseMode: "Markdown",
    });
    const rssItem = RSSItemSchema.parse(rssInput);

    expect(buildEffectiveSender(rssItem, sender).parseMode).toBe("MarkdownV2");
  });

  test("uses the RSS RichHTML override instead of the sender default", () => {
    const sender = TelegramSchema.parse({
      ...senderInput,
      parseMode: "MarkdownV2",
    });
    const rssItem = RSSItemSchema.parse({
      ...rssInput,
      parseMode: "RichHTML",
    });

    expect(buildEffectiveSender(rssItem, sender).parseMode).toBe("RichHTML");
  });
});
```

The first test catches removal of the Markdown compatibility alias. The second catches loss of the RSS-over-sender precedence.

- [ ] **Step 2: Run the tests and verify the intended failures**

Run: `bun test tests/services/pipeline.test.ts`

Expected: the first assertion receives `Markdown`; the second receives `MarkdownV2` because `RSSItemSchema` currently discards `parseMode`.

- [ ] **Step 3: Add the validated parse modes and override resolution**

Add to `src/config/schema.ts`:

```ts
export const ParseModeSchema = z.enum([
  "Markdown",
  "MarkdownV2",
  "HTML",
  "RichHTML",
]);

export type ParseMode = z.infer<typeof ParseModeSchema>;
```

Replace the sender field and add the RSS field:

```ts
parseMode: ParseModeSchema.default("Markdown"),
```

```ts
parseMode: ParseModeSchema.optional(),
```

Update `buildEffectiveSender()` in `src/services/pipeline.ts`:

```ts
const normalizeConfiguredParseMode = (
  parseMode: Telegram["parseMode"],
): Telegram["parseMode"] =>
  parseMode === "Markdown" ? "MarkdownV2" : parseMode;

export const buildEffectiveSender = (
  rssItem: RSS,
  sender: Telegram,
): Telegram => ({
  ...sender,
  parseMode: normalizeConfiguredParseMode(
    rssItem.parseMode ?? sender.parseMode,
  ),
  disableNotification:
    rssItem.disableNotification || sender.disableNotification,
  disableWebPagePreview:
    rssItem.disableWebPagePreview || sender.disableWebPagePreview,
});
```

- [ ] **Step 4: Run the focused test and full typecheck**

Run: `bun test tests/services/pipeline.test.ts`

Expected: 2 tests pass.

Run: `bun typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit the configuration behavior**

```bash
git add src/config/schema.ts src/services/pipeline.ts tests/services/pipeline.test.ts
git commit -m "feat: add per-feed rich html parse mode"
```

---

### Task 2: Rich HTML normalization and inline media

**Files:**
- Create: `src/services/rich-html.ts`
- Create: `tests/services/rich-html.test.ts`

**Interfaces:**
- Produces: `RichHtmlOptions { baseUrl?: string; embedMedia: boolean; mediaExclude: string[] }`.
- Produces: `buildRichContent(content: string, options: RichHtmlOptions): string`.

- [ ] **Step 1: Write failing sanitizer tests**

```ts
import { describe, expect, test } from "bun:test";
import { buildRichContent } from "../../src/services/rich-html";

describe("buildRichContent", () => {
  test("keeps readable supported markup and removes executable markup", () => {
    const result = buildRichContent(
      '<script>alert(1)</script><div><p>Hello <b>world</b></p></div>',
      { embedMedia: true, mediaExclude: [] },
    );

    expect(result).toBe("<p>Hello <b>world</b></p>");
  });

  test("normalizes a lazy relative image and strips unrelated attributes", () => {
    const result = buildRichContent(
      '<p>Before</p><img data-src="/images/card.jpg" class="hero" width="900"><p>After</p>',
      {
        baseUrl: "https://example.com/posts/42",
        embedMedia: true,
        mediaExclude: [],
      },
    );

    expect(result).toBe(
      '<p>Before</p><img src="https://example.com/images/card.jpg"><p>After</p>',
    );
  });

  test("removes excluded media after resolving its URL", () => {
    const result = buildRichContent(
      '<p>Text</p><img src="/images/emoji/smile.png">',
      {
        baseUrl: "https://example.com/topic/1",
        embedMedia: true,
        mediaExclude: ["https://example.com/images/emoji/.+"],
      },
    );

    expect(result).toBe("<p>Text</p>");
  });

  test("removes all media when embedding is disabled", () => {
    const result = buildRichContent(
      '<p>Text</p><img src="https://example.com/a.jpg"><video src="https://example.com/a.mp4"></video>',
      { embedMedia: false, mediaExclude: [] },
    );

    expect(result).toBe("<p>Text</p>");
  });
});
```

These tests catch executable markup leakage, broken relative media, lost element ordering, ignored exclusion rules, and media being retained against configuration.

- [ ] **Step 2: Run the sanitizer tests and verify the missing-module failure**

Run: `bun test tests/services/rich-html.test.ts`

Expected: FAIL because `src/services/rich-html.ts` does not exist.

- [ ] **Step 3: Implement the focused Rich HTML normalizer**

Create `src/services/rich-html.ts` with these constants and public contract:

```ts
import * as cheerio from "cheerio";

export interface RichHtmlOptions {
  baseUrl?: string;
  embedMedia: boolean;
  mediaExclude: string[];
}

const REMOVED_ELEMENTS = "script,style,noscript,iframe,svg,canvas,object,embed";
const MEDIA_ELEMENTS = "img,video,audio";

const ALLOWED_ELEMENTS = new Set([
  "a", "b", "strong", "i", "em", "u", "ins", "s", "strike", "del",
  "code", "mark", "sub", "sup", "tg-spoiler", "tg-reference",
  "tg-emoji", "tg-time", "tg-math", "br", "h1", "h2", "h3", "h4",
  "h5", "h6", "p", "pre", "footer", "hr", "ul", "ol", "li",
  "blockquote", "aside", "cite", "img", "video", "audio", "figure",
  "figcaption", "tg-map", "tg-collage", "tg-slideshow", "table",
  "caption", "tr", "th", "td", "details", "summary", "tg-math-block",
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
```

Implement URL resolution and exclusion with literal, independently testable behavior:

```ts
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
```

`buildRichContent()` must load a fragment with
`cheerio.load(content, { xml: false }, false)`, remove `REMOVED_ELEMENTS`,
normalize each media node before attribute stripping, unwrap elements not in
`ALLOWED_ELEMENTS`, remove attributes not listed for the final element name,
and return `$.root().html()?.trim() ?? ""`.

For `img`, the source lookup order is `src`, `data-src`, `data-lazy-src`, then
`data-original`. For `video` and `audio`, use their own `src`, followed by the
first child `source[src]`. Remove the media node when embedding is disabled,
the resolved URL is not HTTP(S), or an exclusion regex matches. Set the final
resolved URL as `src` before stripping attributes.

Use this implementation body:

```ts
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
        ? media.attr("data-src") ??
          media.attr("data-lazy-src") ??
          media.attr("data-original")
        : undefined;
    const childSource =
      tag === "video" || tag === "audio"
        ? media.find("source[src]").first().attr("src")
        : undefined;
    const source = media.attr("src") ?? lazyImageSource ?? childSource;
    const resolved = source
      ? resolveHttpUrl(source, options.baseUrl)
      : null;

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
```

- [ ] **Step 4: Run tests, adjust only serialization details observed from Cheerio, and keep behavior unchanged**

Run: `bun test tests/services/rich-html.test.ts`

Expected: 4 tests pass. If Cheerio uses equivalent void-element serialization,
change the hand-written expected string once to match its stable output; do not
weaken assertions to snapshots or broad truthiness.

Run: `bun typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit Rich HTML normalization**

```bash
git add src/services/rich-html.ts tests/services/rich-html.test.ts
git commit -m "feat: normalize rss content for rich html"
```

---

### Task 3: Autoescaped RichHTML template rendering

**Files:**
- Create: `tests/services/render.test.ts`
- Modify: `src/services/render.ts`

**Interfaces:**
- Consumes: configured mode string `RichHTML`.
- Preserves: `render(template: string, data: object, parseMode?: string): string`.
- Produces: HTML-escaped ordinary variables with explicit raw insertion through Nunjucks `safe`.

- [ ] **Step 1: Write a failing RichHTML rendering test**

```ts
import { expect, test } from "bun:test";
import { render } from "../../src/services/render";

test("autoescapes RichHTML fields while preserving sanitized rich_content", () => {
  const result = render(
    "<h1>{{ title }}</h1>{{ rich_content | safe }}",
    {
      title: "Cards & <Deals>",
      rich_content: '<p>Body <img src="https://example.com/card.jpg"></p>',
    },
    "RichHTML",
  );

  expect(result).toBe(
    '<h1>Cards &amp; &lt;Deals&gt;</h1><p>Body <img src="https://example.com/card.jpg"></p>',
  );
});
```

This test catches disabling autoescape and accidentally escaping the already sanitized body.

- [ ] **Step 2: Run the test and verify raw title markup leaks**

Run: `bun test tests/services/render.test.ts`

Expected: FAIL because the result contains raw `& <Deals>`.

- [ ] **Step 3: Add a separate autoescaped Nunjucks environment**

In `src/services/render.ts`, create:

```ts
const richHtmlEnvironment = new nunjucks.Environment(undefined, {
  autoescape: true,
});
```

Branch before the existing Markdown rendering and entity-decoding path:

```ts
if (parseMode.toLowerCase() === "richhtml") {
  return richHtmlEnvironment.renderString(template, data);
}
```

Do not pass RichHTML output through `decodeHtmlEntities`, because that would
turn escaped user fields back into markup. Leave MarkdownV2 and HTML behavior
unchanged.

- [ ] **Step 4: Run focused and existing tests**

Run: `bun test tests/services/render.test.ts tests/services/pipeline.test.ts`

Expected: all tests pass.

Run: `bun typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit rendering support**

```bash
git add src/services/render.ts tests/services/render.test.ts
git commit -m "feat: render autoescaped rich html templates"
```

---

### Task 4: Prepare RichHTML content in the processor

**Files:**
- Modify: `tests/services/pipeline.test.ts`
- Modify: `src/services/pipeline.ts`
- Modify: `src/services/index.ts`

**Interfaces:**
- Consumes: `buildRichContent(content, options)` from Task 2.
- Produces: `PreparedMessageContent { richContent?: string; mediaUrls?: Array<{ type: MEDIA_TYPE; url: string }> }`.
- Produces: `prepareMessageContent(rssItem: RSS, sender: Telegram, content: string, articleUrl?: string): PreparedMessageContent`.

- [ ] **Step 1: Add failing preparation tests**

Append to `tests/services/pipeline.test.ts`:

```ts
import { prepareMessageContent } from "../../src/services/pipeline";

test("prepares inline content instead of a media group for RichHTML", () => {
  const sender = TelegramSchema.parse({
    ...senderInput,
    parseMode: "RichHTML",
  });
  const rssItem = RSSItemSchema.parse({
    ...rssInput,
    embedMedia: true,
  });

  const prepared = prepareMessageContent(
    rssItem,
    sender,
    '<p>Body</p><img src="https://example.com/card.jpg">',
    "https://example.com/article",
  );

  expect(prepared.mediaUrls).toBeUndefined();
  expect(prepared.richContent).toBe(
    '<p>Body</p><img src="https://example.com/card.jpg">',
  );
});

test("keeps standard media extraction for MarkdownV2", () => {
  const sender = TelegramSchema.parse({
    ...senderInput,
    parseMode: "MarkdownV2",
  });
  const rssItem = RSSItemSchema.parse({
    ...rssInput,
    embedMedia: true,
  });

  const prepared = prepareMessageContent(
    rssItem,
    sender,
    '<p>Body</p><img src="https://example.com/card.jpg">',
  );

  expect(prepared.richContent).toBeUndefined();
  expect(prepared.mediaUrls).toEqual([
    { type: "photo", url: "https://example.com/card.jpg" },
  ]);
});
```

The tests catch RichHTML accidentally sending duplicate media and standard formats losing existing embedding.

- [ ] **Step 2: Run the pipeline tests and verify the missing-export failure**

Run: `bun test tests/services/pipeline.test.ts`

Expected: FAIL because `prepareMessageContent` is not exported.

- [ ] **Step 3: Implement the pure preparation boundary**

In `src/services/pipeline.ts`, import `buildRichContent`, export the prepared
interface, and add:

```ts
export interface PreparedMessageContent {
  richContent?: string;
  mediaUrls?: { type: MEDIA_TYPE; url: string }[];
}

export const prepareMessageContent = (
  rssItem: RSS,
  sender: Telegram,
  content: string,
  articleUrl?: string,
): PreparedMessageContent => {
  if (sender.parseMode === "RichHTML") {
    return {
      richContent: buildRichContent(content, {
        baseUrl: articleUrl,
        embedMedia: rssItem.embedMedia,
        mediaExclude: rssItem.embedMediaExclude,
      }),
    };
  }

  return {
    mediaUrls: rssItem.embedMedia
      ? extractFilteredMedia(rssItem, content)
      : undefined,
  };
};
```

- [ ] **Step 4: Wire preparation and effective mode before rendering**

In `src/services/index.ts`, build `effectiveSender` immediately after rules and
filters. Replace direct media extraction with:

```ts
const prepared = prepareMessageContent(
  rssItem,
  effectiveSender,
  typeof itemObj.content === "string" ? itemObj.content : "",
  typeof itemObj.link === "string" ? itemObj.link : undefined,
);

if (prepared.richContent !== undefined) {
  itemObj.rich_content = prepared.richContent;
}
```

Render with `effectiveSender.parseMode`, and pass `prepared.mediaUrls` to
`messageQueue.enqueueSend()`. Remove the later duplicate declaration of
`effectiveSender` and the direct `extractFilteredMedia` import.

- [ ] **Step 5: Run processor-boundary tests and typecheck**

Run: `bun test tests/services/pipeline.test.ts tests/services/rich-html.test.ts tests/services/render.test.ts`

Expected: all tests pass.

Run: `bun typecheck`

Expected: exit 0.

- [ ] **Step 6: Commit processor integration**

```bash
git add src/services/index.ts src/services/pipeline.ts tests/services/pipeline.test.ts
git commit -m "feat: prepare inline media for rich html feeds"
```

---

### Task 5: Telegram rich-message send and edit requests

**Files:**
- Create: `src/services/telegram-request.ts`
- Create: `tests/services/telegram-request.test.ts`
- Modify: `src/services/sender.ts`

**Interfaces:**
- Produces: `MediaItem { type: MEDIA_TYPE; url: string }`.
- Produces: `TgRequest { endpoint: string; payload: Record<string, unknown> }`.
- Produces: `buildSendRequest(sender: Telegram, text: string, mediaUrls?: MediaItem[]): TgRequest`.
- Produces: `buildEditTextRequest(sender: Telegram, messageId: number, text: string): TgRequest`.
- Produces: `buildEditCaptionRequest(sender: Telegram, messageId: number, caption: string): TgRequest`.

- [ ] **Step 1: Write failing pure request tests**

```ts
import { describe, expect, test } from "bun:test";
import type { Telegram } from "../../src/config/schema";
import {
  buildEditTextRequest,
  buildSendRequest,
} from "../../src/services/telegram-request";

const sender: Telegram = {
  name: "default",
  token: "secret",
  chatId: 123,
  parseMode: "RichHTML",
  disableNotification: true,
  disableWebPagePreview: true,
};

describe("Telegram rich-message requests", () => {
  test("builds sendRichMessage and ignores separate media", () => {
    expect(
      buildSendRequest(sender, "<h1>Title</h1>", [
        { type: "photo", url: "https://example.com/duplicate.jpg" },
      ]),
    ).toEqual({
      endpoint: "https://api.telegram.org/botsecret/sendRichMessage",
      payload: {
        chat_id: 123,
        rich_message: { html: "<h1>Title</h1>" },
        disable_notification: true,
      },
    });
  });

  test("builds a rich_message edit payload", () => {
    expect(buildEditTextRequest(sender, 456, "<p>Updated</p>")).toEqual({
      endpoint: "https://api.telegram.org/botsecret/editMessageText",
      payload: {
        chat_id: 123,
        message_id: 456,
        rich_message: { html: "<p>Updated</p>" },
      },
    });
  });

  test("preserves a recovered legacy Markdown request", () => {
    const recovered = { ...sender, parseMode: "Markdown" } as Telegram;

    expect(buildSendRequest(recovered, "*legacy*").payload).toEqual({
      chat_id: 123,
      text: "*legacy*",
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      disable_notification: true,
    });
  });
});
```

The tests catch selecting the wrong Telegram endpoint, duplicating media,
emitting unsupported rich-message fields, and breaking old persisted tasks.

- [ ] **Step 2: Run request tests and verify the missing-module failure**

Run: `bun test tests/services/telegram-request.test.ts`

Expected: FAIL because `src/services/telegram-request.ts` does not exist.

- [ ] **Step 3: Move existing pure request construction into the new module**

Create `src/services/telegram-request.ts`. Import `Telegram` directly from
`../config/schema` with `import type` so tests do not load filesystem-backed
configuration. Move `tgEndpoint`, standard text, single-media, and media-group
construction from `sender.ts` without changing their payloads.

Add the RichHTML branch at the start of `buildSendRequest()`:

```ts
if (sender.parseMode === "RichHTML") {
  return {
    endpoint: tgEndpoint(sender.token, "sendRichMessage"),
    payload: {
      chat_id: sender.chatId,
      rich_message: { html: text },
      disable_notification: sender.disableNotification,
    },
  };
}
```

Add edit builders:

```ts
export const buildEditTextRequest = (
  sender: Telegram,
  messageId: number,
  text: string,
): TgRequest =>
  sender.parseMode === "RichHTML"
    ? {
        endpoint: tgEndpoint(sender.token, "editMessageText"),
        payload: {
          chat_id: sender.chatId,
          message_id: messageId,
          rich_message: { html: text },
        },
      }
    : {
        endpoint: tgEndpoint(sender.token, "editMessageText"),
        payload: {
          chat_id: sender.chatId,
          message_id: messageId,
          text,
          parse_mode: sender.parseMode,
          disable_web_page_preview: sender.disableWebPagePreview,
          disable_notification: sender.disableNotification,
        },
      };
```

`buildEditCaptionRequest()` preserves the current standard caption payload.

The complete standard and edit builder structure is:

```ts
import type { Telegram } from "../config/schema";
import {
  MEDIA_TYPE,
  TELEGRAM_API_BASE,
  TELEGRAM_MEDIA_GROUP_LIMIT,
} from "@consts";

export interface MediaItem {
  type: MEDIA_TYPE;
  url: string;
}

export interface TgRequest {
  endpoint: string;
  payload: Record<string, unknown>;
}

const tgEndpoint = (token: string, method: string) =>
  `${TELEGRAM_API_BASE}${token}/${method}`;

const buildTextRequest = (sender: Telegram, text: string): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMessage"),
  payload: {
    chat_id: sender.chatId,
    text,
    parse_mode: sender.parseMode,
    disable_web_page_preview: sender.disableWebPagePreview,
    disable_notification: sender.disableNotification,
  },
});

const buildSingleMediaRequest = (
  sender: Telegram,
  text: string,
  media: MediaItem,
): TgRequest => ({
  endpoint: tgEndpoint(
    sender.token,
    media.type === MEDIA_TYPE.PHOTO ? "sendPhoto" : "sendVideo",
  ),
  payload: {
    chat_id: sender.chatId,
    [media.type]: media.url,
    caption: text,
    parse_mode: sender.parseMode,
    disable_notification: sender.disableNotification,
  },
});

const buildMediaGroupRequest = (
  sender: Telegram,
  text: string,
  mediaUrls: MediaItem[],
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMediaGroup"),
  payload: {
    chat_id: sender.chatId,
    media: mediaUrls.map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: index === 0 ? text : undefined,
      parse_mode: sender.parseMode,
    })),
    disable_notification: sender.disableNotification,
  },
});

export const buildSendRequest = (
  sender: Telegram,
  text: string,
  mediaUrls?: MediaItem[],
): TgRequest => {
  if (sender.parseMode === "RichHTML") {
    return {
      endpoint: tgEndpoint(sender.token, "sendRichMessage"),
      payload: {
        chat_id: sender.chatId,
        rich_message: { html: text },
        disable_notification: sender.disableNotification,
      },
    };
  }

  if (mediaUrls?.[0]) {
    if (mediaUrls.length === 1) {
      return buildSingleMediaRequest(sender, text, mediaUrls[0]);
    }
    if (mediaUrls.length <= TELEGRAM_MEDIA_GROUP_LIMIT) {
      return buildMediaGroupRequest(sender, text, mediaUrls);
    }
  }

  return buildTextRequest(sender, text);
};

export const buildEditCaptionRequest = (
  sender: Telegram,
  messageId: number,
  caption: string,
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "editMessageCaption"),
  payload: {
    chat_id: sender.chatId,
    message_id: messageId,
    caption,
    parse_mode: sender.parseMode,
  },
});
```

- [ ] **Step 4: Run request tests and verify all payloads**

Run: `bun test tests/services/telegram-request.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Wire sender HTTP calls to request builders**

In `src/services/sender.ts`, import `MediaItem`, `buildSendRequest`,
`buildEditTextRequest`, and `buildEditCaptionRequest`. Remove the duplicated
request interfaces and builders. Change `editText()` and `editCaption()` to
post the returned `endpoint` and `payload`.

Only allow the caption fallback for a non-RichHTML sender:

```ts
if (
  sender.parseMode !== "RichHTML" &&
  desc?.includes("there is no text in the message to edit")
) {
  return editCaption(sender, messageId, text);
}
```

Keep response parsing, history behavior, and Telegram error mapping unchanged.

- [ ] **Step 6: Run all tests and typecheck**

Run: `bun test`

Expected: all tests pass.

Run: `bun typecheck`

Expected: exit 0.

- [ ] **Step 7: Commit Telegram request support**

```bash
git add src/services/sender.ts src/services/telegram-request.ts tests/services/telegram-request.test.ts
git commit -m "feat: send and edit telegram rich messages"
```

---

### Task 6: User documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/config_sample.yaml`
- Modify: `docs/rss_sample.yaml`

**Interfaces:**
- Documents: sender default `parseMode` and RSS-level override.
- Documents: required RichHTML template use of `{{ rich_content | safe }}`.

- [ ] **Step 1: Update the sender configuration documentation**

In `README.md` and `docs/config_sample.yaml`, list accepted modes as
`Markdown`, `MarkdownV2`, `HTML`, and `RichHTML`. Explain that configured
`Markdown` is treated as MarkdownV2 for newly rendered messages.

- [ ] **Step 2: Add a per-feed RichHTML example**

Add this focused example to `README.md` and adapt it into
`docs/rss_sample.yaml` comments:

```yaml
rss:
  - name: Rich Article Feed
    url: https://example.com/feed.xml
    sendTo: default
    parseMode: RichHTML
    embedMedia: true
    embedMediaExclude:
      - https://example.com/images/emoji/.+
    text: |
      <h1>{{ title }}</h1>
      <p><a href="{{ link }}">Read the original article</a></p>
      {{ rich_content | safe }}
      <footer>#{{ rss_name | replace(" ", "_") }}</footer>
```

State that ordinary fields are HTML-escaped, `rich_content` is sanitized by
the application, RichHTML does not convert Markdown templates, and
`disableWebPagePreview` has no effect on `sendRichMessage`.

- [ ] **Step 3: Run the complete verification suite**

Run: `bun test`

Expected: all tests pass with no warnings or unhandled errors.

Run: `bun check`

Expected: exit 0 with every warning and error fixed without `biome-ignore`.

Run: `bun typecheck`

Expected: exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Review the final diff for scope and compatibility**

Run: `git diff main...HEAD -- src tests README.md docs/config_sample.yaml docs/rss_sample.yaml`

Verify that database files, queue reserve/finalize behavior, unrelated parser
behavior, and the user's RSS configuration are unchanged.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/config_sample.yaml docs/rss_sample.yaml
git commit -m "docs: explain per-feed rich html messages"
```

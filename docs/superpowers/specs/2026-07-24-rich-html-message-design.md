# Per-Feed Rich HTML Messages

## Goal

Add Telegram Bot API rich-message support while keeping the existing
`parseMode` configuration. A Telegram sender defines the default mode, and an
individual RSS subscription can override it with `parseMode: RichHTML`.

## Supported modes and compatibility

Newly loaded configuration accepts `Markdown`, `MarkdownV2`, `HTML`, and
`RichHTML`.

- `Markdown` is a compatibility alias for `MarkdownV2`. Newly rendered
  messages use MarkdownV2 escaping and are sent with `parse_mode: MarkdownV2`.
- `MarkdownV2` uses the existing `sendMessage`, media-message, and
  `sendMediaGroup` paths with MarkdownV2 escaping.
- `HTML` uses the existing standard Telegram message paths with
  `parse_mode: HTML`.
- `RichHTML` uses `sendRichMessage` with `rich_message.html` and embeds media in
  the rich document.

Pending queue records created by an older application version may contain a
serialized sender with `parseMode: Markdown` and text that was already rendered
with legacy Markdown escaping. Those recovered records continue to use legacy
`parse_mode: Markdown`; only newly loaded configuration normalizes the alias.

The sender-level mode remains the default. `RSSItemSchema.parseMode` is
optional, and the effective mode is resolved as:

```text
rss.parseMode ?? telegram.parseMode
```

The existing effective sender is serialized into queue tasks, so the resolved
mode survives crash recovery without a database migration.

## Approaches considered

### Resolve the override into the effective sender

This is the selected approach. `buildEffectiveSender()` copies the RSS
override into the sender used for rendering, queueing, sending, and editing.
It follows the existing handling of `disableNotification` and
`disableWebPagePreview`, and the queue already persists that object.

### Carry a separate message-format argument through every layer

This makes format selection explicit, but changes processor, queue task,
sender, editor, and recovery interfaces independently. It duplicates state
already represented by `Telegram.parseMode` and provides no additional user
capability.

### Add a separate rich-message pipeline

This isolates new Telegram API calls but duplicates filtering, history,
queueing, retry, and edit behavior. It also makes future fixes easy to apply to
only one path. The small format-dependent branches do not justify the
duplication.

## Rich-content preparation

RichHTML templates receive a new `rich_content` variable derived from the RSS
item's `content`. A focused service parses and normalizes the fragment before
template rendering.

The normalizer:

- removes executable or non-content elements such as `script`, `style`,
  `noscript`, `iframe`, and `svg`;
- keeps Telegram Rich HTML block and inline elements and unwraps unsupported
  layout elements so their readable text is retained;
- keeps inline media only when `embedMedia` is true;
- applies `embedMediaExclude` to media URLs and removes matching elements;
- recognizes common lazy-image attributes such as `data-src` when `src` is
  missing;
- resolves relative HTTP media URLs against the RSS item's article link;
- removes media whose final URL is not HTTP or HTTPS; and
- strips unsupported attributes while retaining the attributes needed by
  Telegram Rich HTML.

RSS configuration continues to control media behavior:

- for standard modes, `embedMedia: true` extracts media and uses the existing
  single-media or media-group sender;
- for RichHTML, `embedMedia: true` retains media at its original position in
  `rich_content` and no separate media request is sent;
- for RichHTML, `embedMedia: false` removes embedded media from
  `rich_content`.

This feature does not change `fullText`. If a subscription enables
`fullText: true`, the existing fetched HTML is normalized using the same rules;
automatic article-selection heuristics are outside this change.

## Template rendering

MarkdownV2 and standard HTML retain their current rendering behavior.

RichHTML uses a Nunjucks environment with HTML autoescaping enabled. Plain RSS
fields such as `title`, `creator`, and `link` are escaped automatically. The
already normalized body is inserted explicitly with:

```jinja2
{{ rich_content | safe }}
```

The application does not convert an existing Markdown template to Rich HTML.
A subscription that opts into `parseMode: RichHTML` must use a Rich HTML
template.

## Telegram requests

Standard modes preserve the existing request selection:

- no media: `sendMessage`;
- one media item: `sendPhoto` or `sendVideo`; and
- two to ten media items: `sendMediaGroup`.

RichHTML always sends one request:

```json
{
  "chat_id": 123,
  "rich_message": {
    "html": "<h1>Title</h1><p>Body</p>"
  },
  "disable_notification": false
}
```

The method is `sendRichMessage`. It returns a normal `Message`, so reserve and
finalize history behavior is unchanged.

Rich-message edits use `editMessageText` with `rich_message.html`. Standard
text edits continue to use `text` and `parse_mode`, including the existing
caption fallback for media messages. `disableWebPagePreview` is not sent for
RichHTML because `sendRichMessage` does not expose that parameter.

## Error handling

Telegram HTTP failures continue through the existing `ky` and queue failure
paths. Invalid or inaccessible media remains a Telegram API error; the queue
records the failure in the same way as other send failures. Local
normalization silently removes unsupported media URLs rather than emitting an
invalid rich document.

## Testing

Tests use Bun's built-in test runner and cover:

- configuration normalization from `Markdown` to `MarkdownV2`;
- per-RSS `parseMode` override resolution;
- HTML escaping for ordinary RichHTML template variables;
- safe insertion of normalized `rich_content`;
- media retention, exclusion, lazy-source normalization, relative URL
  resolution, and removal when `embedMedia` is false;
- `sendRichMessage` payload construction;
- RichHTML edit payload construction; and
- unchanged request construction for MarkdownV2 and HTML.

Final verification runs `bun test`, `bun check`, and `bun typecheck`.

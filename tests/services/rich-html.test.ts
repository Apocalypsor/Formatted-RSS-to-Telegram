import { describe, expect, test } from "bun:test";
import { buildRichContent } from "../../src/services/rich-html";

describe("buildRichContent", () => {
  test("keeps readable supported markup and removes executable markup", () => {
    const result = buildRichContent(
      "<script>alert(1)</script><div><p>Hello <b>world</b></p></div>",
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

  test("resolves a relative link against the article URL", () => {
    const result = buildRichContent('<a href="../details?q=1#top">Read</a>', {
      baseUrl: "https://example.com/articles/current/",
      embedMedia: false,
      mediaExclude: [],
    });

    expect(result).toBe(
      '<a href="https://example.com/articles/details?q=1#top">Read</a>',
    );
  });

  test("keeps supported absolute and in-document link schemes", () => {
    const result = buildRichContent(
      '<a href="http://example.com/page">HTTP</a><a href="https://example.com/page">HTTPS</a><a href="mailto:reader@example.com">Mail</a><a href="tel:+15551234567">Call</a><a href="tg://resolve?domain=telegram">Telegram</a><a href="#section">Section</a>',
      { embedMedia: false, mediaExclude: [] },
    );

    expect(result).toBe(
      '<a href="http://example.com/page">HTTP</a><a href="https://example.com/page">HTTPS</a><a href="mailto:reader@example.com">Mail</a><a href="tel:+15551234567">Call</a><a href="tg://resolve?domain=telegram">Telegram</a><a href="#section">Section</a>',
    );
  });

  test("removes dangerous link targets without removing readable text", () => {
    const result = buildRichContent(
      '<p><a href="javascript:alert(1)">Unsafe</a><a href="data:text/html,bad">Data</a></p>',
      { embedMedia: false, mediaExclude: [] },
    );

    expect(result).toBe("<p><a>Unsafe</a><a>Data</a></p>");
  });

  test("removes entity-encoded dangerous link targets after parsing", () => {
    const result = buildRichContent(
      '<a href="&#x6a;avascript:alert(1)">Encoded</a>',
      { embedMedia: false, mediaExclude: [] },
    );

    expect(result).toBe("<a>Encoded</a>");
  });

  test("removes comment and directive nodes at every nesting level", () => {
    const result = buildRichContent(
      "<!directive><!--root--><p>Before<!--inside--><b>After<!--deep--></b></p>",
      { embedMedia: false, mediaExclude: [] },
    );

    expect(result).toBe("<p>Before<b>After</b></p>");
  });
});

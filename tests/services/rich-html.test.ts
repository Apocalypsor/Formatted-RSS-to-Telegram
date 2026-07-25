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
});

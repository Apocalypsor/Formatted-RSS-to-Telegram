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

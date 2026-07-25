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

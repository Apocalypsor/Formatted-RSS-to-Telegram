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

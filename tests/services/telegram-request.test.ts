import { describe, expect, test } from "bun:test";
import { telegramClient } from "../../src/clients/telegram";
import type { Telegram } from "../../src/config/schema";

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
      telegramClient.buildSendRequest(sender, "<h1>Title</h1>", [
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
    expect(
      telegramClient.buildEditTextRequest(sender, 456, "<p>Updated</p>"),
    ).toEqual({
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

    expect(
      telegramClient.buildSendRequest(recovered, "*legacy*").payload,
    ).toEqual({
      chat_id: 123,
      text: "*legacy*",
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      disable_notification: true,
    });
  });
});

test("builds an expiration notification request", () => {
  expect(
    telegramClient.buildExpirationNotificationRequest(
      sender,
      999,
      "https://example.com/feed.xml",
    ),
  ).toEqual({
    endpoint: "https://api.telegram.org/botsecret/sendMessage",
    payload: {
      chat_id: 999,
      text: "*FR2T detected a link expired*\n\nhttps://example.com/feed.xml",
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    },
  });
});

describe("standard Telegram requests", () => {
  const markdownSender: Telegram = {
    ...sender,
    parseMode: "MarkdownV2",
  };

  test("builds a MarkdownV2 text request", () => {
    expect(telegramClient.buildSendRequest(markdownSender, "*Title*")).toEqual({
      endpoint: "https://api.telegram.org/botsecret/sendMessage",
      payload: {
        chat_id: 123,
        text: "*Title*",
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        disable_notification: true,
      },
    });
  });

  test("builds an HTML text request", () => {
    const htmlSender: Telegram = { ...sender, parseMode: "HTML" };

    expect(telegramClient.buildSendRequest(htmlSender, "<b>Title</b>")).toEqual(
      {
        endpoint: "https://api.telegram.org/botsecret/sendMessage",
        payload: {
          chat_id: 123,
          text: "<b>Title</b>",
          parse_mode: "HTML",
          disable_web_page_preview: true,
          disable_notification: true,
        },
      },
    );
  });

  test("builds a single-photo request", () => {
    expect(
      telegramClient.buildSendRequest(markdownSender, "Caption", [
        { type: "photo", url: "https://example.com/photo.jpg" },
      ]),
    ).toEqual({
      endpoint: "https://api.telegram.org/botsecret/sendPhoto",
      payload: {
        chat_id: 123,
        photo: "https://example.com/photo.jpg",
        caption: "Caption",
        parse_mode: "MarkdownV2",
        disable_notification: true,
      },
    });
  });

  test("builds a mixed media-group request", () => {
    expect(
      telegramClient.buildSendRequest(markdownSender, "Album", [
        { type: "photo", url: "https://example.com/one.jpg" },
        { type: "video", url: "https://example.com/two.mp4" },
      ]),
    ).toEqual({
      endpoint: "https://api.telegram.org/botsecret/sendMediaGroup",
      payload: {
        chat_id: 123,
        media: [
          {
            type: "photo",
            media: "https://example.com/one.jpg",
            caption: "Album",
            parse_mode: "MarkdownV2",
          },
          {
            type: "video",
            media: "https://example.com/two.mp4",
            caption: undefined,
            parse_mode: "MarkdownV2",
          },
        ],
        disable_notification: true,
      },
    });
  });

  test("falls back to text when media exceeds Telegram's group limit", () => {
    expect(
      telegramClient.buildSendRequest(markdownSender, "Too many", [
        { type: "photo", url: "https://example.com/01.jpg" },
        { type: "photo", url: "https://example.com/02.jpg" },
        { type: "photo", url: "https://example.com/03.jpg" },
        { type: "photo", url: "https://example.com/04.jpg" },
        { type: "photo", url: "https://example.com/05.jpg" },
        { type: "photo", url: "https://example.com/06.jpg" },
        { type: "photo", url: "https://example.com/07.jpg" },
        { type: "photo", url: "https://example.com/08.jpg" },
        { type: "photo", url: "https://example.com/09.jpg" },
        { type: "photo", url: "https://example.com/10.jpg" },
        { type: "photo", url: "https://example.com/11.jpg" },
      ]),
    ).toEqual({
      endpoint: "https://api.telegram.org/botsecret/sendMessage",
      payload: {
        chat_id: 123,
        text: "Too many",
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        disable_notification: true,
      },
    });
  });
});

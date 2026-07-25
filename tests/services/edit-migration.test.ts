import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import ky from "ky";
import type { Telegram } from "../../src/config/schema";

const testDirectory = mkdtempSync(join(tmpdir(), "fr2t-rich-edit-"));
const previousEnvironment = {
  CONFIG_PATH: process.env.CONFIG_PATH,
  DATABASE_URL: process.env.DATABASE_URL,
  RSS_PATH: process.env.RSS_PATH,
};

const configPath = join(testDirectory, "config.yaml");
const rssPath = join(testDirectory, "rss.yaml");
writeFileSync(
  configPath,
  "telegram:\n  - name: test\n    token: secret\n    chatId: 123\n",
);
writeFileSync(
  rssPath,
  'rss:\n  - name: test\n    url: https://example.com/feed.xml\n    sendTo: test\n    text: "{{ title }}"\n',
);

const configDirectory = join(process.cwd(), "config");
process.env.CONFIG_PATH = relative(configDirectory, configPath);
process.env.RSS_PATH = relative(configDirectory, rssPath);
process.env.DATABASE_URL = `file:${join(testDirectory, "test.sqlite")}`;

interface TelegramReply {
  status: number;
  body: Record<string, unknown>;
}

const replies: TelegramReply[] = [];
const requests: Array<{ endpoint: string; payload: unknown }> = [];
const telegramHttpClient = ky.create({
  retry: 0,
  fetch: async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push({
      endpoint: request.url,
      payload: await request.clone().json(),
    });

    const reply = replies.shift();
    if (!reply) {
      throw new Error(`Unexpected Telegram request: ${request.url}`);
    }

    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  },
});

const { kyClient } = await import("../../src/clients/ky");
const getInstanceSpy = spyOn(kyClient, "getInstance").mockImplementation(
  async () => telegramHttpClient,
);

const { addHistory, getHistory, initDatabase } = await import(
  "../../src/database/index"
);
const { messageQueue } = await import("../../src/services/queue");
const { telegramClient } = await import("../../src/clients/telegram");

initDatabase();

const richSender: Telegram = {
  name: "rich",
  token: "secret",
  chatId: 123,
  parseMode: "RichHTML",
  disableNotification: true,
  disableWebPagePreview: true,
};

const noTextReply: TelegramReply = {
  status: 400,
  body: {
    ok: false,
    description: "Bad Request: there is no text in the message to edit",
  },
};

beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
});

afterAll(async () => {
  await messageQueue.drain();
  getInstanceSpy.mockRestore();
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("edit", () => {
  test("returns the original message ID after a successful text edit", async () => {
    replies.push({
      status: 200,
      body: { ok: true, result: { message_id: 41 } },
    });

    expect(await telegramClient.edit(richSender, 41, "<p>Updated</p>")).toBe(
      41,
    );
  });

  test("replaces a RichHTML media message and returns the new message ID", async () => {
    replies.push(noTextReply, {
      status: 200,
      body: { ok: true, result: { message_id: 99 } },
    });

    expect(await telegramClient.edit(richSender, 41, "<p>Updated</p>")).toBe(
      99,
    );
    expect(requests).toEqual([
      {
        endpoint: "https://api.telegram.org/botsecret/editMessageText",
        payload: {
          chat_id: 123,
          message_id: 41,
          rich_message: { html: "<p>Updated</p>" },
        },
      },
      {
        endpoint: "https://api.telegram.org/botsecret/sendRichMessage",
        payload: {
          chat_id: 123,
          rich_message: { html: "<p>Updated</p>" },
          disable_notification: true,
        },
      },
    ]);
  });

  test("keeps the standard media caption fallback", async () => {
    const standardSender: Telegram = {
      ...richSender,
      parseMode: "MarkdownV2",
    };
    replies.push(noTextReply, {
      status: 200,
      body: { ok: true, result: { message_id: 41 } },
    });

    expect(await telegramClient.edit(standardSender, 41, "Updated")).toBe(41);
    expect(requests).toEqual([
      {
        endpoint: "https://api.telegram.org/botsecret/editMessageText",
        payload: {
          chat_id: 123,
          message_id: 41,
          text: "Updated",
          parse_mode: "MarkdownV2",
          disable_web_page_preview: true,
          disable_notification: true,
        },
      },
      {
        endpoint: "https://api.telegram.org/botsecret/editMessageCaption",
        payload: {
          chat_id: 123,
          message_id: 41,
          caption: "Updated",
          parse_mode: "MarkdownV2",
        },
      },
    ]);
  });
});

describe("queued edits", () => {
  test("stores the replacement message ID after a RichHTML migration", async () => {
    addHistory("migration", "https://example.com/1", "old", "rich", 41, 123);
    const before = getHistory("migration");
    if (!before) throw new Error("Expected migration history fixture");
    replies.push(noTextReply, {
      status: 200,
      body: { ok: true, result: { message_id: 99 } },
    });

    messageQueue.enqueueEdit(richSender, 41, "<p>Updated</p>", {
      uniqueHash: "migration",
      textHash: "new",
      historyId: before.id,
    });
    await messageQueue.drain();

    expect(getHistory("migration")).toMatchObject({
      textHash: "new",
      telegramMessageId: 99,
    });
  });

  test("leaves history unchanged when an edit fails", async () => {
    addHistory("failed-edit", "https://example.com/2", "old", "rich", 41, 123);
    const before = getHistory("failed-edit");
    if (!before) throw new Error("Expected failed-edit history fixture");
    replies.push({
      status: 400,
      body: { ok: false, description: "Bad Request: message can't be edited" },
    });

    messageQueue.enqueueEdit(richSender, 41, "<p>Updated</p>", {
      uniqueHash: "failed-edit",
      textHash: "new",
      historyId: before.id,
    });
    await messageQueue.drain();

    expect(getHistory("failed-edit")).toMatchObject({
      textHash: "old",
      telegramMessageId: 41,
    });
  });
});

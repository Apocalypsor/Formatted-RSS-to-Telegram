import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

test("builds Telegram requests without loading filesystem config", () => {
  const repositoryRoot = resolve(import.meta.dir, "../..");
  const missingConfigPath = `missing-config-${randomUUID()}.yml`;
  const missingRssPath = `missing-rss-${randomUUID()}.yml`;

  expect(existsSync(resolve(repositoryRoot, "config", missingConfigPath))).toBe(
    false,
  );
  expect(existsSync(resolve(repositoryRoot, "config", missingRssPath))).toBe(
    false,
  );

  const subprocess = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
        import { telegramClient } from "./src/clients/telegram.ts";

        const request = telegramClient.buildSendRequest(
          {
            name: "isolated",
            token: "secret",
            chatId: 7,
            parseMode: "RichHTML",
            disableNotification: false,
            disableWebPagePreview: true,
          },
          "<b>isolated</b>",
        );

        console.log(JSON.stringify(request));
      `,
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        CONFIG_PATH: missingConfigPath,
        RSS_PATH: missingRssPath,
      },
      stderr: "pipe",
      stdout: "pipe",
    },
  );

  expect({
    exitCode: subprocess.exitCode,
    stderr: new TextDecoder().decode(subprocess.stderr),
    stdout: new TextDecoder().decode(subprocess.stdout),
  }).toEqual({
    exitCode: 0,
    stderr: "",
    stdout:
      '{"endpoint":"https://api.telegram.org/botsecret/sendRichMessage","payload":{"chat_id":7,"rich_message":{"html":"<b>isolated</b>"},"disable_notification":false}}\n',
  });
});

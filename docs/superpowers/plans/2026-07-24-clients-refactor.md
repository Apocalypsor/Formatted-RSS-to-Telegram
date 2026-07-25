# Client Layer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ky, FlareSolverr, and Telegram transport into `src/clients/` with direct `@clients/*` imports and no runtime behavior changes.

**Architecture:** Create `clients/ky.ts`, `clients/flaresolverr.ts`, and a unified `clients/telegram.ts`. Keep Telegram transport config-agnostic, preserve lazy ky initialization, and leave sender selection plus expired-feed notification decisions in `services/index.ts`. Delete the old utils/service transport files after every call site is rewired.

**Tech Stack:** Bun, TypeScript, ky, Zod configuration, Bun test.

## Global Constraints

- Add `@clients/*` and use direct client imports; do not create a client barrel.
- Preserve the cached ky promise and lazy `import("@config")`.
- Preserve all Telegram payloads, errors, edit migration, returned message IDs, and queue/history behavior.
- Preserve FlareSolverr request, logging, and `null` fallback behavior.
- Keep all database calls synchronous and do not change database or queue schemas.
- Do not change configuration keys, dependencies, commands, or user-facing behavior.
- Remove `src/utils/client.ts`, `src/services/sender.ts`, and `src/services/telegram-request.ts` after migration.
- Follow TDD: change real behavioral tests to consume the new public client paths, observe the missing-module RED failures, then implement the client modules and restore GREEN.

---

### Task 1: Move ky and FlareSolverr clients

**Files:**
- Create: `src/clients/ky.ts`
- Create: `src/clients/flaresolverr.ts`
- Modify: `tsconfig.json`
- Modify: `tests/services/edit-migration.test.ts`
- Modify: `src/services/sender.ts`
- Modify: `src/services/parser.ts`
- Modify: `src/services/matcher.ts`
- Modify: `src/utils/net.ts`
- Modify: `src/utils/index.ts`
- Delete: `src/utils/client.ts`

**Interfaces:**
- Produces: `getClient(proxy?: boolean): Promise<KyInstance>` from `@clients/ky`.
- Produces: `fetchWithFlareSolver(url: string): Promise<string | null>` from `@clients/flaresolverr`.
- Preserves: the current cached client promise, proxy selection, request headers, FlareSolverr body, and logging.

- [ ] **Step 1: Point the real edit integration test at the new ky boundary**

In `tests/services/edit-migration.test.ts`, replace:

```ts
const actualUtils = await import("../../src/utils/index");
const getClientSpy = spyOn(actualUtils, "getClient").mockImplementation(
  async () => telegramClient,
);
```

with:

```ts
const actualKyClient = await import("../../src/clients/ky");
const getClientSpy = spyOn(actualKyClient, "getClient").mockImplementation(
  async () => telegramClient,
);
```

This remains a real sender/queue/history integration test; only the external
HTTP-client boundary is replaced.

- [ ] **Step 2: Run the integration test and observe RED**

Run: `bun test tests/services/edit-migration.test.ts`

Expected: FAIL because `../../src/clients/ky` does not exist.

- [ ] **Step 3: Add the direct client alias**

Add to `tsconfig.json` paths:

```json
"@clients/*": ["./src/clients/*"]
```

Do not add `src/clients/index.ts`.

- [ ] **Step 4: Create the ky client**

Move the ky-specific content from `src/utils/client.ts` into
`src/clients/ky.ts`. Use direct utility imports to avoid a utils barrel cycle:

```ts
import { HTTP_TIMEOUT } from "@consts";
import ky, { type KyInstance } from "ky";
import { logger } from "../utils/logger";

const buildProxyUrl = (proxy: {
  protocol: string;
  host: string;
  port: number;
  auth: { username: string; password: string };
}): string => {
  let auth = "";
  if (proxy.auth.username && proxy.auth.password) {
    const user = encodeURIComponent(proxy.auth.username);
    const pass = encodeURIComponent(proxy.auth.password);
    auth = `${user}:${pass}@`;
  }
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
};
```

Keep `initClients()`, `const clients = initClients()`, and `getClient()`
behavior exactly as in the old file, including the dynamic config import and
base/proxy selection. Do not include FlareSolverr in this module.

- [ ] **Step 5: Create the FlareSolverr client**

Create `src/clients/flaresolverr.ts`:

```ts
import { HTTP_TIMEOUT } from "@consts";
import { mapError } from "../utils/error";
import { logger } from "../utils/logger";
import { getClient } from "./ky";

export const fetchWithFlareSolver = async (
  url: string,
): Promise<string | null> => {
  const { config } = await import("@config");
  if (!config.flaresolverr) return null;

  try {
    logger.debug(`Fetching with FlareSolver for ${url}`);
    const client = await getClient();
    const resp = await client
      .post(`${config.flaresolverr}/v1`, {
        json: {
          cmd: "request.get",
          url,
          maxTimeout: HTTP_TIMEOUT,
        },
      })
      .json<{ solution?: { response?: string } }>();
    return resp?.solution?.response ?? null;
  } catch (error) {
    logger.warn(`FlareSolver failed for ${url}: ${mapError(error)}`);
    return null;
  }
};
```

- [ ] **Step 6: Rewire ky and FlareSolverr consumers**

Use these imports:

```ts
// src/services/sender.ts, src/services/matcher.ts, src/utils/net.ts
import { getClient } from "@clients/ky";

// src/services/parser.ts
import { fetchWithFlareSolver } from "@clients/flaresolverr";
import { getClient } from "@clients/ky";
```

Remove `getClient` and `fetchWithFlareSolver` from the respective `@utils`
imports. Remove `export * from "./client"` from `src/utils/index.ts`, then
delete `src/utils/client.ts`.

- [ ] **Step 7: Run focused and full verification**

Run: `bun test tests/services/edit-migration.test.ts`

Expected: 5 tests pass.

Run: `bun test && bun check && bun typecheck && git diff --check`

Expected: 27 tests pass and all commands exit 0.

- [ ] **Step 8: Commit ky and FlareSolverr migration**

```bash
git add tsconfig.json src/clients/ky.ts src/clients/flaresolverr.ts src/services/sender.ts src/services/parser.ts src/services/matcher.ts src/utils/net.ts src/utils/index.ts src/utils/client.ts tests/services/edit-migration.test.ts
git commit -m "refactor: move network clients out of utils"
```

---

### Task 2: Unify Telegram transport in the client layer

**Files:**
- Create: `src/clients/telegram.ts`
- Modify: `tests/services/telegram-request.test.ts`
- Modify: `tests/services/edit-migration.test.ts`
- Modify: `src/services/index.ts`
- Modify: `src/services/queue.ts`
- Delete: `src/services/sender.ts`
- Delete: `src/services/telegram-request.ts`

**Interfaces:**
- Produces: `MediaItem`, `TgRequest`, `buildSendRequest`, `buildEditTextRequest`, and `buildEditCaptionRequest` from `@clients/telegram`.
- Produces: `send(sender, text, mediaUrls?)`, `edit(sender, messageId, text)`, and `sendExpirationNotification(sender, chatId, url)` from `@clients/telegram`.
- Consumes: `getClient()` from `@clients/ky`.

- [ ] **Step 1: Move behavioral test imports to the new Telegram client path**

In `tests/services/telegram-request.test.ts`, replace the import source with:

```ts
from "../../src/clients/telegram";
```

In `tests/services/edit-migration.test.ts`, replace:

```ts
const { edit } = await import("../../src/services/sender");
```

with:

```ts
const { edit } = await import("../../src/clients/telegram");
```

Add a literal notification payload test to
`tests/services/telegram-request.test.ts`:

```ts
test("builds an expiration notification request", () => {
  expect(buildExpirationNotificationRequest(sender, 999, "https://example.com/feed.xml")).toEqual({
    endpoint: "https://api.telegram.org/botsecret/sendMessage",
    payload: {
      chat_id: 999,
      text: "*FR2T detected a link expired*\n\nhttps://example.com/feed.xml",
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    },
  });
});
```

Import `buildExpirationNotificationRequest` from the new client.

- [ ] **Step 2: Run Telegram tests and observe RED**

Run: `bun test tests/services/telegram-request.test.ts tests/services/edit-migration.test.ts`

Expected: FAIL because `../../src/clients/telegram` does not exist.

- [ ] **Step 3: Create the unified Telegram client**

Create `src/clients/telegram.ts` by moving the complete request-builder content
from `src/services/telegram-request.ts` and the transport/error content from
`src/services/sender.ts`.

Use these imports:

```ts
import type { Telegram } from "@config";
import { TELEGRAM_API_BASE, TELEGRAM_MEDIA_GROUP_LIMIT, MEDIA_TYPE } from "@consts";
import {
  FailedToEditMessageError,
  MessageNotFoundError,
  SendMessageFailedError,
} from "@errors";
import { HTTPError } from "ky";
import { logger } from "../utils/logger";
import { getClient } from "./ky";
```

The module must not import the `config` value. Preserve all existing request
builders, response parsing, `send()`, `edit()`, Telegram error mapping,
RichHTML replacement, standard caption fallback, and returned IDs.

Add:

```ts
export const buildExpirationNotificationRequest = (
  sender: Telegram,
  chatId: number,
  url: string,
): TgRequest => ({
  endpoint: tgEndpoint(sender.token, "sendMessage"),
  payload: {
    chat_id: chatId,
    text: `*FR2T detected a link expired*\n\n${url}`,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  },
});

export const sendExpirationNotification = async (
  sender: Telegram,
  chatId: number,
  url: string,
): Promise<void> => {
  const { endpoint, payload } = buildExpirationNotificationRequest(
    sender,
    chatId,
    url,
  );
  try {
    logger.info(`Sending notification to ${sender.name}:\n${url}`);
    const client = await getClient(true);
    await client.post(endpoint, { json: payload });
  } catch (error) {
    logger.warn(
      `Failed to send notification for ${url}: ${error instanceof Error ? error.message : error}`,
    );
  }
};
```

- [ ] **Step 4: Move service orchestration out of the Telegram client**

In `src/services/index.ts`, import the config value and client function:

```ts
import { config, type RSS, type Telegram } from "@config";
import { sendExpirationNotification } from "@clients/telegram";
```

Add service-local helpers:

```ts
const getSender = (name: string): Telegram | undefined =>
  config.telegram.find((sender) => sender.name === name);

const notifyExpiredFeed = async (url: string): Promise<void> => {
  const sender = config.telegram[0];
  const chatId = config.notifyTelegramChatId;
  if (!sender || !chatId) {
    logger.warn("No Telegram sender for notification configured, skipping.");
    return;
  }
  await sendExpirationNotification(sender, chatId, url);
};
```

Replace `notify(rssItem.url)` with `notifyExpiredFeed(rssItem.url)`.

In `src/services/queue.ts`, import `edit` and `send` from
`@clients/telegram`. Remove the old sender import.

- [ ] **Step 5: Delete old Telegram transport files**

Delete:

```text
src/services/sender.ts
src/services/telegram-request.ts
```

- [ ] **Step 6: Run focused and full verification**

Run: `bun test tests/services/telegram-request.test.ts tests/services/edit-migration.test.ts`

Expected: 14 tests pass, including the new notification builder test.

Run: `bun test && bun check && bun typecheck && git diff --check`

Expected: 28 tests pass and all commands exit 0.

- [ ] **Step 7: Commit Telegram migration**

```bash
git add src/clients/telegram.ts src/services/index.ts src/services/queue.ts src/services/sender.ts src/services/telegram-request.ts tests/services/telegram-request.test.ts tests/services/edit-migration.test.ts
git commit -m "refactor: move telegram transport into clients"
```

---

### Task 3: Document the client-layer convention and verify cleanup

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Documents: `@clients/*` and client/service ownership rules.

- [ ] **Step 1: Update repository architecture guidance**

In `AGENTS.md`, extend the path-alias list with `@clients/*` and add:

```markdown
- **`src/clients/` owns external transports.** Import specific modules through
  `@clients/*`; do not add a client barrel. Client modules must not choose RSS
  senders or own feed-processing decisions.
```

- [ ] **Step 2: Verify no legacy transport imports or files remain**

Run:

```bash
rg -n "utils/client|services/sender|services/telegram-request|from \"\.\/client\"|from \"\.\/sender\"|from \"\.\/telegram-request\"" src tests
```

Expected: no matches.

Run:

```bash
rg --files src/clients src/services src/utils
```

Expected: the clients directory contains exactly `ky.ts`, `flaresolverr.ts`,
and `telegram.ts`; the three legacy files are absent.

- [ ] **Step 3: Run final verification**

Run: `bun test`

Expected: 28 tests pass.

Run: `bun check`

Expected: exit 0 with no warnings and no `biome-ignore` additions.

Run: `bun typecheck`

Expected: exit 0.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Commit architecture guidance**

```bash
git add AGENTS.md
git commit -m "docs: define external client boundaries"
```

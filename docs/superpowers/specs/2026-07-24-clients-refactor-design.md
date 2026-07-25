# Client Layer Refactor

## Goal

Move Telegram transport, ky construction, and FlareSolverr transport into a
focused `src/clients/` layer without changing runtime behavior, configuration,
Telegram payloads, queue/history behavior, or database code.

## Approaches considered

### Focused client modules without a barrel

This is the selected approach. Create three modules with separate transport
responsibilities and import them through `@clients/*` paths. Keeping imports
direct prevents a barrel from eagerly initializing unrelated clients.

### Mechanical file relocation

Moving the current files without changing boundaries is smaller, but it leaves
FlareSolverr mixed into the ky factory and keeps Telegram payload construction
split from Telegram transport. The resulting `clients` directory would group
files by location rather than responsibility.

### A single client module

Combining Telegram, ky, and FlareSolverr minimizes files but couples unrelated
protocols and makes client initialization difficult to test independently.
Any Telegram import could initialize proxy/configuration code unnecessarily.

## Module boundaries

### `src/clients/telegram.ts`

This module owns Telegram Bot API transport:

- `MediaItem` and `TgRequest` types;
- standard and RichHTML send/edit request builders;
- `send()` and `edit()`;
- Telegram response parsing and error mapping; and
- RichHTML replacement behavior for existing media-backed messages.

The module does not import the application `config` value. Callers pass a
resolved `Telegram` sender and any chat identifier needed for a request. This
keeps request-builder tests independent from filesystem-backed configuration.

The expired-feed notification HTTP call becomes an explicit Telegram client
operation that accepts a sender, notification chat ID, and URL. Selection of
the configured sender and the decision to skip an unconfigured notification
remain service-level orchestration.

### `src/clients/ky.ts`

This module owns ky instance construction and exports `getClient()`.

It preserves the current cached promise and lazy `import("@config")`. The lazy
configuration import remains necessary to avoid the existing circular import
between configuration, client initialization, and services. Proxy URL
construction and the base/proxy ky instances stay internal.

### `src/clients/flaresolverr.ts`

This module owns `fetchWithFlareSolver()`. It reads the configured FlareSolverr
endpoint lazily, sends the request through `getClient()`, maps failures to the
existing log behavior, and returns the response body or `null` exactly as
before.

### Service orchestration

`src/services/index.ts` continues to choose a Telegram sender by name. It also
checks whether `notifyTelegramChatId` and a sender exist before asking the
Telegram client to send an expired-feed notification.

`src/services/queue.ts` imports `send()` and `edit()` from the Telegram client.
Queue persistence, rate limiting, reserve/finalize history, edit migration,
and failure semantics do not change.

Parser, matcher, and network helpers import only the specific clients they
need.

## Imports and aliases

Add the path alias:

```json
"@clients/*": ["./src/clients/*"]
```

Use direct imports such as `@clients/ky`, `@clients/flaresolverr`, and
`@clients/telegram`. Do not add `src/clients/index.ts`; avoiding a barrel keeps
Telegram/config side effects out of ky-only consumers.

After call sites move, remove:

- `src/utils/client.ts`;
- `src/services/sender.ts`; and
- `src/services/telegram-request.ts`.

`src/utils/index.ts` stops exporting the deleted client module. Generic utils
remain unchanged.

## Compatibility

The refactor must preserve:

- the four configured parse modes and per-feed override;
- exact standard and RichHTML Telegram request payloads;
- recovered legacy Markdown requests;
- RichHTML media-message replacement and returned message ID;
- standard caption fallback;
- failed-edit history behavior;
- proxy selection and lazy ky initialization;
- FlareSolverr request/response behavior; and
- all synchronous database and persistent queue behavior.

No configuration key, command, dependency, schema, or migration changes.

## Testing

Use the existing 27 behavioral tests as characterization coverage. First
change client-facing test imports to the new `src/clients` paths and observe
the expected missing-module failures. Then create/move the modules and update
production imports until the same tests pass.

Add focused coverage only where extracting notification orchestration creates
a new public client boundary. Do not add tests that merely assert source file
locations. Final verification runs `bun test`, `bun check`, `bun typecheck`,
and `git diff --check` with a clean working tree.

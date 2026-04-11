# AGENTS.md

## Before committing

1. `bun check` — Biome lint + format. Fix every error and warning; never reach for `biome-ignore`.
2. `bun typecheck` — TypeScript. Fix every error.
3. Update **README.md** / **AGENTS.md** if you change commands, conventions, or user-facing features.

Husky + lint-staged runs `bun check` on staged files at commit time.

## Stack

Bun · TypeScript (strict, `verbatimModuleSyntax`) · SQLite via Drizzle ORM + bun:sqlite · Zod · Winston · Docker (compiled to a standalone binary).

Path aliases (`tsconfig.json`): `@config` · `@database` · `@services` · `@utils` · `@errors` · `@consts`.

## Footguns

- **Database calls are synchronous.** bun:sqlite has no async API. Do NOT add `async`/`await` to functions in `src/database/` — it runs but is wrong, and tsc raises hint `80007`.
- **`new Function(...)` in `services/pipeline.ts` is `eval`.** Both RSS rule `type: func` and remote matcher `func` execute config-supplied JS. Config is trusted; never let untrusted input reach `rules` or `matcher.func`.
- **Config is loaded at module import.** `config/index.ts` parses YAML synchronously at first import. `config` and `rss` are constants for the lifetime of the process — there is no reload.
- **`@utils` is for generic helpers only.** No `helpers.ts` / `utils.ts` dumping grounds. If something depends on `RSS` / `Telegram` / `MEDIA_TYPE` or other domain types, it belongs in `services/`, not `utils/`.

## Architectural notes

- **Reserve/finalize history.** Send tasks insert a history row with `messageId=0` *before* posting, then finalize with the real id after success. This is what prevents duplicate sends on crash recovery — don't bypass it.
- **Crash-recoverable queue.** `MessageQueue` (`services/queue.ts`) is backed by the `MessageQueue` DB table. On startup, `recoverPendingTasks()` re-enqueues anything left as `PENDING` into the in-memory p-queue. Rate limiting comes from `concurrency: 1` + `intervalCap: 1`.
- **First-run flag.** `setFirstRun(true)` makes the processor save items directly to history *without sending*. `src/index.ts` uses it on initial DB setup to avoid flooding the chat.
- **Closure-scoped processor state.** `services/index.ts` wraps `firstRun` and the per-feed init cache inside `createProcessor()`. There is no module-level mutable state — keep it that way.
- **Lazy client init.** `getClient()` returns a cached promise. The async wrapper exists solely to break a circular import with `@config`.

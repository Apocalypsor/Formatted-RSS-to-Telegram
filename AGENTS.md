# AGENTS.md

> **MANDATORY: Code Quality & Documentation**
>
> Before committing ANY changes, you MUST:
>
> 1. Run `bun check` — Biome lint + format check. Fix ALL errors and warnings. Do NOT use `biome-ignore` — fix the code instead.
> 2. Run `bun typecheck` — TypeScript type checking. Fix ALL errors.
> 3. Update **AGENTS.md** and **README.md** if your changes affect commands, conventions, architecture, or features. Do not forget README.md.
>
> These checks also run automatically on pre-commit hook (husky + lint-staged).

## Project Overview

**Formatted-RSS-to-Telegram (FR2T)** is a self-hosted RSS-to-Telegram notification service. It periodically fetches RSS feeds, applies user-defined filters and rules, renders messages via Nunjucks templates, and sends them to Telegram chats through the Bot API. It runs as a long-lived process scheduled with `node-schedule`, backed by SQLite (via Prisma) for history deduplication and a persistent message queue.

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via Prisma ORM
- **Deployment**: Docker (long-running container)

### Key Design Decisions

- **Config at module scope**: `config/index.ts` loads YAML synchronously at import time. Everything downstream imports `config` and `rss` as constants.
- **Lazy client init**: `initClients()` is async (to break circular dep with config), returns cached ky instances via a promise.
- **p-queue based processing**: `MessageQueue` uses `p-queue` with `concurrency: 1` and `intervalCap: 1` for rate limiting. DB table provides crash recovery — on startup, pending DB tasks are recovered into the p-queue.
- **Reserve/finalize pattern**: History entries are reserved (with `messageId=0`) before sending, then finalized with the real `messageId` after success. This prevents duplicate sends on crash recovery.
- **First run handling**: On first run (no history in DB), items are saved directly to history without sending, to avoid flooding on initial setup.
- **BigInt for Telegram IDs**: `chatId` and `messageId` use BigInt throughout, serialized as strings in JSON.

## Code Conventions

### Style

- **Formatter**: Prettier — 4-space indent for TS, 2-space for YAML/MD
- **Linter**: ESLint with `typescript-eslint` recommended rules
- **Pre-commit**: Husky + lint-staged — runs Prettier on staged `*.{ts,js,json,yaml,yml,md}` files
- **Module system**: ESNext modules, `verbatimModuleSyntax: true`
- **Path aliases**: `@config`, `@database`, `@services`, `@utils`, `@errors`, `@consts` — mapped in `tsconfig.json`, resolved by Bun bundler

### Patterns

- **Barrel exports**: Each module directory has an `index.ts` re-exporting public API
- **Error classes**: Custom error classes in `src/errors.ts`, extending `Error` with descriptive `name`
- **Zod validation**: Config and RSS schemas use Zod for parse-time validation with defaults and transforms
- **Enums**: Native TypeScript enums in `consts.ts` for task types, media types, queue status, etc.
- **Logging**: Use `logger` from `@utils` (Winston). Levels: `error`, `warn`, `info`, `debug`

### Database

- **ORM**: Prisma with SQLite
- **Schema**: `prisma/schema.prisma` — 3 models: `History`, `Expire`, `MessageQueue`
- **Migrations**: `prisma/migrations/` — run with `bun run prisma:migrate:deploy`

## Known Issues & Technical Debt

### Security

- `new Function("obj", rule.matcher)` in `processRules` (`src/services/index.ts`) is effectively `eval`. RSS rule `type: func` allows arbitrary code execution from config. This is acceptable since config is trusted, but should never accept untrusted input.

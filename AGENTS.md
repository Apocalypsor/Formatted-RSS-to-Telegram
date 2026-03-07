# AGENTS.md

## Project Overview

**Formatted-RSS-to-Telegram (FR2T)** is a self-hosted RSS-to-Telegram notification service. It periodically fetches RSS feeds, applies user-defined filters and rules, renders messages via Nunjucks templates, and sends them to Telegram chats through the Bot API. It runs as a long-lived process scheduled with `node-schedule`, backed by SQLite (via Prisma) for history deduplication and a persistent message queue.

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via Prisma ORM
- **Deployment**: Docker (long-running container)

## Architecture

```
src/
├── index.ts              # Entry point: startup, scheduling, orchestration
├── consts.ts             # Shared constants and enums
├── config/
│   ├── index.ts          # Loads and exports config + rss at module level
│   ├── config.ts         # Reads config.yaml → Config (Zod validated)
│   ├── rss.ts            # Reads rss.yaml → RSS[] (Zod validated, expands arrays)
│   └── schema.ts         # Zod schemas and inferred types for Config, RSS, Telegram, etc.
├── database/
│   ├── client.ts         # Prisma client singleton
│   ├── history.ts        # CRUD for History table (dedup, edit tracking)
│   ├── expire.ts         # Upsert for Expire table (feed health tracking)
│   ├── queue.ts          # CRUD for MessageQueue table (persistent task queue)
│   └── index.ts          # Re-exports
├── services/
│   ├── index.ts          # processRSS: main pipeline (parse → filter → rule → render → enqueue)
│   ├── parser.ts         # RSS feed fetching + parsing (rss-parser), FlareSolverr fallback
│   ├── render.ts         # Nunjucks template rendering with Telegram Markdown escaping
│   ├── sender.ts         # Telegram Bot API calls (send, edit, notify)
│   ├── queue.ts          # MessageQueue class: in-memory queue + DB persistence, rate limiting, retry, LRU dedup
│   └── render.spec.ts    # Unit tests for render module
├── utils/
│   ├── client.ts         # Axios HTTP client factory with proxy support (HTTP/SOCKS), FlareSolverr helper
│   ├── helpers.ts        # hash, getObj, extractMediaUrls, htmlDecode, isIntranet, etc.
│   ├── logger.ts         # Winston logger (console + file + daily rotate)
│   └── index.ts          # Re-exports
└── errors/
    ├── config.ts         # Config/RSS file loading errors
    ├── services.ts       # Sender/message errors
    └── index.ts          # Re-exports
```

### Data Flow

```
Cron tick
  → main()
    → processRSS(rssItem) for each feed (parallel via Promise.allSettled)
      → parseRSSFeed(url)           # fetch + parse XML, fallback to FlareSolverr
      → processFilters(filters)     # regex-based include/exclude
      → processRules(rules)         # regex or function transforms
      → render(template, data)      # Nunjucks + Markdown escape
      → getHistory(hash)            # dedup check against DB
      → messageQueue.enqueueSend()  # or enqueueEdit() if content changed
        → persisted to MessageQueue table
        → processed sequentially with 1s delay (rate limiting)
        → on success: save to History table
        → on failure: retry up to 3 times, then mark failed
```

### Key Design Decisions

- **Config at module scope**: `config/index.ts` loads YAML synchronously at import time. Everything downstream imports `config` and `rss` as constants.
- **Lazy client init**: `getClient()` is async on first call (to break circular dep with config), then returns cached Axios instances.
- **Dual queue**: In-memory array for ordering + DB table for crash recovery. On startup, pending DB tasks are recovered into the in-memory queue.
- **LRU dedup**: `processedKeys` in MessageQueue uses a Map-based LRU set (capacity 10000) to prevent duplicate enqueues within and across processing cycles.
- **BigInt for Telegram IDs**: `chatId` and `messageId` use BigInt throughout, serialized as strings in JSON.

## Setup

```bash
# Install dependencies
bun install

# Generate Prisma client
bun run prisma:generate

# Run database migrations
bun run prisma:migrate:deploy

# Development (hot reload)
bun run dev

# Production build
bun run build
bun run start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path, e.g. `file:./config/db.sqlite` |
| `CONFIG_PATH` | No | Config filename override (default: `config.yaml`) |
| `RSS_PATH` | No | RSS filename override (default: `rss.yaml`) |
| `NODE_ENV` | No | Set to `development` for debug logging |

### Configuration Files

Config files live in `./config/` (mounted as volume in Docker):

- `config.yaml` — Global settings: proxy, Telegram bots, interval, FlareSolverr, etc. See `docs/config_sample.yaml`.
- `rss.yaml` — RSS feed definitions with rules, filters, templates. See `docs/rss_sample.yaml`.

Both are validated with Zod schemas at `src/config/schema.ts`.

## Build & Run

```bash
# Type check (no emit)
npx tsc --noEmit

# Build (Bun bundler, externalizes node_modules)
bun run build

# Run production
bun run start

# Lint
bun run lint
bun run lint:fix
```

Build script: `scripts/build.ts` — uses `Bun.build()` with all dependencies externalized.

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test src/services/render.spec.ts
```

Tests use Bun's built-in test runner. Currently only `render.spec.ts` exists. Tests are co-located with source files using `.spec.ts` suffix.

## Code Conventions

### Style

- **Formatter**: Prettier — 4-space indent for TS, 2-space for YAML/MD
- **Linter**: ESLint with `typescript-eslint` recommended rules
- **Module system**: ESNext modules, `verbatimModuleSyntax: true`
- **Path aliases**: `@config`, `@database`, `@services`, `@utils`, `@errors`, `@consts` — mapped in `tsconfig.json`, resolved by Bun bundler

### Patterns

- **Barrel exports**: Each module directory has an `index.ts` re-exporting public API
- **Error classes**: Custom error classes in `src/errors/`, extending `Error` with descriptive `name`
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

### Unused / Legacy

- `PROCESSING` status in `QUEUE_STATUS` enum is defined but never set in the queue lifecycle (tasks go directly from `PENDING` to `COMPLETED` or `FAILED`).

### Areas for Improvement

- **Test coverage**: Only `render.ts` has tests. `parser.ts`, `sender.ts`, `queue.ts`, and `services/index.ts` lack tests.

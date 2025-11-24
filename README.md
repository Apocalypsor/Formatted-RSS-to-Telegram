# Formatted RSS to Telegram

Highly customizable RSS to Telegram.

![sample](./docs/assets/screenshot-of-chat.png)

## Usage

0. Install `Docker`.
1. Save the `docker-compose.yaml` file:

    ```yaml
    services:
      fr2t:
        image: ghcr.io/apocalypsor/fr2t
        container_name: fr2t
        restart: always
        volumes:
          - ./data:/app/config
          - ./logs:/app/logs
    ```

2. Refer to the files in [docs](./docs) for configuration. Save the two file as `rss.yaml` and `config.yaml` in
   the `./data` directory.
   > rss-parser is used to parse the RSS feed. Refer
   to [this folder](https://github.com/rbren/rss-parser/tree/master/test/output) to see what property you can use in
   the `rss.yaml` text template.
3. Run `docker-compose up -d`.

## Features

- ✅ **Persistent Message Queue** - SQLite-backed queue with automatic recovery on restart
- ✅ **Rate Limiting** - Prevents Telegram API spam with configurable delays
- ✅ **Retry Logic** - Automatic retry with exponential backoff for failed messages
- ✅ **Proxy Support** - HTTP/SOCKS4/SOCKS5 proxy support
- ✅ **Periodic Cleanup** - Automatic database cleanup of old records
- ✅ **RSS Monitoring** - Notify for invalid RSS links
- ✅ **Media Embedding** - Automatic image/video extraction from RSS content

## Development

```bash
# Install dependencies
bun install

# Run Prisma migrations
bun run prisma:migrate:dev

# Start development server with hot reload
bun run dev

# Build for production
bun run build

# Run production build
bun start

# Docker development environment
docker-compose -f docker-compose.dev.yml up
```

## Environment Variables

- `DATABASE_URL` - SQLite database path (default: `file:../config/db.sqlite`)
- `NODE_ENV` - Environment mode (`development` or `production`)

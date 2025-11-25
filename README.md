# Formatted RSS to Telegram

A highly customizable, production-ready RSS to Telegram bot with persistent message queue, rate limiting, and advanced content processing capabilities.

![sample](./docs/assets/screenshot-of-chat.png)

## ✨ Features

### Core Features
- 🔄 **Persistent Message Queue** - SQLite-backed queue with automatic crash recovery
- ⚡ **Rate Limiting & 429 Handling** - Smart rate limiting with dynamic retry-after delays
- 🔁 **Retry Logic** - Automatic retry with configurable max attempts (default: 3)
- 🎯 **Deduplication** - Memory-efficient deduplication with 10k item limit
- 📊 **Queue Statistics** - Monitor pending, completed, and failed tasks
- 🧹 **Auto Cleanup** - Periodic cleanup of completed tasks (default: 24 hours)

### Content Processing
- 🖼️ **Media Embedding** - Automatic image/video extraction from RSS content
- 📝 **Template Engine** - Nunjucks-powered message templates
- 🔍 **Content Filtering** - Regex-based include/exclude filters
- ⚙️ **Content Rules** - Transform RSS fields with regex or custom functions
- 📏 **Message Splitting** - Auto-split messages exceeding Telegram's 4096 char limit

### Network & Proxy
- 🌐 **Proxy Support** - HTTP/SOCKS4/SOCKS5 proxy with authentication
- 🛡️ **Cloudflare Bypass** - FlareSolverr integration for protected feeds
- 🔄 **Axios Caching** - Efficient HTTP request caching

### Monitoring & Reliability
- 📢 **RSS Monitoring** - Telegram notifications for invalid/expired RSS links
- 📝 **Structured Logging** - Winston-based logging with daily rotation
- 💾 **Database Persistence** - All tasks and history stored in SQLite
- 🔐 **Type Safety** - Full TypeScript with Zod schema validation

## 🚀 Quick Start

### Docker (Recommended)

1. **Install Docker**

2. **Create `docker-compose.yaml`:**
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

3. **Configure RSS and Bot:**
   - Copy sample configs from [docs](./docs) to `./data/`
   - Create `./data/config.yaml` (see [Configuration](#-configuration))
   - Create `./data/rss.yaml` (see [RSS Configuration](#rss-configuration))

4. **Start the service:**
   ```bash
   docker-compose up -d
   ```

### Local Development

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run database migrations
bun run prisma:migrate:dev

# Start development server with hot reload
bun run dev

# Build for production
bun run build

# Run production build
bun start
```

## ⚙️ Configuration

### Bot Configuration (`config.yaml`)

```yaml
# Cleanup interval (days)
expireTime: 30

# RSS check interval (minutes)
interval: 10

# User agent for RSS requests
userAgent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

# FlareSolverr endpoint (optional)
flaresolverr: http://127.0.0.1:8191/

# Telegram chat ID for RSS monitoring notifications (optional)
notifyTelegramChatId: 111111111

# Proxy configuration (optional)
proxy:
  enabled: true
  protocol: socks5  # http, socks4, or socks5
  host: 127.0.0.1
  port: 1080
  auth:
    username: user
    password: pass

# Telegram bot configuration (required)
telegram:
  - name: default
    token: YOUR_BOT_TOKEN
    chatId: YOUR_CHAT_ID
    parseMode: MarkdownV2  # HTML, Markdown, or MarkdownV2
    disableNotification: false
    disableWebPagePreview: false
```

### RSS Configuration (`rss.yaml`)

```yaml
rss:
  - name: GitHub Commits
    url: https://github.com/user/repo/commits.atom
    sendTo: default  # or list: [bot1, bot2]
    
    # Optional settings
    disableNotification: false
    disableWebPagePreview: false
    fullText: true
    embedMedia: true
    embedMediaExclude:
      - https://example.com/.+
    
    # Content transformation rules
    rules:
      - obj: title
        type: regex  # or func
        matcher: ^(\[.+?\])?(.+?)$
        dest: tag
      
      - obj: content
        type: func
        matcher: |
          return obj.replace(/pattern/, 'replacement');
        dest: processed_content
    
    # Content filters
    filters:
      - obj: title
        type: in   # include only matching
        matcher: important
      
      - obj: content
        type: out  # exclude matching
        matcher: spam|ads
    
    # Message template (Nunjucks)
    text: |
      **{{ title }}**
      
      {{ content }}
      
      [Read more]({{ link }})
      
      _Tags: {{ tag }}_
```

### Available Template Variables

From RSS feed (via [rss-parser](https://github.com/rbren/rss-parser)):
- `title`, `link`, `content`, `contentSnippet`
- `author`, `pubDate`, `guid`
- Any custom fields from your RSS feed

Custom variables:
- `rss_name` - Name of the RSS feed
- `rss_url` - URL of the RSS feed
- Any fields created by `rules` (e.g., `tag`, `processed_content`)

## 📄 License

Apache-2.0 License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [rss-parser](https://github.com/rbren/rss-parser) - RSS feed parsing
- [Prisma](https://www.prisma.io/) - Database ORM
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Nunjucks](https://mozilla.github.io/nunjucks/) - Template engine

# Formatted RSS to Telegram

Highly customizable RSS to Telegram.

![sample](./docs/assets/screenshot-of-chat.png)

## Usage

0. Install `Docker`.
1. Save the `docker-compose.yaml` file:
    ```yaml
    version: '3'
    
    services:
      fr2t:
        image: ghcr.io/apocalypsor/fr2t
        container_name: fr2t
        volumes:
          - ./data:/app/config
          - ./logs:/app/logs
    
      morss:
        image: pictuga/morss
        container_name: morss
    ```
2. Refer to the files in [docs](./docs) for configuration. Save the two file as `rss.yaml` and `config.yaml`.
3. Run `docker-compose up -d`.

## Todo

- [x] Proxy
- [x] Notify for invalid RSS links
- [x] docs
- [ ] Clean Database periodically
- [ ] Telegraph support
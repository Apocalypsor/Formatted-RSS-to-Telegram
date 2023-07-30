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
        restart: always
        volumes:
          - ./data:/app/config
          - ./logs:/app/logs
    ```

2. Refer to the files in [docs](./docs) for configuration. Save the two file as `rss.yaml` and `config.yaml` in the `./data` directory.
   > rss-parser is used to parse the RSS feed. Refer to [this folder](https://github.com/rbren/rss-parser/tree/master/test/output) to see what property you can use in the `rss.yaml` text template.
3. Run `docker-compose up -d`.

## Todo

- [x] Proxy
- [x] Notify for invalid RSS links
- [x] docs
- [x] Clean Database periodically

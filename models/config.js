const logger = require("@utils/logger");
const { isInteger } = require("@utils/tools");

const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

class Config {
    constructor(input) {
        this.expireTime = isInteger(input.expireTime) ? input.expireTime : 365;
        this.interval = isInteger(input.interval) ? input.interval : 10;
        this.userAgent = input.userAgent || UA;
        this.morss = input.morss || "https://morss.it/";
        this.notifyTelegramChatId = input.notifyTelegramChatId || null;

        this.flaresolverr = input.flaresolverr
            ? input.flaresolverr.replace(/\/$/, "")
            : null;

        this._proxy = { enabled: false };
        this.proxy = input.proxy;

        this._telegram = [];
        this.telegram = input.telegram;

        logger.debug(
            `Using proxy: ${this.proxy ? JSON.stringify(this.proxy) : "none"}`
        );
    }

    set proxy(proxyInput) {
        if (proxyInput?.enabled) {
            const mustHave = ["host", "port"];
            for (const mustHaveKey of mustHave) {
                if (!proxyInput.hasOwnProperty(mustHaveKey)) {
                    logger.error(
                        `Invalid Proxy config for ${proxyInput.name}, skipping!`
                    );
                    return;
                }
            }

            this._proxy = {
                enabled: true,
                protocol: "http",
                host: "127.0.0.1",
                port: 1080,
                auth: {
                    username: null,
                    password: null,
                },
            };

            for (const proxyKey in this._proxy) {
                if (proxyKey in proxyInput) {
                    this._proxy[proxyKey] = proxyInput[proxyKey];
                }
            }
        }
    }

    get proxy() {
        return this._proxy;
    }

    set telegram(telegramInput) {
        if (telegramInput) {
            telegramInputLoop: for (const tg of telegramInput) {
                const mustHave = ["name", "token", "chatId"];
                for (const mustHaveKey of mustHave) {
                    if (!tg.hasOwnProperty(mustHaveKey)) {
                        logger.error(
                            `Invalid Telegram config for ${tg.name}, skipping!`
                        );
                        continue telegramInputLoop;
                    }
                }

                const parsedTelegram = {
                    name: "default",
                    token: "",
                    chatId: "",
                    parseMode: "Markdown",
                    disableNotification: false,
                    disableWebPagePreview: false,
                };

                for (const telegramKey in parsedTelegram) {
                    if (tg.hasOwnProperty(telegramKey)) {
                        parsedTelegram[telegramKey] = tg[telegramKey];
                    }
                }

                this._telegram.push(parsedTelegram);
            }
        }
    }

    get telegram() {
        return this._telegram;
    }
}

module.exports = Config;

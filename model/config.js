const logger = require('../lib/logger');
const {isInteger} = require("../lib/tools");

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

class Config {
    constructor(input) {
        this.expireTime = isInteger(input.expireTime) ? input.expireTime : 365;
        this.interval = isInteger(input.interval) ? input.interval : 10;
        this.userAgent = input.userAgent || UA;
        this.morss = input.morss || 'https://morss.it/';
        this.notifyTelegramChatId = input.notifyTelegramChatId || null;

        this.puppeteerWSEndpoint = input.puppeteerWSEndpoint || null;

        this.proxy = this.parseProxy(input.proxy);
        logger.debug(`Using proxy: ${this.proxy ? JSON.stringify(this.proxy) : 'none'}`);

        this.telegram = [];
        if (input.telegram) {
            for (const telegram of input.telegram) {
                const parsedTelegram = this.parseTelegram(telegram);
                if (parsedTelegram) {
                    this.telegram.push(parsedTelegram);
                }
            }
        }
    }

    parseProxy(input) {
        if (!input || !input.enabled) {
            return null;
        }

        const proxy = {
            protocol: 'http',
            host: '127.0.0.1',
            port: 1080,
            auth: {
                username: null,
                password: null,
            }
        }

        const mustHave = ['host', 'port'];
        for (const mustHaveKey of mustHave) {
            if (!(mustHaveKey in input)) {
                logger.error(`Invalid Proxy config for ${input.name}, skipping!`);
                return null;
            }
        }

        for (const proxyKey in proxy) {
            if (proxyKey in input) {
                proxy[proxyKey] = input[proxyKey];
            }
        }

        return proxy;
    }

    parseTelegram(input) {
        const telegram = {
            name: 'default',
            token: '',
            chatId: '',
            parseMode: 'Markdown',
            disableNotification: false,
            disableWebPagePreview: false,
        };

        const mustHave = ['name', 'token', 'chatId'];
        for (const mustHaveKey of mustHave) {
            if (!(mustHaveKey in input)) {
                logger.error(`Invalid Telegram config for ${input.name}, skipping!`);
                return;
            }
        }

        for (const telegramKey in telegram) {
            if (telegramKey in input) {
                telegram[telegramKey] = input[telegramKey];
            }
        }

        return telegram;
    }
}

module.exports = Config;
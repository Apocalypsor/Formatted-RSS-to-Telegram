const logger = require('../lib/logger');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

class Config {
    constructor(input) {
        this.expireTime = input.expireTime || '30d';
        this.userAgent = input.userAgent || UA;
        this.morss = input.morss || 'https://morss.it/';
        this.notifyTelegramChatId = input.notifyTelegramChatId || null;

        this.puppeteerWSEndpoint = input.puppeteerWSEndpoint || null;
        this.proxyUri = input.proxyUri || null;

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
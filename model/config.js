const logger = require('../lib/logger');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';

class Config {
    constructor(input) {
        this.expireTime = input.expireTime || '30d';
        this.userAgent = input.userAgent || UA;
        this.telegraphAccessToken = input.telegraphAccessToken || null;
        this.notifyTelegramChatId = input.notifyTelegramChatId || null;

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
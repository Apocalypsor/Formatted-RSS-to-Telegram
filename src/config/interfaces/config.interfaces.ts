interface Config {
    expireTime: number;
    interval: number;
    userAgent: string;
    notifyTelegramChatId: string | undefined;
    flaresolverr: string | undefined;
    proxy: EnabledProxy | DisabledProxy;
    telegram: Telegram[];
}

interface EnabledProxy {
    enabled: true;
    protocol: string;
    host: string;
    port: number;
    auth: {
        username: string;
        password: string;
    };
}

interface DisabledProxy {
    enabled: false;
}

interface Telegram {
    name: string;
    token: string;
    chatId: number;
    parseMode: string;
    disableNotification: boolean;
    disableWebPagePreview: boolean;
}

export { Config, EnabledProxy, DisabledProxy, Telegram };

import { UA } from "@consts/config";
import {
    Config,
    DisabledProxy,
    EnabledProxy,
    Telegram,
} from "config/interfaces/config.interfaces";
import {
    ConfigFileNotFoundError,
    InvalidConfigError,
    InvalidConfigProxyError,
    InvalidTelegramConfigError,
    LoadConfigError,
} from "errors/config";
import * as fs from "node:fs";
import { parse } from "yaml";

const parseProxy = (proxy: any): EnabledProxy | DisabledProxy => {
    if (proxy?.enabled) {
        const mustHave = ["host", "port"];
        for (const mustHaveKey of mustHave) {
            if (!proxy.hasOwnProperty(mustHaveKey)) {
                throw new InvalidConfigProxyError();
            }
        }

        return {
            enabled: true,
            protocol: proxy.protocol || "http",
            host: proxy.host || "127.0.0.1",
            port: proxy.port || 1080,
            auth: {
                username: proxy?.auth?.username || "",
                password: proxy?.auth?.password || "",
            },
        };
    } else {
        return { enabled: false };
    }
};

const parseTelegram = (telegram: any): Telegram[] => {
    if (!telegram || telegram.length === 0) {
        throw new InvalidTelegramConfigError();
    }

    const parsedTelegram: Telegram[] = [];
    for (const tg of telegram) {
        const mustHave = ["name", "token", "chatId"];
        for (const mustHaveKey of mustHave) {
            if (!tg.hasOwnProperty(mustHaveKey)) {
                throw new InvalidTelegramConfigError();
            }
        }

        parsedTelegram.push({
            name: tg.name || "default",
            token: tg.token || "",
            chatId: tg.chatId || "",
            parseMode: tg.parseMode || "Markdown",
            disableNotification: tg.disableNotification || false,
            disableWebPagePreview: tg.disableWebPagePreview || false,
        });
    }

    return parsedTelegram;
};

const parseConfig = (config: any): Config => {
    if (!config) {
        throw new InvalidConfigError();
    }

    return {
        expireTime: config.expireTime || 365,
        interval: config.interval || 10,
        userAgent: config.userAgent || UA,
        notifyTelegramChatId: config.notifyTelegramChatId,
        flaresolverr: config.flaresolverr
            ? config.flaresolverr.replace(/\/$/, "")
            : undefined,
        proxy: parseProxy(config.proxy),
        telegram: parseTelegram(config.telegram),
    };
};

const loadConfigFile = (configFile: string | undefined): Config => {
    const configPath =
        __dirname + "/../config/" + (configFile || "config.yaml");
    if (!fs.existsSync(configPath)) {
        throw new ConfigFileNotFoundError(configPath);
    } else {
        const parsed = parse(fs.readFileSync(configPath, "utf8"), {
            merge: true,
        });
        try {
            return parseConfig(parsed);
        } catch (e) {
            throw new LoadConfigError(configPath);
        }
    }
};

export { loadConfigFile, parseConfig };

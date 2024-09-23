/**
 * config.ts errors
 */
import { mapError } from "@utils/helpers";

class ConfigFileNotFoundError extends Error {
    constructor(configPath: string) {
        super(`Config file not found at ${configPath}`);
        this.name = "ConfigFileNotFoundError";
    }
}

class LoadConfigError extends Error {
    constructor(configPath: string) {
        super(`Failed to parse config file at ${configPath}`);
        this.name = "LoadConfigError";
    }
}

class InvalidConfigError extends Error {
    constructor() {
        super("Invalid config file");
        this.name = "InvalidConfigError";
    }
}

class InvalidConfigProxyError extends Error {
    constructor() {
        super("Invalid proxy config");
        this.name = "InvalidConfigProxyError";
    }
}

class InvalidTelegramConfigError extends Error {
    constructor() {
        super("Invalid Telegram config");
        this.name = "InvalidTelegramConfigError";
    }
}

/**
 * rss.ts errors
 */

class RSSFileNotFoundError extends Error {
    constructor(rssPath: string) {
        super(`RSS file not found at ${rssPath}`);
        this.name = "RSSFileNotFoundError";
    }
}

class LoadRSSFileError extends Error {
    constructor(rssPath: string, error: any) {
        super(`Failed to load RSS file at ${rssPath}: ${mapError(error)}`);
        this.name = "LoadRSSFileError";
    }
}

class InvalidRSSRuleError extends Error {
    constructor(from: string, to: string) {
        super(`Invalid RSS rule from ${from} to ${to}`);
        this.name = "InvalidRSSRuleError";
    }
}

class InvalidRSSFilterError extends Error {
    constructor(from: string) {
        super(`Invalid RSS filter for ${from}`);
        this.name = "InvalidRSSFilterError";
    }
}

class InvalidRSSItemError extends Error {
    constructor(rssItem: any) {
        super(`Invalid RSS config for ${rssItem}`);
        this.name = "InvalidRSSItemError";
    }
}

export {
    RSSFileNotFoundError,
    ConfigFileNotFoundError,
    LoadConfigError,
    InvalidConfigError,
    InvalidTelegramConfigError,
    InvalidRSSRuleError,
    InvalidRSSFilterError,
    InvalidRSSItemError,
    LoadRSSFileError,
    InvalidConfigProxyError,
};

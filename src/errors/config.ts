/**
 * config.ts errors
 */

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

class LoadRSSFileError extends Error {
    constructor(rssPath: string) {
        super(`Failed to load RSS file at ${rssPath}`);
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
    constructor() {
        super("Invalid RSS config");
        this.name = "InvalidRSSItemError";
    }
}

export {
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

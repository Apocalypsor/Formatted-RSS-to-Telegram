/**
 * config.ts errors
 */
import { mapError } from "@utils";

export class ConfigFileNotFoundError extends Error {
    constructor(configPath: string) {
        super(`Config file not found at ${configPath}`);
        this.name = "ConfigFileNotFoundError";
    }
}

export class LoadConfigError extends Error {
    constructor(configPath: string) {
        super(`Failed to parse config file at ${configPath}`);
        this.name = "LoadConfigError";
    }
}

/**
 * rss.ts errors
 */

export class RSSFileNotFoundError extends Error {
    constructor(rssPath: string) {
        super(`RSS file not found at ${rssPath}`);
        this.name = "RSSFileNotFoundError";
    }
}

export class LoadRSSFileError extends Error {
    constructor(rssPath: string, error: unknown) {
        super(`Failed to load RSS file at ${rssPath}: ${mapError(error)}`);
        this.name = "LoadRSSFileError";
    }
}

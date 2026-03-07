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

export class SenderNotFoundError extends Error {
    constructor() {
        super(`Sender not found`);
        this.name = "SenderNotFoundError";
    }
}

export class SendMessageFailedError extends Error {
    constructor(sender: string) {
        super(`Failed to send message to ${sender}`);
        this.name = "SendMessageFailedError";
    }
}

export class MessageNotFoundError extends Error {
    constructor(messageId: bigint, sender: string) {
        super(`Message ${messageId} not found on ${sender}`);
        this.name = "MessageNotFoundError";
    }
}

export class FailedToEditMessageError extends Error {
    constructor(messageId: bigint, sender: string) {
        super(`Failed to edit message ${messageId} on ${sender}`);
        this.name = "FailedToEditMessageError";
    }
}

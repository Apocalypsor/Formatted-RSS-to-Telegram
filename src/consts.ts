export const UA = "curl/8.16.0";
export const DEFAULT_DATA_PATH = "./config/";
export const DEFAULT_CONFIG_FILE = "config.yaml";
export const DEFAULT_RSS_FILE = "rss.yaml";
export const AXIOS_TIMEOUT = 60000;

// Telegram
export const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const TELEGRAM_MEDIA_GROUP_LIMIT = 10;

// Queue
export const QUEUE_MAX_RETRIES = 3;
export const QUEUE_DELAY_BETWEEN_MESSAGES = 1000;
export const QUEUE_LRU_CAPACITY = 10000;
export const QUEUE_DRAIN_TIMEOUT = 30000;
export const QUEUE_CLEANUP_HOURS = 24;

// RSS
export const RSS_PARSER_TIMEOUT = 10000;
export const CONTENT_SNIPPET_LENGTH = 200;
export const EXPIRE_NOTIFY_THRESHOLD = 16;

export enum TASK_TYPE {
    SEND = "send",
    EDIT = "edit",
}

export enum MEDIA_TYPE {
    PHOTO = "photo",
    VIDEO = "video",
}

export enum QUEUE_STATUS {
    PENDING = "pending",
    COMPLETED = "completed",
    FAILED = "failed",
}

export enum RSS_RULE_TYPE {
    REGEX = "regex",
    FUNC = "func",
}

export enum RSS_FILTER_TYPE {
    OUT = "out",
    IN = "in",
}

export const UA = "curl/8.16.0";
export const DEFAULT_DATA_PATH = "./config/";
export const DEFAULT_CONFIG_FILE = "config.yaml";
export const DEFAULT_RSS_FILE = "rss.yaml";
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const AXIOS_TIMEOUT = 60000;

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
    PROCESSING = "processing",
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

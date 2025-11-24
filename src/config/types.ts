import { z } from "zod";
import { UA } from "@consts";

// Proxy schemas
export const EnabledProxySchema = z.object({
    enabled: z.literal(true),
    protocol: z.string().default("http"),
    host: z.string().default("127.0.0.1"),
    port: z.number().default(1080),
    auth: z
        .object({
            username: z.string().default(""),
            password: z.string().default(""),
        })
        .default({ username: "", password: "" }),
});

export const DisabledProxySchema = z.object({
    enabled: z.literal(false),
});

export const ProxySchema = z.union([EnabledProxySchema, DisabledProxySchema]);

// Telegram schema
export const TelegramSchema = z.object({
    name: z.string(),
    token: z.string(),
    chatId: z.number().transform((val) => BigInt(val)),
    parseMode: z.string().default("Markdown"),
    disableNotification: z.boolean().default(false),
    disableWebPagePreview: z.boolean().default(false),
});

// Config schema
export const ConfigSchema = z.object({
    expireTime: z.number().default(30),
    interval: z.number().default(10),
    userAgent: z.string().default(UA),
    notifyTelegramChatId: z.number().optional(),
    flaresolverr: z
        .string()
        .transform((val) => val?.replace(/\/$/, ""))
        .optional(),
    proxy: ProxySchema.default({ enabled: false }),
    telegram: z.array(TelegramSchema).min(1),
});

// RSS schemas
export const RSSRuleSchema = z.object({
    obj: z.string(),
    type: z.enum(["regex", "func"]),
    matcher: z.string(),
    dest: z.string(),
});

export const RSSFilterSchema = z.object({
    obj: z.string(),
    type: z.enum(["out", "in"]),
    matcher: z.string(),
});

export const RSSItemSchema = z.object({
    name: z.string(),
    url: z.string(),
    sendTo: z.string(),
    disableNotification: z.boolean().default(false),
    disableWebPagePreview: z.boolean().default(false),
    fullText: z.boolean().default(false),
    embedMedia: z.boolean().default(false),
    embedMediaExclude: z.array(z.string()).default([]),
    rules: z.array(RSSRuleSchema).default([]),
    filters: z.array(RSSFilterSchema).default([]),
    text: z.string(),
});

export const RSSArraySchema = z.array(RSSItemSchema).min(1);

// Export inferred types
export type Config = z.infer<typeof ConfigSchema>;
export type Telegram = z.infer<typeof TelegramSchema>;
export type RSS = z.infer<typeof RSSItemSchema>;
export type RSSRule = z.infer<typeof RSSRuleSchema>;
export type RSSFilter = z.infer<typeof RSSFilterSchema>;

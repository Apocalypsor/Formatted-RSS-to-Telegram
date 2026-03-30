import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const history = sqliteTable(
  "History",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uniqueHash: text("unique_hash").notNull().unique(),
    url: text("url").notNull(),
    textHash: text("text_hash").notNull(),
    telegramName: text("telegram_name").notNull(),
    telegramMessageId: integer("telegram_message_id").notNull(),
    telegramChatId: integer("telegram_chat_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("History_url_idx").on(table.url)],
);

export const expire = sqliteTable("Expire", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  expire: integer("expire").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull(),
});

export const messageQueue = sqliteTable(
  "MessageQueue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskType: text("task_type").notNull(),
    taskData: text("task_data").notNull(),
    status: text("status").notNull().default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("MessageQueue_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

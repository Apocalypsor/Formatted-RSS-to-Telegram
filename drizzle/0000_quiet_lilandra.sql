CREATE TABLE IF NOT EXISTS `Expire` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`expire` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Expire_url_unique` ON `Expire` (`url`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `History` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unique_hash` text NOT NULL,
	`url` text NOT NULL,
	`text_hash` text NOT NULL,
	`telegram_name` text NOT NULL,
	`telegram_message_id` integer NOT NULL,
	`telegram_chat_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `History_unique_hash_unique` ON `History` (`unique_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `History_url_idx` ON `History` (`url`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `MessageQueue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_type` text NOT NULL,
	`task_data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `MessageQueue_status_created_at_idx` ON `MessageQueue` (`status`,`created_at`);

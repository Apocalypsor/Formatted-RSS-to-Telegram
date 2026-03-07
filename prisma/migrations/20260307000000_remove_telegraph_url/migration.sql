-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_History" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unique_hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "telegram_message_id" BIGINT NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_History" ("id", "unique_hash", "url", "text_hash", "telegram_name", "telegram_message_id", "telegram_chat_id", "created_at", "updated_at") SELECT "id", "unique_hash", "url", "text_hash", "telegram_name", "telegram_message_id", "telegram_chat_id", "created_at", "updated_at" FROM "History";
DROP TABLE "History";
ALTER TABLE "new_History" RENAME TO "History";
CREATE UNIQUE INDEX "History_unique_hash_key" ON "History"("unique_hash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "History" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "unique_hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "telegram_message_id" BIGINT NOT NULL,
    "telegram_chat_id" BIGINT NOT NULL,
    "telegraph_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Expire" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "expire" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "History_unique_hash_key" ON "History"("unique_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Expire_url_key" ON "Expire"("url");

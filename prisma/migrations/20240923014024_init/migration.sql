-- CreateTable
CREATE TABLE "History" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "unique_hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "telegram_name" TEXT NOT NULL,
    "telegram_message_id" INTEGER NOT NULL,
    "telegram_chat_id" INTEGER NOT NULL,
    "telegraph_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Expire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "expire" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "History_unique_hash_key" ON "History"("unique_hash");

-- CreateIndex
CREATE UNIQUE INDEX "Expire_url_key" ON "Expire"("url");

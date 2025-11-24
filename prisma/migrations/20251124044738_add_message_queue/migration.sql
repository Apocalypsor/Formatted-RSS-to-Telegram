-- CreateTable
CREATE TABLE "MessageQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_type" TEXT NOT NULL,
    "task_data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MessageQueue_status_created_at_idx" ON "MessageQueue"("status", "created_at");

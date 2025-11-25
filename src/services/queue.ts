import type { Telegram } from "@config";
import {
    addHistory,
    deleteCompletedMessages,
    enqueueMessage,
    getPendingMessages,
    incrementRetryCount,
    updateHistory,
    updateMessageStatus,
} from "@database";
import { logger } from "@utils";
import { edit, send } from "./sender";
import { MediaType, TaskType } from "@consts";
import { AxiosError } from "axios";

// History metadata for saving after task execution
export interface HistoryMetadata {
    uniqueHash: string;
    url: string;
    textHash: string;
    senderName: string;
    chatId: bigint;
}

export interface EditHistoryMetadata {
    historyId: number;
    textHash: string;
}

// Serializable task data (no callbacks)
export interface SendMessageTaskData {
    type: TaskType.SEND;
    sender: Telegram;
    text: string;
    initialized: boolean;
    mediaUrls?: {
        type: MediaType;
        url: string;
    }[];
    uniqueKey?: string; // For deduplication
    historyMetadata?: HistoryMetadata; // For saving to history after send
}

export interface EditMessageTaskData {
    type: TaskType.EDIT;
    sender: Telegram;
    messageId: string; // BigInt serialized as string
    text: string;
    uniqueKey?: string; // For deduplication
    editHistoryMetadata?: EditHistoryMetadata; // For updating history after edit
}

export type MessageTaskData = SendMessageTaskData | EditMessageTaskData;

// In-memory task (extends serializable data with runtime fields)
interface SendMessageTask extends SendMessageTaskData {
    dbId?: number;
    retryCount?: number;
}

interface EditMessageTask extends EditMessageTaskData {
    dbId?: number;
    retryCount?: number;
}

type MessageTask = SendMessageTask | EditMessageTask;

class MessageQueue {
    private queue: MessageTask[] = [];
    private processing = false;
    private readonly delayBetweenMessages = 1000; // 1 second between messages
    private readonly maxRetries = 3;
    private readonly processedKeys = new Set<string>(); // Track processed unique keys for deduplication
    private readonly maxProcessedKeys = 10000; // Max size before clearing to prevent memory leak

    /**
     * Add a message task to the queue (persists to database)
     */
    async enqueue(task: MessageTask): Promise<void> {
        // Check for duplicate using uniqueKey if provided
        if (task.uniqueKey) {
            if (this.processedKeys.has(task.uniqueKey)) {
                logger.debug(
                    `Task with key ${task.uniqueKey} already processed, skipping`,
                );
                return;
            }
            this.processedKeys.add(task.uniqueKey);

            // Prevent memory leak: clear if size exceeds limit
            if (this.processedKeys.size >= this.maxProcessedKeys) {
                logger.info(
                    `Processed keys reached ${this.maxProcessedKeys}, clearing to prevent memory leak`,
                );
                this.processedKeys.clear();
            }
        }

        // Serialize task data (includes history metadata for persistence)
        const taskData: MessageTaskData = {
            type: task.type,
            sender: task.sender,
            text: task.text,
            uniqueKey: task.uniqueKey,
            initialized:
                task.type === TaskType.SEND ? task.initialized : undefined,
            mediaUrls: task.type === TaskType.SEND ? task.mediaUrls : undefined,
            historyMetadata:
                task.type === TaskType.SEND ? task.historyMetadata : undefined,
            messageId: task.type === TaskType.EDIT ? task.messageId : undefined,
            editHistoryMetadata:
                task.type === TaskType.EDIT
                    ? task.editHistoryMetadata
                    : undefined,
        } as MessageTaskData;

        // Persist to database
        const dbId = await enqueueMessage(task.type, JSON.stringify(taskData));
        task.dbId = dbId;

        // Add to in-memory queue
        this.queue.push(task);
        logger.debug(
            `Task enqueued (DB ID: ${dbId}). Queue size: ${this.queue.length}, Type: ${task.type}`,
        );

        // Start processing if not already running
        if (!this.processing) {
            void this.processQueue();
        }
    }

    /**
     * Add a send message task (fire-and-forget)
     */
    enqueueSend(
        sender: Telegram,
        text: string,
        initialized: boolean,
        mediaUrls?: {
            type: MediaType;
            url: string;
        }[],
        uniqueKey?: string,
        historyMetadata?: HistoryMetadata,
    ): void {
        void this.enqueue({
            type: TaskType.SEND,
            sender,
            text,
            initialized,
            mediaUrls,
            uniqueKey,
            historyMetadata,
        });
    }

    /**
     * Add an edit message task (fire-and-forget)
     */
    enqueueEdit(
        sender: Telegram,
        messageId: bigint,
        text: string,
        uniqueKey?: string,
        editHistoryMetadata?: EditHistoryMetadata,
    ): void {
        void this.enqueue({
            type: TaskType.EDIT,
            sender,
            messageId: messageId.toString(), // Convert BigInt to string for serialization
            text,
            uniqueKey,
            editHistoryMetadata,
        });
    }

    /**
     * Get current queue size (in-memory)
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Check if queue is processing
     */
    isProcessing(): boolean {
        return this.processing;
    }

    /**
     * Get queue statistics from database
     */
    async getQueueStats(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    }> {
        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        };

        try {
            const pendingTasks = await getPendingMessages();
            stats.pending = pendingTasks.length;

            // You can add more queries here if needed for other statuses
            // For now, pending is the most important metric
        } catch (error) {
            logger.error(`Failed to get queue stats: ${error}`);
        }

        return stats;
    }

    /**
     * Recover pending tasks from database on startup
     */
    async recoverPendingTasks(): Promise<void> {
        logger.info("Recovering pending tasks from database...");
        const pendingTasks = await getPendingMessages();

        if (pendingTasks.length === 0) {
            logger.info("No pending tasks to recover");
            return;
        }

        logger.info(`Found ${pendingTasks.length} pending tasks to recover`);

        for (const dbTask of pendingTasks) {
            try {
                const taskData: MessageTaskData = JSON.parse(dbTask.task_data);

                // Create in-memory task from recovered data
                if (taskData.type === TaskType.SEND) {
                    const task: SendMessageTask = {
                        ...taskData,
                        dbId: dbTask.id,
                        retryCount: dbTask.retry_count,
                    };

                    // Recover unique key for deduplication
                    if (task.uniqueKey) {
                        this.processedKeys.add(task.uniqueKey);
                    }

                    this.queue.push(task);
                } else if (taskData.type === TaskType.EDIT) {
                    const task: EditMessageTask = {
                        ...taskData,
                        dbId: dbTask.id,
                        retryCount: dbTask.retry_count,
                    };

                    // Recover unique key for deduplication
                    if (task.uniqueKey) {
                        this.processedKeys.add(task.uniqueKey);
                    }

                    this.queue.push(task);
                }
            } catch (error) {
                logger.error(`Failed to recover task ${dbTask.id}: ${error}`);
            }
        }

        // Start processing recovered tasks
        if (this.queue.length > 0 && !this.processing) {
            logger.info(
                `Starting to process ${this.queue.length} recovered tasks`,
            );
            void this.processQueue();
        }
    }

    /**
     * Clean up old completed tasks from database
     */
    async cleanupCompletedTasks(olderThanHours = 24): Promise<void> {
        logger.info(
            `Cleaning up completed tasks older than ${olderThanHours} hours`,
        );
        await deleteCompletedMessages(olderThanHours);
    }

    /**
     * Process the queue with rate limiting
     */
    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (!task) break;

            try {
                await this.executeTask(task);
            } catch (error) {
                // Check if this is a 429 rate limit error
                if (
                    error instanceof AxiosError &&
                    error.response?.status === 429
                ) {
                    // Extract retry_after from Telegram API response
                    const retryAfter =
                        error.response?.data?.parameters?.retry_after || 60;
                    const retryAfterMs = retryAfter * 1000;

                    logger.warn(
                        `Rate limited (429). Waiting ${retryAfter}s before continuing...`,
                    );

                    // Put the task back at the front of the queue
                    this.queue.unshift(task);

                    // Wait for the retry-after period
                    await this.delay(
                        Math.max(0, retryAfterMs - this.delayBetweenMessages),
                    );
                    continue;
                }
                // For other errors, executeTask already handles retry logic
            }

            // Wait before processing next message to avoid rate limiting
            if (this.queue.length > 0) {
                await this.delay(this.delayBetweenMessages);
            }
        }

        this.processing = false;
        this.processedKeys.clear();
        logger.debug("Queue processing completed");
    }

    /**
     * Execute a single task with retry logic
     */
    private async executeTask(task: MessageTask): Promise<void> {
        const retryCount = task.retryCount ?? 0;
        try {
            if (task.type === TaskType.SEND) {
                logger.debug(
                    `Processing send task (DB ID: ${task.dbId}) for ${task.sender.name} (attempt ${retryCount + 1})`,
                );
                const messageId = await send(
                    task.sender,
                    task.text,
                    task.initialized,
                    task.mediaUrls,
                );

                // Save to history if metadata provided
                if (messageId && task.historyMetadata) {
                    try {
                        await addHistory(
                            task.historyMetadata.uniqueHash,
                            task.historyMetadata.url,
                            task.historyMetadata.textHash,
                            task.historyMetadata.senderName,
                            messageId,
                            task.historyMetadata.chatId,
                            "",
                        );
                        logger.debug(`Saved history for message ${messageId}`);
                    } catch (e) {
                        logger.error(
                            `Failed to save history for message ${messageId}: ${e}`,
                        );
                    }
                }

                // Mark as completed in database
                if (task.dbId) {
                    await updateMessageStatus(task.dbId, "completed");
                }
            } else if (task.type === TaskType.EDIT) {
                logger.debug(
                    `Processing edit task (DB ID: ${task.dbId}) for ${task.sender.name}, message ${task.messageId} (attempt ${retryCount + 1})`,
                );
                // Convert string back to BigInt
                const messageIdBigInt = BigInt(task.messageId);
                await edit(task.sender, messageIdBigInt, task.text);

                // Update history if metadata provided
                if (task.editHistoryMetadata) {
                    try {
                        await updateHistory(
                            task.editHistoryMetadata.historyId,
                            task.editHistoryMetadata.textHash,
                            messageIdBigInt,
                        );
                        logger.debug(
                            `Updated history for message ${task.messageId}`,
                        );
                    } catch (e) {
                        logger.error(
                            `Failed to update history for message ${task.messageId}: ${e}`,
                        );
                    }
                }

                // Mark as completed in database
                if (task.dbId) {
                    await updateMessageStatus(task.dbId, "completed");
                }
            }
        } catch (error) {
            // Re-throw 429 errors immediately for processQueue to handle
            if (error instanceof AxiosError && error.response?.status === 429) {
                throw error;
            }

            // Increment retry count in database for other errors
            if (task.dbId) {
                await incrementRetryCount(task.dbId);
            }

            // Check if we should retry
            if (retryCount < this.maxRetries) {
                logger.warn(
                    `Task (DB ID: ${task.dbId}) failed (attempt ${retryCount + 1}/${this.maxRetries}), re-enqueueing for retry...`,
                );

                // Re-enqueue the task with incremented retry count
                // This ensures the task goes through the normal queue processing
                // and respects rate limiting
                task.retryCount = retryCount + 1;
                this.queue.push(task);

                logger.debug(
                    `Task re-enqueued (DB ID: ${task.dbId}). Queue size: ${this.queue.length}`,
                );
            } else {
                const errorMsg =
                    error instanceof Error ? error.message : String(error);
                logger.error(
                    `Task (DB ID: ${task.dbId}) failed after ${this.maxRetries} retries: ${errorMsg}`,
                );

                // Mark as failed in database
                if (task.dbId) {
                    await updateMessageStatus(task.dbId, "failed", errorMsg);
                }

                // Mark in history database as well
                if (task.type === TaskType.SEND && task.historyMetadata) {
                    try {
                        await addHistory(
                            task.historyMetadata.uniqueHash,
                            task.historyMetadata.url,
                            task.historyMetadata.textHash,
                            task.historyMetadata.senderName,
                            BigInt(0), // Use 0 to indicate failed message
                            task.historyMetadata.chatId,
                            "",
                        );
                        logger.debug(
                            `Marked failed send task in history with message_id=0`,
                        );
                    } catch (e) {
                        logger.error(
                            `Failed to mark failed send task in history: ${e}`,
                        );
                    }
                } else if (
                    task.type === TaskType.EDIT &&
                    task.editHistoryMetadata
                ) {
                    try {
                        // For edit tasks, update the existing history record
                        // Keep the original message_id but update with new text_hash
                        const messageIdBigInt = BigInt(task.messageId);
                        await updateHistory(
                            task.editHistoryMetadata.historyId,
                            task.editHistoryMetadata.textHash,
                            messageIdBigInt,
                        );
                        logger.debug(
                            `Marked failed edit task in history (kept original message_id)`,
                        );
                    } catch (e) {
                        logger.error(
                            `Failed to mark failed edit task in history: ${e}`,
                        );
                    }
                }
            }
        }
    }

    /**
     * Helper to delay execution
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const messageQueue = new MessageQueue();

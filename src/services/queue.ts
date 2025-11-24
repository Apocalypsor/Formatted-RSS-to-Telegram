import type { Telegram } from "@config";
import {
    deleteCompletedMessages,
    enqueueMessage,
    getPendingMessages,
    incrementRetryCount,
    updateMessageStatus,
} from "@database";
import { logger } from "@utils";
import { edit, send } from "./sender";
import { MediaType, TaskType } from "@consts";

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
}

export interface EditMessageTaskData {
    type: TaskType.EDIT;
    sender: Telegram;
    messageId: string; // BigInt serialized as string
    text: string;
}

export type MessageTaskData = SendMessageTaskData | EditMessageTaskData;

// In-memory task with callbacks (for Promise resolution)
interface SendMessageTask extends SendMessageTaskData {
    dbId?: number;
    retryCount?: number;
    onSuccess: (messageId: bigint | undefined) => void;
    onError: (error: Error) => void;
}

interface EditMessageTask extends EditMessageTaskData {
    dbId?: number;
    retryCount?: number;
    onSuccess: () => void;
    onError: (error: Error) => void;
}

type MessageTask = SendMessageTask | EditMessageTask;

class MessageQueue {
    private queue: MessageTask[] = [];
    private processing = false;
    private readonly delayBetweenMessages = 1000; // 1 second between messages
    private readonly maxRetries = 3;

    /**
     * Add a message task to the queue (persists to database)
     */
    async enqueue(task: MessageTask): Promise<void> {
        // Serialize task data (without callbacks)
        const taskData: MessageTaskData = {
            type: task.type,
            sender: task.sender,
            text: task.text,
            initialized: task.type === "send" ? task.initialized : undefined,
            mediaUrls: task.type === "send" ? task.mediaUrls : undefined,
            messageId: task.type === "edit" ? task.messageId : undefined,
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
     * Add a send message task (fire-and-forget with callbacks)
     */
    enqueueSend(
        sender: Telegram,
        text: string,
        initialized: boolean,
        mediaUrls?: {
            type: MediaType;
            url: string;
        }[],
        onSuccess?: (messageId: bigint | undefined) => void | Promise<void>,
        onError?: (error: Error) => void | Promise<void>,
    ): void {
        void this.enqueue({
            type: TaskType.SEND,
            sender,
            text,
            initialized,
            mediaUrls,
            onSuccess: onSuccess || (() => {}),
            onError: onError || (() => {}),
        });
    }

    /**
     * Add an edit message task (fire-and-forget with callbacks)
     */
    enqueueEdit(
        sender: Telegram,
        messageId: bigint,
        text: string,
        onSuccess?: () => void | Promise<void>,
        onError?: (error: Error) => void | Promise<void>,
    ): void {
        void this.enqueue({
            type: TaskType.EDIT,
            sender,
            messageId: messageId.toString(), // Convert BigInt to string for serialization
            text,
            onSuccess: onSuccess || (() => {}),
            onError: onError || (() => {}),
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

                // Create in-memory task (without callbacks - will just process)
                if (taskData.type === TaskType.SEND) {
                    const task: SendMessageTask = {
                        ...taskData,
                        dbId: dbTask.id,
                        onSuccess: () => {
                            logger.info(
                                `Recovered task ${dbTask.id} completed successfully`,
                            );
                        },
                        onError: (error) => {
                            logger.error(
                                `Recovered task ${dbTask.id} failed: ${error.message}`,
                            );
                        },
                    };
                    this.queue.push(task);
                } else if (taskData.type === TaskType.EDIT) {
                    const task: EditMessageTask = {
                        ...taskData,
                        dbId: dbTask.id,
                        onSuccess: () => {
                            logger.info(
                                `Recovered task ${dbTask.id} completed successfully`,
                            );
                        },
                        onError: (error) => {
                            logger.error(
                                `Recovered task ${dbTask.id} failed: ${error.message}`,
                            );
                        },
                    };
                    this.queue.push(task);
                }
            } catch (error) {
                logger.error(`Failed to parse task ${dbTask.id}: ${error}`);
                await updateMessageStatus(
                    dbTask.id,
                    "failed",
                    "Failed to parse task data",
                );
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

            await this.executeTask(task);

            // Wait before processing next message to avoid rate limiting
            if (this.queue.length > 0) {
                await this.delay(this.delayBetweenMessages);
            }
        }

        this.processing = false;
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

                // Mark as completed in database
                if (task.dbId) {
                    await updateMessageStatus(task.dbId, "completed");
                }

                task.onSuccess(messageId);
            } else if (task.type === TaskType.EDIT) {
                logger.debug(
                    `Processing edit task (DB ID: ${task.dbId}) for ${task.sender.name}, message ${task.messageId} (attempt ${retryCount + 1})`,
                );
                // Convert string back to BigInt
                const messageIdBigInt = BigInt(task.messageId);
                await edit(task.sender, messageIdBigInt, task.text);

                // Mark as completed in database
                if (task.dbId) {
                    await updateMessageStatus(task.dbId, "completed");
                }

                task.onSuccess();
            }
        } catch (error) {
            // Increment retry count in database
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

                task.onError(
                    error instanceof Error ? error : new Error(String(error)),
                );
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

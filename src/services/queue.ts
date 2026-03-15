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
import {
    MEDIA_TYPE,
    QUEUE_DELAY_BETWEEN_MESSAGES,
    QUEUE_LRU_CAPACITY,
    QUEUE_CLEANUP_HOURS,
    QUEUE_MAX_RETRIES,
    QUEUE_STATUS,
    TASK_TYPE,
} from "@consts";
import { AxiosError } from "axios";
import PQueue from "p-queue";

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

export interface SendMessageTaskData {
    type: TASK_TYPE.SEND;
    sender: Telegram;
    text: string;
    mediaUrls?: {
        type: MEDIA_TYPE;
        url: string;
    }[];
    uniqueKey?: string;
    historyMetadata?: HistoryMetadata;
}

export interface EditMessageTaskData {
    type: TASK_TYPE.EDIT;
    sender: Telegram;
    messageId: string; // BigInt serialized as string
    text: string;
    uniqueKey?: string;
    editHistoryMetadata?: EditHistoryMetadata;
}

export type MessageTaskData = SendMessageTaskData | EditMessageTaskData;

interface TaskWithDbId {
    data: MessageTaskData;
    dbId?: number;
}

class LRUSet {
    private readonly map = new Map<string, true>();
    private readonly capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    has(key: string): boolean {
        if (!this.map.has(key)) return false;
        this.map.delete(key);
        this.map.set(key, true);
        return true;
    }

    add(key: string): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.capacity) {
            const oldest = this.map.keys().next().value!;
            this.map.delete(oldest);
        }
        this.map.set(key, true);
    }

    get size(): number {
        return this.map.size;
    }
}

class MessageQueue {
    private readonly pQueue = new PQueue({
        concurrency: 1,
        intervalCap: 1,
        interval: QUEUE_DELAY_BETWEEN_MESSAGES,
    });
    private readonly processedKeys = new LRUSet(QUEUE_LRU_CAPACITY);

    enqueueSend(
        sender: Telegram,
        text: string,
        mediaUrls?: {
            type: MEDIA_TYPE;
            url: string;
        }[],
        uniqueKey?: string,
        historyMetadata?: HistoryMetadata,
    ): void {
        if (uniqueKey && this.processedKeys.has(uniqueKey)) {
            logger.debug(`Task with key ${uniqueKey} already processed, skipping`);
            return;
        }
        if (uniqueKey) this.processedKeys.add(uniqueKey);

        const taskData: SendMessageTaskData = {
            type: TASK_TYPE.SEND,
            sender,
            text,
            mediaUrls,
            uniqueKey,
            historyMetadata,
        };

        void this.persistAndEnqueue(taskData);
    }

    enqueueEdit(
        sender: Telegram,
        messageId: bigint,
        text: string,
        uniqueKey?: string,
        editHistoryMetadata?: EditHistoryMetadata,
    ): void {
        if (uniqueKey && this.processedKeys.has(uniqueKey)) {
            logger.debug(`Task with key ${uniqueKey} already processed, skipping`);
            return;
        }
        if (uniqueKey) this.processedKeys.add(uniqueKey);

        const taskData: EditMessageTaskData = {
            type: TASK_TYPE.EDIT,
            sender,
            messageId: messageId.toString(),
            text,
            uniqueKey,
            editHistoryMetadata,
        };

        void this.persistAndEnqueue(taskData);
    }

    private async persistAndEnqueue(taskData: MessageTaskData): Promise<void> {
        try {
            const dbId = await enqueueMessage(taskData.type, JSON.stringify(taskData));
            logger.debug(
                `Task enqueued (DB ID: ${dbId}). Queue size: ${this.getQueueSize()}, Type: ${taskData.type}`,
            );
            void this.pQueue.add(() => this.executeWithRetry({ data: taskData, dbId }));
        } catch (e) {
            logger.error(`Failed to persist task: ${e}`);
        }
    }

    private async executeWithRetry(task: TaskWithDbId, attempt = 0): Promise<void> {
        try {
            if (task.data.type === TASK_TYPE.SEND) {
                const data = task.data;
                logger.debug(
                    `Processing send task (DB ID: ${task.dbId}) for ${data.sender.name} (attempt ${attempt + 1})`,
                );
                const messageId = await send(data.sender, data.text, data.mediaUrls);

                if (data.historyMetadata) {
                    try {
                        await addHistory(
                            data.historyMetadata.uniqueHash,
                            data.historyMetadata.url,
                            data.historyMetadata.textHash,
                            data.historyMetadata.senderName,
                            messageId,
                            data.historyMetadata.chatId,
                        );
                        logger.debug(`Saved history for message ${messageId}`);
                    } catch (e) {
                        logger.error(`Failed to save history for message ${messageId}: ${e}`);
                    }
                }
            } else {
                const data = task.data;
                const messageIdBigInt = BigInt(data.messageId);
                logger.debug(
                    `Processing edit task (DB ID: ${task.dbId}) for ${data.sender.name}, message ${data.messageId} (attempt ${attempt + 1})`,
                );
                await edit(data.sender, messageIdBigInt, data.text);

                if (data.editHistoryMetadata) {
                    try {
                        await updateHistory(
                            data.editHistoryMetadata.historyId,
                            data.editHistoryMetadata.textHash,
                            messageIdBigInt,
                        );
                        logger.debug(`Updated history for message ${data.messageId}`);
                    } catch (e) {
                        logger.error(`Failed to update history for message ${data.messageId}: ${e}`);
                    }
                }
            }

            if (task.dbId) {
                try {
                    await updateMessageStatus(task.dbId, QUEUE_STATUS.COMPLETED);
                } catch (e) {
                    logger.error(`Failed to update task status to completed (DB ID: ${task.dbId}): ${e}`);
                }
            }
        } catch (error) {
            // 429 rate limit: wait retry_after then retry (don't count as attempt)
            // concurrency=1 so no other task runs while we wait
            if (error instanceof AxiosError && error.response?.status === 429) {
                const retryAfter = error.response?.data?.parameters?.retry_after || 60;
                logger.warn(`Rate limited (429). Waiting ${retryAfter}s before retrying...`);
                await this.delay(retryAfter * 1000);
                return this.executeWithRetry(task, attempt);
            }

            if (task.dbId) await incrementRetryCount(task.dbId);

            if (attempt < QUEUE_MAX_RETRIES) {
                logger.warn(
                    `Task (DB ID: ${task.dbId}) failed (attempt ${attempt + 1}/${QUEUE_MAX_RETRIES}), retrying...`,
                );
                return this.executeWithRetry(task, attempt + 1);
            }

            // Final failure
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Task (DB ID: ${task.dbId}) failed after ${QUEUE_MAX_RETRIES} retries: ${errorMsg}`);

            if (task.dbId) {
                await updateMessageStatus(task.dbId, QUEUE_STATUS.FAILED, errorMsg);
            }

            // Save failure to history
            if (task.data.type === TASK_TYPE.SEND && task.data.historyMetadata) {
                const meta = task.data.historyMetadata;
                await addHistory(meta.uniqueHash, meta.url, meta.textHash, meta.senderName, BigInt(0), meta.chatId).catch((e) =>
                    logger.error(`Failed to mark failed send task in history: ${e}`),
                );
            } else if (task.data.type === TASK_TYPE.EDIT && task.data.editHistoryMetadata) {
                const meta = task.data.editHistoryMetadata;
                const messageIdBigInt = BigInt(task.data.messageId);
                await updateHistory(meta.historyId, meta.textHash, messageIdBigInt).catch((e) =>
                    logger.error(`Failed to mark failed edit task in history: ${e}`),
                );
            }
        }
    }

    getQueueSize(): number {
        return this.pQueue.size + this.pQueue.pending;
    }

    async drain(timeoutMs = 30000): Promise<void> {
        if (this.pQueue.size === 0 && this.pQueue.pending === 0) return;
        logger.info(`Waiting for ${this.getQueueSize()} queued tasks to finish (timeout: ${timeoutMs}ms)...`);
        let timedOut = false;
        const idle = this.pQueue.onIdle();
        const timeout = new Promise<void>((resolve) => {
            setTimeout(() => {
                timedOut = true;
                resolve();
            }, timeoutMs);
        });
        await Promise.race([idle, timeout]);
        if (timedOut) {
            logger.warn(`Drain timeout reached, ${this.getQueueSize()} tasks still pending`);
        } else {
            logger.info("Queue drained successfully");
        }
    }

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

                if (taskData.uniqueKey) {
                    this.processedKeys.add(taskData.uniqueKey);
                }

                void this.pQueue.add(() =>
                    this.executeWithRetry(
                        { data: taskData, dbId: dbTask.id },
                        dbTask.retry_count,
                    ),
                );
            } catch (error) {
                logger.error(`Failed to recover task ${dbTask.id}: ${error}`);
            }
        }

        logger.info(`Recovered ${pendingTasks.length} tasks into queue`);
    }

    async cleanupCompletedTasks(olderThanHours = QUEUE_CLEANUP_HOURS): Promise<void> {
        logger.info(`Cleaning up completed tasks older than ${olderThanHours} hours`);
        await deleteCompletedMessages(olderThanHours);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const messageQueue = new MessageQueue();

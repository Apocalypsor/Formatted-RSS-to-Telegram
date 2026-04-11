import type { Telegram } from "@config";
import {
  type MEDIA_TYPE,
  QUEUE_CLEANUP_HOURS,
  QUEUE_DELAY_BETWEEN_MESSAGES,
  QUEUE_STATUS,
  TASK_TYPE,
} from "@consts";
import {
  addHistory,
  deleteCompletedMessages,
  enqueueMessage,
  finalizeHistory,
  getHistory,
  getPendingMessages,
  reserveHistory,
  updateHistory,
  updateMessageStatus,
} from "@database";
import { logger } from "@utils";
import PQueue from "p-queue";
import { edit, send } from "./sender";

export interface SendTaskMetadata {
  uniqueHash: string;
  textHash: string;
  url: string;
  senderName: string;
  chatId: number;
}

export interface EditTaskMetadata {
  uniqueHash: string;
  textHash: string;
  historyId: number;
}

export interface SendMessageTaskData {
  type: TASK_TYPE.SEND;
  sender: Telegram;
  text: string;
  mediaUrls?: {
    type: MEDIA_TYPE;
    url: string;
  }[];
  metadata?: SendTaskMetadata;
}

export interface EditMessageTaskData {
  type: TASK_TYPE.EDIT;
  sender: Telegram;
  messageId: string; // number serialized as string
  text: string;
  metadata?: EditTaskMetadata;
}

export type MessageTaskData = SendMessageTaskData | EditMessageTaskData;

interface TaskWithDbId {
  data: MessageTaskData;
  dbId?: number;
}

class MessageQueue {
  private readonly pQueue = new PQueue({
    concurrency: 1,
    intervalCap: 1,
    interval: QUEUE_DELAY_BETWEEN_MESSAGES,
  });

  enqueueSend(
    sender: Telegram,
    text: string,
    mediaUrls?: {
      type: MEDIA_TYPE;
      url: string;
    }[],
    metadata?: SendTaskMetadata,
  ): void {
    void this.persistAndEnqueue({
      type: TASK_TYPE.SEND,
      sender,
      text,
      mediaUrls,
      metadata,
    });
  }

  enqueueEdit(
    sender: Telegram,
    messageId: number,
    text: string,
    metadata?: EditTaskMetadata,
  ): void {
    void this.persistAndEnqueue({
      type: TASK_TYPE.EDIT,
      sender,
      messageId: messageId.toString(),
      text,
      metadata,
    });
  }

  private async persistAndEnqueue(taskData: MessageTaskData): Promise<void> {
    try {
      const dbId = enqueueMessage(taskData.type, JSON.stringify(taskData));
      logger.debug(
        `Task enqueued (DB ID: ${dbId}). Queue size: ${this.getQueueSize()}, Type: ${taskData.type}`,
      );
      void this.pQueue.add(() => this.execute({ data: taskData, dbId }));
    } catch (e) {
      logger.error(`Failed to persist task: ${e}`);
    }
  }

  private async execute(task: TaskWithDbId): Promise<void> {
    try {
      if (task.data.type === TASK_TYPE.SEND) {
        await this.executeSend(task.dbId, task.data);
      } else {
        await this.executeEdit(task.dbId, task.data);
      }

      this.markStatus(task.dbId, QUEUE_STATUS.COMPLETED);
    } catch (error) {
      const errorDetail =
        error instanceof Error ? error.message : String(error);
      logger.error(`Task (DB ID: ${task.dbId}) failed: ${errorDetail}`);

      this.markStatus(task.dbId, QUEUE_STATUS.FAILED, errorDetail);
      this.persistFailureToHistory(task.data);
    }
  }

  private async executeSend(
    dbId: number | undefined,
    data: SendMessageTaskData,
  ): Promise<void> {
    logger.debug(
      `Processing send task (DB ID: ${dbId}) for ${data.sender.name}`,
    );

    if (data.metadata) {
      reserveHistory(
        data.metadata.uniqueHash,
        data.metadata.url,
        data.metadata.textHash,
        data.metadata.senderName,
        data.metadata.chatId,
      );
    }

    const messageId = await send(data.sender, data.text, data.mediaUrls);

    if (data.metadata) {
      try {
        finalizeHistory(
          data.metadata.uniqueHash,
          data.metadata.textHash,
          messageId,
        );
        logger.debug(`Saved history for message ${messageId}`);
      } catch (e) {
        logger.error(
          `Failed to finalize history for message ${messageId}: ${e}`,
        );
      }
    }
  }

  private async executeEdit(
    dbId: number | undefined,
    data: EditMessageTaskData,
  ): Promise<void> {
    const messageId = Number(data.messageId);
    logger.debug(
      `Processing edit task (DB ID: ${dbId}) for ${data.sender.name}, message ${data.messageId}`,
    );

    await edit(data.sender, messageId, data.text);

    if (data.metadata) {
      try {
        updateHistory(
          data.metadata.historyId,
          data.metadata.textHash,
          messageId,
        );
        logger.debug(`Updated history for message ${data.messageId}`);
      } catch (e) {
        logger.error(
          `Failed to update history for message ${data.messageId}: ${e}`,
        );
      }
    }
  }

  private markStatus(
    dbId: number | undefined,
    status: QUEUE_STATUS,
    detail?: string,
  ): void {
    if (!dbId) return;
    try {
      updateMessageStatus(dbId, status, detail);
    } catch (e) {
      logger.error(
        `Failed to update task status to ${status} (DB ID: ${dbId}): ${e}`,
      );
    }
  }

  private persistFailureToHistory(data: MessageTaskData): void {
    if (!data.metadata) return;

    try {
      if (data.type === TASK_TYPE.SEND) {
        const meta = data.metadata;
        addHistory(
          meta.uniqueHash,
          meta.url,
          meta.textHash,
          meta.senderName,
          0,
          meta.chatId,
        );
      } else {
        const meta = data.metadata;
        updateHistory(meta.historyId, meta.textHash, Number(data.messageId));
      }
    } catch (e) {
      logger.error(
        `Failed to record failed ${data.type} task in history: ${e}`,
      );
    }
  }

  getQueueSize(): number {
    return this.pQueue.size + this.pQueue.pending;
  }

  async drain(timeoutMs = 30000): Promise<void> {
    if (this.pQueue.size === 0 && this.pQueue.pending === 0) return;
    logger.info(
      `Waiting for ${this.getQueueSize()} queued tasks to finish (timeout: ${timeoutMs}ms)...`,
    );
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
      logger.warn(
        `Drain timeout reached, ${this.getQueueSize()} tasks still pending`,
      );
    } else {
      logger.info("Queue drained successfully");
    }
  }

  recoverPendingTasks(): void {
    logger.info("Recovering pending tasks from database...");
    const pendingTasks = getPendingMessages();

    if (pendingTasks.length === 0) {
      logger.info("No pending tasks to recover");
      return;
    }

    logger.info(`Found ${pendingTasks.length} pending tasks to recover`);

    for (const dbTask of pendingTasks) {
      try {
        const taskData: MessageTaskData = JSON.parse(dbTask.taskData);

        // Skip send tasks whose history already has a real messageId (already sent)
        if (taskData.type === TASK_TYPE.SEND && taskData.metadata?.uniqueHash) {
          const existing = getHistory(taskData.metadata.uniqueHash);
          if (existing && existing.telegramMessageId > 0) {
            logger.info(
              `Task ${dbTask.id} already sent (messageId: ${existing.telegramMessageId}), marking completed`,
            );
            try {
              updateMessageStatus(dbTask.id, QUEUE_STATUS.COMPLETED);
            } catch (e) {
              logger.error(
                `Failed to mark already-sent task ${dbTask.id} as completed: ${e}`,
              );
            }
            continue;
          }
        }

        void this.pQueue.add(() =>
          this.execute({ data: taskData, dbId: dbTask.id }),
        );
      } catch (error) {
        logger.error(`Failed to recover task ${dbTask.id}: ${error}`);
        try {
          updateMessageStatus(dbTask.id, QUEUE_STATUS.FAILED, String(error));
        } catch (e) {
          logger.error(
            `Failed to mark corrupted task ${dbTask.id} as failed: ${e}`,
          );
        }
      }
    }

    logger.info(`Recovered ${pendingTasks.length} tasks into queue`);
  }

  cleanupCompletedTasks(olderThanHours = QUEUE_CLEANUP_HOURS): void {
    logger.info(
      `Cleaning up completed tasks older than ${olderThanHours} hours`,
    );
    deleteCompletedMessages(olderThanHours);
  }
}

export const messageQueue = new MessageQueue();

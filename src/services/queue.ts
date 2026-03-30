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
  chatId: bigint;
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
  messageId: string; // BigInt serialized as string
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
    messageId: bigint,
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
      const dbId = await enqueueMessage(
        taskData.type,
        JSON.stringify(taskData),
      );
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
        const data = task.data;
        logger.debug(
          `Processing send task (DB ID: ${task.dbId}) for ${data.sender.name}`,
        );

        if (data.metadata) {
          await reserveHistory(
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
            await finalizeHistory(
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
      } else {
        const data = task.data;
        const messageIdBigInt = BigInt(data.messageId);
        logger.debug(
          `Processing edit task (DB ID: ${task.dbId}) for ${data.sender.name}, message ${data.messageId}`,
        );

        await edit(data.sender, messageIdBigInt, data.text);

        if (data.metadata) {
          try {
            await updateHistory(
              data.metadata.historyId,
              data.metadata.textHash,
              messageIdBigInt,
            );
            logger.debug(`Updated history for message ${data.messageId}`);
          } catch (e) {
            logger.error(
              `Failed to update history for message ${data.messageId}: ${e}`,
            );
          }
        }
      }

      if (task.dbId) {
        await updateMessageStatus(task.dbId, QUEUE_STATUS.COMPLETED).catch(
          (e) =>
            logger.error(
              `Failed to update task status to completed (DB ID: ${task.dbId}): ${e}`,
            ),
        );
      }
    } catch (error) {
      const errorDetail =
        error instanceof Error ? error.message : String(error);
      logger.error(`Task (DB ID: ${task.dbId}) failed: ${errorDetail}`);

      if (task.dbId) {
        await updateMessageStatus(
          task.dbId,
          QUEUE_STATUS.FAILED,
          errorDetail,
        ).catch((e) =>
          logger.error(
            `Failed to update task status to failed (DB ID: ${task.dbId}): ${e}`,
          ),
        );
      }

      // Save failure to history
      if (task.data.type === TASK_TYPE.SEND && task.data.metadata) {
        const meta = task.data.metadata;
        await addHistory(
          meta.uniqueHash,
          meta.url,
          meta.textHash,
          meta.senderName,
          BigInt(0),
          meta.chatId,
        ).catch((e) =>
          logger.error(`Failed to mark failed send task in history: ${e}`),
        );
      } else if (task.data.type === TASK_TYPE.EDIT && task.data.metadata) {
        const meta = task.data.metadata;
        const messageIdBigInt = BigInt(task.data.messageId);
        await updateHistory(
          meta.historyId,
          meta.textHash,
          messageIdBigInt,
        ).catch((e) =>
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

        // Skip send tasks whose history already has a real messageId (already sent)
        if (taskData.type === TASK_TYPE.SEND && taskData.metadata?.uniqueHash) {
          const existing = await getHistory(taskData.metadata.uniqueHash);
          if (existing && existing.telegram_message_id > 0) {
            logger.info(
              `Task ${dbTask.id} already sent (messageId: ${existing.telegram_message_id}), marking completed`,
            );
            await updateMessageStatus(dbTask.id, QUEUE_STATUS.COMPLETED).catch(
              (e) =>
                logger.error(
                  `Failed to mark already-sent task ${dbTask.id} as completed: ${e}`,
                ),
            );
            continue;
          }
        }

        void this.pQueue.add(() =>
          this.execute({ data: taskData, dbId: dbTask.id }),
        );
      } catch (error) {
        logger.error(`Failed to recover task ${dbTask.id}: ${error}`);
        await updateMessageStatus(
          dbTask.id,
          QUEUE_STATUS.FAILED,
          String(error),
        ).catch((e) =>
          logger.error(
            `Failed to mark corrupted task ${dbTask.id} as failed: ${e}`,
          ),
        );
      }
    }

    logger.info(`Recovered ${pendingTasks.length} tasks into queue`);
  }

  async cleanupCompletedTasks(
    olderThanHours = QUEUE_CLEANUP_HOURS,
  ): Promise<void> {
    logger.info(
      `Cleaning up completed tasks older than ${olderThanHours} hours`,
    );
    await deleteCompletedMessages(olderThanHours);
  }
}

export const messageQueue = new MessageQueue();

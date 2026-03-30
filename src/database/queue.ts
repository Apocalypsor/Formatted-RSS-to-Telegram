import { QUEUE_CLEANUP_HOURS, QUEUE_STATUS } from "@consts";
import { and, eq, lt } from "drizzle-orm";
import { db } from "./client";
import { messageQueue } from "./schema";

export const enqueueMessage = (taskType: string, taskData: string): number => {
  const result = db
    .insert(messageQueue)
    .values({
      taskType,
      taskData,
      status: QUEUE_STATUS.PENDING,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: messageQueue.id })
    .get();
  return result.id;
};

export const getPendingMessages = () => {
  return db
    .select()
    .from(messageQueue)
    .where(eq(messageQueue.status, QUEUE_STATUS.PENDING))
    .orderBy(messageQueue.createdAt)
    .all();
};

export const updateMessageStatus = (
  id: number,
  status: string,
  error?: string,
) => {
  return db
    .update(messageQueue)
    .set({
      status,
      error,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(messageQueue.id, id))
    .run();
};

export const deleteCompletedMessages = (
  olderThanHours = QUEUE_CLEANUP_HOURS,
) => {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

  db.delete(messageQueue)
    .where(
      and(
        eq(messageQueue.status, QUEUE_STATUS.COMPLETED),
        lt(messageQueue.updatedAt, cutoffDate.toISOString()),
      ),
    )
    .run();
};

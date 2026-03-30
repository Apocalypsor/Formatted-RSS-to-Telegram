import { eq, lt } from "drizzle-orm";
import { db } from "./client";
import { history } from "./schema";

export const checkHistoryInitialized = (): boolean => {
  const row = db.select().from(history).limit(1).get();
  return !!row;
};

export const getFirstHistoryByURL = (url: string) => {
  return db.select().from(history).where(eq(history.url, url)).limit(1).get();
};

export const getHistory = (uniqueHash: string) => {
  return db
    .select()
    .from(history)
    .where(eq(history.uniqueHash, uniqueHash))
    .limit(1)
    .get();
};

export const addHistory = (
  uniqueHash: string,
  url: string,
  textHash: string,
  telegramName: string,
  telegramMessageId: number,
  telegramChatId: number,
) => {
  return db
    .insert(history)
    .values({
      uniqueHash,
      url,
      textHash,
      telegramName,
      telegramMessageId,
      telegramChatId,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: history.uniqueHash })
    .run();
};

export const reserveHistory = (
  uniqueHash: string,
  url: string,
  textHash: string,
  telegramName: string,
  telegramChatId: number,
) => {
  return db
    .insert(history)
    .values({
      uniqueHash,
      url,
      textHash,
      telegramName,
      telegramMessageId: 0,
      telegramChatId,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: history.uniqueHash })
    .run();
};

export const finalizeHistory = (
  uniqueHash: string,
  textHash: string,
  telegramMessageId: number,
) => {
  return db
    .update(history)
    .set({
      textHash,
      telegramMessageId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(history.uniqueHash, uniqueHash))
    .run();
};

export const updateHistory = (
  id: number,
  textHash: string,
  telegramMessageId: number,
) => {
  return db
    .update(history)
    .set({
      textHash,
      telegramMessageId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(history.id, id))
    .run();
};

export const clean = (numberOfDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - numberOfDays);

  db.delete(history)
    .where(lt(history.createdAt, cutoffDate.toISOString()))
    .run();
};

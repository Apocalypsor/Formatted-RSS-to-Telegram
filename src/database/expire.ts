import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { expire } from "./schema";

export const updateExpire = (url: string, reset = false): number => {
  if (reset) {
    db.insert(expire)
      .values({ url, expire: 0, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: expire.url,
        set: { expire: 0, updatedAt: new Date().toISOString() },
      })
      .run();
    return 0;
  }

  db.insert(expire)
    .values({ url, expire: 1, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: expire.url,
      set: {
        expire: sql`${expire.expire} + 1`,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();

  const row = db
    .select({ expire: expire.expire })
    .from(expire)
    .where(eq(expire.url, url))
    .get();

  return row?.expire ?? 1;
};

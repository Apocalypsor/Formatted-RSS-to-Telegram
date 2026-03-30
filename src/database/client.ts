import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const DB_PATH =
  process.env.DATABASE_URL?.replace("file:", "") ?? "./config/db.sqlite";

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA synchronous = NORMAL");
  sqlite.run("PRAGMA cache_size = -20000");
  sqlite.run("PRAGMA busy_timeout = 5000");
  sqlite.run("PRAGMA temp_store = MEMORY");

  migrate(db, { migrationsFolder: "./drizzle" });
}

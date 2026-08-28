import Database from "@tauri-apps/plugin-sql";
import { type SqlDriver, type SqlStatement } from "./driver";

export const DB_URL = "sqlite:strand.db";

/**
 * Migrations are applied by the Rust side (tauri-plugin-sql) before the first
 * query resolves, so this driver only has to open the handle.
 */
export async function createTauriDriver(): Promise<SqlDriver> {
  const db = await Database.load(DB_URL);

  return {
    kind: "tauri",
    async select<T>(sql: string, params: unknown[] = []) {
      return db.select<T[]>(sql, params) as Promise<T[]>;
    },
    async execute(sql: string, params: unknown[] = []) {
      await db.execute(sql, params);
    },
    async batch(statements: SqlStatement[]) {
      // sqlx hands out pooled connections, so an explicit BEGIN/COMMIT pair is
      // not guaranteed to stay on one connection. Statements are ordered so a
      // partial apply leaves the database consistent, and the in-memory
      // document is the source of truth for the current session anyway.
      for (const statement of statements) {
        await db.execute(statement.sql, statement.params ?? []);
      }
    },
    async flush() {
      /* SQLite writes straight through. */
    },
    async serialize() {
      return null;
    },
  };
}

import { invoke } from "@tauri-apps/api/core";
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
      if (statements.length === 0) return;
      // A Rust command owns this: an explicit BEGIN sent through the plugin is
      // not guaranteed to stay on one pooled connection, so the transaction has
      // to be driven on the pool itself.
      await invoke("apply_batch", {
        statements: statements.map((statement) => ({
          sql: statement.sql,
          params: statement.params ?? [],
        })),
      });
    },
    async flush() {
      /* SQLite writes straight through. */
    },
    async serialize() {
      return null;
    },
  };
}

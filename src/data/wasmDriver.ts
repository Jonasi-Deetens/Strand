import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { MIGRATIONS } from "./migrations";
import { isNodeRuntime, type SqlDriver, type SqlStatement } from "./driver";

const STORAGE_KEY = "strand.db.v1";

let sqlJs: SqlJsStatic | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlJs) return sqlJs;
  if (isNodeRuntime()) {
    // Vitest/jsdom cannot fetch the wasm asset, so hand it over as bytes.
    const fsModule = "node:fs/promises";
    const pathModule = "node:path";
    const fs = await import(/* @vite-ignore */ fsModule);
    const path = await import(/* @vite-ignore */ pathModule);
    const binary = await fs.readFile(
      path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"),
    );
    sqlJs = await initSqlJs({ wasmBinary: binary });
  } else {
    sqlJs = await initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlJs;
}

function readStored(): Uint8Array | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function writeStored(bytes: Uint8Array): void {
  if (typeof localStorage === "undefined") return;
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  try {
    localStorage.setItem(STORAGE_KEY, btoa(binary));
  } catch {
    // Quota exceeded: the session keeps working, only persistence is lost.
  }
}

function currentVersion(db: Database): number {
  const result = db.exec("PRAGMA user_version");
  const value = result[0]?.values?.[0]?.[0];
  return typeof value === "number" ? value : 0;
}

function applyMigrations(db: Database): void {
  const from = currentVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export interface WasmDriverOptions {
  /** Skip localStorage entirely (used by tests). */
  ephemeral?: boolean;
  /** Start from existing database bytes (project import). */
  bytes?: Uint8Array;
}

export async function createWasmDriver(
  options: WasmDriverOptions = {},
): Promise<SqlDriver> {
  const SQL = await loadSqlJs();
  const seed = options.bytes ?? (options.ephemeral ? null : readStored());
  const db = seed ? new SQL.Database(seed) : new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON");
  applyMigrations(db);

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (options.ephemeral) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => writeStored(db.export()), 250);
  };

  const runOne = (sql: string, params: unknown[]) => {
    const statement = db.prepare(sql);
    try {
      statement.bind(params as never);
      while (statement.step()) {
        /* drain */
      }
    } finally {
      statement.free();
    }
  };

  return {
    kind: "wasm",
    async select<T>(sql: string, params: unknown[] = []) {
      const statement = db.prepare(sql);
      const rows: T[] = [];
      try {
        statement.bind(params as never);
        while (statement.step()) {
          rows.push(statement.getAsObject() as T);
        }
      } finally {
        statement.free();
      }
      return rows;
    },
    async execute(sql: string, params: unknown[] = []) {
      runOne(sql, params);
      schedulePersist();
    },
    async batch(statements: SqlStatement[]) {
      db.exec("BEGIN");
      try {
        for (const statement of statements) {
          runOne(statement.sql, statement.params ?? []);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      schedulePersist();
    },
    async flush() {
      if (persistTimer) clearTimeout(persistTimer);
      if (!options.ephemeral) writeStored(db.export());
    },
    async serialize() {
      return db.export();
    },
  };
}

export interface SqlStatement {
  sql: string;
  params?: unknown[];
}

/**
 * Minimal SQL surface the repositories talk to. Two implementations exist: the
 * Tauri SQLite plugin (the real app) and sql.js in wasm (browser dev + tests),
 * so exactly one set of SQL and one set of migrations is maintained.
 */
export interface SqlDriver {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  /** Runs statements as one unit of work where the backend supports it. */
  batch(statements: SqlStatement[]): Promise<void>;
  /** Flushes to disk for drivers that keep the database in memory. */
  flush(): Promise<void>;
  /** Raw database bytes, when the driver can provide them (backup/export). */
  serialize(): Promise<Uint8Array | null>;
  readonly kind: "tauri" | "wasm";
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions?.node !== undefined &&
    !isTauriRuntime()
  );
}

let driverPromise: Promise<SqlDriver> | null = null;

/** Resolves the driver for the current runtime, once. */
export function getDriver(): Promise<SqlDriver> {
  if (!driverPromise) {
    driverPromise = isTauriRuntime()
      ? import("./tauriDriver").then((m) => m.createTauriDriver())
      : import("./wasmDriver").then((m) => m.createWasmDriver());
  }
  return driverPromise;
}

/** Test seam: replaces the process-wide driver. */
export function setDriver(driver: SqlDriver): void {
  driverPromise = Promise.resolve(driver);
}

export function resetDriver(): void {
  driverPromise = null;
}

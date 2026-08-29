/** Short, sortable-ish id. crypto.randomUUID is available in Tauri and Node 22. */
export function newId(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const short = uuid.replace(/-/g, "").slice(0, 12);
  return prefix ? `${prefix}_${short}` : short;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

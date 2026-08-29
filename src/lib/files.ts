import { isTauriRuntime } from "@/data/driver";

/**
 * File access has two paths: Tauri dialogs plus the fs plugin in the desktop
 * app, and plain browser downloads/uploads when the same UI runs in a browser.
 */

async function tauri() {
  const [dialog, fs, opener] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
    import("@tauri-apps/plugin-opener"),
  ]);
  return { dialog, fs, opener };
}

function browserDownload(bytes: Uint8Array | string, filename: string, mime: string) {
  const blob =
    typeof bytes === "string"
      ? new Blob([bytes], { type: mime })
      : new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveTextFile(
  contents: string,
  filename: string,
  extensions: string[],
  mime = "text/plain",
): Promise<string | null> {
  if (!isTauriRuntime()) {
    browserDownload(contents, filename, mime);
    return filename;
  }
  const { dialog, fs } = await tauri();
  const path = await dialog.save({
    defaultPath: filename,
    filters: [{ name: extensions.join("/").toUpperCase(), extensions }],
  });
  if (!path) return null;
  await fs.writeTextFile(path, contents);
  return path;
}

export async function saveBinaryFile(
  bytes: Uint8Array,
  filename: string,
  extensions: string[],
  mime = "application/octet-stream",
): Promise<string | null> {
  if (!isTauriRuntime()) {
    browserDownload(bytes, filename, mime);
    return filename;
  }
  const { dialog, fs } = await tauri();
  const path = await dialog.save({
    defaultPath: filename,
    filters: [{ name: extensions.join("/").toUpperCase(), extensions }],
  });
  if (!path) return null;
  await fs.writeFile(path, bytes);
  return path;
}

/** Returns the path of a quote document to remember on the offerte. */
export async function pickQuoteFile(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
      input.onchange = () => resolve(input.files?.[0]?.name ?? null);
      input.click();
    });
  }
  const { dialog } = await tauri();
  const selected = await dialog.open({
    multiple: false,
    filters: [
      {
        name: "Offerte",
        extensions: ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export async function openTextFile(
  extensions: string[],
): Promise<{ path: string; contents: string } | null> {
  if (!isTauriRuntime()) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = extensions.map((extension) => `.${extension}`).join(",");
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve({ path: file.name, contents: await file.text() });
      };
      input.click();
    });
  }
  const { dialog, fs } = await tauri();
  const selected = await dialog.open({
    multiple: false,
    filters: [{ name: extensions.join("/").toUpperCase(), extensions }],
  });
  if (typeof selected !== "string") return null;
  return { path: selected, contents: await fs.readTextFile(selected) };
}

export async function revealPath(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  const { opener } = await tauri();
  await opener.openPath(path);
}

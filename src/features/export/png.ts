import type Konva from "konva";

let activeStage: Konva.Stage | null = null;

/** The canvas registers its stage so the export menu can snapshot it. */
export function registerStage(stage: Konva.Stage | null): void {
  activeStage = stage;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Snapshot of what is on screen, at twice the screen resolution. */
export function stagePng(): Uint8Array | null {
  if (!activeStage) return null;
  return dataUrlToBytes(activeStage.toDataURL({ pixelRatio: 2 }));
}

export function pngFileName(projectName: string): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "strand";
  return `${slug}-plan-${new Date().toISOString().slice(0, 10)}.png`;
}

import { type Mm } from "@/domain/types";

export const MM_PER_M = 1000;

/** Placement snap: 5 cm. Fine enough for furniture, coarse enough to stay tidy. */
export const SNAP_MM = 50;
export const ROTATION_SNAP_DEG = 15;

export function mToMm(metres: number): Mm {
  return Math.round(metres * MM_PER_M);
}

export function mmToM(mm: Mm): number {
  return mm / MM_PER_M;
}

export function snapMm(mm: number, snap: number = SNAP_MM): Mm {
  if (snap <= 0) return Math.round(mm);
  return Math.round(mm / snap) * snap;
}

export function snapAngle(deg: number, snap: number = ROTATION_SNAP_DEG): number {
  const snapped = Math.round(deg / snap) * snap;
  return ((snapped % 360) + 360) % 360;
}

/** Area in m2 from millimetre dimensions. */
export function areaM2(wMm: Mm, hMm: Mm): number {
  return (wMm / MM_PER_M) * (hMm / MM_PER_M);
}

export function formatM(mm: Mm, digits = 2): string {
  return `${mmToM(mm).toFixed(digits).replace(/\.?0+$/, "")} m`;
}

export function formatM2(m2: number, digits = 1): string {
  return `${m2.toFixed(digits)} m²`;
}

export function formatDims(wMm: Mm, hMm: Mm): string {
  return `${formatM(wMm)} × ${formatM(hMm)}`;
}

/** Parses free user input in metres ("6,5" or "6.5") into millimetres. */
export function parseMetresInput(value: string): Mm | null {
  const normalised = value.replace(",", ".").trim();
  if (normalised === "") return null;
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return null;
  return mToMm(parsed);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

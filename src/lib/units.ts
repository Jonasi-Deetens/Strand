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

/**
 * Lengths and areas read with a comma decimal, matching the money helpers and
 * the dimension text in the DXF export. Trailing zeroes are dropped from a
 * length, so a whole metre reads "6 m" rather than "6,00 m".
 */
export function formatM(mm: Mm, digits = 2, locale = "nl-NL"): string {
  const value = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(mmToM(mm));
  return `${value} m`;
}

export function formatM2(m2: number, digits = 1, locale = "nl-NL"): string {
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(m2);
  return `${value} m²`;
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

export const DEFAULT_VAT_PCT = 21;

export function formatCents(
  cents: number,
  currency = "EUR",
  locale = "nl-NL",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCentsPrecise(
  cents: number,
  currency = "EUR",
  locale = "nl-NL",
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}

/** Parses "1234,50" or "1.234,50" or "1234.50" into cents. */
export function parseAmountInput(value: string): number | null {
  const trimmed = value.trim().replace(/[^\d.,-]/g, "");
  if (trimmed === "") return null;
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalised = trimmed;
  if (lastComma > lastDot) {
    normalised = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    normalised = trimmed.replace(/,/g, "");
  }
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function lineTotalExVat(qty: number, unitPriceCents: number): number {
  return Math.round(qty * unitPriceCents);
}

export function lineTotalIncVat(
  qty: number,
  unitPriceCents: number,
  vatPct: number,
): number {
  return Math.round(qty * unitPriceCents * (1 + vatPct / 100));
}

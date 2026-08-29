import { newId } from "@/lib/id";
import { itemTypeName, type Lang } from "./naming";
import {
  type CabinStockLine,
  type ItemType,
  type ProjectDocument,
} from "./types";

/** Starter packing list seeded onto every new cabin. */
export const DEFAULT_CABIN_KIT: readonly {
  itemTypeId: string;
  qtyNeeded: number;
}[] = [
  { itemTypeId: "it_stoel", qtyNeeded: 2 },
  { itemTypeId: "it_regisseursstoel", qtyNeeded: 2 },
];

export function isCabinType(itemType: ItemType | undefined): boolean {
  return itemType?.category === "cabine";
}

export function stockForCabin(
  doc: ProjectDocument,
  cabinId: string,
): CabinStockLine[] {
  return doc.cabinStock
    .filter((line) => line.cabinId === cabinId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function cabinStockCounts(lines: CabinStockLine[]): {
  ready: number;
  needed: number;
} {
  return lines.reduce(
    (totals, line) => ({
      ready: totals.ready + Math.min(Math.max(0, line.qtyReady), line.qtyNeeded),
      needed: totals.needed + Math.max(0, line.qtyNeeded),
    }),
    { ready: 0, needed: 0 },
  );
}

export function cabinStockFilled(lines: CabinStockLine[]): boolean {
  return (
    lines.length > 0 &&
    lines.every((line) => line.qtyNeeded <= 0 || line.qtyReady >= line.qtyNeeded)
  );
}

export function defaultCabinStock(
  cabinId: string,
  itemTypes: ItemType[],
  lang: Lang,
): CabinStockLine[] {
  return DEFAULT_CABIN_KIT.flatMap((entry, index) => {
    const itemType = itemTypes.find((type) => type.id === entry.itemTypeId);
    if (!itemType) return [];
    return [
      {
        id: newId("cs"),
        cabinId,
        itemTypeId: itemType.id,
        title: itemTypeName(itemType, lang),
        qtyNeeded: entry.qtyNeeded,
        qtyReady: 0,
        sortOrder: index,
      },
    ];
  });
}

export function copyCabinStock(
  lines: CabinStockLine[],
  fromCabinId: string,
  toCabinId: string,
): CabinStockLine[] {
  return lines
    .filter((line) => line.cabinId === fromCabinId)
    .map((line, index) => ({
      ...line,
      id: newId("cs"),
      cabinId: toCabinId,
      qtyReady: 0,
      sortOrder: line.sortOrder || index,
    }));
}

export interface CabinFillSummary {
  filled: number;
  total: number;
}

/** How many cabins on the plan have every stock line present. */
export function cabinFillSummary(doc: ProjectDocument): CabinFillSummary {
  const cabinTypeIds = new Set(
    doc.itemTypes.filter((type) => type.category === "cabine").map((type) => type.id),
  );
  const cabins = doc.objects.filter((object) => cabinTypeIds.has(object.itemTypeId));
  let filled = 0;
  for (const cabin of cabins) {
    if (cabinStockFilled(stockForCabin(doc, cabin.id))) filled += 1;
  }
  return { filled, total: cabins.length };
}

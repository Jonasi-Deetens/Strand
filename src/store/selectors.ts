import { completionRatio, isDone } from "@/domain/status";
import {
  type Category,
  type Offerte,
  type PlanObject,
  type ProcurementLine,
  type ProjectDocument,
  type Task,
} from "@/domain/types";
import { lineTotalExVat, lineTotalIncVat } from "@/lib/money";
import { areaM2 } from "@/lib/units";

export interface QuoteTotal {
  offerte: Offerte;
  exVatCents: number;
  incVatCents: number;
  lineCount: number;
}

export function objectsForLine(
  doc: ProjectDocument,
  lineId: string,
): PlanObject[] {
  return doc.objects.filter((object) => object.procurementLineId === lineId);
}

/** Every quote that prices a given procurement line, cheapest first. */
export function quotesForLine(
  doc: ProjectDocument,
  lineId: string,
): QuoteTotal[] {
  const byOfferte = new Map<string, { exVat: number; incVat: number; count: number }>();
  for (const line of doc.offerteLines) {
    if (line.procurementLineId !== lineId) continue;
    const current = byOfferte.get(line.offerteId) ?? {
      exVat: 0,
      incVat: 0,
      count: 0,
    };
    current.exVat += lineTotalExVat(line.qty, line.unitPriceCents);
    current.incVat += lineTotalIncVat(line.qty, line.unitPriceCents, line.vatPct);
    current.count += 1;
    byOfferte.set(line.offerteId, current);
  }
  return [...byOfferte.entries()]
    .flatMap(([offerteId, totals]) => {
      const offerte = doc.offertes.find((candidate) => candidate.id === offerteId);
      if (!offerte || offerte.status === "afgewezen") return [];
      return [
        {
          offerte,
          exVatCents: totals.exVat,
          incVatCents: totals.incVat,
          lineCount: totals.count,
        },
      ];
    })
    .sort((a, b) => a.exVatCents - b.exVatCents);
}

export function offerteTotals(
  doc: ProjectDocument,
  offerteId: string,
): { exVatCents: number; incVatCents: number } {
  return doc.offerteLines
    .filter((line) => line.offerteId === offerteId)
    .reduce(
      (totals, line) => ({
        exVatCents: totals.exVatCents + lineTotalExVat(line.qty, line.unitPriceCents),
        incVatCents:
          totals.incVatCents +
          lineTotalIncVat(line.qty, line.unitPriceCents, line.vatPct),
      }),
      { exVatCents: 0, incVatCents: 0 },
    );
}

export function bestQuoteForLine(
  doc: ProjectDocument,
  lineId: string,
): QuoteTotal | null {
  const quotes = quotesForLine(doc, lineId);
  const chosen = quotes.find((quote) => quote.offerte.status === "gekozen");
  return chosen ?? quotes[0] ?? null;
}

export function chosenQuoteForLine(
  doc: ProjectDocument,
  lineId: string,
): QuoteTotal | null {
  return (
    quotesForLine(doc, lineId).find(
      (quote) => quote.offerte.status === "gekozen",
    ) ?? null
  );
}

export function lineCompletion(doc: ProjectDocument, line: ProcurementLine): number {
  if (!line.derived) return isDone(line.status) ? 1 : 0;
  return completionRatio(objectsForLine(doc, line.id).map((object) => object.status));
}

export interface ProjectTotals {
  budgetCents: number;
  /** Cheapest available quote per line, falling back to the budget. */
  expectedCents: number;
  /** Only the quotes that are actually chosen. */
  committedCents: number;
  potentialSavingCents: number;
  lineCount: number;
  openLineCount: number;
  doneLineCount: number;
  progress: number;
}

export function projectTotals(doc: ProjectDocument): ProjectTotals {
  let budgetCents = 0;
  let expectedCents = 0;
  let committedCents = 0;
  let potentialSavingCents = 0;
  let doneLineCount = 0;
  let progressSum = 0;

  const lines = doc.procurementLines.filter((line) => line.status !== "vervallen");
  for (const line of lines) {
    budgetCents += line.budgetCents;
    const quotes = quotesForLine(doc, line.id);
    const best = quotes[0];
    const chosen = quotes.find((quote) => quote.offerte.status === "gekozen");
    expectedCents += (chosen ?? best)?.exVatCents ?? line.budgetCents;
    if (chosen) committedCents += chosen.exVatCents;
    if (quotes.length > 1 && best) {
      const worst = quotes[quotes.length - 1]!;
      potentialSavingCents += worst.exVatCents - best.exVatCents;
    }
    const completion = lineCompletion(doc, line);
    progressSum += completion;
    if (completion >= 1) doneLineCount += 1;
  }

  return {
    budgetCents,
    expectedCents,
    committedCents,
    potentialSavingCents,
    lineCount: lines.length,
    openLineCount: lines.length - doneLineCount,
    doneLineCount,
    progress: lines.length === 0 ? 0 : progressSum / lines.length,
  };
}

export interface CategorySummary {
  category: Category;
  lineCount: number;
  objectCount: number;
  doneObjectCount: number;
  budgetCents: number;
  progress: number;
}

export function categorySummaries(doc: ProjectDocument): CategorySummary[] {
  const byCategory = new Map<Category, CategorySummary>();
  for (const line of doc.procurementLines) {
    if (line.status === "vervallen") continue;
    const summary =
      byCategory.get(line.category) ??
      ({
        category: line.category,
        lineCount: 0,
        objectCount: 0,
        doneObjectCount: 0,
        budgetCents: 0,
        progress: 0,
      } satisfies CategorySummary);
    const objects = objectsForLine(doc, line.id);
    summary.lineCount += 1;
    summary.objectCount += line.derived ? objects.length : line.qtyPlanned;
    summary.doneObjectCount += line.derived
      ? objects.filter((object) => isDone(object.status)).length
      : isDone(line.status)
        ? line.qtyPlanned
        : 0;
    summary.budgetCents += line.budgetCents;
    byCategory.set(line.category, summary);
  }

  return [...byCategory.values()]
    .map((summary) => ({
      ...summary,
      progress:
        summary.objectCount === 0
          ? 0
          : summary.doneObjectCount / summary.objectCount,
    }))
    .sort((a, b) => b.budgetCents - a.budgetCents);
}

export function openTasks(doc: ProjectDocument): Task[] {
  return doc.tasks
    .filter((task) => task.status !== "klaar")
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.sortOrder - b.sortOrder;
    });
}

export function expiringOffertes(
  doc: ProjectDocument,
  withinDays = 30,
  today = new Date(),
): { offerte: Offerte; days: number }[] {
  const result: { offerte: Offerte; days: number }[] = [];
  for (const offerte of doc.offertes) {
    if (!offerte.validUntil || offerte.status === "afgewezen") continue;
    const days = Math.round(
      (new Date(offerte.validUntil).getTime() - today.getTime()) / 86400000,
    );
    if (days <= withinDays) result.push({ offerte, days });
  }
  return result.sort((a, b) => a.days - b.days);
}

/** Share of the beach that is covered by objects, 0..1. */
export function plotCoverage(doc: ProjectDocument): number {
  const beach = doc.scenes.find((scene) => scene.kind === "beach");
  if (!beach) return 0;
  const plot = areaM2(beach.wMm, beach.hMm);
  if (plot <= 0) return 0;
  const covered = doc.objects
    .filter((object) => object.sceneId === beach.id)
    .reduce((sum, object) => sum + areaM2(object.wMm, object.hMm), 0);
  return covered / plot;
}

export function sceneObjects(
  doc: ProjectDocument,
  sceneId: string,
): PlanObject[] {
  return doc.objects.filter((object) => object.sceneId === sceneId);
}

export function beachScene(doc: ProjectDocument) {
  return doc.scenes.find((scene) => scene.kind === "beach") ?? null;
}

export function lineById(doc: ProjectDocument, id: string | null) {
  if (!id) return null;
  return doc.procurementLines.find((line) => line.id === id) ?? null;
}

export function itemTypeById(doc: ProjectDocument, id: string) {
  return doc.itemTypes.find((itemType) => itemType.id === id) ?? null;
}

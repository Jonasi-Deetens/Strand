import { describe, expect, it } from "vitest";
import {
  cabinType,
  makeDocument,
  makeLine,
  makeObject,
  makeOfferte,
  makeOfferteLine,
} from "@/test/factories";
import { syncDerived } from "@/domain/sync";
import {
  bestQuoteForLine,
  categorySummaries,
  expiringOffertes,
  lineCompletion,
  offerteTotals,
  plotCoverage,
  projectTotals,
  quotesForLine,
} from "./selectors";

/** Eight cabins on the plan, quoted by two suppliers. */
function quotedDocument() {
  const base = syncDerived(
    makeDocument({
      objects: Array.from({ length: 8 }, (_, index) =>
        makeObject({
          id: `ob_${index}`,
          itemTypeId: cabinType.id,
          xMm: index * 2500,
          status: index < 2 ? "gebouwd" : "nodig",
        }),
      ),
    }),
    "nl",
  );
  const lineId = base.procurementLines[0]!.id;
  return {
    lineId,
    doc: {
      ...base,
      offertes: [
        makeOfferte({ id: "of_cheap", reference: "A" }),
        makeOfferte({ id: "of_pricey", reference: "B" }),
      ],
      offerteLines: [
        makeOfferteLine({
          id: "ol_1",
          offerteId: "of_cheap",
          procurementLineId: lineId,
          qty: 8,
          unitPriceCents: 130000,
        }),
        makeOfferteLine({
          id: "ol_2",
          offerteId: "of_pricey",
          procurementLineId: lineId,
          qty: 8,
          unitPriceCents: 160000,
        }),
      ],
    },
  };
}

describe("quote selectors", () => {
  it("sorts quotes for a line cheapest first", () => {
    const { doc, lineId } = quotedDocument();
    const quotes = quotesForLine(doc, lineId);
    expect(quotes.map((quote) => quote.offerte.id)).toEqual([
      "of_cheap",
      "of_pricey",
    ]);
    expect(quotes[0]?.exVatCents).toBe(1040000);
    expect(quotes[0]?.incVatCents).toBe(1258400);
  });

  it("prefers a chosen quote over a cheaper rejected one", () => {
    const { doc, lineId } = quotedDocument();
    const withChoice = {
      ...doc,
      offertes: doc.offertes.map((offerte) =>
        offerte.id === "of_pricey"
          ? { ...offerte, status: "gekozen" as const }
          : offerte,
      ),
    };
    expect(bestQuoteForLine(withChoice, lineId)?.offerte.id).toBe("of_pricey");
  });

  it("leaves rejected quotes out entirely", () => {
    const { doc, lineId } = quotedDocument();
    const rejected = {
      ...doc,
      offertes: doc.offertes.map((offerte) =>
        offerte.id === "of_cheap"
          ? { ...offerte, status: "afgewezen" as const }
          : offerte,
      ),
    };
    expect(quotesForLine(rejected, lineId)).toHaveLength(1);
  });

  it("totals one quote across its lines", () => {
    const { doc } = quotedDocument();
    expect(offerteTotals(doc, "of_cheap")).toEqual({
      exVatCents: 1040000,
      incVatCents: 1258400,
    });
  });
});

describe("projectTotals", () => {
  it("uses the cheapest quote where there is one and the budget elsewhere", () => {
    const { doc } = quotedDocument();
    const withManual = {
      ...doc,
      procurementLines: [
        ...doc.procurementLines,
        makeLine({ id: "pl_manual", title: "Loods", budgetCents: 900000 }),
      ],
    };
    const totals = projectTotals(withManual);
    expect(totals.budgetCents).toBe(8 * cabinType.unitPriceCents + 900000);
    expect(totals.expectedCents).toBe(1040000 + 900000);
    expect(totals.committedCents).toBe(0);
    expect(totals.potentialSavingCents).toBe(160000 * 8 - 130000 * 8);
    expect(totals.lineCount).toBe(2);
  });

  it("reports progress from the objects on the plan", () => {
    const { doc, lineId } = quotedDocument();
    expect(lineCompletion(doc, doc.procurementLines[0]!)).toBe(0.25);
    expect(projectTotals(doc).progress).toBe(0.25);
    expect(bestQuoteForLine(doc, lineId)).not.toBeNull();
  });
});

describe("categorySummaries", () => {
  it("counts objects and money per category", () => {
    const { doc } = quotedDocument();
    const summaries = categorySummaries(doc);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      category: "cabine",
      objectCount: 8,
      doneObjectCount: 2,
      progress: 0.25,
    });
  });
});

describe("expiringOffertes", () => {
  it("returns quotes near or past their validity, soonest first", () => {
    const today = new Date("2026-06-01T00:00:00.000Z");
    const doc = makeDocument({
      offertes: [
        makeOfferte({ id: "of_soon", validUntil: "2026-06-10" }),
        makeOfferte({ id: "of_late", validUntil: "2026-05-01" }),
        makeOfferte({ id: "of_far", validUntil: "2026-12-01" }),
        makeOfferte({
          id: "of_rejected",
          validUntil: "2026-06-02",
          status: "afgewezen",
        }),
      ],
    });
    const expiring = expiringOffertes(doc, 30, today);
    expect(expiring.map((entry) => entry.offerte.id)).toEqual([
      "of_late",
      "of_soon",
    ]);
    expect(expiring[0]?.days).toBeLessThan(0);
  });
});

describe("plotCoverage", () => {
  it("is the share of the beach covered by objects", () => {
    const doc = makeDocument({
      objects: [
        makeObject({
          id: "ob_bar",
          itemTypeId: "it_bar",
          wMm: 12000,
          hMm: 5000,
        }),
      ],
    });
    // 60 m2 of a 60 x 70 m beach.
    expect(plotCoverage(doc)).toBeCloseTo(60 / 4200, 6);
  });
});

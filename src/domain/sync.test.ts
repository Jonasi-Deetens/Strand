import { describe, expect, it } from "vitest";
import { cabinType, makeDocument, makeObject } from "@/test/factories";
import { type Status } from "./types";
import { syncDerived } from "./sync";

const withCabins = (count: number, status: Status = "nodig") =>
  makeDocument({
    objects: Array.from({ length: count }, (_, index) =>
      makeObject({
        id: `ob_${index}`,
        itemTypeId: cabinType.id,
        xMm: index * 2500,
        status,
      }),
    ),
  });

describe("syncDerived", () => {
  it("creates one derived line and one automatic task per item type", () => {
    const doc = syncDerived(withCabins(8), "nl");
    expect(doc.procurementLines).toHaveLength(1);
    const [line] = doc.procurementLines;
    expect(line?.title).toBe("Strandcabine");
    expect(line?.derived).toBe(true);
    expect(line?.qtyPlanned).toBe(8);
    expect(line?.budgetCents).toBe(8 * cabinType.unitPriceCents);
    expect(doc.tasks).toHaveLength(1);
    expect(doc.tasks[0]?.auto).toBe(true);
    expect(doc.tasks[0]?.procurementLineId).toBe(line?.id);
  });

  it("links every object to its line", () => {
    const doc = syncDerived(withCabins(3), "nl");
    const lineId = doc.procurementLines[0]?.id;
    expect(doc.objects.every((object) => object.procurementLineId === lineId)).toBe(
      true,
    );
  });

  it("uses the English title when the app runs in English", () => {
    const doc = syncDerived(withCabins(1), "en");
    expect(doc.procurementLines[0]?.title).toBe("Beach cabin");
  });

  it("follows the quantity when objects are added or removed", () => {
    const first = syncDerived(withCabins(8), "nl");
    const grown = syncDerived(
      {
        ...first,
        objects: [
          ...first.objects,
          makeObject({ id: "ob_extra", itemTypeId: cabinType.id }),
        ],
      },
      "nl",
    );
    expect(grown.procurementLines[0]?.qtyPlanned).toBe(9);
    expect(grown.procurementLines[0]?.id).toBe(first.procurementLines[0]?.id);

    const emptied = syncDerived({ ...grown, objects: [] }, "nl");
    expect(emptied.procurementLines).toHaveLength(0);
    expect(emptied.tasks).toHaveLength(0);
  });

  it("rolls the lowest object status up to the line", () => {
    const doc = syncDerived(withCabins(4, "gebouwd"), "nl");
    expect(doc.procurementLines[0]?.status).toBe("gebouwd");
    expect(doc.tasks[0]?.status).toBe("klaar");

    const partial = syncDerived(
      {
        ...doc,
        objects: doc.objects.map((object, index) =>
          index === 0 ? { ...object, status: "besteld" as const } : object,
        ),
      },
      "nl",
    );
    expect(partial.procurementLines[0]?.status).toBe("besteld");
    expect(partial.tasks[0]?.status).toBe("open");
  });

  it("keeps variants apart", () => {
    const doc = syncDerived(
      makeDocument({
        objects: [
          makeObject({ id: "ob_a", itemTypeId: cabinType.id, variant: "blauw" }),
          makeObject({ id: "ob_b", itemTypeId: cabinType.id, variant: "geel" }),
          makeObject({ id: "ob_c", itemTypeId: cabinType.id, variant: "geel" }),
        ],
      }),
      "nl",
    );
    expect(doc.procurementLines).toHaveLength(2);
    expect(
      doc.procurementLines.map((line) => line.qtyPlanned).sort(),
    ).toEqual([1, 2]);
    expect(doc.procurementLines.map((line) => line.title)).toContain(
      "Strandcabine (geel)",
    );
  });

  it("leaves manual lines and their tasks untouched", () => {
    const base = makeDocument({
      procurementLines: [
        {
          id: "pl_loods",
          projectId: "pr_1",
          itemTypeId: null,
          variant: null,
          title: "Loods huren",
          category: "overig",
          qtyPlanned: 6,
          derived: false,
          budgetCents: 900000,
          status: "besteld",
          unit: "maand",
          notes: null,
        },
      ],
    });
    const doc = syncDerived(base, "nl");
    expect(doc.procurementLines).toHaveLength(1);
    expect(doc.procurementLines[0]?.budgetCents).toBe(900000);
    expect(doc.tasks).toHaveLength(1);
    expect(doc.tasks[0]?.title).toBe("Loods huren");

    // Running again must not create a second task for the same line.
    expect(syncDerived(doc, "nl").tasks).toHaveLength(1);
  });
});

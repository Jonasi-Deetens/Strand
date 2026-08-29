import { describe, expect, it } from "vitest";
import {
  cabinFillSummary,
  cabinStockCounts,
  cabinStockFilled,
  copyCabinStock,
  defaultCabinStock,
  stockForCabin,
} from "./cabinStock";
import {
  cabinType,
  chairType,
  directorChairType,
  makeCabinStock,
  makeDocument,
  makeObject,
} from "@/test/factories";

describe("defaultCabinStock", () => {
  it("seeds two chairs and two director chairs", () => {
    const lines = defaultCabinStock("ob_cabin", [chairType, directorChairType], "nl");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => [line.itemTypeId, line.qtyNeeded, line.qtyReady])).toEqual([
      ["it_stoel", 2, 0],
      ["it_regisseursstoel", 2, 0],
    ]);
    expect(lines[0]?.title).toBe("Stoel");
  });

  it("skips kit items that are missing from the catalogue", () => {
    expect(defaultCabinStock("ob_cabin", [cabinType], "nl")).toEqual([]);
  });
});

describe("cabin stock progress", () => {
  it("is filled only when every needed item is present", () => {
    const lines = [
      makeCabinStock({ id: "cs_1", cabinId: "ob_1", qtyNeeded: 2, qtyReady: 2 }),
      makeCabinStock({
        id: "cs_2",
        cabinId: "ob_1",
        itemTypeId: directorChairType.id,
        title: "Regisseursstoel",
        qtyNeeded: 2,
        qtyReady: 1,
        sortOrder: 1,
      }),
    ];
    expect(cabinStockCounts(lines)).toEqual({ ready: 3, needed: 4 });
    expect(cabinStockFilled(lines)).toBe(false);
    expect(cabinStockFilled([{ ...lines[1]!, qtyReady: 2 }])).toBe(true);
    expect(cabinStockFilled([])).toBe(false);
  });

  it("counts stocked cabins on the plan", () => {
    const empty = makeCabinStock({ id: "cs_a", cabinId: "ob_a" });
    const full = makeCabinStock({
      id: "cs_b",
      cabinId: "ob_b",
      qtyNeeded: 2,
      qtyReady: 2,
    });
    const doc = makeDocument({
      objects: [
        makeObject({ id: "ob_a", itemTypeId: cabinType.id }),
        makeObject({ id: "ob_b", itemTypeId: cabinType.id, xMm: 3000 }),
      ],
      cabinStock: [empty, full],
    });
    expect(stockForCabin(doc, "ob_a")).toHaveLength(1);
    expect(cabinFillSummary(doc)).toEqual({ filled: 1, total: 2 });
  });

  it("resets fill when a cabin list is copied", () => {
    const copies = copyCabinStock(
      [makeCabinStock({ id: "cs_old", cabinId: "ob_old", qtyReady: 2 })],
      "ob_old",
      "ob_new",
    );
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      cabinId: "ob_new",
      qtyNeeded: 2,
      qtyReady: 0,
    });
    expect(copies[0]?.id).not.toBe("cs_old");
  });
});

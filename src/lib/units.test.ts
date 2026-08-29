import { describe, expect, it } from "vitest";
import {
  areaM2,
  formatDims,
  formatM,
  formatM2,
  mToMm,
  mmToM,
  parseMetresInput,
  snapAngle,
  snapMm,
} from "./units";

describe("unit conversion", () => {
  it("round-trips metres through millimetres", () => {
    expect(mToMm(6.5)).toBe(6500);
    expect(mmToM(6500)).toBe(6.5);
  });

  it("snaps to five centimetres", () => {
    expect(snapMm(1234)).toBe(1250);
    expect(snapMm(1224)).toBe(1200);
    expect(snapMm(-1234)).toBe(-1250);
  });

  it("snaps angles to fifteen degrees and normalises them", () => {
    expect(snapAngle(7)).toBe(0);
    expect(snapAngle(8)).toBe(15);
    expect(snapAngle(-10)).toBe(345);
    expect(snapAngle(370)).toBe(15);
  });

  it("computes area in square metres", () => {
    expect(areaM2(12000, 5000)).toBe(60);
  });

  it("accepts comma decimals from Dutch keyboards", () => {
    expect(parseMetresInput("6,5")).toBe(6500);
    expect(parseMetresInput("6.5")).toBe(6500);
    expect(parseMetresInput("")).toBeNull();
    expect(parseMetresInput("abc")).toBeNull();
  });

  it("formats dimensions without trailing zeroes", () => {
    expect(formatDims(12000, 5000)).toBe("12 m × 5 m");
  });

  it("writes decimals the Dutch way, like the money and DXF output", () => {
    expect(formatM(7700)).toBe("7,7 m");
    expect(formatM(6050)).toBe("6,05 m");
    expect(formatM2(130.94)).toBe("130,9 m²");
    // A whole area keeps its decimal so a column of figures lines up.
    expect(formatM2(60)).toBe("60,0 m²");
  });
});

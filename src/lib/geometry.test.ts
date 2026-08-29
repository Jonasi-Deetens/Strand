import { describe, expect, it } from "vitest";
import {
  arrayPositions,
  boundingBox,
  clampRectInside,
  findGuides,
  rectContains,
  rectsOverlap,
} from "./geometry";

describe("boundingBox", () => {
  it("returns the rect itself when there is no rotation", () => {
    expect(boundingBox({ x: 100, y: 200, w: 300, h: 400 })).toEqual({
      x: 100,
      y: 200,
      w: 300,
      h: 400,
    });
  });

  it("grows to fit a rotated rect", () => {
    const box = boundingBox({ x: 0, y: 0, w: 1000, h: 200 }, 90);
    expect(Math.round(box.w)).toBe(200);
    expect(Math.round(box.h)).toBe(1000);
    // Rotation happens around the centre, so the box stays centred.
    expect(Math.round(box.x + box.w / 2)).toBe(500);
  });
});

describe("arrayPositions", () => {
  it("lays out a single row at the requested spacing", () => {
    const positions = arrayPositions(
      { x: 0, y: 0, w: 2000, h: 2000 },
      {
        count: 4,
        spacingMm: 2500,
        direction: "horizontal",
        rows: 1,
        rowSpacingMm: 3000,
      },
    );
    expect(positions).toHaveLength(4);
    expect(positions.map((position) => position.x)).toEqual([0, 2500, 5000, 7500]);
    expect(new Set(positions.map((position) => position.y))).toEqual(new Set([0]));
  });

  it("stacks multiple rows and supports the vertical direction", () => {
    const positions = arrayPositions(
      { x: 1000, y: 500, w: 2000, h: 800 },
      {
        count: 2,
        spacingMm: 1000,
        direction: "vertical",
        rows: 2,
        rowSpacingMm: 4000,
      },
    );
    expect(positions).toEqual([
      { x: 1000, y: 500 },
      { x: 1000, y: 1500 },
      { x: 5000, y: 500 },
      { x: 5000, y: 1500 },
    ]);
  });
});

describe("findGuides", () => {
  const other = { x: 1000, y: 1000, w: 2000, h: 2000 };

  it("snaps a near-aligned left edge onto the neighbour", () => {
    const hits = findGuides({ x: 1080, y: 5000, w: 2000, h: 2000 }, [other], 250);
    const xHit = hits.find((hit) => hit.axis === "x");
    expect(xHit?.valueMm).toBe(1000);
    expect(xHit?.lineMm).toBe(1000);
  });

  it("snaps centres, not only edges", () => {
    // Moving centre at 2050 is within tolerance of the neighbour centre 2000.
    const hits = findGuides({ x: 1050, y: 9000, w: 2000, h: 2000 }, [other], 250);
    expect(hits.find((hit) => hit.axis === "x")?.valueMm).toBe(1000);
  });

  it("ignores neighbours that are too far away", () => {
    expect(findGuides({ x: 9000, y: 9000, w: 100, h: 100 }, [other], 250)).toEqual(
      [],
    );
  });
});

describe("rect helpers", () => {
  it("detects overlap and containment", () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    expect(rectsOverlap(a, { x: 50, y: 50, w: 100, h: 100 })).toBe(true);
    expect(rectsOverlap(a, { x: 200, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectContains(a, { x: 10, y: 10, w: 10, h: 10 })).toBe(true);
    expect(rectContains(a, { x: 90, y: 90, w: 20, h: 20 })).toBe(false);
  });

  it("keeps a rect inside its bounds by moving it", () => {
    const bounds = { x: 0, y: 0, w: 1000, h: 1000 };
    expect(clampRectInside({ x: 1200, y: -50, w: 200, h: 200 }, bounds)).toEqual({
      x: 800,
      y: 0,
      w: 200,
      h: 200,
    });
  });
});

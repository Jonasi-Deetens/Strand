import { describe, expect, it } from "vitest";
import { MM_PER_M } from "@/lib/units";
import { gridStepMm, rulerTicks, toModel, toScreen } from "./canvasUtils";

const view = { scale: 0.02, x: 100, y: 60 };

describe("rulerTicks", () => {
  it("labels only the ticks that fall on a grid major step", () => {
    const ticks = rulerTicks(view, 400, "x");
    const { minor, major } = gridStepMm(view.scale);

    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) {
      expect(tick.major).toBe((tick.metre * MM_PER_M) % major === 0);
    }
    const [first, second] = ticks;
    expect(second!.positionPx - first!.positionPx).toBeCloseTo(
      minor * view.scale,
    );
  });

  it("puts each tick where the same model coordinate lands on screen", () => {
    for (const tick of rulerTicks(view, 400, "x")) {
      const { x } = toScreen({ x: tick.metre * MM_PER_M, y: 0 }, view);
      expect(tick.positionPx).toBeCloseTo(x);
    }
  });

  it("covers the viewport without running past it", () => {
    const lengthPx = 400;
    const ticks = rulerTicks(view, lengthPx, "y");
    const first = ticks[0]!;
    const last = ticks[ticks.length - 1]!;
    const { minor } = gridStepMm(view.scale);

    expect(first.positionPx).toBeLessThanOrEqual(0);
    expect(first.positionPx + minor * view.scale).toBeGreaterThan(0);
    expect(last.positionPx).toBeLessThanOrEqual(lengthPx);
    expect(last.positionPx + minor * view.scale).toBeGreaterThan(lengthPx);
  });

  it("returns nothing for a collapsed viewport or an unusable scale", () => {
    expect(rulerTicks(view, 0, "x")).toEqual([]);
    expect(rulerTicks({ ...view, scale: 0 }, 400, "x")).toEqual([]);
  });
});

describe("toModel / toScreen", () => {
  it("round trips a point", () => {
    const point = { x: 137, y: 412 };
    const back = toScreen(toModel(point, view), view);
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
  });
});

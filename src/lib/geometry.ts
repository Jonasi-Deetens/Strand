import { type Mm } from "@/domain/types";

export interface Rect {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

export interface Point {
  x: number;
  y: number;
}

export function rotatePoint(point: Point, origin: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Corner points of a rect rotated around its own centre. */
export function rectCorners(rect: Rect, rotationDeg: number): Point[] {
  const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
  if (!rotationDeg) return corners;
  return corners.map((corner) => rotatePoint(corner, centre, rotationDeg));
}

/** Axis-aligned bounding box of a rotated rect. */
export function boundingBox(rect: Rect, rotationDeg = 0): Rect {
  const corners = rectCorners(rect, rotationDeg);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY,
  };
}

export function unionBox(boxes: Rect[]): Rect | null {
  if (boxes.length === 0) return null;
  const first = boxes[0] as Rect;
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.w;
  let maxY = first.y + first.h;
  for (const box of boxes.slice(1)) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/** Keeps a rect fully inside bounds by translating it (never resizing). */
export function clampRectInside(rect: Rect, bounds: Rect): Rect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.w - rect.w),
    y: Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.h - rect.h),
  };
}

export interface ArraySpec {
  count: number;
  /** Centre-to-centre distance along the row, in millimetres. */
  spacingMm: Mm;
  direction: "horizontal" | "vertical";
  rows: number;
  rowSpacingMm: Mm;
}

/**
 * Positions for an array of identical items, starting at the anchor rect.
 * Used by the row tool that places 40 cabines or a line of parasols at once.
 */
export function arrayPositions(anchor: Rect, spec: ArraySpec): Point[] {
  const positions: Point[] = [];
  const rows = Math.max(1, Math.floor(spec.rows));
  const count = Math.max(1, Math.floor(spec.count));
  for (let row = 0; row < rows; row += 1) {
    for (let index = 0; index < count; index += 1) {
      const along = index * spec.spacingMm;
      const across = row * spec.rowSpacingMm;
      positions.push(
        spec.direction === "horizontal"
          ? { x: anchor.x + along, y: anchor.y + across }
          : { x: anchor.x + across, y: anchor.y + along },
      );
    }
  }
  return positions;
}

export interface GuideHit {
  axis: "x" | "y";
  /** Position in model space the moving rect should snap to. */
  valueMm: Mm;
  /** Where to draw the guide line. */
  lineMm: Mm;
}

/**
 * Alignment guides: compares the moving rect's edges and centre against the
 * same anchors on every other rect, and returns the closest hit per axis.
 */
export function findGuides(
  moving: Rect,
  others: Rect[],
  toleranceMm: Mm,
): GuideHit[] {
  const hits: GuideHit[] = [];
  const movingAnchors = {
    x: [moving.x, moving.x + moving.w / 2, moving.x + moving.w],
    y: [moving.y, moving.y + moving.h / 2, moving.y + moving.h],
  };

  for (const axis of ["x", "y"] as const) {
    let bestDelta = Number.POSITIVE_INFINITY;
    let bestHit: GuideHit | null = null;
    for (const other of others) {
      const otherAnchors =
        axis === "x"
          ? [other.x, other.x + other.w / 2, other.x + other.w]
          : [other.y, other.y + other.h / 2, other.y + other.h];
      movingAnchors[axis].forEach((movingValue, movingIndex) => {
        for (const otherValue of otherAnchors) {
          const delta = Math.abs(movingValue - otherValue);
          if (delta > toleranceMm) continue;
          const offset =
            movingIndex === 0
              ? 0
              : movingIndex === 1
                ? (axis === "x" ? moving.w : moving.h) / 2
                : axis === "x"
                  ? moving.w
                  : moving.h;
          const candidate: GuideHit = {
            axis,
            valueMm: otherValue - offset,
            lineMm: otherValue,
          };
          if (delta < bestDelta) {
            bestDelta = delta;
            bestHit = candidate;
          }
        }
      });
    }
    if (bestHit) hits.push(bestHit);
  }
  return hits;
}

export function distanceMm(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

import { Fragment, useMemo } from "react";
import { type ViewTransform } from "@/store/useEditorStore";
import { rulerTicks, type Size } from "./canvasUtils";

/** Gutter thickness in screen pixels; wide enough for a two digit metre label. */
export const RULER_PX = 20;

interface CanvasRulersProps {
  view: ViewTransform;
  size: Size;
  /** Cursor position in model millimetres, for the tracking marks. */
  pointerMm: { x: number; y: number } | null;
}

/**
 * Metre rulers along the top and left edge of the drawing area. Drawn as a
 * non-interactive DOM overlay rather than Konva shapes, so they stay crisp at
 * any zoom and stay out of the PNG export of the stage.
 */
export function CanvasRulers({ view, size, pointerMm }: CanvasRulersProps) {
  const horizontal = useMemo(
    () => rulerTicks(view, size.width, "x"),
    [view, size.width],
  );
  const vertical = useMemo(
    () => rulerTicks(view, size.height, "y"),
    [view, size.height],
  );

  const cursorX = pointerMm ? pointerMm.x * view.scale + view.x : null;
  const cursorY = pointerMm ? pointerMm.y * view.scale + view.y : null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute top-0 right-0 border-b border-subtle bg-[var(--surface-raised)]/90"
        style={{ height: RULER_PX, left: RULER_PX }}
      >
        {horizontal.map((tick) => (
          <Fragment key={tick.metre}>
            <span
              className="absolute bottom-0 w-px bg-[var(--border-subtle)]"
              style={{
                left: tick.positionPx - RULER_PX,
                height: tick.major ? 7 : 4,
              }}
            />
            {tick.major && (
              <span
                className="muted absolute top-0.5 text-[9px] leading-none tabular-nums"
                style={{ left: tick.positionPx - RULER_PX + 2 }}
              >
                {tick.metre}
              </span>
            )}
          </Fragment>
        ))}
        {cursorX !== null && (
          <span
            className="absolute inset-y-0 w-px bg-sea-400"
            style={{ left: cursorX - RULER_PX }}
          />
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 border-r border-subtle bg-[var(--surface-raised)]/90"
        style={{ width: RULER_PX, top: RULER_PX }}
      >
        {vertical.map((tick) => (
          <Fragment key={tick.metre}>
            <span
              className="absolute right-0 h-px bg-[var(--border-subtle)]"
              style={{
                top: tick.positionPx - RULER_PX,
                width: tick.major ? 7 : 4,
              }}
            />
            {tick.major && (
              <span
                className="muted absolute left-0.5 text-[9px] leading-none tabular-nums"
                style={{ top: tick.positionPx - RULER_PX + 2 }}
              >
                {tick.metre}
              </span>
            )}
          </Fragment>
        ))}
        {cursorY !== null && (
          <span
            className="absolute inset-x-0 h-px bg-sea-400"
            style={{ top: cursorY - RULER_PX }}
          />
        )}
      </div>

      <div
        className="absolute top-0 left-0 border-r border-b border-subtle bg-[var(--surface-raised)]/90 text-[8px] leading-none"
        style={{ width: RULER_PX, height: RULER_PX }}
      >
        <span className="muted absolute right-0.5 bottom-0.5">m</span>
      </div>
    </div>
  );
}

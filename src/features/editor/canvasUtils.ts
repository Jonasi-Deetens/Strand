import { STATUS_COLOUR, isDone } from "@/domain/status";
import { type ItemType, type PlanObject, type Status } from "@/domain/types";
import { type ColourMode, type ViewTransform } from "@/store/useEditorStore";
import { MM_PER_M } from "@/lib/units";

export interface Size {
  width: number;
  height: number;
}

/** Screen pixels -> model millimetres. */
export function toModel(
  point: { x: number; y: number },
  view: ViewTransform,
): { x: number; y: number } {
  return {
    x: (point.x - view.x) / view.scale,
    y: (point.y - view.y) / view.scale,
  };
}

/** Model millimetres -> screen pixels. */
export function toScreen(
  point: { x: number; y: number },
  view: ViewTransform,
): { x: number; y: number } {
  return {
    x: point.x * view.scale + view.x,
    y: point.y * view.scale + view.y,
  };
}

export function fitView(
  scene: { wMm: number; hMm: number },
  size: Size,
  paddingPx = 56,
): ViewTransform {
  if (size.width === 0 || size.height === 0) {
    return { scale: 0.012, x: paddingPx, y: paddingPx };
  }
  const scale = Math.min(
    (size.width - paddingPx * 2) / scene.wMm,
    (size.height - paddingPx * 2) / scene.hMm,
  );
  return {
    scale,
    x: (size.width - scene.wMm * scale) / 2,
    y: (size.height - scene.hMm * scale) / 2,
  };
}

export function zoomAt(
  view: ViewTransform,
  pointer: { x: number; y: number },
  factor: number,
  limits: [number, number] = [0.0015, 0.35],
): ViewTransform {
  const scale = Math.min(Math.max(view.scale * factor, limits[0]), limits[1]);
  const applied = scale / view.scale;
  return {
    scale,
    x: pointer.x - (pointer.x - view.x) * applied,
    y: pointer.y - (pointer.y - view.y) * applied,
  };
}

/** Grid step in millimetres that stays readable at the current zoom. */
export function gridStepMm(scale: number): { minor: number; major: number } {
  const pxPerMetre = scale * MM_PER_M;
  if (pxPerMetre > 26) return { minor: MM_PER_M, major: MM_PER_M * 5 };
  if (pxPerMetre > 10) return { minor: MM_PER_M * 2, major: MM_PER_M * 10 };
  if (pxPerMetre > 4) return { minor: MM_PER_M * 5, major: MM_PER_M * 25 };
  return { minor: MM_PER_M * 10, major: MM_PER_M * 50 };
}

export interface ObjectStyle {
  stroke: string;
  fill: string;
  dash: number[] | undefined;
  iconOpacity: number;
}

export function objectStyle(
  object: PlanObject,
  itemType: ItemType,
  mode: ColourMode,
  selected: boolean,
): ObjectStyle {
  const colour =
    mode === "status" ? STATUS_COLOUR[object.status] : itemType.colour;
  const done = isDone(object.status);
  return {
    stroke: colour,
    fill: `${colour}${done ? "55" : "22"}`,
    dash: done || selected ? undefined : [900, 600],
    iconOpacity: done ? 0.95 : 0.55,
  };
}

export function statusLabelColour(status: Status): string {
  return STATUS_COLOUR[status];
}

/** Ruler ticks in model space that are visible in the viewport. */
export function rulerTicks(
  view: ViewTransform,
  lengthPx: number,
  axis: "x" | "y",
): { positionPx: number; metre: number; major: boolean }[] {
  const { major } = gridStepMm(view.scale);
  const step = major;
  const origin = axis === "x" ? view.x : view.y;
  const startMm = Math.floor(-origin / view.scale / step) * step;
  const endMm = (lengthPx - origin) / view.scale;
  const ticks: { positionPx: number; metre: number; major: boolean }[] = [];
  for (let mm = startMm; mm <= endMm; mm += step) {
    ticks.push({
      positionPx: mm * view.scale + origin,
      metre: Math.round(mm / MM_PER_M),
      major: true,
    });
  }
  return ticks;
}

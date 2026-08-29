import {
  DxfWriter,
  LWPolylineFlags,
  TextHorizontalAlignment,
  TextVerticalAlignment,
  Units,
  point2d,
  point3d,
} from "@tarikjabiri/dxf";
import { type Category, type ProjectDocument, type Scene } from "@/domain/types";
import { itemTypeName, type Lang } from "@/domain/naming";
import { rectCorners } from "@/lib/geometry";
import { MM_PER_M } from "@/lib/units";

/** AutoCAD colour index per category, so layers look sane in any CAD viewer. */
const LAYER_COLOUR: Record<Category, number> = {
  gebouw: 30,
  cabine: 4,
  meubilair: 3,
  parasol: 2,
  techniek: 5,
  terrein: 8,
  groen: 92,
  interieur: 6,
  overig: 7,
};

const LAYER_PLOT = "PERCEEL";
const LAYER_GRID = "RASTER";
const LAYER_TEXT = "TEKST";
const LAYER_DIM = "MAATLIJN";

const GRID_STEP_MM = 5 * MM_PER_M;
const GUTTER_MM = 6 * MM_PER_M;

/** Dimension line geometry, all in model millimetres. */
const DIM_OFFSET_MM = 1500;
const DIM_OVERSHOOT_MM = 400;
const DIM_GAP_MM = 250;
const DIM_TICK_MM = 350;
const DIM_TEXT_MM = 700;

interface Offset {
  x: number;
  y: number;
}

type Pt = [number, number];

/**
 * Draws a dimension as plain lines and text instead of a DIMENSION entity.
 * A DIMENSION only carries definition points and delegates its appearance to a
 * block that the writer cannot generate, so tools that do not regenerate it
 * from the dimension style show nothing at all. Explicit geometry measures the
 * same and draws identically everywhere.
 */
function drawDimension(
  dxf: DxfWriter,
  from: Pt,
  to: Pt,
  label: string,
): void {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const length = Math.hypot(dx, dy);
  if (length === 0) return;

  // Rotating the run by -90 degrees points away from the plot for both the
  // bottom edge (measured left to right) and the right edge (measured upwards).
  const nx = dy / length;
  const ny = -dx / length;
  const ux = dx / length;
  const uy = dy / length;

  const along = (point: Pt, out: number): Pt => [
    point[0] + nx * out,
    point[1] + ny * out,
  ];
  const line = (a: Pt, b: Pt) =>
    dxf.addLine(point3d(...a), point3d(...b), { layerName: LAYER_DIM });

  for (const end of [from, to]) {
    line(
      along(end, DIM_GAP_MM),
      along(end, DIM_OFFSET_MM + DIM_OVERSHOOT_MM),
    );
  }

  const start = along(from, DIM_OFFSET_MM);
  const end = along(to, DIM_OFFSET_MM);
  line(start, end);

  // Architectural ticks: a short slash at 45 degrees through each end.
  for (const point of [start, end]) {
    const tx = (ux + nx) * (DIM_TICK_MM / 2);
    const ty = (uy + ny) * (DIM_TICK_MM / 2);
    line(
      [point[0] - tx, point[1] - ty],
      [point[0] + tx, point[1] + ty],
    );
  }

  const mid: Pt = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const anchor = along(mid, DIM_GAP_MM);
  // Keep the text upright and readable: never let it end up upside down.
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rotation > 90 || rotation <= -90) rotation += 180;
  dxf.addText(point3d(...anchor), DIM_TEXT_MM, label, {
    layerName: LAYER_DIM,
    rotation,
    horizontalAlignment: TextHorizontalAlignment.Center,
    verticalAlignment: TextVerticalAlignment.Bottom,
    secondAlignmentPoint: point3d(...anchor),
  });
}

const metres = (mm: number): string =>
  `${(mm / MM_PER_M).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m`;

/**
 * The model has Y growing downwards (screen convention); DXF has Y growing
 * upwards. Every point is flipped inside the scene box it belongs to.
 */
function flip(
  x: number,
  y: number,
  sceneHeightMm: number,
  offset: Offset,
): [number, number] {
  return [x + offset.x, sceneHeightMm - y + offset.y];
}

function drawScene(
  dxf: DxfWriter,
  doc: ProjectDocument,
  scene: Scene,
  offset: Offset,
  lang: Lang,
  title: string,
): void {
  const height = scene.hMm;

  dxf.addLWPolyline(
    [
      { point: point2d(...flip(0, 0, height, offset)) },
      { point: point2d(...flip(scene.wMm, 0, height, offset)) },
      { point: point2d(...flip(scene.wMm, scene.hMm, height, offset)) },
      { point: point2d(...flip(0, scene.hMm, height, offset)) },
    ],
    { layerName: LAYER_PLOT, flags: LWPolylineFlags.Closed },
  );

  for (let x = GRID_STEP_MM; x < scene.wMm; x += GRID_STEP_MM) {
    dxf.addLine(
      point3d(...flip(x, 0, height, offset)),
      point3d(...flip(x, scene.hMm, height, offset)),
      { layerName: LAYER_GRID },
    );
  }
  for (let y = GRID_STEP_MM; y < scene.hMm; y += GRID_STEP_MM) {
    dxf.addLine(
      point3d(...flip(0, y, height, offset)),
      point3d(...flip(scene.wMm, y, height, offset)),
      { layerName: LAYER_GRID },
    );
  }

  dxf.addText(
    point3d(...flip(0, scene.hMm + 1200, height, offset)),
    600,
    title,
    { layerName: LAYER_TEXT },
  );

  const objects = doc.objects.filter((object) => object.sceneId === scene.id);
  for (const object of objects) {
    const itemType = doc.itemTypes.find((it) => it.id === object.itemTypeId);
    if (!itemType) continue;
    const layerName = itemType.category.toUpperCase();

    if (itemType.shape === "circle") {
      dxf.addCircle(
        point3d(
          ...flip(
            object.xMm + object.wMm / 2,
            object.yMm + object.hMm / 2,
            height,
            offset,
          ),
        ),
        Math.min(object.wMm, object.hMm) / 2,
        { layerName },
      );
    } else {
      const corners = rectCorners(
        { x: object.xMm, y: object.yMm, w: object.wMm, h: object.hMm },
        object.rotationDeg,
      );
      dxf.addLWPolyline(
        corners.map((corner) => ({
          point: point2d(...flip(corner.x, corner.y, height, offset)),
        })),
        { layerName, flags: LWPolylineFlags.Closed },
      );
    }

    const label = object.label ?? itemTypeName(itemType, lang);
    const textHeight = Math.max(
      200,
      Math.min(400, Math.min(object.wMm, object.hMm) / 4),
    );
    dxf.addText(
      point3d(
        ...flip(
          object.xMm + 150,
          object.yMm + object.hMm / 2 + textHeight / 2,
          height,
          offset,
        ),
      ),
      textHeight,
      label,
      { layerName: LAYER_TEXT },
    );
  }

  drawDimension(
    dxf,
    flip(0, scene.hMm, height, offset),
    flip(scene.wMm, scene.hMm, height, offset),
    metres(scene.wMm),
  );
  drawDimension(
    dxf,
    flip(scene.wMm, scene.hMm, height, offset),
    flip(scene.wMm, 0, height, offset),
    metres(scene.hMm),
  );
}

export interface DxfOptions {
  lang: Lang;
  /** Include the interior plans next to the site plan. */
  includeInteriors?: boolean;
}

/**
 * Writes the site plan (and optionally every interior plan beside it) as DXF in
 * millimetres, one layer per category so a contractor can switch parts off.
 */
export function buildDxf(
  doc: ProjectDocument,
  options: DxfOptions,
): string {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);

  dxf.addLayer(LAYER_PLOT, 7);
  dxf.addLayer(LAYER_GRID, 253);
  dxf.addLayer(LAYER_TEXT, 7);
  dxf.addLayer(LAYER_DIM, 1);
  for (const [category, colour] of Object.entries(LAYER_COLOUR)) {
    dxf.addLayer(category.toUpperCase(), colour);
  }

  const beach = doc.scenes.find((scene) => scene.kind === "beach");
  if (!beach) return dxf.stringify();

  drawScene(dxf, doc, beach, { x: 0, y: 0 }, options.lang, doc.project.name);

  if (options.includeInteriors !== false) {
    let cursorX = beach.wMm + GUTTER_MM;
    for (const scene of doc.scenes.filter((s) => s.kind === "interior")) {
      const parent = doc.objects.find(
        (object) => object.id === scene.parentObjectId,
      );
      const parentType = parent
        ? doc.itemTypes.find((it) => it.id === parent.itemTypeId)
        : null;
      const title = parent?.label
        ? `${parent.label} — ${scene.name}`
        : parentType
          ? `${itemTypeName(parentType, options.lang)} — ${scene.name}`
          : scene.name;
      drawScene(dxf, doc, scene, { x: cursorX, y: 0 }, options.lang, title);
      cursorX += scene.wMm + GUTTER_MM;
    }
  }

  return dxf.stringify();
}

export function dxfFileName(doc: ProjectDocument): string {
  const slug =
    doc.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "strand";
  return `${slug}-situatie-${new Date().toISOString().slice(0, 10)}.dxf`;
}

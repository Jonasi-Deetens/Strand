import { jsPDF } from "jspdf";
import { STATUS_COLOUR } from "@/domain/status";
import { itemTypeName, type Lang } from "@/domain/naming";
import {
  type ItemType,
  type PlanObject,
  type ProjectDocument,
  type Scene,
} from "@/domain/types";
import { rectCorners } from "@/lib/geometry";
import { MM_PER_M, areaM2, formatDimensionM } from "@/lib/units";
import { formatCents } from "@/lib/money";
import { bestQuoteForLine } from "@/store/selectors";

/** Standard drawing scales, most detailed first. */
const SCALES = [20, 50, 100, 150, 200, 250, 500, 1000];

/** ISO A sheets in paper millimetres, smallest first. */
const SHEETS = [
  { name: "a4", short: 210, long: 297 },
  { name: "a3", short: 297, long: 420 },
  { name: "a2", short: 420, long: 594 },
  { name: "a1", short: 594, long: 841 },
  { name: "a0", short: 841, long: 1189 },
] as const;

const A3 = SHEETS[1];
const A3_LONG = A3.long;
const A3_SHORT = A3.short;

/** Sheet furniture, in millimetres on an A3. Bigger paper scales it up. */
const MARGIN = 12;
/** Height of the bottom band that carries the legend and the title block. */
const BAND_HEIGHT = 58;
const TITLE_BLOCK_WIDTH = 104;

export interface PdfLabels {
  drawingTitle: string;
  legend: string;
  schedule: string;
  scale: string;
  date: string;
  drawnBy: string;
  north: string;
  qty: string;
  status: string;
  budget: string;
  quoted: string;
  total: string;
  plot: string;
  sheet: string;
  interior: string;
}

export interface Sheet {
  /** jsPDF format name, e.g. "a1". */
  name: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
}

/** A fixed drawing scale, or "fit" to use the largest scale an A3 can hold. */
export type ScaleChoice = number | "fit";

/** The scale the plan asks for; a site plan of this size lands on A0. */
export const DEFAULT_SCALE = 100;

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function orient(
  spec: (typeof SHEETS)[number],
  orientation: "portrait" | "landscape",
): Sheet {
  return orientation === "portrait"
    ? { name: spec.name, width: spec.short, height: spec.long, orientation }
    : { name: spec.name, width: spec.long, height: spec.short, orientation };
}

/** Portrait for a plot deeper than it is wide, landscape otherwise. */
export function sheetFor(
  scene: { wMm: number; hMm: number },
  spec: (typeof SHEETS)[number] = A3,
): Sheet {
  return orient(spec, scene.hMm > scene.wMm ? "portrait" : "landscape");
}

/**
 * A sheet plus its furniture. Margins, the title block and every font size are
 * tuned for A3 and then multiplied by `k`, so a 1:100 site plan on A0 gets a
 * title block and annotation in proportion instead of A3 furniture lost in a
 * corner.
 */
export interface Paper {
  sheet: Sheet;
  margin: number;
  bandHeight: number;
  titleBlockWidth: number;
  k: number;
}

export function paperFor(sheet: Sheet): Paper {
  const k = Math.min(sheet.width, sheet.height) / A3_SHORT;
  return {
    sheet,
    margin: MARGIN * k,
    bandHeight: BAND_HEIGHT * k,
    titleBlockWidth: TITLE_BLOCK_WIDTH * k,
    k,
  };
}

/** Top edge of the bottom band; nothing from the drawing may cross it. */
function bandTop(paper: Paper): number {
  return paper.sheet.height - paper.margin - paper.bandHeight;
}

function frameFor(paper: Paper): Frame {
  const { sheet, margin, bandHeight, k } = paper;
  return {
    x: margin + 10 * k,
    y: margin + 12 * k,
    width: sheet.width - margin * 2 - 16 * k,
    height: sheet.height - margin * 2 - bandHeight - 24 * k,
  };
}

/** Picks the largest standard scale at which the scene still fits the frame. */
export function chooseScale(
  scene: { wMm: number; hMm: number },
  frame: Pick<Frame, "width" | "height">,
): number {
  const found = SCALES.find(
    (scale) => scene.wMm / scale <= frame.width && scene.hMm / scale <= frame.height,
  );
  return found ?? SCALES[SCALES.length - 1]!;
}

function fits(
  scene: { wMm: number; hMm: number },
  sheet: Sheet,
  scale: number,
): boolean {
  const frame = frameFor(paperFor(sheet));
  return scene.wMm / scale <= frame.width && scene.hMm / scale <= frame.height;
}

/**
 * Smallest ISO sheet that holds the scene at a fixed scale, preferring the
 * orientation that matches the plot. Null when even A0 is too small.
 */
export function sheetForScale(
  scene: { wMm: number; hMm: number },
  scale: number,
): Sheet | null {
  const preferred = scene.hMm > scene.wMm ? "portrait" : "landscape";
  const other = preferred === "portrait" ? "landscape" : "portrait";
  for (const spec of SHEETS) {
    for (const orientation of [preferred, other] as const) {
      const sheet = orient(spec, orientation);
      if (fits(scene, sheet, scale)) return sheet;
    }
  }
  return null;
}

/**
 * Paper and scale for one scene. A fixed scale grows the paper until the
 * drawing fits, which is how a real drawing set works; "fit" instead keeps A3
 * and gives up detail. Falling back to "fit" keeps very large plots printable.
 */
export function layoutFor(
  scene: { wMm: number; hMm: number },
  choice: ScaleChoice,
): { sheet: Sheet; scale: number } {
  if (choice !== "fit") {
    const sheet = sheetForScale(scene, choice);
    if (sheet) return { sheet, scale: choice };
  }
  const sheet = sheetFor(scene);
  return { sheet, scale: chooseScale(scene, frameFor(paperFor(sheet))) };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "").slice(0, 6);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function drawObject(
  pdf: jsPDF,
  object: PlanObject,
  itemType: ItemType,
  project: (xMm: number, yMm: number) => [number, number],
  scale: number,
  k: number,
): void {
  const [r, g, b] = hexToRgb(STATUS_COLOUR[object.status]);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(0.3 * k);

  if (itemType.shape === "circle") {
    const [cx, cy] = project(
      object.xMm + object.wMm / 2,
      object.yMm + object.hMm / 2,
    );
    pdf.circle(cx, cy, Math.min(object.wMm, object.hMm) / 2 / scale, "S");
    return;
  }

  const corners = rectCorners(
    { x: object.xMm, y: object.yMm, w: object.wMm, h: object.hMm },
    object.rotationDeg,
  ).map((corner) => project(corner.x, corner.y));

  const [first] = corners;
  if (!first) return;
  const deltas: [number, number][] = corners.slice(1).map((corner, index) => {
    const previous = corners[index]!;
    return [corner[0] - previous[0], corner[1] - previous[1]];
  });
  const last = corners[corners.length - 1]!;
  deltas.push([first[0] - last[0], first[1] - last[1]]);
  pdf.lines(deltas, first[0], first[1], [1, 1], "S", true);
}

function drawSceneDrawing(
  pdf: jsPDF,
  doc: ProjectDocument,
  scene: Scene,
  paper: Paper,
  scale: number,
  labels: PdfLabels,
  lang: Lang,
  heading: string,
): void {
  const { k, margin } = paper;
  const frame = frameFor(paper);
  const width = scene.wMm / scale;
  const height = scene.hMm / scale;
  const originX = frame.x + (frame.width - width) / 2;
  const originY = frame.y + (frame.height - height) / 2;
  const project = (xMm: number, yMm: number): [number, number] => [
    originX + xMm / scale,
    originY + yMm / scale,
  ];

  pdf.setFontSize(11 * k);
  pdf.setTextColor(30);
  pdf.text(heading, margin, margin + 6 * k);

  pdf.setDrawColor(216);
  pdf.setLineWidth(0.1 * k);
  for (let x = 0; x <= scene.wMm; x += 5 * MM_PER_M) {
    const [px] = project(x, 0);
    pdf.line(px, originY, px, originY + height);
  }
  for (let y = 0; y <= scene.hMm; y += 5 * MM_PER_M) {
    const [, py] = project(0, y);
    pdf.line(originX, py, originX + width, py);
  }

  pdf.setDrawColor(50);
  pdf.setLineWidth(0.6 * k);
  pdf.rect(originX, originY, width, height, "S");

  const itemTypes = new Map(doc.itemTypes.map((it) => [it.id, it]));
  for (const object of doc.objects.filter((o) => o.sceneId === scene.id)) {
    const itemType = itemTypes.get(object.itemTypeId);
    if (!itemType) continue;
    drawObject(pdf, object, itemType, project, scale, k);
    if (object.wMm / scale > 14 * k && object.hMm / scale > 5 * k) {
      pdf.setFontSize(6 * k);
      pdf.setTextColor(80);
      const [tx, ty] = project(object.xMm + 250, object.yMm + object.hMm / 2);
      const text = object.label ?? itemTypeName(itemType, lang);
      pdf.text(fitText(pdf, text, object.wMm / scale - 3 * k), tx, ty);
    }
  }

  // Overall dimensions along the top and the left edge.
  pdf.setDrawColor(90);
  pdf.setLineWidth(0.2 * k);
  pdf.setFontSize(7 * k);
  pdf.setTextColor(60);
  pdf.line(originX, originY - 5 * k, originX + width, originY - 5 * k);
  pdf.line(originX, originY - 7 * k, originX, originY - 3 * k);
  pdf.line(
    originX + width,
    originY - 7 * k,
    originX + width,
    originY - 3 * k,
  );
  pdf.text(
    formatDimensionM(scene.wMm),
    originX + width / 2 - 7 * k,
    originY - 7 * k,
  );
  pdf.line(originX - 5 * k, originY, originX - 5 * k, originY + height);
  pdf.line(originX - 7 * k, originY, originX - 3 * k, originY);
  pdf.line(
    originX - 7 * k,
    originY + height,
    originX - 3 * k,
    originY + height,
  );
  pdf.text(
    formatDimensionM(scene.hMm),
    originX - 7 * k,
    originY + height / 2 + 7 * k,
    { angle: 90 },
  );

  // Scale bar of ten metres with a five metre tick, in the strip that separates
  // the drawing from the band, so it never lands on the legend.
  const barLength = (10 * MM_PER_M) / scale;
  const barY = bandTop(paper) - 7 * k;
  pdf.setDrawColor(40);
  pdf.setLineWidth(0.4 * k);
  pdf.line(frame.x, barY, frame.x + barLength, barY);
  for (let metre = 0; metre <= 10; metre += 5) {
    const x = frame.x + (metre * MM_PER_M) / scale;
    pdf.line(x, barY - 1.6 * k, x, barY + 1.6 * k);
  }
  pdf.setFontSize(6.5 * k);
  pdf.text("0", frame.x - 1 * k, barY + 5 * k);
  pdf.text("5", frame.x + barLength / 2 - 1 * k, barY + 5 * k);
  pdf.text("10 m", frame.x + barLength - 4 * k, barY + 5 * k);
  pdf.setFontSize(8 * k);
  pdf.text(
    `${labels.scale} 1:${scale}`,
    frame.x + barLength + 10 * k,
    barY + 1.5 * k,
  );

  // North arrow, top right of the drawing.
  const northX = originX + width + 8 * k;
  const northY = originY + 10 * k;
  pdf.setLineWidth(0.5 * k);
  pdf.line(northX, northY, northX, northY - 9 * k);
  pdf.line(northX, northY - 9 * k, northX - 2.2 * k, northY - 4.5 * k);
  pdf.line(northX, northY - 9 * k, northX + 2.2 * k, northY - 4.5 * k);
  pdf.setFontSize(8 * k);
  pdf.text(labels.north, northX - 1.4 * k, northY + 4.5 * k);
}

function drawTitleBlock(
  pdf: jsPDF,
  doc: ProjectDocument,
  paper: Paper,
  labels: PdfLabels,
  scale: number,
  sheetNumber: string,
): void {
  const { sheet, margin, bandHeight, titleBlockWidth, k } = paper;
  const x = sheet.width - margin - titleBlockWidth;
  const y = sheet.height - margin - bandHeight;
  pdf.setDrawColor(60);
  pdf.setLineWidth(0.4 * k);
  pdf.rect(x, y, titleBlockWidth, bandHeight, "S");

  pdf.setFontSize(12 * k);
  pdf.setTextColor(20);
  pdf.text(doc.project.name, x + 4 * k, y + 9 * k);
  pdf.setFontSize(8 * k);
  pdf.setTextColor(70);
  pdf.text(labels.drawingTitle, x + 4 * k, y + 15 * k);

  pdf.setLineWidth(0.2 * k);
  pdf.line(x, y + 19 * k, x + titleBlockWidth, y + 19 * k);

  const rows: [string, string][] = [
    [labels.scale, `1:${scale}`],
    [labels.date, new Date().toISOString().slice(0, 10)],
    [
      labels.plot,
      `${(doc.project.plotWMm / MM_PER_M).toFixed(0)} × ${(
        doc.project.plotHMm / MM_PER_M
      ).toFixed(0)} m`,
    ],
    [labels.sheet, sheetNumber],
  ];
  pdf.setFontSize(7.5 * k);
  rows.forEach(([label, value], index) => {
    const rowY = y + (25.5 + index * 6) * k;
    pdf.setTextColor(120);
    pdf.text(label, x + 4 * k, rowY);
    pdf.setTextColor(30);
    pdf.text(value, x + 36 * k, rowY);
  });

  pdf.setFontSize(6.5 * k);
  pdf.setTextColor(150);
  pdf.text(labels.drawnBy, x + 4 * k, y + bandHeight - 4 * k);
}

function drawLegend(
  pdf: jsPDF,
  doc: ProjectDocument,
  scene: Scene,
  paper: Paper,
  labels: PdfLabels,
  lang: Lang,
  statusLabel: (status: string) => string,
): void {
  const { sheet, margin, bandHeight, titleBlockWidth, k } = paper;
  const x = margin;
  const y = bandTop(paper);
  const rowHeight = 5 * k;
  const rowsPerColumn = Math.floor((bandHeight - 14 * k) / rowHeight);
  pdf.setFontSize(8 * k);
  pdf.setTextColor(40);
  pdf.text(labels.legend, x, y + 4 * k);

  const statusColumnWidth = 42 * k;
  const statuses = [...new Set(doc.objects.map((object) => object.status))];
  pdf.setFontSize(6.5 * k);
  statuses.forEach((status, index) => {
    const rowX = x + Math.floor(index / rowsPerColumn) * statusColumnWidth;
    const rowY = y + 10 * k + (index % rowsPerColumn) * rowHeight;
    const [r, g, b] = hexToRgb(STATUS_COLOUR[status]);
    pdf.setFillColor(r, g, b);
    pdf.rect(rowX, rowY - 2.4 * k, 3 * k, 3 * k, "F");
    pdf.setTextColor(70);
    pdf.text(statusLabel(status), rowX + 4.5 * k, rowY);
  });

  // What is on this sheet, counted per item type. The number of columns follows
  // the space left between the legend and the title block.
  const counts = new Map<string, number>();
  for (const object of doc.objects.filter((o) => o.sceneId === scene.id)) {
    counts.set(object.itemTypeId, (counts.get(object.itemTypeId) ?? 0) + 1);
  }
  const statusColumns = Math.ceil(statuses.length / rowsPerColumn) || 1;
  const columnX = x + statusColumns * statusColumnWidth + 8 * k;
  const available = sheet.width - margin - titleBlockWidth - 6 * k - columnX;
  const columnWidth = 48 * k;
  const columnCount = Math.max(1, Math.floor(available / columnWidth));
  const entries = [...counts.entries()]
    .map(([itemTypeId, count]) => {
      const itemType = doc.itemTypes.find((it) => it.id === itemTypeId);
      return { name: itemType ? itemTypeName(itemType, lang) : "?", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, columnCount * rowsPerColumn);

  if (available < columnWidth / 2) return;
  pdf.setFontSize(8 * k);
  pdf.setTextColor(40);
  pdf.text(labels.schedule, columnX, y + 4 * k);
  pdf.setFontSize(6.5 * k);
  const nameWidth = columnWidth - 12 * k;
  entries.forEach((entry, index) => {
    const rowX = columnX + Math.floor(index / rowsPerColumn) * columnWidth;
    const rowY = y + 10 * k + (index % rowsPerColumn) * rowHeight;
    pdf.setTextColor(70);
    pdf.text(`${entry.count}×`, rowX, rowY);
    pdf.text(fitText(pdf, entry.name, nameWidth), rowX + 8 * k, rowY);
  });
}

/** Truncates with an ellipsis until the string fits the given paper width. */
function fitText(pdf: jsPDF, text: string, maxWidth: number): string {
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let candidate = text;
  while (candidate.length > 1 && pdf.getTextWidth(`${candidate}…`) > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  return `${candidate.trimEnd()}…`;
}

function drawSchedule(
  pdf: jsPDF,
  doc: ProjectDocument,
  labels: PdfLabels,
  statusLabel: (status: string) => string,
): void {
  pdf.addPage("a3", "landscape");
  const width = A3_LONG;
  pdf.setFontSize(14);
  pdf.setTextColor(20);
  pdf.text(`${doc.project.name} — ${labels.schedule}`, MARGIN, MARGIN + 8);

  const columns = [
    { label: "", x: MARGIN },
    { label: labels.qty, x: MARGIN + 130 },
    { label: labels.status, x: MARGIN + 170 },
    { label: labels.budget, x: MARGIN + 250, align: "right" as const },
    { label: labels.quoted, x: MARGIN + 320, align: "right" as const },
  ];
  pdf.setFontSize(7.5);
  pdf.setTextColor(120);
  for (const column of columns) {
    pdf.text(column.label, column.x, MARGIN + 18, {
      align: column.align ?? "left",
    });
  }
  pdf.setDrawColor(170);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, MARGIN + 20, width - MARGIN, MARGIN + 20);

  const lines = [...doc.procurementLines].sort(
    (a, b) => b.budgetCents - a.budgetCents,
  );
  let y = MARGIN + 26;
  let budgetTotal = 0;
  let quotedTotal = 0;
  pdf.setFontSize(8);
  for (const line of lines) {
    if (y > A3_SHORT - MARGIN - 18) {
      pdf.addPage("a3", "landscape");
      y = MARGIN + 12;
    }
    const quote = bestQuoteForLine(doc, line.id);
    pdf.setTextColor(30);
    pdf.text(fitText(pdf, line.title, 124), columns[0]!.x, y);
    pdf.text(`${line.qtyPlanned} ${line.unit}`, columns[1]!.x, y);
    const [r, g, b] = hexToRgb(STATUS_COLOUR[line.status]);
    pdf.setTextColor(r, g, b);
    pdf.text(statusLabel(line.status), columns[2]!.x, y);
    pdf.setTextColor(30);
    pdf.text(
      formatCents(line.budgetCents, doc.project.currency),
      columns[3]!.x,
      y,
      { align: "right" },
    );
    if (quote) {
      pdf.text(
        formatCents(quote.exVatCents, doc.project.currency),
        columns[4]!.x,
        y,
        { align: "right" },
      );
      quotedTotal += quote.exVatCents;
    } else {
      // Nothing quoted yet, so the column stays empty rather than repeating
      // the budget; the total then reads as "quoted so far".
      pdf.setTextColor(150);
      pdf.text("–", columns[4]!.x, y, { align: "right" });
    }
    budgetTotal += line.budgetCents;
    y += 6;
  }

  pdf.setDrawColor(110);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, width - MARGIN, y);
  pdf.setFontSize(9.5);
  pdf.setTextColor(10);
  pdf.text(labels.total, columns[0]!.x, y + 7);
  pdf.text(
    formatCents(budgetTotal, doc.project.currency),
    columns[3]!.x,
    y + 7,
    { align: "right" },
  );
  pdf.text(
    formatCents(quotedTotal, doc.project.currency),
    columns[4]!.x,
    y + 7,
    { align: "right" },
  );
}

export interface PdfOptions {
  lang: Lang;
  labels: PdfLabels;
  statusLabel: (status: string) => string;
  /** Fixed drawing scale, or "fit" to squeeze every scene onto A3. */
  scale?: ScaleChoice;
  includeInteriors?: boolean;
  includeSchedule?: boolean;
}

/**
 * A true-scale drawing rather than a screenshot: geometry is drawn from the
 * model in paper millimetres, at 1:100 by default, with a title block, scale
 * bar, north arrow, legend, per-sheet item counts and a priced schedule at the
 * back. Each sheet gets the smallest ISO paper its drawing fits on.
 */
export function buildPdf(doc: ProjectDocument, options: PdfOptions): jsPDF {
  const choice = options.scale ?? DEFAULT_SCALE;
  const beach = doc.scenes.find((scene) => scene.kind === "beach");
  const first = layoutFor(beach ?? { wMm: 1, hMm: 1 }, choice);
  const pdf = new jsPDF({
    orientation: first.sheet.orientation,
    unit: "mm",
    format: first.sheet.name,
  });
  if (!beach) return pdf;

  const firstPaper = paperFor(first.sheet);
  drawSceneDrawing(
    pdf,
    doc,
    beach,
    firstPaper,
    first.scale,
    options.labels,
    options.lang,
    `${doc.project.name} — ${options.labels.drawingTitle}`,
  );
  drawLegend(
    pdf,
    doc,
    beach,
    firstPaper,
    options.labels,
    options.lang,
    options.statusLabel,
  );
  drawTitleBlock(pdf, doc, firstPaper, options.labels, first.scale, "1");

  if (options.includeInteriors !== false) {
    const interiors = doc.scenes.filter((scene) => scene.kind === "interior");
    for (const [index, scene] of interiors.entries()) {
      const parent = doc.objects.find(
        (object) => object.id === scene.parentObjectId,
      );
      const parentType = parent
        ? doc.itemTypes.find((it) => it.id === parent.itemTypeId)
        : null;
      const { sheet, scale } = layoutFor(scene, choice);
      const paper = paperFor(sheet);
      pdf.addPage(sheet.name, sheet.orientation);
      const name =
        parent?.label ??
        (parentType ? itemTypeName(parentType, options.lang) : scene.name);
      drawSceneDrawing(
        pdf,
        doc,
        scene,
        paper,
        scale,
        options.labels,
        options.lang,
        `${name} — ${options.labels.interior} · ${areaM2(
          scene.wMm,
          scene.hMm,
        ).toFixed(1)} m²`,
      );
      drawLegend(
        pdf,
        doc,
        scene,
        paper,
        options.labels,
        options.lang,
        options.statusLabel,
      );
      drawTitleBlock(pdf, doc, paper, options.labels, scale, `${index + 2}`);
    }
  }

  if (options.includeSchedule !== false) {
    drawSchedule(pdf, doc, options.labels, options.statusLabel);
  }

  return pdf;
}

export function pdfFileName(doc: ProjectDocument): string {
  const slug =
    doc.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "strand";
  return `${slug}-plattegrond-${new Date().toISOString().slice(0, 10)}.pdf`;
}

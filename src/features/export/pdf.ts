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
import { MM_PER_M, areaM2 } from "@/lib/units";
import { formatCents } from "@/lib/money";
import { bestQuoteForLine } from "@/store/selectors";

/** Standard drawing scales, most detailed first. */
const SCALES = [20, 50, 100, 150, 200, 250, 500, 1000];

const A3_LONG = 420;
const A3_SHORT = 297;
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

interface Sheet {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
}

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Portrait for a plot deeper than it is wide, landscape otherwise. */
export function sheetFor(scene: { wMm: number; hMm: number }): Sheet {
  return scene.hMm > scene.wMm
    ? { width: A3_SHORT, height: A3_LONG, orientation: "portrait" }
    : { width: A3_LONG, height: A3_SHORT, orientation: "landscape" };
}

/** Top edge of the bottom band; nothing from the drawing may cross it. */
function bandTop(sheet: Sheet): number {
  return sheet.height - MARGIN - BAND_HEIGHT;
}

function frameFor(sheet: Sheet): Frame {
  return {
    x: MARGIN + 10,
    y: MARGIN + 12,
    width: sheet.width - MARGIN * 2 - 16,
    height: sheet.height - MARGIN * 2 - BAND_HEIGHT - 24,
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
): void {
  const [r, g, b] = hexToRgb(STATUS_COLOUR[object.status]);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(0.3);

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
  sheet: Sheet,
  labels: PdfLabels,
  lang: Lang,
  heading: string,
): number {
  const frame = frameFor(sheet);
  const scale = chooseScale(scene, frame);
  const width = scene.wMm / scale;
  const height = scene.hMm / scale;
  const originX = frame.x + (frame.width - width) / 2;
  const originY = frame.y + (frame.height - height) / 2;
  const project = (xMm: number, yMm: number): [number, number] => [
    originX + xMm / scale,
    originY + yMm / scale,
  ];

  pdf.setFontSize(11);
  pdf.setTextColor(30);
  pdf.text(heading, MARGIN, MARGIN + 6);

  pdf.setDrawColor(216);
  pdf.setLineWidth(0.1);
  for (let x = 0; x <= scene.wMm; x += 5 * MM_PER_M) {
    const [px] = project(x, 0);
    pdf.line(px, originY, px, originY + height);
  }
  for (let y = 0; y <= scene.hMm; y += 5 * MM_PER_M) {
    const [, py] = project(0, y);
    pdf.line(originX, py, originX + width, py);
  }

  pdf.setDrawColor(50);
  pdf.setLineWidth(0.6);
  pdf.rect(originX, originY, width, height, "S");

  const itemTypes = new Map(doc.itemTypes.map((it) => [it.id, it]));
  for (const object of doc.objects.filter((o) => o.sceneId === scene.id)) {
    const itemType = itemTypes.get(object.itemTypeId);
    if (!itemType) continue;
    drawObject(pdf, object, itemType, project, scale);
    if (object.wMm / scale > 14 && object.hMm / scale > 5) {
      pdf.setFontSize(6);
      pdf.setTextColor(80);
      const [tx, ty] = project(object.xMm + 250, object.yMm + object.hMm / 2);
      const text = object.label ?? itemTypeName(itemType, lang);
      pdf.text(fitText(pdf, text, object.wMm / scale - 3), tx, ty);
    }
  }

  // Overall dimensions along the top and the left edge.
  pdf.setDrawColor(90);
  pdf.setLineWidth(0.2);
  pdf.setFontSize(7);
  pdf.setTextColor(60);
  pdf.line(originX, originY - 5, originX + width, originY - 5);
  pdf.line(originX, originY - 7, originX, originY - 3);
  pdf.line(originX + width, originY - 7, originX + width, originY - 3);
  pdf.text(
    `${(scene.wMm / MM_PER_M).toFixed(1)} m`,
    originX + width / 2 - 6,
    originY - 7,
  );
  pdf.line(originX - 5, originY, originX - 5, originY + height);
  pdf.line(originX - 7, originY, originX - 3, originY);
  pdf.line(originX - 7, originY + height, originX - 3, originY + height);
  pdf.text(
    `${(scene.hMm / MM_PER_M).toFixed(1)} m`,
    originX - 7,
    originY + height / 2 + 6,
    { angle: 90 },
  );

  // Scale bar of ten metres with a five metre tick, in the strip that separates
  // the drawing from the band, so it never lands on the legend.
  const barLength = (10 * MM_PER_M) / scale;
  const barY = bandTop(sheet) - 7;
  pdf.setDrawColor(40);
  pdf.setLineWidth(0.4);
  pdf.line(frame.x, barY, frame.x + barLength, barY);
  for (let metre = 0; metre <= 10; metre += 5) {
    const x = frame.x + (metre * MM_PER_M) / scale;
    pdf.line(x, barY - 1.6, x, barY + 1.6);
  }
  pdf.setFontSize(6.5);
  pdf.text("0", frame.x - 1, barY + 5);
  pdf.text("5", frame.x + barLength / 2 - 1, barY + 5);
  pdf.text("10 m", frame.x + barLength - 4, barY + 5);
  pdf.setFontSize(8);
  pdf.text(`${labels.scale} 1:${scale}`, frame.x + barLength + 10, barY + 1.5);

  // North arrow, top right of the drawing.
  const northX = originX + width + 8;
  const northY = originY + 10;
  pdf.setLineWidth(0.5);
  pdf.line(northX, northY, northX, northY - 9);
  pdf.line(northX, northY - 9, northX - 2.2, northY - 4.5);
  pdf.line(northX, northY - 9, northX + 2.2, northY - 4.5);
  pdf.setFontSize(8);
  pdf.text(labels.north, northX - 1.4, northY + 4.5);

  return scale;
}

function drawTitleBlock(
  pdf: jsPDF,
  doc: ProjectDocument,
  sheet: Sheet,
  labels: PdfLabels,
  scale: number,
  sheetNumber: string,
): void {
  const x = sheet.width - MARGIN - TITLE_BLOCK_WIDTH;
  const y = sheet.height - MARGIN - BAND_HEIGHT;
  pdf.setDrawColor(60);
  pdf.setLineWidth(0.4);
  pdf.rect(x, y, TITLE_BLOCK_WIDTH, BAND_HEIGHT, "S");

  pdf.setFontSize(12);
  pdf.setTextColor(20);
  pdf.text(doc.project.name, x + 4, y + 9);
  pdf.setFontSize(8);
  pdf.setTextColor(70);
  pdf.text(labels.drawingTitle, x + 4, y + 15);

  pdf.setLineWidth(0.2);
  pdf.line(x, y + 19, x + TITLE_BLOCK_WIDTH, y + 19);

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
  pdf.setFontSize(7.5);
  rows.forEach(([label, value], index) => {
    const rowY = y + 25.5 + index * 6;
    pdf.setTextColor(120);
    pdf.text(label, x + 4, rowY);
    pdf.setTextColor(30);
    pdf.text(value, x + 36, rowY);
  });

  pdf.setFontSize(6.5);
  pdf.setTextColor(150);
  pdf.text(labels.drawnBy, x + 4, y + BAND_HEIGHT - 4);
}

function drawLegend(
  pdf: jsPDF,
  doc: ProjectDocument,
  scene: Scene,
  sheet: Sheet,
  labels: PdfLabels,
  lang: Lang,
  statusLabel: (status: string) => string,
): void {
  const x = MARGIN;
  const y = bandTop(sheet);
  const rowHeight = 5;
  const rowsPerColumn = Math.floor((BAND_HEIGHT - 14) / rowHeight);
  pdf.setFontSize(8);
  pdf.setTextColor(40);
  pdf.text(labels.legend, x, y + 4);

  const statusColumnWidth = 42;
  const statuses = [...new Set(doc.objects.map((object) => object.status))];
  pdf.setFontSize(6.5);
  statuses.forEach((status, index) => {
    const rowX = x + Math.floor(index / rowsPerColumn) * statusColumnWidth;
    const rowY = y + 10 + (index % rowsPerColumn) * rowHeight;
    const [r, g, b] = hexToRgb(STATUS_COLOUR[status]);
    pdf.setFillColor(r, g, b);
    pdf.rect(rowX, rowY - 2.4, 3, 3, "F");
    pdf.setTextColor(70);
    pdf.text(statusLabel(status), rowX + 4.5, rowY);
  });

  // What is on this sheet, counted per item type. The number of columns follows
  // the space left between the legend and the title block.
  const counts = new Map<string, number>();
  for (const object of doc.objects.filter((o) => o.sceneId === scene.id)) {
    counts.set(object.itemTypeId, (counts.get(object.itemTypeId) ?? 0) + 1);
  }
  const statusColumns = Math.ceil(statuses.length / rowsPerColumn) || 1;
  const columnX = x + statusColumns * statusColumnWidth + 8;
  const available = sheet.width - MARGIN - TITLE_BLOCK_WIDTH - 6 - columnX;
  const columnWidth = 48;
  const columnCount = Math.max(1, Math.floor(available / columnWidth));
  const entries = [...counts.entries()]
    .map(([itemTypeId, count]) => {
      const itemType = doc.itemTypes.find((it) => it.id === itemTypeId);
      return { name: itemType ? itemTypeName(itemType, lang) : "?", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, columnCount * rowsPerColumn);

  if (available < columnWidth / 2) return;
  pdf.setFontSize(8);
  pdf.setTextColor(40);
  pdf.text(labels.schedule, columnX, y + 4);
  pdf.setFontSize(6.5);
  const nameWidth = columnWidth - 12;
  entries.forEach((entry, index) => {
    const rowX = columnX + Math.floor(index / rowsPerColumn) * columnWidth;
    const rowY = y + 10 + (index % rowsPerColumn) * rowHeight;
    pdf.setTextColor(70);
    pdf.text(`${entry.count}×`, rowX, rowY);
    pdf.text(fitText(pdf, entry.name, nameWidth), rowX + 8, rowY);
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
      // No quote yet: the budget stands in, marked so the reader sees why.
      pdf.setTextColor(150);
      pdf.text("–", columns[4]!.x, y, { align: "right" });
      quotedTotal += line.budgetCents;
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
  includeInteriors?: boolean;
  includeSchedule?: boolean;
}

/**
 * A true-scale drawing rather than a screenshot: geometry is drawn from the
 * model in paper millimetres on A3, with a title block, scale bar, north arrow,
 * legend, per-sheet item counts and a priced schedule at the back.
 */
export function buildPdf(doc: ProjectDocument, options: PdfOptions): jsPDF {
  const beach = doc.scenes.find((scene) => scene.kind === "beach");
  const firstSheet = sheetFor(beach ?? { wMm: 1, hMm: 1 });
  const pdf = new jsPDF({
    orientation: firstSheet.orientation,
    unit: "mm",
    format: "a3",
  });
  if (!beach) return pdf;

  const scale = drawSceneDrawing(
    pdf,
    doc,
    beach,
    firstSheet,
    options.labels,
    options.lang,
    `${doc.project.name} — ${options.labels.drawingTitle}`,
  );
  drawLegend(
    pdf,
    doc,
    beach,
    firstSheet,
    options.labels,
    options.lang,
    options.statusLabel,
  );
  drawTitleBlock(pdf, doc, firstSheet, options.labels, scale, "1");

  if (options.includeInteriors !== false) {
    const interiors = doc.scenes.filter((scene) => scene.kind === "interior");
    for (const [index, scene] of interiors.entries()) {
      const parent = doc.objects.find(
        (object) => object.id === scene.parentObjectId,
      );
      const parentType = parent
        ? doc.itemTypes.find((it) => it.id === parent.itemTypeId)
        : null;
      const sheet = sheetFor(scene);
      pdf.addPage("a3", sheet.orientation);
      const name =
        parent?.label ??
        (parentType ? itemTypeName(parentType, options.lang) : scene.name);
      const interiorScale = drawSceneDrawing(
        pdf,
        doc,
        scene,
        sheet,
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
        sheet,
        options.labels,
        options.lang,
        options.statusLabel,
      );
      drawTitleBlock(
        pdf,
        doc,
        sheet,
        options.labels,
        interiorScale,
        `${index + 2}`,
      );
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

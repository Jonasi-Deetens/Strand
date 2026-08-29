/**
 * Renders a sample beach plan to DXF and PDF without starting the app, so the
 * blueprint output can be inspected from the command line:
 *   npx vite-node scripts/sample-blueprint.ts
 */
import { writeFileSync } from "node:fs";
import { syncDerived } from "@/domain/sync";
import { type ItemType, type PlanObject, type ProjectDocument } from "@/domain/types";
import { createWasmDriver } from "@/data/wasmDriver";
import { toItemType, type ItemTypeRow } from "@/data/rows";
import { createProjectDocument } from "@/domain/bootstrap";
import { newId } from "@/lib/id";
import { mToMm } from "@/lib/units";
import { buildDxf, dxfFileName } from "@/features/export/dxf";
import { buildPdf, pdfFileName } from "@/features/export/pdf";

const driver = await createWasmDriver({ ephemeral: true });
const itemTypes = (
  await driver.select<ItemTypeRow>("SELECT * FROM item_types")
).map(toItemType);
const byId = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
const base = createProjectDocument(itemTypes, (key) => key.replace("seed.", ""));
const beachScene = base.scenes[0]!;

const place = (
  typeId: string,
  xM: number,
  yM: number,
  status: PlanObject["status"] = "nodig",
  size?: { w: number; h: number },
  rotationDeg = 0,
): PlanObject => {
  const itemType = byId.get(typeId) as ItemType;
  return {
    id: newId("ob"),
    sceneId: beachScene.id,
    itemTypeId: typeId,
    variant: null,
    xMm: mToMm(xM),
    yMm: mToMm(yM),
    wMm: size ? mToMm(size.w) : itemType.defaultWMm,
    hMm: size ? mToMm(size.h) : itemType.defaultHMm,
    rotationDeg,
    status,
    procurementLineId: null,
    label: null,
    notes: null,
    locked: false,
  };
};

const objects: PlanObject[] = [
  place("it_bar", 18, 8, "gebouwd", { w: 12, h: 5 }),
  place("it_toilet", 4, 9, "besteld", { w: 6, h: 3 }),
  place("it_terras", 14, 14, "geleverd", { w: 20, h: 10 }),
  place("it_pad", 24, 25, "nodig", { w: 2, h: 20 }, 0),
  place("it_volleybal", 34, 44, "offerte_aangevraagd"),
];

for (let index = 0; index < 12; index += 1) {
  objects.push(
    place(
      "it_cabine",
      4 + (index % 6) * 2.5,
      30 + Math.floor(index / 6) * 3,
      index < 5 ? "gebouwd" : "nodig",
    ),
  );
}
for (let index = 0; index < 8; index += 1) {
  objects.push(
    place("it_parasol", 6 + index * 4, 52, index < 3 ? "geleverd" : "besteld"),
  );
}
for (let index = 0; index < 8; index += 1) {
  objects.push(
    place("it_ligbed", 6 + index * 4, 56, "nodig", undefined, index % 2 ? 15 : 0),
  );
}

const barObject = objects[0]!;
const interiorScene = {
  id: newId("sc"),
  projectId: base.project.id,
  kind: "interior" as const,
  parentObjectId: barObject.id,
  name: "Bar interieur",
  wMm: barObject.wMm,
  hMm: barObject.hMm,
};

const interiorObjects: PlanObject[] = [
  {
    ...place("it_toog", 1, 0.5, "gebouwd", { w: 6, h: 0.7 }),
    sceneId: interiorScene.id,
  },
  { ...place("it_tap", 2, 2, "besteld"), sceneId: interiorScene.id },
  { ...place("it_koeling", 8, 1, "nodig"), sceneId: interiorScene.id },
  { ...place("it_werkbank", 8, 3, "nodig"), sceneId: interiorScene.id },
];

const doc: ProjectDocument = syncDerived(
  {
    ...base,
    scenes: [...base.scenes, interiorScene],
    objects: [...objects, ...interiorObjects],
  },
  "nl",
);

const dxf = buildDxf(doc, { lang: "nl" });
writeFileSync(`/tmp/${dxfFileName(doc)}`, dxf);

const labels = {
  drawingTitle: "Situatietekening",
  legend: "Legenda",
  schedule: "Stuklijst",
  scale: "Schaal",
  date: "Datum",
  drawnBy: "Getekend met Strand",
  north: "N",
  qty: "Aantal",
  status: "Status",
  budget: "Budget",
  quoted: "Geoffreerd",
  total: "Totaal",
  plot: "Perceel",
  sheet: "Blad",
  interior: "Interieur",
};

console.log(`objects: ${doc.objects.length}`);
console.log(`lines: ${doc.procurementLines.length}`);
console.log(`dxf: /tmp/${dxfFileName(doc)} (${dxf.length} bytes)`);

// Both scale modes, so the fixed 1:100 sheets and the A3 fallback can be
// eyeballed side by side.
for (const scale of [100, "fit"] as const) {
  const pdf = buildPdf(doc, {
    lang: "nl",
    scale,
    statusLabel: (status) => status.replace(/_/g, " "),
    labels,
  });
  const path = `/tmp/${scale === "fit" ? "fit-" : ""}${pdfFileName(doc)}`;
  writeFileSync(path, Buffer.from(pdf.output("arraybuffer")));
  console.log(`pdf (${scale}): ${path}`);
}

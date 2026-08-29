import { newId, nowIso } from "@/lib/id";
import { mToMm } from "@/lib/units";
import {
  type ItemType,
  type ProcurementLine,
  type ProjectDocument,
  type Scene,
} from "./types";

export const DEFAULT_PLOT_W_M = 60;
export const DEFAULT_PLOT_H_M = 70;

export type Translate = (key: string) => string;

/** Non-drawable work that still needs money and follow-up. */
const MANUAL_LINES: {
  key: string;
  unit: string;
  qty: number;
  budgetCents: number;
}[] = [
  { key: "seed.loods", unit: "maand", qty: 6, budgetCents: 900000 },
  { key: "seed.vergunning", unit: "post", qty: 1, budgetCents: 250000 },
  { key: "seed.nutsvoorzieningen", unit: "post", qty: 1, budgetCents: 750000 },
  { key: "seed.verzekering", unit: "post", qty: 1, budgetCents: 180000 },
  { key: "seed.transport", unit: "post", qty: 1, budgetCents: 450000 },
  { key: "seed.personeel", unit: "post", qty: 1, budgetCents: 0 },
];

export function createProjectDocument(
  itemTypes: ItemType[],
  t: Translate,
): ProjectDocument {
  const projectId = newId("pr");
  const beachScene: Scene = {
    id: newId("sc"),
    projectId,
    kind: "beach",
    parentObjectId: null,
    name: t("seed.beachScene"),
    wMm: mToMm(DEFAULT_PLOT_W_M),
    hMm: mToMm(DEFAULT_PLOT_H_M),
  };

  const procurementLines: ProcurementLine[] = MANUAL_LINES.map((manual) => ({
    id: newId("pl"),
    projectId,
    itemTypeId: null,
    variant: null,
    title: t(manual.key),
    category: "overig",
    qtyPlanned: manual.qty,
    derived: false,
    budgetCents: manual.budgetCents,
    status: "nodig",
    unit: manual.unit,
    notes: null,
  }));

  return {
    project: {
      id: projectId,
      name: t("seed.projectName"),
      plotWMm: mToMm(DEFAULT_PLOT_W_M),
      plotHMm: mToMm(DEFAULT_PLOT_H_M),
      currency: "EUR",
      createdAt: nowIso(),
    },
    scenes: [beachScene],
    itemTypes,
    objects: [],
    procurementLines,
    suppliers: [],
    offertes: [],
    offerteLines: [],
    tasks: [],
  };
}

export const emptyDocument = (): ProjectDocument => ({
  project: {
    id: "",
    name: "",
    plotWMm: 0,
    plotHMm: 0,
    currency: "EUR",
    createdAt: "",
  },
  scenes: [],
  itemTypes: [],
  objects: [],
  procurementLines: [],
  suppliers: [],
  offertes: [],
  offerteLines: [],
  tasks: [],
});

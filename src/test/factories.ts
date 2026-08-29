import {
  type CabinStockLine,
  type ItemType,
  type Offerte,
  type OfferteLine,
  type PlanObject,
  type ProcurementLine,
  type ProjectDocument,
  type Scene,
  type Task,
} from "@/domain/types";
import { mToMm } from "@/lib/units";

export const barType: ItemType = {
  id: "it_bar",
  category: "gebouw",
  nameNl: "Strandbar",
  nameEn: "Beach bar",
  icon: "bar",
  shape: "rect",
  placement: "beach",
  defaultWMm: mToMm(12),
  defaultHMm: mToMm(5),
  resizable: true,
  hasInterior: true,
  unitPriceCents: 7500000,
  targetAreaM2: 60,
  colour: "#b58f57",
  image: null,
};

export const chairType: ItemType = {
  id: "it_stoel",
  category: "meubilair",
  nameNl: "Stoel",
  nameEn: "Chair",
  icon: "chair",
  shape: "rect",
  placement: "both",
  defaultWMm: 500,
  defaultHMm: 500,
  resizable: false,
  hasInterior: false,
  unitPriceCents: 8000,
  targetAreaM2: null,
  colour: "#1d4249",
  image: null,
};

export const directorChairType: ItemType = {
  id: "it_regisseursstoel",
  category: "meubilair",
  nameNl: "Regisseursstoel aluminium",
  nameEn: "Aluminium director chair",
  icon: "chair",
  shape: "rect",
  placement: "beach",
  defaultWMm: 550,
  defaultHMm: 540,
  resizable: false,
  hasInterior: false,
  unitPriceCents: 9500,
  targetAreaM2: null,
  colour: "#8b9aa0",
  image: null,
};

export const cabinType: ItemType = {
  id: "it_cabine",
  category: "cabine",
  nameNl: "Strandcabine",
  nameEn: "Beach cabin",
  icon: "cabin",
  shape: "rect",
  placement: "beach",
  defaultWMm: mToMm(2),
  defaultHMm: mToMm(2),
  resizable: true,
  hasInterior: false,
  unitPriceCents: 145000,
  targetAreaM2: null,
  colour: "#43b6ba",
  image: null,
};

export const beach: Scene = {
  id: "sc_beach",
  projectId: "pr_1",
  kind: "beach",
  parentObjectId: null,
  name: "Strand",
  wMm: mToMm(60),
  hMm: mToMm(70),
};

export function makeObject(
  overrides: Partial<PlanObject> & Pick<PlanObject, "id" | "itemTypeId">,
): PlanObject {
  return {
    sceneId: beach.id,
    variant: null,
    xMm: 0,
    yMm: 0,
    wMm: mToMm(2),
    hMm: mToMm(2),
    rotationDeg: 0,
    status: "nodig",
    procurementLineId: null,
    label: null,
    notes: null,
    locked: false,
    ...overrides,
  };
}

export function makeDocument(
  overrides: Partial<ProjectDocument> = {},
): ProjectDocument {
  return {
    project: {
      id: "pr_1",
      name: "Strandpaviljoen",
      plotWMm: mToMm(60),
      plotHMm: mToMm(70),
      currency: "EUR",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    scenes: [beach],
    itemTypes: [barType, cabinType, chairType, directorChairType],
    objects: [],
    procurementLines: [],
    suppliers: [],
    offertes: [],
    offerteLines: [],
    tasks: [],
    cabinStock: [],
    ...overrides,
  };
}

export function makeLine(
  overrides: Partial<ProcurementLine> & Pick<ProcurementLine, "id" | "title">,
): ProcurementLine {
  return {
    projectId: "pr_1",
    itemTypeId: null,
    variant: null,
    category: "overig",
    qtyPlanned: 1,
    derived: false,
    budgetCents: 0,
    status: "nodig",
    unit: "post",
    notes: null,
    ...overrides,
  };
}

export function makeOfferte(
  overrides: Partial<Offerte> & Pick<Offerte, "id">,
): Offerte {
  return {
    projectId: "pr_1",
    supplierId: null,
    reference: "",
    status: "ontvangen",
    requestedAt: null,
    receivedAt: null,
    validUntil: null,
    filePath: null,
    notes: null,
    ...overrides,
  };
}

export function makeOfferteLine(
  overrides: Partial<OfferteLine> & Pick<OfferteLine, "id" | "offerteId">,
): OfferteLine {
  return {
    procurementLineId: null,
    description: "",
    qty: 1,
    unitPriceCents: 0,
    vatPct: 21,
    ...overrides,
  };
}

export function makeCabinStock(
  overrides: Partial<CabinStockLine> & Pick<CabinStockLine, "id" | "cabinId">,
): CabinStockLine {
  return {
    itemTypeId: chairType.id,
    title: "Stoel",
    qtyNeeded: 2,
    qtyReady: 0,
    sortOrder: 0,
    ...overrides,
  };
}

export function makeTask(
  overrides: Partial<Task> & Pick<Task, "id" | "title">,
): Task {
  return {
    projectId: "pr_1",
    procurementLineId: null,
    status: "open",
    dueDate: null,
    assignee: null,
    notes: null,
    sortOrder: 0,
    auto: false,
    ...overrides,
  };
}

/** Canonical unit in the whole model is the millimetre (integer). */
export type Mm = number;

export const STATUSES = [
  "nodig",
  "offerte_aangevraagd",
  "offerte_ontvangen",
  "besteld",
  "geleverd",
  "gebouwd",
  "vervallen",
] as const;

export type Status = (typeof STATUSES)[number];

export const CATEGORIES = [
  "gebouw",
  "cabine",
  "meubilair",
  "parasol",
  "techniek",
  "terrein",
  "groen",
  "interieur",
  "overig",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Which scene kind an item type may be placed in. */
export type Placement = "beach" | "interior" | "both";

export type SceneKind = "beach" | "interior";

export type Shape = "rect" | "circle";

export interface Project {
  id: string;
  name: string;
  plotWMm: Mm;
  plotHMm: Mm;
  currency: string;
  createdAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  kind: SceneKind;
  parentObjectId: string | null;
  name: string;
  wMm: Mm;
  hMm: Mm;
}

export interface ItemType {
  id: string;
  category: Category;
  nameNl: string;
  nameEn: string;
  icon: string;
  shape: Shape;
  placement: Placement;
  defaultWMm: Mm;
  defaultHMm: Mm;
  resizable: boolean;
  hasInterior: boolean;
  /** Indicative unit price in cents, used as budget seed. */
  unitPriceCents: number;
  /** Target footprint in m2, e.g. 60 for the bar. Null when not applicable. */
  targetAreaM2: number | null;
  colour: string;
  /** Public path to a top-down plan image, e.g. `catalog/it_stoel.webp`. */
  image: string | null;
}

export interface PlanObject {
  id: string;
  sceneId: string;
  itemTypeId: string;
  variant: string | null;
  xMm: Mm;
  yMm: Mm;
  wMm: Mm;
  hMm: Mm;
  rotationDeg: number;
  status: Status;
  procurementLineId: string | null;
  label: string | null;
  notes: string | null;
  locked: boolean;
}

export interface ProcurementLine {
  id: string;
  projectId: string;
  /** Null for manual lines that are not drawn on the plan (loods, vergunningen). */
  itemTypeId: string | null;
  variant: string | null;
  title: string;
  category: Category;
  qtyPlanned: number;
  /** True when quantity is derived from the objects on the plan. */
  derived: boolean;
  budgetCents: number;
  status: Status;
  notes: string | null;
  unit: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export type OfferteStatus =
  | "aangevraagd"
  | "ontvangen"
  | "gekozen"
  | "afgewezen";

export interface Offerte {
  id: string;
  projectId: string;
  supplierId: string | null;
  reference: string;
  status: OfferteStatus;
  requestedAt: string | null;
  receivedAt: string | null;
  validUntil: string | null;
  filePath: string | null;
  notes: string | null;
}

export interface OfferteLine {
  id: string;
  offerteId: string;
  procurementLineId: string | null;
  description: string;
  qty: number;
  unitPriceCents: number;
  vatPct: number;
}

export type TaskStatus = "open" | "bezig" | "wacht" | "klaar";

export interface Task {
  id: string;
  projectId: string;
  procurementLineId: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  assignee: string | null;
  notes: string | null;
  sortOrder: number;
  auto: boolean;
}

/** Everything the app keeps in memory for the active project. */
export interface ProjectDocument {
  project: Project;
  scenes: Scene[];
  itemTypes: ItemType[];
  objects: PlanObject[];
  procurementLines: ProcurementLine[];
  suppliers: Supplier[];
  offertes: Offerte[];
  offerteLines: OfferteLine[];
  tasks: Task[];
}

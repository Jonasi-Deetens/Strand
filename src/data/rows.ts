import {
  type Category,
  type ItemType,
  type Offerte,
  type OfferteLine,
  type OfferteStatus,
  type Placement,
  type PlanObject,
  type ProcurementLine,
  type Project,
  type Scene,
  type SceneKind,
  type Shape,
  type Status,
  type Supplier,
  type Task,
  type TaskStatus,
} from "@/domain/types";

const bool = (value: unknown): boolean => value === 1 || value === true;
const flag = (value: boolean): number => (value ? 1 : 0);

export interface ProjectRow {
  id: string;
  name: string;
  plot_w_mm: number;
  plot_h_mm: number;
  currency: string;
  created_at: string;
}

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  plotWMm: row.plot_w_mm,
  plotHMm: row.plot_h_mm,
  currency: row.currency,
  createdAt: row.created_at,
});

export interface SceneRow {
  id: string;
  project_id: string;
  kind: SceneKind;
  parent_object_id: string | null;
  name: string;
  w_mm: number;
  h_mm: number;
}

export const toScene = (row: SceneRow): Scene => ({
  id: row.id,
  projectId: row.project_id,
  kind: row.kind,
  parentObjectId: row.parent_object_id,
  name: row.name,
  wMm: row.w_mm,
  hMm: row.h_mm,
});

export interface ItemTypeRow {
  id: string;
  category: Category;
  name_nl: string;
  name_en: string;
  icon: string;
  shape: Shape;
  placement: Placement;
  default_w_mm: number;
  default_h_mm: number;
  resizable: number;
  has_interior: number;
  unit_price_cents: number;
  target_area_m2: number | null;
  colour: string;
  image: string | null;
}

export const toItemType = (row: ItemTypeRow): ItemType => ({
  id: row.id,
  category: row.category,
  nameNl: row.name_nl,
  nameEn: row.name_en,
  icon: row.icon,
  shape: row.shape,
  placement: row.placement,
  defaultWMm: row.default_w_mm,
  defaultHMm: row.default_h_mm,
  resizable: bool(row.resizable),
  hasInterior: bool(row.has_interior),
  unitPriceCents: row.unit_price_cents,
  targetAreaM2: row.target_area_m2,
  colour: row.colour,
  image: row.image,
});

export interface ObjectRow {
  id: string;
  scene_id: string;
  item_type_id: string;
  variant: string | null;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rotation_deg: number;
  status: Status;
  procurement_line_id: string | null;
  label: string | null;
  notes: string | null;
  locked: number;
}

export const toObject = (row: ObjectRow): PlanObject => ({
  id: row.id,
  sceneId: row.scene_id,
  itemTypeId: row.item_type_id,
  variant: row.variant,
  xMm: row.x_mm,
  yMm: row.y_mm,
  wMm: row.w_mm,
  hMm: row.h_mm,
  rotationDeg: row.rotation_deg,
  status: row.status,
  procurementLineId: row.procurement_line_id,
  label: row.label,
  notes: row.notes,
  locked: bool(row.locked),
});

export interface ProcurementLineRow {
  id: string;
  project_id: string;
  item_type_id: string | null;
  variant: string | null;
  title: string;
  category: Category;
  qty_planned: number;
  derived: number;
  budget_cents: number;
  status: Status;
  unit: string;
  notes: string | null;
}

export const toProcurementLine = (row: ProcurementLineRow): ProcurementLine => ({
  id: row.id,
  projectId: row.project_id,
  itemTypeId: row.item_type_id,
  variant: row.variant,
  title: row.title,
  category: row.category,
  qtyPlanned: row.qty_planned,
  derived: bool(row.derived),
  budgetCents: row.budget_cents,
  status: row.status,
  unit: row.unit,
  notes: row.notes,
});

export interface SupplierRow {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export const toSupplier = (row: SupplierRow): Supplier => ({ ...row });

export interface OfferteRow {
  id: string;
  project_id: string;
  supplier_id: string | null;
  reference: string;
  status: OfferteStatus;
  requested_at: string | null;
  received_at: string | null;
  valid_until: string | null;
  file_path: string | null;
  notes: string | null;
}

export const toOfferte = (row: OfferteRow): Offerte => ({
  id: row.id,
  projectId: row.project_id,
  supplierId: row.supplier_id,
  reference: row.reference,
  status: row.status,
  requestedAt: row.requested_at,
  receivedAt: row.received_at,
  validUntil: row.valid_until,
  filePath: row.file_path,
  notes: row.notes,
});

export interface OfferteLineRow {
  id: string;
  offerte_id: string;
  procurement_line_id: string | null;
  description: string;
  qty: number;
  unit_price_cents: number;
  vat_pct: number;
}

export const toOfferteLine = (row: OfferteLineRow): OfferteLine => ({
  id: row.id,
  offerteId: row.offerte_id,
  procurementLineId: row.procurement_line_id,
  description: row.description,
  qty: row.qty,
  unitPriceCents: row.unit_price_cents,
  vatPct: row.vat_pct,
});

export interface TaskRow {
  id: string;
  project_id: string;
  procurement_line_id: string | null;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  assignee: string | null;
  notes: string | null;
  sort_order: number;
  auto: number;
}

export const toTask = (row: TaskRow): Task => ({
  id: row.id,
  projectId: row.project_id,
  procurementLineId: row.procurement_line_id,
  title: row.title,
  status: row.status,
  dueDate: row.due_date,
  assignee: row.assignee,
  notes: row.notes,
  sortOrder: row.sort_order,
  auto: bool(row.auto),
});

export { bool, flag };

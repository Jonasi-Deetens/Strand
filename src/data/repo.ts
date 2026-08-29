import { type SqlDriver, type SqlStatement } from "./driver";
import {
  flag,
  toItemType,
  toObject,
  toOfferte,
  toOfferteLine,
  toProcurementLine,
  toProject,
  toScene,
  toSupplier,
  toTask,
  type ItemTypeRow,
  type ObjectRow,
  type OfferteLineRow,
  type OfferteRow,
  type ProcurementLineRow,
  type ProjectRow,
  type SceneRow,
  type SupplierRow,
  type TaskRow,
} from "./rows";
import {
  type ItemType,
  type Offerte,
  type OfferteLine,
  type PlanObject,
  type ProcurementLine,
  type Project,
  type ProjectDocument,
  type Scene,
  type Supplier,
  type Task,
} from "@/domain/types";

/**
 * The whole project is small enough (hundreds of rows) to keep in memory, so
 * the app loads it once and writes through on every mutation. Reads never hit
 * SQL again, which keeps the canvas at 60fps.
 */
export async function loadDocument(
  driver: SqlDriver,
  projectId: string,
): Promise<ProjectDocument | null> {
  const [projectRow] = await driver.select<ProjectRow>(
    "SELECT * FROM projects WHERE id = $1",
    [projectId],
  );
  if (!projectRow) return null;

  const [
    scenes,
    itemTypes,
    objects,
    lines,
    suppliers,
    offertes,
    offerteLines,
    tasks,
  ] = await Promise.all([
    // 'beach' sorts before 'interior', which keeps the beach scene first.
    driver.select<SceneRow>(
      "SELECT * FROM scenes WHERE project_id = $1 ORDER BY kind, name",
      [projectId],
    ),
    driver.select<ItemTypeRow>(
      "SELECT * FROM item_types ORDER BY category, name_nl",
    ),
    driver.select<ObjectRow>(
      "SELECT o.* FROM objects o JOIN scenes s ON s.id = o.scene_id WHERE s.project_id = $1",
      [projectId],
    ),
    driver.select<ProcurementLineRow>(
      "SELECT * FROM procurement_lines WHERE project_id = $1",
      [projectId],
    ),
    driver.select<SupplierRow>("SELECT * FROM suppliers ORDER BY name"),
    driver.select<OfferteRow>("SELECT * FROM offertes WHERE project_id = $1", [
      projectId,
    ]),
    driver.select<OfferteLineRow>(
      "SELECT ol.* FROM offerte_lines ol JOIN offertes q ON q.id = ol.offerte_id WHERE q.project_id = $1",
      [projectId],
    ),
    driver.select<TaskRow>(
      "SELECT * FROM tasks WHERE project_id = $1 ORDER BY sort_order",
      [projectId],
    ),
  ]);

  return {
    project: toProject(projectRow),
    scenes: scenes.map(toScene),
    itemTypes: itemTypes.map(toItemType),
    objects: objects.map(toObject),
    procurementLines: lines.map(toProcurementLine),
    suppliers: suppliers.map(toSupplier),
    offertes: offertes.map(toOfferte),
    offerteLines: offerteLines.map(toOfferteLine),
    tasks: tasks.map(toTask),
  };
}

export async function findFirstProjectId(
  driver: SqlDriver,
): Promise<string | null> {
  const rows = await driver.select<{ id: string }>(
    "SELECT id FROM projects ORDER BY created_at LIMIT 1",
  );
  return rows[0]?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Statement builders. The store batches these so one user action is one write. */
/* -------------------------------------------------------------------------- */

export const upsertProject = (project: Project): SqlStatement => ({
  sql: `INSERT INTO projects (id, name, plot_w_mm, plot_h_mm, currency, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          plot_w_mm = excluded.plot_w_mm,
          plot_h_mm = excluded.plot_h_mm,
          currency = excluded.currency`,
  params: [
    project.id,
    project.name,
    project.plotWMm,
    project.plotHMm,
    project.currency,
    project.createdAt,
  ],
});

export const upsertScene = (scene: Scene): SqlStatement => ({
  sql: `INSERT INTO scenes (id, project_id, kind, parent_object_id, name, w_mm, h_mm)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          parent_object_id = excluded.parent_object_id,
          w_mm = excluded.w_mm,
          h_mm = excluded.h_mm`,
  params: [
    scene.id,
    scene.projectId,
    scene.kind,
    scene.parentObjectId,
    scene.name,
    scene.wMm,
    scene.hMm,
  ],
});

export const deleteScene = (id: string): SqlStatement => ({
  sql: "DELETE FROM scenes WHERE id = $1",
  params: [id],
});

export const upsertItemType = (itemType: ItemType): SqlStatement => ({
  sql: `INSERT INTO item_types (id, category, name_nl, name_en, icon, shape, placement,
          default_w_mm, default_h_mm, resizable, has_interior, unit_price_cents,
          target_area_m2, colour, image)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          name_nl = excluded.name_nl,
          name_en = excluded.name_en,
          icon = excluded.icon,
          shape = excluded.shape,
          placement = excluded.placement,
          default_w_mm = excluded.default_w_mm,
          default_h_mm = excluded.default_h_mm,
          resizable = excluded.resizable,
          has_interior = excluded.has_interior,
          unit_price_cents = excluded.unit_price_cents,
          target_area_m2 = excluded.target_area_m2,
          colour = excluded.colour,
          image = excluded.image`,
  params: [
    itemType.id,
    itemType.category,
    itemType.nameNl,
    itemType.nameEn,
    itemType.icon,
    itemType.shape,
    itemType.placement,
    itemType.defaultWMm,
    itemType.defaultHMm,
    flag(itemType.resizable),
    flag(itemType.hasInterior),
    itemType.unitPriceCents,
    itemType.targetAreaM2,
    itemType.colour,
    itemType.image,
  ],
});

export const deleteItemType = (id: string): SqlStatement => ({
  sql: "DELETE FROM item_types WHERE id = $1",
  params: [id],
});

export const upsertObject = (object: PlanObject): SqlStatement => ({
  sql: `INSERT INTO objects (id, scene_id, item_type_id, variant, x_mm, y_mm, w_mm, h_mm,
          rotation_deg, status, procurement_line_id, label, notes, locked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT(id) DO UPDATE SET
          variant = excluded.variant,
          x_mm = excluded.x_mm,
          y_mm = excluded.y_mm,
          w_mm = excluded.w_mm,
          h_mm = excluded.h_mm,
          rotation_deg = excluded.rotation_deg,
          status = excluded.status,
          procurement_line_id = excluded.procurement_line_id,
          label = excluded.label,
          notes = excluded.notes,
          locked = excluded.locked`,
  params: [
    object.id,
    object.sceneId,
    object.itemTypeId,
    object.variant,
    object.xMm,
    object.yMm,
    object.wMm,
    object.hMm,
    object.rotationDeg,
    object.status,
    object.procurementLineId,
    object.label,
    object.notes,
    flag(object.locked),
  ],
});

export const deleteObject = (id: string): SqlStatement => ({
  sql: "DELETE FROM objects WHERE id = $1",
  params: [id],
});

export const upsertProcurementLine = (line: ProcurementLine): SqlStatement => ({
  sql: `INSERT INTO procurement_lines (id, project_id, item_type_id, variant, title,
          category, qty_planned, derived, budget_cents, status, unit, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT(id) DO UPDATE SET
          variant = excluded.variant,
          title = excluded.title,
          category = excluded.category,
          qty_planned = excluded.qty_planned,
          derived = excluded.derived,
          budget_cents = excluded.budget_cents,
          status = excluded.status,
          unit = excluded.unit,
          notes = excluded.notes`,
  params: [
    line.id,
    line.projectId,
    line.itemTypeId,
    line.variant,
    line.title,
    line.category,
    line.qtyPlanned,
    flag(line.derived),
    line.budgetCents,
    line.status,
    line.unit,
    line.notes,
  ],
});

export const deleteProcurementLine = (id: string): SqlStatement => ({
  sql: "DELETE FROM procurement_lines WHERE id = $1",
  params: [id],
});

export const upsertSupplier = (supplier: Supplier): SqlStatement => ({
  sql: `INSERT INTO suppliers (id, name, contact, email, phone, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          contact = excluded.contact,
          email = excluded.email,
          phone = excluded.phone,
          notes = excluded.notes`,
  params: [
    supplier.id,
    supplier.name,
    supplier.contact,
    supplier.email,
    supplier.phone,
    supplier.notes,
  ],
});

export const deleteSupplier = (id: string): SqlStatement => ({
  sql: "DELETE FROM suppliers WHERE id = $1",
  params: [id],
});

export const upsertOfferte = (offerte: Offerte): SqlStatement => ({
  sql: `INSERT INTO offertes (id, project_id, supplier_id, reference, status,
          requested_at, received_at, valid_until, file_path, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(id) DO UPDATE SET
          supplier_id = excluded.supplier_id,
          reference = excluded.reference,
          status = excluded.status,
          requested_at = excluded.requested_at,
          received_at = excluded.received_at,
          valid_until = excluded.valid_until,
          file_path = excluded.file_path,
          notes = excluded.notes`,
  params: [
    offerte.id,
    offerte.projectId,
    offerte.supplierId,
    offerte.reference,
    offerte.status,
    offerte.requestedAt,
    offerte.receivedAt,
    offerte.validUntil,
    offerte.filePath,
    offerte.notes,
  ],
});

export const deleteOfferte = (id: string): SqlStatement => ({
  sql: "DELETE FROM offertes WHERE id = $1",
  params: [id],
});

export const upsertOfferteLine = (line: OfferteLine): SqlStatement => ({
  sql: `INSERT INTO offerte_lines (id, offerte_id, procurement_line_id, description,
          qty, unit_price_cents, vat_pct)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(id) DO UPDATE SET
          procurement_line_id = excluded.procurement_line_id,
          description = excluded.description,
          qty = excluded.qty,
          unit_price_cents = excluded.unit_price_cents,
          vat_pct = excluded.vat_pct`,
  params: [
    line.id,
    line.offerteId,
    line.procurementLineId,
    line.description,
    line.qty,
    line.unitPriceCents,
    line.vatPct,
  ],
});

export const deleteOfferteLine = (id: string): SqlStatement => ({
  sql: "DELETE FROM offerte_lines WHERE id = $1",
  params: [id],
});

export const upsertTask = (task: Task): SqlStatement => ({
  sql: `INSERT INTO tasks (id, project_id, procurement_line_id, title, status,
          due_date, assignee, notes, sort_order, auto)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(id) DO UPDATE SET
          procurement_line_id = excluded.procurement_line_id,
          title = excluded.title,
          status = excluded.status,
          due_date = excluded.due_date,
          assignee = excluded.assignee,
          notes = excluded.notes,
          sort_order = excluded.sort_order,
          auto = excluded.auto`,
  params: [
    task.id,
    task.projectId,
    task.procurementLineId,
    task.title,
    task.status,
    task.dueDate,
    task.assignee,
    task.notes,
    task.sortOrder,
    flag(task.auto),
  ],
});

export const deleteTask = (id: string): SqlStatement => ({
  sql: "DELETE FROM tasks WHERE id = $1",
  params: [id],
});

/** Writes an entire document, used by project import. */
export function documentStatements(doc: ProjectDocument): SqlStatement[] {
  return [
    upsertProject(doc.project),
    ...doc.itemTypes.map(upsertItemType),
    ...doc.scenes.map(upsertScene),
    ...doc.procurementLines.map(upsertProcurementLine),
    ...doc.objects.map(upsertObject),
    ...doc.suppliers.map(upsertSupplier),
    ...doc.offertes.map(upsertOfferte),
    ...doc.offerteLines.map(upsertOfferteLine),
    ...doc.tasks.map(upsertTask),
  ];
}

export function clearProjectStatements(projectId: string): SqlStatement[] {
  return [
    {
      sql: "DELETE FROM offerte_lines WHERE offerte_id IN (SELECT id FROM offertes WHERE project_id = $1)",
      params: [projectId],
    },
    { sql: "DELETE FROM offertes WHERE project_id = $1", params: [projectId] },
    { sql: "DELETE FROM tasks WHERE project_id = $1", params: [projectId] },
    {
      sql: "DELETE FROM objects WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = $1)",
      params: [projectId],
    },
    {
      sql: "DELETE FROM procurement_lines WHERE project_id = $1",
      params: [projectId],
    },
    { sql: "DELETE FROM scenes WHERE project_id = $1", params: [projectId] },
    { sql: "DELETE FROM projects WHERE id = $1", params: [projectId] },
  ];
}

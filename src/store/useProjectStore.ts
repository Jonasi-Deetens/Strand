import { create } from "zustand";
import { getDriver, type SqlDriver, type SqlStatement } from "@/data/driver";
import { diffDocuments } from "@/data/diff";
import {
  documentStatements,
  findFirstProjectId,
  loadDocument,
} from "@/data/repo";
import { type ItemTypeRow } from "@/data/rows";
import { toItemType } from "@/data/rows";
import { createProjectDocument, type Translate } from "@/domain/bootstrap";
import { syncDerived } from "@/domain/sync";
import { nextStatus } from "@/domain/status";
import { type Lang } from "@/domain/naming";
import {
  type ItemType,
  type Offerte,
  type OfferteLine,
  type PlanObject,
  type ProcurementLine,
  type Project,
  type ProjectDocument,
  type Scene,
  type Status,
  type Supplier,
  type Task,
} from "@/domain/types";
import { newId } from "@/lib/id";
import { areaM2, clamp, snapMm } from "@/lib/units";
import { DEFAULT_VAT_PCT } from "@/lib/money";

const HISTORY_LIMIT = 60;

type LoadState = "idle" | "loading" | "ready" | "error";

interface CommitOptions {
  history?: boolean;
  /** Skips the derived procurement/task sync for pure UI-ish edits. */
  skipSync?: boolean;
}

export interface NewObjectInput {
  sceneId: string;
  itemTypeId: string;
  xMm: number;
  yMm: number;
  wMm?: number;
  hMm?: number;
  rotationDeg?: number;
  variant?: string | null;
  status?: Status;
}

interface ProjectState {
  loadState: LoadState;
  error: string | null;
  doc: ProjectDocument | null;
  lang: Lang;
  past: ProjectDocument[];
  future: ProjectDocument[];
  driver: SqlDriver | null;
  pending: SqlStatement[];

  init: (t: Translate, lang: Lang) => Promise<void>;
  setLang: (lang: Lang) => void;
  flush: () => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  beginInteraction: () => void;
  endInteraction: () => void;

  addObject: (input: NewObjectInput) => string | null;
  addObjects: (inputs: NewObjectInput[]) => string[];
  updateObject: (
    id: string,
    patch: Partial<PlanObject>,
    options?: CommitOptions,
  ) => void;
  updateObjects: (
    ids: string[],
    patch: Partial<PlanObject>,
    options?: CommitOptions,
  ) => void;
  moveObjects: (ids: string[], dxMm: number, dyMm: number) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[], offsetMm?: number) => string[];
  cycleObjectStatus: (ids: string[]) => void;
  raiseObjects: (ids: string[], direction: 1 | -1) => void;

  ensureInteriorScene: (objectId: string) => string | null;
  updateProject: (patch: Partial<Project>) => void;

  addManualLine: (line: Partial<ProcurementLine>) => string;
  updateLine: (id: string, patch: Partial<ProcurementLine>) => void;
  removeLine: (id: string) => void;
  setLineStatus: (id: string, status: Status) => void;

  addItemType: (itemType: Partial<ItemType>) => string;
  updateItemType: (id: string, patch: Partial<ItemType>) => void;
  removeItemType: (id: string) => void;

  addSupplier: (supplier: Partial<Supplier>) => string;
  updateSupplier: (id: string, patch: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;

  addOfferte: (offerte: Partial<Offerte>) => string;
  updateOfferte: (id: string, patch: Partial<Offerte>) => void;
  removeOfferte: (id: string) => void;
  chooseOfferte: (id: string) => void;
  addOfferteLine: (offerteId: string, line?: Partial<OfferteLine>) => string;
  updateOfferteLine: (id: string, patch: Partial<OfferteLine>) => void;
  removeOfferteLine: (id: string) => void;

  addTask: (task: Partial<Task>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;

  replaceDocument: (doc: ProjectDocument) => Promise<void>;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectStore = create<ProjectState>((set, get) => {
  /** Applies a new document: history, state, and the SQL write queue. */
  const commit = (next: ProjectDocument, options: CommitOptions = {}) => {
    const { doc, past, driver, pending, lang } = get();
    if (!doc) return;
    const synced = options.skipSync ? next : syncDerived(next, lang);
    const statements = diffDocuments(doc, synced);
    const interacting = interactionSnapshot !== null;
    const recordHistory = options.history !== false && !interacting;

    set({
      doc: synced,
      past: recordHistory
        ? [...past, doc].slice(-HISTORY_LIMIT)
        : past,
      future: recordHistory ? [] : get().future,
      pending: [...pending, ...statements],
    });

    if (driver && statements.length > 0) scheduleFlush();
  };

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => void get().flush(), 200);
  };

  let interactionSnapshot: ProjectDocument | null = null;

  const restore = (target: ProjectDocument) => {
    const { doc, driver, pending } = get();
    if (!doc) return;
    const statements = diffDocuments(doc, target);
    set({ doc: target, pending: [...pending, ...statements] });
    if (driver && statements.length > 0) scheduleFlush();
  };

  const requireDoc = (): ProjectDocument | null => get().doc;

  return {
    loadState: "idle",
    error: null,
    doc: null,
    lang: "nl",
    past: [],
    future: [],
    driver: null,
    pending: [],

    async init(t, lang) {
      if (get().loadState === "loading" || get().loadState === "ready") return;
      set({ loadState: "loading", lang });
      try {
        const driver = await getDriver();
        set({ driver });
        const existingId = await findFirstProjectId(driver);
        if (existingId) {
          const doc = await loadDocument(driver, existingId);
          if (!doc) throw new Error("project row disappeared");
          set({ doc, loadState: "ready", error: null });
          return;
        }
        const itemTypeRows = await driver.select<ItemTypeRow>(
          "SELECT * FROM item_types ORDER BY category, name_nl",
        );
        const fresh = createProjectDocument(itemTypeRows.map(toItemType), t);
        await driver.batch(documentStatements(fresh));
        await driver.flush();
        set({ doc: fresh, loadState: "ready", error: null });
      } catch (error) {
        set({ loadState: "error", error: String(error) });
      }
    },

    setLang(lang) {
      set({ lang });
    },

    async flush() {
      const { driver, pending } = get();
      if (!driver || pending.length === 0) return;
      set({ pending: [] });
      try {
        await driver.batch(pending);
        await driver.flush();
      } catch (error) {
        console.error("Strand: write failed", error);
      }
    },

    undo() {
      const { past, future, doc } = get();
      const previous = past[past.length - 1];
      if (!previous || !doc) return;
      set({ past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT) });
      restore(previous);
    },

    redo() {
      const { past, future, doc } = get();
      const next = future[0];
      if (!next || !doc) return;
      set({ past: [...past, doc].slice(-HISTORY_LIMIT), future: future.slice(1) });
      restore(next);
    },

    canUndo() {
      return get().past.length > 0;
    },

    canRedo() {
      return get().future.length > 0;
    },

    beginInteraction() {
      interactionSnapshot = get().doc;
    },

    endInteraction() {
      const snapshot = interactionSnapshot;
      interactionSnapshot = null;
      const { doc, past } = get();
      if (!snapshot || !doc || snapshot === doc) return;
      set({ past: [...past, snapshot].slice(-HISTORY_LIMIT), future: [] });
    },

    addObject(input) {
      const ids = get().addObjects([input]);
      return ids[0] ?? null;
    },

    addObjects(inputs) {
      const doc = requireDoc();
      if (!doc || inputs.length === 0) return [];
      const created: PlanObject[] = [];
      for (const input of inputs) {
        const itemType = doc.itemTypes.find((it) => it.id === input.itemTypeId);
        const scene = doc.scenes.find((s) => s.id === input.sceneId);
        if (!itemType || !scene) continue;
        const wMm = input.wMm ?? itemType.defaultWMm;
        const hMm = input.hMm ?? itemType.defaultHMm;
        created.push({
          id: newId("ob"),
          sceneId: scene.id,
          itemTypeId: itemType.id,
          variant: input.variant ?? null,
          xMm: snapMm(clamp(input.xMm, 0, Math.max(0, scene.wMm - wMm))),
          yMm: snapMm(clamp(input.yMm, 0, Math.max(0, scene.hMm - hMm))),
          wMm,
          hMm,
          rotationDeg: input.rotationDeg ?? 0,
          status: input.status ?? "nodig",
          procurementLineId: null,
          label: null,
          notes: null,
          locked: false,
        });
      }
      if (created.length === 0) return [];
      commit({ ...doc, objects: [...doc.objects, ...created] });
      return created.map((object) => object.id);
    },

    updateObject(id, patch, options) {
      get().updateObjects([id], patch, options);
    },

    updateObjects(ids, patch, options) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return;
      const idSet = new Set(ids);
      const objects = doc.objects.map((object) =>
        idSet.has(object.id) ? { ...object, ...patch } : object,
      );
      commit({ ...doc, objects }, options);
    },

    moveObjects(ids, dxMm, dyMm) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return;
      const idSet = new Set(ids);
      const sceneById = new Map(doc.scenes.map((scene) => [scene.id, scene]));
      const objects = doc.objects.map((object) => {
        if (!idSet.has(object.id) || object.locked) return object;
        const scene = sceneById.get(object.sceneId);
        const maxX = scene ? Math.max(0, scene.wMm - object.wMm) : Infinity;
        const maxY = scene ? Math.max(0, scene.hMm - object.hMm) : Infinity;
        return {
          ...object,
          xMm: snapMm(clamp(object.xMm + dxMm, 0, maxX)),
          yMm: snapMm(clamp(object.yMm + dyMm, 0, maxY)),
        };
      });
      commit({ ...doc, objects });
    },

    removeObjects(ids) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return;
      const idSet = new Set(ids);
      // Interior scenes belong to their building; drop them with it.
      const removedScenes = new Set(
        doc.scenes
          .filter((s) => s.parentObjectId && idSet.has(s.parentObjectId))
          .map((s) => s.id),
      );
      commit({
        ...doc,
        objects: doc.objects.filter(
          (object) => !idSet.has(object.id) && !removedScenes.has(object.sceneId),
        ),
        scenes: doc.scenes.filter((scene) => !removedScenes.has(scene.id)),
      });
    },

    duplicateObjects(ids, offsetMm = 500) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return [];
      const idSet = new Set(ids);
      const copies = doc.objects
        .filter((object) => idSet.has(object.id))
        .map((object) => ({
          ...object,
          id: newId("ob"),
          xMm: object.xMm + offsetMm,
          yMm: object.yMm + offsetMm,
          procurementLineId: null,
        }));
      if (copies.length === 0) return [];
      commit({ ...doc, objects: [...doc.objects, ...copies] });
      return copies.map((copy) => copy.id);
    },

    cycleObjectStatus(ids) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return;
      const idSet = new Set(ids);
      const objects = doc.objects.map((object) =>
        idSet.has(object.id)
          ? { ...object, status: nextStatus(object.status) }
          : object,
      );
      commit({ ...doc, objects });
    },

    raiseObjects(ids, direction) {
      const doc = requireDoc();
      if (!doc || ids.length === 0) return;
      const objects = [...doc.objects];
      const indices = objects
        .map((object, index) => ({ object, index }))
        .filter(({ object }) => ids.includes(object.id))
        .map(({ index }) => index);
      const ordered = direction === 1 ? indices.reverse() : indices;
      for (const index of ordered) {
        const target = index + direction;
        if (target < 0 || target >= objects.length) continue;
        const a = objects[index]!;
        const b = objects[target]!;
        objects[index] = b;
        objects[target] = a;
      }
      commit({ ...doc, objects }, { skipSync: true });
    },

    ensureInteriorScene(objectId) {
      const doc = requireDoc();
      if (!doc) return null;
      const object = doc.objects.find((candidate) => candidate.id === objectId);
      if (!object) return null;
      const itemType = doc.itemTypes.find((it) => it.id === object.itemTypeId);
      if (!itemType?.hasInterior) return null;

      const existing = doc.scenes.find(
        (scene) => scene.parentObjectId === objectId,
      );
      if (existing) {
        if (existing.wMm !== object.wMm || existing.hMm !== object.hMm) {
          commit(
            {
              ...doc,
              scenes: doc.scenes.map((scene) =>
                scene.id === existing.id
                  ? { ...scene, wMm: object.wMm, hMm: object.hMm }
                  : scene,
              ),
            },
            { skipSync: true, history: false },
          );
        }
        return existing.id;
      }

      const scene: Scene = {
        id: newId("sc"),
        projectId: doc.project.id,
        kind: "interior",
        parentObjectId: objectId,
        name: object.label ?? itemType.nameNl,
        wMm: object.wMm,
        hMm: object.hMm,
      };
      commit({ ...doc, scenes: [...doc.scenes, scene] }, { skipSync: true });
      return scene.id;
    },

    updateProject(patch) {
      const doc = requireDoc();
      if (!doc) return;
      const project = { ...doc.project, ...patch };
      const scenes = doc.scenes.map((scene) =>
        scene.kind === "beach"
          ? { ...scene, wMm: project.plotWMm, hMm: project.plotHMm }
          : scene,
      );
      commit({ ...doc, project, scenes }, { skipSync: true });
    },

    addManualLine(partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const line: ProcurementLine = {
        id: newId("pl"),
        projectId: doc.project.id,
        itemTypeId: null,
        variant: null,
        title: partial.title ?? "",
        category: partial.category ?? "overig",
        qtyPlanned: partial.qtyPlanned ?? 1,
        derived: false,
        budgetCents: partial.budgetCents ?? 0,
        status: partial.status ?? "nodig",
        unit: partial.unit ?? "post",
        notes: partial.notes ?? null,
      };
      commit({ ...doc, procurementLines: [...doc.procurementLines, line] });
      return line.id;
    },

    updateLine(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        procurementLines: doc.procurementLines.map((line) =>
          line.id === id ? { ...line, ...patch } : line,
        ),
      });
    },

    removeLine(id) {
      const doc = requireDoc();
      if (!doc) return;
      const line = doc.procurementLines.find((candidate) => candidate.id === id);
      if (!line || line.derived) return;
      commit({
        ...doc,
        procurementLines: doc.procurementLines.filter(
          (candidate) => candidate.id !== id,
        ),
        tasks: doc.tasks.filter((task) => task.procurementLineId !== id),
        offerteLines: doc.offerteLines.map((offerteLine) =>
          offerteLine.procurementLineId === id
            ? { ...offerteLine, procurementLineId: null }
            : offerteLine,
        ),
      });
    },

    setLineStatus(id, status) {
      const doc = requireDoc();
      if (!doc) return;
      const line = doc.procurementLines.find((candidate) => candidate.id === id);
      if (!line) return;
      if (!line.derived) {
        get().updateLine(id, { status });
        return;
      }
      // Derived lines take their status from their objects, so push it down.
      const objects = doc.objects.map((object) =>
        object.procurementLineId === id ? { ...object, status } : object,
      );
      commit({ ...doc, objects });
    },

    addItemType(partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const itemType: ItemType = {
        id: newId("it"),
        category: partial.category ?? "overig",
        nameNl: partial.nameNl ?? "",
        nameEn: partial.nameEn ?? partial.nameNl ?? "",
        icon: partial.icon ?? "box",
        shape: partial.shape ?? "rect",
        placement: partial.placement ?? "beach",
        defaultWMm: partial.defaultWMm ?? 1000,
        defaultHMm: partial.defaultHMm ?? 1000,
        resizable: partial.resizable ?? true,
        hasInterior: partial.hasInterior ?? false,
        unitPriceCents: partial.unitPriceCents ?? 0,
        targetAreaM2: partial.targetAreaM2 ?? null,
        colour: partial.colour ?? "#43b6ba",
      };
      commit({ ...doc, itemTypes: [...doc.itemTypes, itemType] });
      return itemType.id;
    },

    updateItemType(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        itemTypes: doc.itemTypes.map((itemType) =>
          itemType.id === id ? { ...itemType, ...patch } : itemType,
        ),
      });
    },

    removeItemType(id) {
      const doc = requireDoc();
      if (!doc) return;
      if (doc.objects.some((object) => object.itemTypeId === id)) return;
      commit({
        ...doc,
        itemTypes: doc.itemTypes.filter((itemType) => itemType.id !== id),
        procurementLines: doc.procurementLines.filter(
          (line) => line.itemTypeId !== id,
        ),
      });
    },

    addSupplier(partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const supplier: Supplier = {
        id: newId("su"),
        name: partial.name ?? "",
        contact: partial.contact ?? null,
        email: partial.email ?? null,
        phone: partial.phone ?? null,
        notes: partial.notes ?? null,
      };
      commit({ ...doc, suppliers: [...doc.suppliers, supplier] });
      return supplier.id;
    },

    updateSupplier(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        suppliers: doc.suppliers.map((supplier) =>
          supplier.id === id ? { ...supplier, ...patch } : supplier,
        ),
      });
    },

    removeSupplier(id) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        suppliers: doc.suppliers.filter((supplier) => supplier.id !== id),
        offertes: doc.offertes.map((offerte) =>
          offerte.supplierId === id ? { ...offerte, supplierId: null } : offerte,
        ),
      });
    },

    addOfferte(partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const offerte: Offerte = {
        id: newId("of"),
        projectId: doc.project.id,
        supplierId: partial.supplierId ?? null,
        reference: partial.reference ?? "",
        status: partial.status ?? "aangevraagd",
        requestedAt: partial.requestedAt ?? null,
        receivedAt: partial.receivedAt ?? null,
        validUntil: partial.validUntil ?? null,
        filePath: partial.filePath ?? null,
        notes: partial.notes ?? null,
      };
      commit({ ...doc, offertes: [...doc.offertes, offerte] });
      return offerte.id;
    },

    updateOfferte(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        offertes: doc.offertes.map((offerte) =>
          offerte.id === id ? { ...offerte, ...patch } : offerte,
        ),
      });
    },

    removeOfferte(id) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        offertes: doc.offertes.filter((offerte) => offerte.id !== id),
        offerteLines: doc.offerteLines.filter((line) => line.offerteId !== id),
      });
    },

    /** Choosing a quote rejects the competing quotes for the same items. */
    chooseOfferte(id) {
      const doc = requireDoc();
      if (!doc) return;
      const chosenLineIds = new Set(
        doc.offerteLines
          .filter((line) => line.offerteId === id && line.procurementLineId)
          .map((line) => line.procurementLineId as string),
      );
      const competing = new Set(
        doc.offerteLines
          .filter(
            (line) =>
              line.offerteId !== id &&
              line.procurementLineId &&
              chosenLineIds.has(line.procurementLineId),
          )
          .map((line) => line.offerteId),
      );
      commit({
        ...doc,
        offertes: doc.offertes.map((offerte) => {
          if (offerte.id === id) return { ...offerte, status: "gekozen" };
          if (competing.has(offerte.id) && offerte.status !== "afgewezen")
            return { ...offerte, status: "afgewezen" };
          return offerte;
        }),
      });
    },

    addOfferteLine(offerteId, partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const line: OfferteLine = {
        id: newId("ol"),
        offerteId,
        procurementLineId: partial?.procurementLineId ?? null,
        description: partial?.description ?? "",
        qty: partial?.qty ?? 1,
        unitPriceCents: partial?.unitPriceCents ?? 0,
        vatPct: partial?.vatPct ?? DEFAULT_VAT_PCT,
      };
      commit({ ...doc, offerteLines: [...doc.offerteLines, line] });
      return line.id;
    },

    updateOfferteLine(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        offerteLines: doc.offerteLines.map((line) =>
          line.id === id ? { ...line, ...patch } : line,
        ),
      });
    },

    removeOfferteLine(id) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        offerteLines: doc.offerteLines.filter((line) => line.id !== id),
      });
    },

    addTask(partial) {
      const doc = requireDoc();
      if (!doc) return "";
      const task: Task = {
        id: newId("tk"),
        projectId: doc.project.id,
        procurementLineId: partial.procurementLineId ?? null,
        title: partial.title ?? "",
        status: partial.status ?? "open",
        dueDate: partial.dueDate ?? null,
        assignee: partial.assignee ?? null,
        notes: partial.notes ?? null,
        sortOrder:
          partial.sortOrder ??
          doc.tasks.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1,
        auto: false,
      };
      commit({ ...doc, tasks: [...doc.tasks, task] });
      return task.id;
    },

    updateTask(id, patch) {
      const doc = requireDoc();
      if (!doc) return;
      commit({
        ...doc,
        tasks: doc.tasks.map((task) =>
          task.id === id ? { ...task, ...patch } : task,
        ),
      });
    },

    removeTask(id) {
      const doc = requireDoc();
      if (!doc) return;
      const task = doc.tasks.find((candidate) => candidate.id === id);
      if (!task || task.auto) return;
      commit({ ...doc, tasks: doc.tasks.filter((item) => item.id !== id) });
    },

    async replaceDocument(next) {
      const { driver, doc } = get();
      if (!driver || !doc) return;
      const statements = diffDocuments(doc, next);
      set({ doc: next, past: [], future: [], pending: [] });
      await driver.batch(statements);
      await driver.flush();
    },
  };
});

/** Total footprint in m2 of every object of a given item type in a scene. */
export function sceneFootprintM2(doc: ProjectDocument, sceneId: string): number {
  return doc.objects
    .filter((object) => object.sceneId === sceneId)
    .reduce((sum, object) => sum + areaM2(object.wMm, object.hMm), 0);
}

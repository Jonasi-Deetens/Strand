import { newId } from "@/lib/id";
import { lineTitle } from "./naming";
import { rollupStatus } from "./status";
import {
  type ItemType,
  type ProcurementLine,
  type ProjectDocument,
  type Task,
} from "./types";
import { type Lang } from "./naming";

const groupKey = (itemTypeId: string, variant: string | null): string =>
  `${itemTypeId}::${variant ?? ""}`;

/**
 * Keeps the procurement side in step with the plan. Every group of identical
 * objects (item type + variant) owns exactly one derived line, and every line
 * owns exactly one automatic task.
 *
 * Rules that make this predictable for the user:
 * - quantity of a derived line always equals the number of objects on the plan;
 * - budget of a derived line is quantity x catalogue price (edit the price in
 *   the catalogue, or add a quote for the real number);
 * - line status is the lowest status of its objects, so "40 cabines" only turns
 *   green once the last cabine is built;
 * - derived lines disappear together with their last object;
 * - automatic tasks are closed when their line is built and reopened when it
 *   falls back.
 */
export function syncDerived(doc: ProjectDocument, lang: Lang): ProjectDocument {
  const itemTypesById = new Map<string, ItemType>(
    doc.itemTypes.map((itemType) => [itemType.id, itemType]),
  );

  const groups = new Map<
    string,
    { itemTypeId: string; variant: string | null; objectIds: string[] }
  >();
  for (const object of doc.objects) {
    const key = groupKey(object.itemTypeId, object.variant);
    const group = groups.get(key);
    if (group) group.objectIds.push(object.id);
    else
      groups.set(key, {
        itemTypeId: object.itemTypeId,
        variant: object.variant,
        objectIds: [object.id],
      });
  }

  const linesByKey = new Map<string, ProcurementLine>();
  for (const line of doc.procurementLines) {
    if (line.itemTypeId) {
      linesByKey.set(groupKey(line.itemTypeId, line.variant), line);
    }
  }

  const statusById = new Map(doc.objects.map((o) => [o.id, o.status]));
  const nextLines: ProcurementLine[] = [];
  const lineIdByGroup = new Map<string, string>();

  // Manual lines survive untouched.
  for (const line of doc.procurementLines) {
    if (!line.itemTypeId || !line.derived) nextLines.push(line);
  }

  for (const [key, group] of groups) {
    const itemType = itemTypesById.get(group.itemTypeId);
    if (!itemType) continue;
    const existing = linesByKey.get(key);
    const statuses = group.objectIds.map((id) => statusById.get(id)!);
    const qty = group.objectIds.length;
    const line: ProcurementLine = existing
      ? {
          ...existing,
          qtyPlanned: qty,
          status: rollupStatus(statuses),
          budgetCents: qty * itemType.unitPriceCents,
          category: itemType.category,
        }
      : {
          id: newId("pl"),
          projectId: doc.project.id,
          itemTypeId: group.itemTypeId,
          variant: group.variant,
          title: lineTitle(itemType, group.variant, lang),
          category: itemType.category,
          qtyPlanned: qty,
          derived: true,
          budgetCents: qty * itemType.unitPriceCents,
          status: rollupStatus(statuses),
          unit: "stuk",
          notes: null,
        };
    lineIdByGroup.set(key, line.id);
    nextLines.push(line);
  }

  const nextObjects = doc.objects.map((object) => {
    const lineId =
      lineIdByGroup.get(groupKey(object.itemTypeId, object.variant)) ?? null;
    return object.procurementLineId === lineId
      ? object
      : { ...object, procurementLineId: lineId };
  });

  const liveLineIds = new Set(nextLines.map((line) => line.id));
  const autoTaskByLine = new Map<string, Task>();
  for (const task of doc.tasks) {
    if (task.auto && task.procurementLineId) {
      autoTaskByLine.set(task.procurementLineId, task);
    }
  }

  const nextTasks: Task[] = doc.tasks.filter(
    (task) =>
      !task.auto ||
      (task.procurementLineId !== null && liveLineIds.has(task.procurementLineId)),
  );

  let sortOrder = nextTasks.reduce(
    (max, task) => Math.max(max, task.sortOrder),
    0,
  );

  const patchedTasks = nextTasks.map((task) => {
    if (!task.auto || !task.procurementLineId) return task;
    const line = nextLines.find((l) => l.id === task.procurementLineId);
    if (!line) return task;
    if (line.status === "gebouwd" && task.status !== "klaar")
      return { ...task, status: "klaar" as const };
    if (line.status !== "gebouwd" && task.status === "klaar")
      return { ...task, status: "open" as const };
    return task;
  });

  for (const line of nextLines) {
    if (autoTaskByLine.has(line.id)) continue;
    sortOrder += 1;
    patchedTasks.push({
      id: newId("tk"),
      projectId: doc.project.id,
      procurementLineId: line.id,
      title: line.title,
      status: line.status === "gebouwd" ? "klaar" : "open",
      dueDate: null,
      assignee: null,
      notes: null,
      sortOrder,
      auto: true,
    });
  }

  return {
    ...doc,
    objects: nextObjects,
    procurementLines: nextLines,
    tasks: patchedTasks,
  };
}

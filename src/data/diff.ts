import { type ProjectDocument } from "@/domain/types";
import { type SqlStatement } from "./driver";
import * as repo from "./repo";

interface Entity {
  id: string;
}

/**
 * Rows are compared field by field. The document is small (hundreds of rows) so
 * diffing the whole thing after every action costs microseconds and removes the
 * class of bugs where memory and database drift apart.
 */
function shallowEqual(a: object, b: object): boolean {
  const keys = Object.keys(a) as (keyof typeof a)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key as keyof typeof b]);
}

interface CollectionDiff {
  upserts: SqlStatement[];
  deletes: SqlStatement[];
}

function diffCollection<T extends Entity>(
  prev: T[],
  next: T[],
  upsert: (entity: T) => SqlStatement,
  remove: (id: string) => SqlStatement,
): CollectionDiff {
  const upserts: SqlStatement[] = [];
  const deletes: SqlStatement[] = [];
  const prevById = new Map(prev.map((entity) => [entity.id, entity]));
  const nextIds = new Set<string>();

  for (const entity of next) {
    nextIds.add(entity.id);
    const before = prevById.get(entity.id);
    if (!before || !shallowEqual(before, entity)) upserts.push(upsert(entity));
  }
  for (const entity of prev) {
    if (!nextIds.has(entity.id)) deletes.push(remove(entity.id));
  }
  return { upserts, deletes };
}

/**
 * Foreign keys are honoured by writing all inserts and updates parent-first,
 * then all deletes child-first.
 */
export function diffDocuments(
  prev: ProjectDocument,
  next: ProjectDocument,
): SqlStatement[] {
  const parentFirst: CollectionDiff[] = [
    diffCollection(
      prev.itemTypes,
      next.itemTypes,
      repo.upsertItemType,
      repo.deleteItemType,
    ),
    diffCollection(prev.scenes, next.scenes, repo.upsertScene, repo.deleteScene),
    diffCollection(
      prev.procurementLines,
      next.procurementLines,
      repo.upsertProcurementLine,
      repo.deleteProcurementLine,
    ),
    diffCollection(
      prev.objects,
      next.objects,
      repo.upsertObject,
      repo.deleteObject,
    ),
    diffCollection(
      prev.suppliers,
      next.suppliers,
      repo.upsertSupplier,
      repo.deleteSupplier,
    ),
    diffCollection(
      prev.offertes,
      next.offertes,
      repo.upsertOfferte,
      repo.deleteOfferte,
    ),
    diffCollection(
      prev.offerteLines,
      next.offerteLines,
      repo.upsertOfferteLine,
      repo.deleteOfferteLine,
    ),
    diffCollection(prev.tasks, next.tasks, repo.upsertTask, repo.deleteTask),
  ];

  const statements: SqlStatement[] = [];
  if (!shallowEqual(prev.project, next.project)) {
    statements.push(repo.upsertProject(next.project));
  }
  for (const diff of parentFirst) statements.push(...diff.upserts);
  for (const diff of [...parentFirst].reverse()) statements.push(...diff.deletes);
  return statements;
}

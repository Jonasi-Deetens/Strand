import { type ProjectDocument } from "@/domain/types";
import { openTextFile, saveTextFile } from "@/lib/files";

export const PROJECT_FILE_VERSION = 1;

export interface ProjectFile {
  format: "strand-project";
  version: number;
  exportedAt: string;
  document: ProjectDocument;
}

export function serialiseProject(doc: ProjectDocument): string {
  const file: ProjectFile = {
    format: "strand-project",
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    document: doc,
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(contents: string): ProjectDocument {
  const parsed = JSON.parse(contents) as Partial<ProjectFile>;
  if (parsed.format !== "strand-project" || !parsed.document) {
    throw new Error("Geen Strand-projectbestand");
  }
  if ((parsed.version ?? 0) > PROJECT_FILE_VERSION) {
    throw new Error("Bestand komt uit een nieuwere versie van Strand");
  }
  return {
    ...parsed.document,
    cabinStock: Array.isArray(parsed.document.cabinStock)
      ? parsed.document.cabinStock
      : [],
  };
}

export function projectFileName(doc: ProjectDocument): string {
  const slug =
    doc.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "strand";
  return `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function exportProjectFile(
  doc: ProjectDocument,
): Promise<string | null> {
  return saveTextFile(
    serialiseProject(doc),
    projectFileName(doc),
    ["json"],
    "application/json",
  );
}

export async function importProjectFile(): Promise<ProjectDocument | null> {
  const picked = await openTextFile(["json"]);
  if (!picked) return null;
  return parseProject(picked.contents);
}

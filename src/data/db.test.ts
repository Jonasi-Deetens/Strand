import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createWasmDriver } from "./wasmDriver";
import { type SqlDriver } from "./driver";
import { diffDocuments } from "./diff";
import { documentStatements, loadDocument, findFirstProjectId } from "./repo";
import { type ItemTypeRow, toItemType } from "./rows";
import { createProjectDocument } from "@/domain/bootstrap";
import { syncDerived } from "@/domain/sync";
import { makeObject } from "@/test/factories";
import { type ProjectDocument } from "@/domain/types";

const translate = (key: string) => key.replace("seed.", "");

async function freshDriver(): Promise<SqlDriver> {
  return createWasmDriver({ ephemeral: true });
}

describe("migrations and catalogue seed", () => {
  let driver: SqlDriver;

  beforeAll(async () => {
    driver = await freshDriver();
  });

  it("creates the schema and seeds the Dutch catalogue", async () => {
    const itemTypes = await driver.select<ItemTypeRow>(
      "SELECT * FROM item_types ORDER BY id",
    );
    expect(itemTypes.length).toBeGreaterThan(30);
    const bar = itemTypes.find((row) => row.id === "it_bar");
    expect(bar).toBeDefined();
    expect(toItemType(bar!)).toMatchObject({
      nameNl: "Strandbar",
      hasInterior: true,
      targetAreaM2: 60,
      defaultWMm: 12000,
      defaultHMm: 5000,
    });
    expect(
      itemTypes.filter((row) => row.placement === "interior").length,
    ).toBeGreaterThan(5);
  });

  it("seeds measured outdoor types with a top-down image path", async () => {
    const rows = await driver.select<ItemTypeRow>(
      "SELECT * FROM item_types WHERE id IN ('it_regisseursstoel', 'it_houten_lounge', 'it_wipkip', 'it_helmgras')",
    );
    const byId = Object.fromEntries(
      rows.map((row) => [row.id, toItemType(row)]),
    );
    expect(byId.it_regisseursstoel).toMatchObject({
      defaultWMm: 550,
      defaultHMm: 540,
      image: "catalog/it_regisseursstoel.webp",
    });
    expect(byId.it_houten_lounge).toMatchObject({
      defaultWMm: 2000,
      defaultHMm: 900,
      image: "catalog/it_houten_lounge.webp",
    });
    expect(byId.it_wipkip).toMatchObject({
      defaultWMm: 900,
      defaultHMm: 400,
    });
    expect(byId.it_helmgras).toMatchObject({
      shape: "circle",
      defaultWMm: 800,
    });
    const ligbed = await driver.select<ItemTypeRow>(
      "SELECT * FROM item_types WHERE id = 'it_ligbed'",
    );
    expect(toItemType(ligbed[0]!).image).toBe("catalog/it_ligbed.webp");
  });

  it("gives every catalogue type a picture, including a 7 x 7 m parasol", async () => {
    const rows = await driver.select<ItemTypeRow>("SELECT * FROM item_types");
    const missing = rows.filter((row) => !row.image);
    expect(missing.map((row) => row.id)).toEqual([]);
    const xxl = toItemType(rows.find((row) => row.id === "it_parasol_xxl")!);
    expect(xxl).toMatchObject({
      defaultWMm: 7000,
      defaultHMm: 7000,
      unitPriceCents: 1_500_000,
      image: "catalog/it_parasol_xxl.webp",
    });
    const absent = rows
      .map((row) => row.image!)
      .filter((image) => !existsSync(path.join(process.cwd(), "public", image)));
    expect(absent).toEqual([]);
  });

  it("puts the toilet building on the same 60 m2 target as the bar", async () => {
    const rows = await driver.select<ItemTypeRow>(
      "SELECT * FROM item_types WHERE id = 'it_toilet'",
    );
    const toilet = toItemType(rows[0]!);
    expect(toilet).toMatchObject({
      hasInterior: true,
      targetAreaM2: 60,
      defaultWMm: 10000,
      defaultHMm: 6000,
    });
    // Straight out of the palette it already meets its target.
    expect((toilet.defaultWMm / 1000) * (toilet.defaultHMm / 1000)).toBe(60);
  });

  it("is idempotent when the same migrations run again", async () => {
    const bytes = await driver.serialize();
    const reopened = await createWasmDriver({
      ephemeral: true,
      bytes: bytes ?? undefined,
    });
    const reopenedRows = await reopened.select<{ count: number }>(
      "SELECT COUNT(*) as count FROM item_types",
    );
    const originalRows = await driver.select<{ count: number }>(
      "SELECT COUNT(*) as count FROM item_types",
    );
    expect(reopenedRows[0]?.count).toBe(originalRows[0]?.count);
  });
});

describe("document round trip", () => {
  it("writes a fresh project and reads it back unchanged", async () => {
    const driver = await freshDriver();
    const itemTypes = (
      await driver.select<ItemTypeRow>("SELECT * FROM item_types")
    ).map(toItemType);
    const created = createProjectDocument(itemTypes, translate);

    await driver.batch(documentStatements(created));

    const projectId = await findFirstProjectId(driver);
    expect(projectId).toBe(created.project.id);

    const loaded = await loadDocument(driver, created.project.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.project).toEqual(created.project);
    expect(loaded!.scenes).toEqual(created.scenes);
    expect(loaded!.procurementLines).toHaveLength(
      created.procurementLines.length,
    );
    expect(loaded!.objects).toEqual([]);
  });

  it("persists exactly the changes the diff describes", async () => {
    const driver = await freshDriver();
    const itemTypes = (
      await driver.select<ItemTypeRow>("SELECT * FROM item_types")
    ).map(toItemType);
    const created = createProjectDocument(itemTypes, translate);
    await driver.batch(documentStatements(created));

    const withCabins: ProjectDocument = syncDerived(
      {
        ...created,
        objects: Array.from({ length: 3 }, (_, index) =>
          makeObject({
            id: `ob_${index}`,
            itemTypeId: "it_cabine",
            sceneId: created.scenes[0]!.id,
            xMm: index * 2500,
            status: index === 0 ? "gebouwd" : "nodig",
          }),
        ),
      },
      "nl",
    );

    const statements = diffDocuments(created, withCabins);
    expect(statements.length).toBeGreaterThan(0);
    await driver.batch(statements);

    const loaded = await loadDocument(driver, created.project.id);
    expect(loaded!.objects).toHaveLength(3);
    const derived = loaded!.procurementLines.find((line) => line.derived);
    expect(derived).toMatchObject({ qtyPlanned: 3, status: "nodig" });
    expect(
      loaded!.objects.every(
        (object) => object.procurementLineId === derived!.id,
      ),
    ).toBe(true);
    expect(loaded!.tasks.some((task) => task.auto)).toBe(true);

    // Deleting the objects removes the derived line and its automatic task,
    // while the manual lines seeded at bootstrap keep theirs.
    const derivedTaskId = loaded!.tasks.find(
      (task) => task.procurementLineId === derived!.id,
    )!.id;
    const emptied = syncDerived({ ...withCabins, objects: [] }, "nl");
    await driver.batch(diffDocuments(withCabins, emptied));
    const after = await loadDocument(driver, created.project.id);
    expect(after!.objects).toHaveLength(0);
    expect(after!.procurementLines.some((line) => line.derived)).toBe(false);
    expect(after!.tasks.some((task) => task.id === derivedTaskId)).toBe(false);
    expect(after!.tasks).toHaveLength(created.procurementLines.length);
  });

  it("rolls a failing batch back", async () => {
    const driver = await freshDriver();
    await expect(
      driver.batch([
        {
          sql: "INSERT INTO projects (id, name, plot_w_mm, plot_h_mm, currency, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          params: ["pr_x", "Test", 1000, 1000, "EUR", "now"],
        },
        { sql: "INSERT INTO nope (id) VALUES ($1)", params: ["boom"] },
      ]),
    ).rejects.toThrow();
    const rows = await driver.select("SELECT * FROM projects");
    expect(rows).toHaveLength(0);
  });
});

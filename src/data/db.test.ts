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

  it("draws parasols as white squares and creates a cabin stock table", async () => {
    const rows = await driver.select<ItemTypeRow>(
      "SELECT * FROM item_types WHERE id IN ('it_parasol', 'it_parasol_xl')",
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(toItemType(row)).toMatchObject({
        shape: "rect",
        image: `catalog/${row.id}.webp`,
      });
      expect(existsSync(path.join(process.cwd(), "public", row.image!))).toBe(
        true,
      );
    }
    const tables = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cabin_stock'",
    );
    expect(tables).toHaveLength(1);
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
    expect(loaded!.cabinStock).toEqual([]);
  });

  it("backfills a packing list onto cabins that already exist", async () => {
    const driver = await freshDriver();
    const itemTypes = (
      await driver.select<ItemTypeRow>("SELECT * FROM item_types")
    ).map(toItemType);
    const created = createProjectDocument(itemTypes, translate);
    const cabin = makeObject({
      id: "ob_old",
      itemTypeId: "it_cabine",
      sceneId: created.scenes[0]!.id,
    });
    await driver.batch(
      documentStatements({ ...created, objects: [cabin], cabinStock: [] }),
    );
    await driver.execute(
      `INSERT OR IGNORE INTO cabin_stock (id, cabin_id, item_type_id, title, qty_needed, qty_ready, sort_order)
       SELECT 'cs_' || o.id || '_stoel', o.id, 'it_stoel',
         (SELECT name_nl FROM item_types WHERE id = 'it_stoel'), 2, 0, 0
       FROM objects o
       WHERE o.item_type_id IN (SELECT id FROM item_types WHERE category = 'cabine')`,
    );
    await driver.execute(
      `INSERT OR IGNORE INTO cabin_stock (id, cabin_id, item_type_id, title, qty_needed, qty_ready, sort_order)
       SELECT 'cs_' || o.id || '_regie', o.id, 'it_regisseursstoel',
         (SELECT name_nl FROM item_types WHERE id = 'it_regisseursstoel'), 2, 0, 1
       FROM objects o
       WHERE o.item_type_id IN (SELECT id FROM item_types WHERE category = 'cabine')`,
    );
    const loaded = await loadDocument(driver, created.project.id);
    expect(loaded!.cabinStock).toHaveLength(2);
    expect(loaded!.cabinStock.map((line) => line.itemTypeId).sort()).toEqual([
      "it_regisseursstoel",
      "it_stoel",
    ]);
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

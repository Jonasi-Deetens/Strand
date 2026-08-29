import { beforeEach, describe, expect, it } from "vitest";
import { resetDriver, setDriver, type SqlDriver } from "@/data/driver";
import { createWasmDriver } from "@/data/wasmDriver";
import { loadDocument } from "@/data/repo";
import { useProjectStore } from "./useProjectStore";

const translate = (key: string) => key.replace("seed.", "");

let driver: SqlDriver;

async function freshStore() {
  resetDriver();
  driver = await createWasmDriver({ ephemeral: true });
  setDriver(driver);
  useProjectStore.setState({
    loadState: "idle",
    error: null,
    doc: null,
    past: [],
    future: [],
    driver: null,
    pending: [],
  });
  await useProjectStore.getState().init(translate, "nl");
  return useProjectStore.getState();
}

describe("project store", () => {
  beforeEach(async () => {
    await freshStore();
  });

  it("bootstraps a project with a beach scene and manual lines", () => {
    const doc = useProjectStore.getState().doc!;
    expect(doc.scenes).toHaveLength(1);
    expect(doc.scenes[0]!.kind).toBe("beach");
    expect(doc.procurementLines.length).toBeGreaterThan(0);
    expect(doc.procurementLines.every((line) => !line.derived)).toBe(true);
  });

  it("places an object, derives its line and persists both", async () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    const id = store.addObject({
      sceneId: beach.id,
      itemTypeId: "it_cabine",
      xMm: 4000,
      yMm: 4000,
    });
    expect(id).not.toBeNull();

    await useProjectStore.getState().flush();
    const projectId = useProjectStore.getState().doc!.project.id;
    const loaded = await loadDocument(driver, projectId);
    expect(loaded!.objects).toHaveLength(1);
    const line = loaded!.procurementLines.find((candidate) => candidate.derived);
    expect(line).toMatchObject({ qtyPlanned: 1, itemTypeId: "it_cabine" });
    expect(loaded!.objects[0]!.procurementLineId).toBe(line!.id);
  });

  it("keeps interior objects in their own scene and writes them", async () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    const barId = store.addObject({
      sceneId: beach.id,
      itemTypeId: "it_bar",
      xMm: 10000,
      yMm: 8000,
    })!;

    const interiorId = useProjectStore.getState().ensureInteriorScene(barId);
    expect(interiorId).not.toBeNull();
    // Asking twice must reuse the same scene rather than stack up new ones.
    expect(useProjectStore.getState().ensureInteriorScene(barId)).toBe(
      interiorId,
    );

    const toogId = useProjectStore.getState().addObject({
      sceneId: interiorId!,
      itemTypeId: "it_toog",
      xMm: 1000,
      yMm: 500,
    });
    expect(toogId).not.toBeNull();

    const inMemory = useProjectStore.getState().doc!;
    expect(
      inMemory.objects.filter((object) => object.sceneId === interiorId),
    ).toHaveLength(1);

    await useProjectStore.getState().flush();
    const loaded = await loadDocument(driver, inMemory.project.id);
    expect(loaded!.scenes.map((scene) => scene.kind)).toEqual([
      "beach",
      "interior",
    ]);
    const interiorObjects = loaded!.objects.filter(
      (object) => object.sceneId === interiorId,
    );
    expect(interiorObjects).toHaveLength(1);
    expect(interiorObjects[0]!.itemTypeId).toBe("it_toog");
  });

  it("drops the interior scene and its contents with the building", async () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    const barId = store.addObject({
      sceneId: beach.id,
      itemTypeId: "it_bar",
      xMm: 10000,
      yMm: 8000,
    })!;
    const interiorId = useProjectStore.getState().ensureInteriorScene(barId)!;
    useProjectStore.getState().addObject({
      sceneId: interiorId,
      itemTypeId: "it_toog",
      xMm: 1000,
      yMm: 500,
    });

    useProjectStore.getState().removeObjects([barId]);
    const doc = useProjectStore.getState().doc!;
    expect(doc.objects).toHaveLength(0);
    expect(doc.scenes).toHaveLength(1);

    await useProjectStore.getState().flush();
    const loaded = await loadDocument(driver, doc.project.id);
    expect(loaded!.objects).toHaveLength(0);
    expect(loaded!.scenes).toHaveLength(1);
  });

  it("finds the same interior scene again after a restart", async () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    const barId = store.addObject({
      sceneId: beach.id,
      itemTypeId: "it_bar",
      xMm: 10000,
      yMm: 8000,
    })!;
    const interiorId = useProjectStore.getState().ensureInteriorScene(barId)!;
    useProjectStore.getState().addObject({
      sceneId: interiorId,
      itemTypeId: "it_toog",
      xMm: 1000,
      yMm: 500,
    });
    await useProjectStore.getState().flush();

    // Reopen the same database in a new store, the way a restart would.
    const bytes = (await driver.serialize())!;
    const reopened = await createWasmDriver({ ephemeral: true, bytes });
    setDriver(reopened);
    useProjectStore.setState({
      loadState: "idle",
      error: null,
      doc: null,
      past: [],
      future: [],
      driver: null,
      pending: [],
    });
    await useProjectStore.getState().init(translate, "nl");

    const doc = useProjectStore.getState().doc!;
    const interior = doc.scenes.find((scene) => scene.kind === "interior")!;
    expect(interior.id).toBe(interiorId);
    expect(interior.parentObjectId).toBe(barId);
    expect(
      doc.objects.filter((object) => object.sceneId === interior.id),
    ).toHaveLength(1);
    expect(useProjectStore.getState().ensureInteriorScene(barId)).toBe(
      interior.id,
    );
  });

  it("undoes and redoes a placement, database included", async () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    store.addObject({
      sceneId: beach.id,
      itemTypeId: "it_parasol",
      xMm: 6000,
      yMm: 6000,
    });
    expect(useProjectStore.getState().doc!.objects).toHaveLength(1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().doc!.objects).toHaveLength(0);
    await useProjectStore.getState().flush();
    const projectId = useProjectStore.getState().doc!.project.id;
    expect((await loadDocument(driver, projectId))!.objects).toHaveLength(0);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().doc!.objects).toHaveLength(1);
    await useProjectStore.getState().flush();
    expect((await loadDocument(driver, projectId))!.objects).toHaveLength(1);
  });

  it("pushes a derived line status down to its objects", () => {
    const store = useProjectStore.getState();
    const beach = store.doc!.scenes[0]!;
    for (let index = 0; index < 3; index += 1) {
      store.addObject({
        sceneId: beach.id,
        itemTypeId: "it_cabine",
        xMm: index * 3000,
        yMm: 20000,
      });
    }
    const line = useProjectStore
      .getState()
      .doc!.procurementLines.find((candidate) => candidate.derived)!;
    useProjectStore.getState().setLineStatus(line.id, "besteld");
    const doc = useProjectStore.getState().doc!;
    expect(doc.objects.every((object) => object.status === "besteld")).toBe(true);
    expect(
      doc.procurementLines.find((candidate) => candidate.id === line.id)!.status,
    ).toBe("besteld");
  });
});

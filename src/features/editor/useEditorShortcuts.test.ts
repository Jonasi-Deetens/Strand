import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MM_PER_M, SNAP_MM } from "@/lib/units";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";
import { beach, cabinType, makeDocument, makeObject } from "@/test/factories";
import { SHORTCUT_GROUPS } from "./shortcuts";
import { useEditorShortcuts } from "./useEditorShortcuts";

const press = (key: string, init: KeyboardEventInit = {}, target?: Element) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  (target ?? window).dispatchEvent(event);
};

const object = () => useProjectStore.getState().doc!.objects[0]!;

describe("useEditorShortcuts", () => {
  beforeEach(() => {
    // The hook reads both stores through `getState`, so seeding them is enough:
    // no database driver is involved and writes simply queue up unflushed.
    useProjectStore.setState({
      doc: makeDocument({
        objects: [makeObject({ id: "ob_1", itemTypeId: cabinType.id })],
      }),
      lang: "nl",
      driver: null,
      past: [],
      future: [],
      pending: [],
    });
    useEditorStore.setState({
      activeSceneId: beach.id,
      tool: "select",
      selection: [],
      showGrid: true,
      showRulers: true,
      measure: null,
    });
    renderHook(() => useEditorShortcuts());
  });

  // Without this the window listener of every previous test is still attached,
  // so one key press would nudge or toggle several times over.
  afterEach(cleanup);

  it("picks tools with the single letter keys", () => {
    press("r");
    expect(useEditorStore.getState().tool).toBe("array");
    press("m");
    expect(useEditorStore.getState().tool).toBe("measure");
    press("v");
    expect(useEditorStore.getState().tool).toBe("select");
  });

  it("separates the rulers from the array tool by Shift", () => {
    press("R", { shiftKey: true });
    expect(useEditorStore.getState().showRulers).toBe(false);
    expect(useEditorStore.getState().tool).toBe("select");
    press("g");
    expect(useEditorStore.getState().showGrid).toBe(false);
  });

  it("nudges by the snap step, and by a metre with Shift", () => {
    useEditorStore.setState({ selection: ["ob_1"] });
    press("ArrowRight");
    expect(object().xMm).toBe(SNAP_MM);
    press("ArrowDown", { shiftKey: true });
    expect(object().yMm).toBe(MM_PER_M);
  });

  it("undoes and redoes with the platform modifier", () => {
    useEditorStore.setState({ selection: ["ob_1"] });
    press("ArrowRight");
    press("z", { metaKey: true });
    expect(object().xMm).toBe(0);
    press("z", { metaKey: true, shiftKey: true });
    expect(object().xMm).toBe(SNAP_MM);
  });

  it("selects everything in the active scene only", () => {
    const doc = useProjectStore.getState().doc!;
    useProjectStore.setState({
      doc: {
        ...doc,
        objects: [
          ...doc.objects,
          makeObject({
            id: "ob_elsewhere",
            itemTypeId: cabinType.id,
            sceneId: "sc_other",
          }),
        ],
      },
    });
    press("a", { ctrlKey: true });
    expect(useEditorStore.getState().selection).toEqual(["ob_1"]);
  });

  it("deletes the selection and clears it", () => {
    useEditorStore.setState({ selection: ["ob_1"] });
    press("Backspace");
    expect(useProjectStore.getState().doc!.objects).toHaveLength(0);
    expect(useEditorStore.getState().selection).toEqual([]);
  });

  it("cycles the status of the selection", () => {
    useEditorStore.setState({ selection: ["ob_1"] });
    press("s");
    expect(object().status).toBe("offerte_aangevraagd");
  });

  it("stays out of the way while typing in a field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    press("g", {}, input);
    expect(useEditorStore.getState().showGrid).toBe(true);
    input.remove();
  });

  it("documents every key it listens to", () => {
    const listed = SHORTCUT_GROUPS.flatMap((group) =>
      group.items.map((item) => item.keys ?? item.keysKey),
    );
    for (const keys of ["V", "R", "⇧ + R", "M", "G", "S", "L", "[ ]"]) {
      expect(listed).toContain(keys);
    }
  });
});

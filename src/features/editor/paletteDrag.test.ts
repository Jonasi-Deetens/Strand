import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/store/useEditorStore";
import { beginPaletteDrag, registerDropTarget } from "./paletteDrag";

const pointer = (type: string, x: number, y: number) =>
  window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }));

const stubTarget = (contains: boolean) => {
  const drop = vi.fn();
  registerDropTarget({ contains: () => contains, drop });
  return drop;
};

afterEach(() => {
  registerDropTarget(null);
  useEditorStore.getState().setPaletteDrag(null);
});

describe("beginPaletteDrag", () => {
  it("reports the dragged item and pointer once past the threshold", () => {
    stubTarget(true);
    beginPaletteDrag("it_cabine", 100, 100);

    pointer("pointermove", 101, 100);
    expect(useEditorStore.getState().paletteDrag).toBeNull();

    pointer("pointermove", 140, 180);
    expect(useEditorStore.getState().paletteDrag).toEqual({
      itemTypeId: "it_cabine",
      x: 140,
      y: 180,
    });

    pointer("pointerup", 140, 180);
    expect(useEditorStore.getState().paletteDrag).toBeNull();
  });

  it("drops on the registered target", () => {
    const drop = stubTarget(true);
    beginPaletteDrag("it_cabine", 100, 100);
    pointer("pointermove", 300, 400);
    pointer("pointerup", 300, 400);

    expect(drop).toHaveBeenCalledWith("it_cabine", 300, 400);
  });

  it("ignores a press that never moved, leaving it to the click handler", () => {
    const drop = stubTarget(true);
    beginPaletteDrag("it_cabine", 100, 100);
    pointer("pointerup", 100, 100);

    expect(drop).not.toHaveBeenCalled();
  });

  it("does not drop outside the drawing area", () => {
    const drop = stubTarget(false);
    beginPaletteDrag("it_cabine", 100, 100);
    pointer("pointermove", 20, 400);
    pointer("pointerup", 20, 400);

    expect(drop).not.toHaveBeenCalled();
    expect(useEditorStore.getState().paletteDrag).toBeNull();
  });

  it("stops tracking after the gesture ends", () => {
    stubTarget(true);
    beginPaletteDrag("it_cabine", 100, 100);
    pointer("pointermove", 300, 400);
    pointer("pointerup", 300, 400);

    pointer("pointermove", 320, 420);
    expect(useEditorStore.getState().paletteDrag).toBeNull();
  });
});

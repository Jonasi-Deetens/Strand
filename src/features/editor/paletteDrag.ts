import { useEditorStore } from "@/store/useEditorStore";

export interface DropTarget {
  /** Whether a client-space point lies over the drawing area. */
  contains: (clientX: number, clientY: number) => boolean;
  drop: (itemTypeId: string, clientX: number, clientY: number) => void;
}

let dropTarget: DropTarget | null = null;

export function registerDropTarget(target: DropTarget | null): void {
  dropTarget = target;
}

/** Movement before a press counts as a drag rather than a click. */
const THRESHOLD_PX = 4;

/**
 * Drags an item out of the palette by tracking the pointer. HTML5
 * drag-and-drop would be less code, but every webview paints its own drag
 * ghost — Chromium and WebKitGTK both blow it up far past the row it snapshots
 * — and none of them can show the item's real footprint. Owning the gesture
 * lets the canvas draw the outline at plot scale instead.
 */
export function beginPaletteDrag(
  itemTypeId: string,
  startX: number,
  startY: number,
): void {
  const setPaletteDrag = useEditorStore.getState().setPaletteDrag;
  let dragging = false;

  const finish = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", finish);
    setPaletteDrag(null);
  };

  const onMove = (event: PointerEvent) => {
    if (
      !dragging &&
      Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD_PX
    ) {
      return;
    }
    dragging = true;
    setPaletteDrag({ itemTypeId, x: event.clientX, y: event.clientY });
  };

  const onUp = (event: PointerEvent) => {
    const drop = dragging && dropTarget?.contains(event.clientX, event.clientY);
    finish();
    // A press without movement falls through to the button's click handler,
    // which loads the item into the place tool.
    if (drop) dropTarget?.drop(itemTypeId, event.clientX, event.clientY);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", finish);
}

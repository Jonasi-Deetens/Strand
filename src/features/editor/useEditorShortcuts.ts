import { useEffect } from "react";
import { MM_PER_M, SNAP_MM } from "@/lib/units";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

/** Keyboard model of the editor, deliberately close to Figma and AutoCAD. */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const editor = useEditorStore.getState();
      const project = useProjectStore.getState();
      const selection = editor.selection;
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) project.redo();
        else project.undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        project.redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const copies = project.duplicateObjects(selection);
        if (copies.length > 0) editor.setSelection(copies);
        return;
      }
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const doc = project.doc;
        const sceneId = editor.activeSceneId;
        if (!doc) return;
        editor.setSelection(
          doc.objects
            .filter((object) => !sceneId || object.sceneId === sceneId)
            .map((object) => object.id),
        );
        return;
      }

      switch (event.key) {
        case "Escape":
          editor.setTool("select");
          editor.clearSelection();
          editor.setMeasure(null);
          return;
        case "Delete":
        case "Backspace":
          if (selection.length === 0) return;
          event.preventDefault();
          project.removeObjects(selection);
          editor.clearSelection();
          return;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          if (selection.length === 0) return;
          event.preventDefault();
          const step = event.shiftKey ? MM_PER_M : SNAP_MM;
          const dx =
            event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy =
            event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          project.moveObjects(selection, dx, dy);
          return;
        }
        default:
          break;
      }

      switch (event.key.toLowerCase()) {
        case "v":
          editor.setTool("select");
          break;
        case "m":
          editor.setTool("measure");
          break;
        case "r":
          // Shift+R is the rulers, following Figma; bare R is the array tool.
          if (event.shiftKey) editor.toggleRulers();
          else editor.setTool("array");
          break;
        case "g":
          editor.toggleGrid();
          break;
        case "s":
          if (selection.length > 0) project.cycleObjectStatus(selection);
          break;
        case "l":
          if (selection.length > 0) {
            const doc = project.doc;
            const first = doc?.objects.find(
              (object) => object.id === selection[0],
            );
            project.updateObjects(selection, { locked: !first?.locked });
          }
          break;
        case "[":
          project.raiseObjects(selection, -1);
          break;
        case "]":
          project.raiseObjects(selection, 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

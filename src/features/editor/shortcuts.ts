export interface Shortcut {
  /** Rendered as typed, with ⌘/Ctrl covering both platforms. */
  keys?: string;
  /** For combinations that name a mouse gesture and so need translating. */
  keysKey?: string;
  labelKey: string;
}

export interface ShortcutGroup {
  titleKey: string;
  items: Shortcut[];
}

/**
 * Single source of truth for what `useEditorShortcuts` listens to, shown both
 * in the editor help overlay and on the settings page.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: "editor.groupTools",
    items: [
      { keys: "V", labelKey: "editor.escape" },
      { keys: "R", labelKey: "editor.arrayTool" },
      { keys: "M", labelKey: "editor.measure" },
      { keys: "Esc", labelKey: "editor.escape" },
    ],
  },
  {
    titleKey: "editor.groupSelection",
    items: [
      { keys: "⌘/Ctrl + A", labelKey: "editor.selectAll" },
      { keysKey: "editor.keyShiftClick", labelKey: "editor.addToSelection" },
      { keys: "⌘/Ctrl + D", labelKey: "common.duplicate" },
      { keys: "⌫", labelKey: "editor.deleteSelection" },
    ],
  },
  {
    titleKey: "editor.groupEditing",
    items: [
      { keys: "↑ ↓ ← →", labelKey: "editor.nudgeHint" },
      { keys: "S", labelKey: "editor.statusCycle" },
      { keys: "L", labelKey: "editor.locked" },
      { keys: "[ ]", labelKey: "editor.sendBackward" },
      { keys: "⌘/Ctrl + Z", labelKey: "editor.undo" },
      { keys: "⌘/Ctrl + ⇧ + Z", labelKey: "editor.redo" },
    ],
  },
  {
    titleKey: "editor.groupView",
    items: [
      { keys: "G", labelKey: "editor.grid" },
      { keysKey: "editor.keySpaceDrag", labelKey: "editor.pan" },
      { keys: "Scroll", labelKey: "editor.zoomWheel" },
      { keysKey: "editor.keyDoubleClick", labelKey: "editor.openInterior" },
      { keys: "?", labelKey: "editor.shortcuts" },
    ],
  },
];

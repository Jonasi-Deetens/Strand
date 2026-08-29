import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Category } from "@/domain/types";

export type Tool = "select" | "place" | "measure" | "array";
export type ColourMode = "type" | "status";

export interface ViewTransform {
  /** Pixels per millimetre. */
  scale: number;
  x: number;
  y: number;
}

export interface MeasureLine {
  fromMm: { x: number; y: number };
  toMm: { x: number; y: number };
}

export interface ArraySettings {
  count: number;
  spacingMm: number;
  rows: number;
  rowSpacingMm: number;
  direction: "horizontal" | "vertical";
}

export interface PaletteDrag {
  itemTypeId: string;
  x: number;
  y: number;
}

interface EditorState {
  activeSceneId: string | null;
  selection: string[];
  tool: Tool;
  placingItemTypeId: string | null;
  /** Live palette drag, in client coordinates, for the canvas drop preview. */
  paletteDrag: PaletteDrag | null;
  colourMode: ColourMode;
  showGrid: boolean;
  showLabels: boolean;
  snapEnabled: boolean;
  hiddenCategories: Category[];
  lockedCategories: Category[];
  view: ViewTransform;
  measure: MeasureLine | null;
  array: ArraySettings;
  theme: "light" | "dark";

  setActiveScene: (sceneId: string | null) => void;
  setSelection: (ids: string[]) => void;
  toggleInSelection: (id: string) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  startPlacing: (itemTypeId: string) => void;
  stopPlacing: () => void;
  setPaletteDrag: (drag: PaletteDrag | null) => void;
  setColourMode: (mode: ColourMode) => void;
  toggleGrid: () => void;
  toggleLabels: () => void;
  toggleSnap: () => void;
  toggleCategoryVisible: (category: Category) => void;
  toggleCategoryLocked: (category: Category) => void;
  setView: (view: Partial<ViewTransform>) => void;
  setMeasure: (measure: MeasureLine | null) => void;
  setArray: (settings: Partial<ArraySettings>) => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      activeSceneId: null,
      selection: [],
      tool: "select",
      placingItemTypeId: null,
      paletteDrag: null,
      colourMode: "status",
      showGrid: true,
      showLabels: true,
      snapEnabled: true,
      hiddenCategories: [],
      lockedCategories: [],
      view: { scale: 0.012, x: 40, y: 40 },
      measure: null,
      array: {
        count: 6,
        spacingMm: 2500,
        rows: 1,
        rowSpacingMm: 3000,
        direction: "horizontal",
      },
      theme: "dark",

      setActiveScene: (sceneId) =>
        set({ activeSceneId: sceneId, selection: [], measure: null }),
      setSelection: (ids) => set({ selection: ids }),
      toggleInSelection: (id) => {
        const { selection } = get();
        set({
          selection: selection.includes(id)
            ? selection.filter((candidate) => candidate !== id)
            : [...selection, id],
        });
      },
      clearSelection: () => set({ selection: [] }),
      setTool: (tool) =>
        set({
          tool,
          placingItemTypeId: tool === "select" ? null : get().placingItemTypeId,
          measure: tool === "measure" ? get().measure : null,
        }),
      // Picking an item while the array tool is active keeps the array tool, so
      // "row of cabins" works whichever order the two are chosen in.
      startPlacing: (itemTypeId) =>
        set({
          tool: get().tool === "array" ? "array" : "place",
          placingItemTypeId: itemTypeId,
        }),
      stopPlacing: () => set({ tool: "select", placingItemTypeId: null }),
      setPaletteDrag: (paletteDrag) => set({ paletteDrag }),
      setColourMode: (colourMode) => set({ colourMode }),
      toggleGrid: () => set({ showGrid: !get().showGrid }),
      toggleLabels: () => set({ showLabels: !get().showLabels }),
      toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),
      toggleCategoryVisible: (category) => {
        const { hiddenCategories } = get();
        set({
          hiddenCategories: hiddenCategories.includes(category)
            ? hiddenCategories.filter((candidate) => candidate !== category)
            : [...hiddenCategories, category],
        });
      },
      toggleCategoryLocked: (category) => {
        const { lockedCategories } = get();
        set({
          lockedCategories: lockedCategories.includes(category)
            ? lockedCategories.filter((candidate) => candidate !== category)
            : [...lockedCategories, category],
        });
      },
      setView: (view) => set({ view: { ...get().view, ...view } }),
      setMeasure: (measure) => set({ measure }),
      setArray: (settings) => set({ array: { ...get().array, ...settings } }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "strand.editor",
      partialize: (state) => ({
        colourMode: state.colourMode,
        showGrid: state.showGrid,
        showLabels: state.showLabels,
        snapEnabled: state.snapEnabled,
        hiddenCategories: state.hiddenCategories,
        lockedCategories: state.lockedCategories,
        array: state.array,
        theme: state.theme,
      }),
    },
  ),
);

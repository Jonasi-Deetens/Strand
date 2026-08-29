import { useEditorStore } from "@/store/useEditorStore";

export interface CanvasTheme {
  background: string;
  plot: string;
  grid: string;
  gridMajor: string;
  text: string;
  accent: string;
  guide: string;
  measure: string;
}

/**
 * Konva paints on a canvas and cannot read the CSS custom properties the rest
 * of the UI is themed with, so the drawing palette lives here. Keep these in
 * step with the --canvas-* variables in styles.css.
 */
const THEMES: Record<"light" | "dark", CanvasTheme> = {
  light: {
    background: "#f7f0e0",
    plot: "#fdf8ec",
    grid: "#ded0b4",
    gridMajor: "#c9b48d",
    text: "#8a7a5c",
    accent: "#227b84",
    guide: "#f97316",
    measure: "#e11d48",
  },
  dark: {
    background: "#131a20",
    plot: "#18222a",
    grid: "#223039",
    gridMajor: "#33454f",
    text: "#84919d",
    accent: "#43b6ba",
    guide: "#f97316",
    measure: "#f43f5e",
  },
};

export function useCanvasTheme(): CanvasTheme {
  return THEMES[useEditorStore((state) => state.theme)];
}

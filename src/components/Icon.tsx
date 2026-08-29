/**
 * Every catalogue item and every toolbar button draws from this one path set,
 * so the palette, the canvas and the PDF legend always show the same symbol.
 * Paths are drawn in a 24x24 box with stroke geometry only.
 */
export const ICON_PATHS: Record<string, string> = {
  // Buildings and structures
  bar: "M2 9h20v3H2z M4 12v9 M20 12v9 M4 21h16 M7 12v4h10v-4 M6 9V6h12v3",
  toilet: "M4 3h16v18H4z M9 8h6v5a3 3 0 0 1-6 0z M12 13v5",
  shed: "M3 11 12 4l9 7 M5 11v10h14V11 M10 21v-6h4v6",
  deck: "M3 5h18v14H3z M7 5v14 M11 5v14 M15 5v14 M19 5v14",
  path: "M4 21c2-6 4-9 4-12 0-2-1-3-1-5 M14 21c2-6 4-9 4-12 0-2-1-3-1-5",
  cabin: "M4 4h16v16H4z M12 4v16 M4 12h16 M8 20v-3 M16 20v-3",
  // Furniture
  sunbed: "M3 15h18v3H3z M5 18v3 M19 18v3 M6 15V9h6v6 M14 15v-3h7",
  sofa: "M3 11h18v7H3z M3 18v2 M21 18v2 M5 11V7h14v4 M9 11V8 M15 11V8",
  armchair: "M6 9h12v9H6z M6 12H4v4h2 M18 12h2v4h-2 M8 18v2 M16 18v2",
  table: "M3 9h18v3H3z M6 12v8 M18 12v8",
  hightable: "M6 6h12v2H6z M11.2 8h1.6v10h-1.6z M8 20h8",
  chair: "M7 10h10v8H7z M7 10V5h10v5 M9 18v2 M15 18v2",
  umbrella: "M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z M12 12v9 M9 21h6",
  // Grounds
  windscreen: "M3 20V8l6-3v15 M9 20V5l6 3v12 M15 20V8l6-3v15",
  fence: "M4 4v16 M10 4v16 M16 4v16 M22 4v16 M2 9h20 M2 15h20",
  bin: "M6 7h12l-1 14H7z M4 7h16 M10 4h4v3h-4z M10 11v6 M14 11v6",
  flag: "M7 3v18 M7 4h11l-3 4 3 4H7",
  playground: "M4 20V7l8-3 8 3v13 M9 20v-6h6v6 M12 4v3",
  volleyball: "M3 6h18v12H3z M12 4v16 M3 12h4 M17 12h4",
  plant: "M12 21v-8 M12 13c-4 0-6-3-6-6 4 0 6 2 6 6z M12 13c4 0 6-3 6-6-4 0-6 2-6 6z M8 21h8",
  // Utilities
  shower: "M12 3v6 M6 9h12a6 6 0 0 0-12 0z M9 14v1 M12 16v1 M15 14v1 M9 19v1 M15 19v1",
  water: "M6 4h12v16H6z M6 10h12 M9 14h6 M12 4v6",
  generator: "M3 8h18v10H3z M7 18v3 M17 18v3 M8 12h3l-1 3 4-5h-3l1-3z",
  container: "M2 7h20v11H2z M6 7v11 M10 7v11 M14 7v11 M18 7v11",
  dj: "M3 8h18v9H3z M8 12.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0z M16 11v3",
  // Interior
  counter: "M3 8h18v4H3z M3 12v8 M21 12v8 M3 20h18 M8 12v8 M16 12v8",
  tap: "M6 20h12 M9 20v-6h6v6 M12 14V8h5 M12 8H8a2 2 0 0 1 0-4h6",
  fridge: "M6 3h12v18H6z M6 10h12 M9 6v2 M9 13v3",
  kitchen: "M3 8h18v12H3z M3 12h18 M8 8V4h8v4 M7 16h4 M15 16h2",
  workbench: "M3 9h18v3H3z M5 12v9 M19 12v9 M5 17h14 M8 9V6h8v3",
  dishwasher: "M5 3h14v18H5z M5 8h14 M12 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M8 5.5h.01 M11 5.5h.01",
  register: "M4 9h16v11H4z M7 9V5h10v4 M8 13h8 M8 16h4",
  shelf: "M3 4h18v16H3z M3 9h18 M3 14h18 M9 4v16 M15 4v16",
  wc: "M7 3h10v6H7z M9 9v4a3 3 0 0 0 6 0V9 M12 16v5 M9 21h6",
  urinal: "M8 3h8v9a4 4 0 0 1-8 0z M12 16v5 M10 21h4",
  sink: "M4 10h16 M6 10v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6 M12 10V5a2 2 0 0 1 4 0",
  wall: "M3 10h18v4H3z M8 10v4 M13 10v4 M18 10v4",
  door: "M6 3h12v18H6z M15 12h.01 M6 21h12",
  box: "M4 4h16v16H4z",
  // Toolbar
  cursor: "M5 3l14 8-6 1-2 6z",
  measureTool: "M3 15 15 3l6 6L9 21z M8 10l2 2 M11 7l2 2 M14 12l2 2",
  arrayTool: "M4 4h5v5H4z M15 4h5v5h-5z M4 15h5v5H4z M15 15h5v5h-5z",
  undoIcon: "M4 10h9a5 5 0 1 1 0 10H8 M4 10l4-4 M4 10l4 4",
  redoIcon: "M20 10h-9a5 5 0 1 0 0 10h5 M20 10l-4-4 M20 10l-4 4",
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5 M11 8v6 M8 11h6",
  zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5 M8 11h6",
  fit: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5",
  trash: "M6 7h12l-1 13H7z M4 7h16 M10 4h4v3h-4z",
  copy: "M8 8h12v12H8z M4 16V4h12",
  grid: "M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18",
  palette: "M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z",
  rotate: "M12 5a7 7 0 1 1-7 7 M12 5V2 M12 5l3 2",
  layers: "M12 3 3 8l9 5 9-5z M3 13l9 5 9-5",
  overview: "M4 13h6V4H4z M14 20h6V9h-6z M4 20h6v-4H4z M14 6h6V4h-6z",
  tasks: "M4 6h4v4H4z M4 14h4v4H4z M10 8h10 M10 16h10",
  euro: "M17 6a7 7 0 1 0 0 12 M5 10h8 M5 14h8",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 3v3 M12 18v3 M4.2 7.5l2.6 1.5 M17.2 15l2.6 1.5 M4.2 16.5l2.6-1.5 M17.2 9l2.6-1.5",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  plus: "M12 5v14 M5 12h14",
  check: "M5 13l4 4L19 7",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M4 4l16 16 M2 12s4-6 10-6c2 0 3.6.6 5 1.5 M22 12s-4 6-10 6c-2 0-3.6-.6-5-1.5",
  lock: "M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3",
  unlock: "M6 11h12v9H6z M9 11V8a3 3 0 0 1 5.8-1",
  download: "M12 4v10 M8 11l4 4 4-4 M5 19h14",
  upload: "M12 20V9 M8 12l4-4 4 4 M5 4h14",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
  info: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 11v5 M12 8h.01",
  warning: "M12 4 2 20h20z M12 10v5 M12 17h.01",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2",
  help: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6 M12 16.5h.01",
};

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.6,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.box!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path.split(" M").map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

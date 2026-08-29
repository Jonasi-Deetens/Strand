# Strand

A desktop app for building a beach bar: draw the beach in 2D, and let the drawing
drive the procurement list, the quotes and the todo list. Everything you place on
the plan becomes a real line item with a status, and the status paints itself back
onto the drawing, so the plan fills in as the build progresses.

Interface language is Dutch by default and switchable to English. All data stays
on your machine in a local SQLite file.

## What it does

- **Plan** — a 60 × 70 m beach on a metre grid with rulers, a searchable
  catalogue, drag to place, snapping, alignment guides, an array tool for rows of
  cabins or umbrellas, a measure tool, layer locks and undo/redo. The selected
  building carries a live size and area readout, so you can resize the bar until
  it hits its 60 m² target. Double-click the bar or the toilet block to draw its
  interior on its own sheet.
- **Taken** — every object rolls up into a procurement line (40 cabins is one
  line with quantity 40), and each line gets a task. Manual items that you
  cannot draw — warehouse rent, permits, utilities, insurance — live in the same
  list.
- **Offertes** — quotes per supplier with lines linked to procurement lines,
  VAT, validity dates, a comparison view and a cheapest/chosen roll-up into the
  budget.
- **Overzicht** — budget versus quoted versus committed, progress per category,
  the next tasks with overdue flagged, and quotes about to expire.
- **Export** — a real DXF for CAD, and a true-scale PDF blueprint with a title
  block, scale bar, north arrow, legend and a priced schedule. The PDF comes in
  two flavours: **1:100**, which puts each sheet on the smallest ISO paper its
  drawing fits (a 60 × 70 m beach lands on A0, a bar interior on A4), and
  **fitted to A3** for something you can print at home. Also a PNG of the canvas
  and a portable `.json` project file for backup or sharing.

Statuses drive every colour: `nodig`, `offerte_aangevraagd`, `offerte_ontvangen`,
`besteld`, `geleverd`, `gebouwd`, `vervallen`.

## Requirements

- Node.js 20 or newer
- Rust 1.85 or newer (`rustup toolchain install stable`) for the desktop shell
- Linux only: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`,
  `librsvg2-dev`, `patchelf`, `build-essential`, `pkg-config`

```bash
# Debian/Ubuntu
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf build-essential pkg-config
```

macOS needs Xcode command line tools; Windows needs the MSVC build tools and the
WebView2 runtime.

## Getting started

```bash
npm install
npm run tauri:dev     # desktop app with hot reload
```

`npm run dev` alone runs the frontend in a browser on
[localhost:1420](http://localhost:1420). That is handy for UI work: the app then
stores its database in the browser via `sql.js` instead of a file, and the
export dialogs fall back to ordinary downloads.

## Building

```bash
npm run tauri:build   # installers in src-tauri/target/release/bundle
```

The build runs `npm run build` first, which typechecks and bundles the frontend.

## Checks

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest
```

Sample export artefacts can be generated without starting the app, which is the
quickest way to inspect blueprint changes:

```bash
npx vite-node scripts/sample-blueprint.ts   # writes a DXF and a PDF to /tmp
```

## How it is put together

```
migrations/          SQL schema and the Dutch catalogue seed, shared by Rust and TS
src/domain/          types, status vocabulary, derived-data sync, bootstrap
src/data/            SqlDriver, Tauri and sql.js implementations, row mapping, diffing
src/store/           Zustand project + editor stores, selectors
src/features/        editor, tasks, offertes, catalog, dashboard, settings, export
src-tauri/           Tauri v2 shell, plugin registration, migrations, capabilities
```

A few decisions worth knowing:

- **Millimetres as integers** are the canonical unit. No float drift, and DXF
  export is a direct mapping. The UI shows metres and snaps to 0.05 m.
- **Documents are pure.** Every mutation produces a new `ProjectDocument`; a diff
  against the previous one generates the SQL batch that persists it. Undo/redo is
  therefore just replaying documents, and history stays in sync with the database.
- **One migration source.** The `.sql` files are read by Rust with `include_str!`
  and by TypeScript with `?raw`, so the native and browser databases cannot drift.
- **Derived data is recomputed, not hand-maintained.** `syncDerived` rebuilds
  procurement lines and their tasks from the objects on the plan, rolling object
  statuses up into a line status.
- **The PDF is drawn from the model**, not screenshotted, so it is vector output
  at a true scale that a contractor can measure on paper. Sheet furniture and
  annotation are sized for A3 and scaled with the paper, so a 1:100 A0 sheet does
  not end up with an A3 title block in the corner.
- **Writes are one transaction.** The SQL plugin hands out a pooled connection
  per call, so a `BEGIN` from the frontend cannot be trusted to stay on one
  connection. The `apply_batch` command in `src-tauri/src/lib.rs` takes the pool
  out of the plugin's state and drives the transaction in Rust instead.

## Storage and backups

The database lives in the app's config directory as `strand.db`
(`~/.config/nl.strand.planner` on Linux,
`~/Library/Application Support/nl.strand.planner` on macOS,
`%APPDATA%\nl.strand.planner` on Windows). Nothing leaves the machine.

Use **Instellingen → Back-up → Project exporteren** for a portable `.json`
snapshot, and *Project importeren* to restore it or hand it to someone else.
Importing replaces the current project.

## Keyboard

`V` select · `R` array · `M` measure · `G` grid · `S` next status · `L` lock ·
arrows nudge (Shift for 1 m) · `⌘/Ctrl+D` duplicate · `⌘/Ctrl+Z` undo ·
`⌘/Ctrl+⇧+Z` redo · `?` shows the full list.

The toolbar also toggles the grid, the rulers, object labels and snapping, and
switches colour between per status and per item type.

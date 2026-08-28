-- Strand schema v1. All lengths are millimetres (integer), all money is cents.
-- This file is the single source of truth: the Rust side embeds it with
-- include_str! and the browser/test driver imports it with ?raw.

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  plot_w_mm    INTEGER NOT NULL,
  plot_h_mm    INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenes (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('beach', 'interior')),
  parent_object_id TEXT,
  name             TEXT NOT NULL,
  w_mm             INTEGER NOT NULL,
  h_mm             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_parent ON scenes(parent_object_id);

CREATE TABLE IF NOT EXISTS item_types (
  id               TEXT PRIMARY KEY,
  category         TEXT NOT NULL,
  name_nl          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  icon             TEXT NOT NULL,
  shape            TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'circle')),
  placement        TEXT NOT NULL DEFAULT 'beach' CHECK (placement IN ('beach', 'interior', 'both')),
  default_w_mm     INTEGER NOT NULL,
  default_h_mm     INTEGER NOT NULL,
  resizable        INTEGER NOT NULL DEFAULT 1,
  has_interior     INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  target_area_m2   REAL,
  colour           TEXT NOT NULL DEFAULT '#43b6ba'
);

CREATE TABLE IF NOT EXISTS procurement_lines (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type_id        TEXT REFERENCES item_types(id),
  variant             TEXT,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL,
  qty_planned         REAL NOT NULL DEFAULT 0,
  derived             INTEGER NOT NULL DEFAULT 1,
  budget_cents        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'nodig',
  unit                TEXT NOT NULL DEFAULT 'stuk',
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_lines_project ON procurement_lines(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lines_type_variant
  ON procurement_lines(project_id, item_type_id, IFNULL(variant, ''))
  WHERE item_type_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS objects (
  id                   TEXT PRIMARY KEY,
  scene_id             TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  item_type_id         TEXT NOT NULL REFERENCES item_types(id),
  variant              TEXT,
  x_mm                 INTEGER NOT NULL,
  y_mm                 INTEGER NOT NULL,
  w_mm                 INTEGER NOT NULL,
  h_mm                 INTEGER NOT NULL,
  rotation_deg         REAL NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'nodig',
  procurement_line_id  TEXT REFERENCES procurement_lines(id) ON DELETE SET NULL,
  label                TEXT,
  notes                TEXT,
  locked               INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_objects_scene ON objects(scene_id);
CREATE INDEX IF NOT EXISTS idx_objects_line ON objects(procurement_line_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  contact TEXT,
  email   TEXT,
  phone   TEXT,
  notes   TEXT
);

CREATE TABLE IF NOT EXISTS offertes (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id   TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  reference     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'aangevraagd',
  requested_at  TEXT,
  received_at   TEXT,
  valid_until   TEXT,
  file_path     TEXT,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_offertes_project ON offertes(project_id);

CREATE TABLE IF NOT EXISTS offerte_lines (
  id                  TEXT PRIMARY KEY,
  offerte_id          TEXT NOT NULL REFERENCES offertes(id) ON DELETE CASCADE,
  procurement_line_id TEXT REFERENCES procurement_lines(id) ON DELETE SET NULL,
  description         TEXT NOT NULL DEFAULT '',
  qty                 REAL NOT NULL DEFAULT 1,
  unit_price_cents    INTEGER NOT NULL DEFAULT 0,
  vat_pct             REAL NOT NULL DEFAULT 21
);

CREATE INDEX IF NOT EXISTS idx_offerte_lines_offerte ON offerte_lines(offerte_id);
CREATE INDEX IF NOT EXISTS idx_offerte_lines_line ON offerte_lines(procurement_line_id);

CREATE TABLE IF NOT EXISTS tasks (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  procurement_line_id TEXT REFERENCES procurement_lines(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open',
  due_date            TEXT,
  assignee            TEXT,
  notes               TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  auto                INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_line ON tasks(procurement_line_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

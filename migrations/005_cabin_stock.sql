-- Parasols read as a white square shade on the plan, not a round canopy
-- with a pole through it.
UPDATE item_types
SET
  shape = 'rect',
  colour = '#e8e4dc',
  image = CASE id
    WHEN 'it_parasol' THEN 'catalog/it_parasol.webp'
    WHEN 'it_parasol_xl' THEN 'catalog/it_parasol_xl.webp'
    WHEN 'it_parasol_xxl' THEN 'catalog/it_parasol_xxl.webp'
    ELSE image
  END
WHERE id IN ('it_parasol', 'it_parasol_xl', 'it_parasol_xxl');

-- What belongs in a cabin, and how much of it is already in.
CREATE TABLE IF NOT EXISTS cabin_stock (
  id           TEXT PRIMARY KEY,
  cabin_id     TEXT NOT NULL,
  item_type_id TEXT,
  title        TEXT NOT NULL,
  qty_needed   INTEGER NOT NULL DEFAULT 1,
  qty_ready    INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (cabin_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id)
);

CREATE INDEX IF NOT EXISTS idx_cabin_stock_cabin ON cabin_stock(cabin_id);

-- Existing cabins get the same starter kit a newly placed one would.
INSERT OR IGNORE INTO cabin_stock (id, cabin_id, item_type_id, title, qty_needed, qty_ready, sort_order)
SELECT
  'cs_' || o.id || '_stoel',
  o.id,
  'it_stoel',
  (SELECT name_nl FROM item_types WHERE id = 'it_stoel'),
  2, 0, 0
FROM objects o
WHERE o.item_type_id IN (SELECT id FROM item_types WHERE category = 'cabine')
  AND EXISTS (SELECT 1 FROM item_types WHERE id = 'it_stoel');

INSERT OR IGNORE INTO cabin_stock (id, cabin_id, item_type_id, title, qty_needed, qty_ready, sort_order)
SELECT
  'cs_' || o.id || '_regie',
  o.id,
  'it_regisseursstoel',
  (SELECT name_nl FROM item_types WHERE id = 'it_regisseursstoel'),
  2, 0, 1
FROM objects o
WHERE o.item_type_id IN (SELECT id FROM item_types WHERE category = 'cabine')
  AND EXISTS (SELECT 1 FROM item_types WHERE id = 'it_regisseursstoel');

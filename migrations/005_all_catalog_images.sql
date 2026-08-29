-- Pictures for every remaining catalogue type, plus a 7 × 7 m commercial
-- parasol at the price the project actually quotes.

INSERT OR IGNORE INTO item_types
  (id, category, name_nl, name_en, icon, shape, placement, default_w_mm, default_h_mm,
   resizable, has_interior, unit_price_cents, target_area_m2, colour, image)
VALUES
  ('it_parasol_xxl', 'parasol', 'Parasol 7×7', 'Umbrella 7×7', 'umbrella', 'circle',
   'beach', 7000, 7000, 1, 0, 1500000, NULL, '#b45309', 'catalog/it_parasol_xxl.webp');

UPDATE item_types SET image = 'catalog/' || id || '.webp'
WHERE image IS NULL;

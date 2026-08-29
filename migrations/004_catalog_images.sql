-- Top-down plan images and measured outdoor types. Existing projects keep
-- their generic stoel / loungebank; these rows are additive.

ALTER TABLE item_types ADD COLUMN image TEXT;

UPDATE item_types SET image = 'catalog/it_ligbed.webp' WHERE id = 'it_ligbed';
UPDATE item_types SET image = 'catalog/it_loungebank.webp' WHERE id = 'it_loungebank';
UPDATE item_types SET image = 'catalog/it_loungestoel.webp' WHERE id = 'it_loungestoel';
UPDATE item_types SET image = 'catalog/it_plantenbak.webp' WHERE id = 'it_plantenbak';
UPDATE item_types SET image = 'catalog/it_speeltoestel.webp' WHERE id = 'it_speeltoestel';

-- Footprints are open-product sizes, snapped to 50 mm.
INSERT OR IGNORE INTO item_types
  (id, category, name_nl, name_en, icon, shape, placement, default_w_mm, default_h_mm,
   resizable, has_interior, unit_price_cents, target_area_m2, colour, image)
VALUES
  ('it_regisseursstoel',  'meubilair', 'Regisseursstoel aluminium', 'Aluminium director chair', 'chair',      'rect',   'beach',  550,  540, 0, 0,   9500, NULL, '#8b9aa0', 'catalog/it_regisseursstoel.webp'),
  ('it_houten_lounge',    'meubilair', 'Houten loungebank',         'Wooden lounge sofa',        'sofa',       'rect',   'beach', 2000,  900, 1, 0, 189000, NULL, '#9a6b3f', 'catalog/it_houten_lounge.webp'),
  ('it_houten_loungestoel','meubilair', 'Houten loungestoel',        'Wooden lounge chair',       'armchair',   'rect',   'beach',  850,  850, 0, 0,  79000, NULL, '#b07d4a', 'catalog/it_houten_loungestoel.webp'),
  ('it_wipkip',           'terrein',   'Wipkip',                    'Spring rider',              'wipkip',     'rect',   'beach',  900,  400, 0, 0,  45000, NULL, '#eab308', 'catalog/it_wipkip.webp'),
  ('it_schommel',         'terrein',   'Schommel',                  'Swing set',                 'schommel',   'rect',   'beach', 3500, 2000, 1, 0, 180000, NULL, '#22c55e', 'catalog/it_schommel.webp'),
  ('it_zandbak',          'terrein',   'Zandbak',                   'Sandpit',                   'zandbak',    'rect',   'beach', 2000, 2000, 1, 0,  35000, NULL, '#d4a017', 'catalog/it_zandbak.webp'),
  ('it_glijbaan',         'terrein',   'Glijbaan',                  'Slide',                     'glijbaan',   'rect',   'beach', 3500,  800, 1, 0, 120000, NULL, '#3b82f6', 'catalog/it_glijbaan.webp'),
  ('it_helmgras',         'groen',     'Helmgras',                  'Marram grass',              'helmgras',   'circle', 'beach',  800,  800, 1, 0,   4500, NULL, '#65a30d', 'catalog/it_helmgras.webp'),
  ('it_duindoorn',        'groen',     'Duindoorn',                 'Sea buckthorn',             'duindoorn',  'circle', 'beach', 1500, 1500, 1, 0,   8500, NULL, '#4d7c0f', 'catalog/it_duindoorn.webp'),
  ('it_palm',             'groen',     'Palm',                      'Small palm',                'palm',       'circle', 'beach', 2500, 2500, 1, 0,  35000, NULL, '#15803d', 'catalog/it_palm.webp');

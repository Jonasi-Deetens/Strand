-- The brief asks for a toilet building on the same footing as the bar: custom
-- sized, aiming at 60 m2 in total. It shipped with an 18 m2 target and a 6 x 3 m
-- default, which made every placed toilet read as far under target.
UPDATE item_types
SET default_w_mm = 10000,
    default_h_mm = 6000,
    target_area_m2 = 60
WHERE id = 'it_toilet';

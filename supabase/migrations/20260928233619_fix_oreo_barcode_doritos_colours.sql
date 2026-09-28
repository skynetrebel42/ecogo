-- Final-review fix for real_barcodes_doritos_oreo (checked against USDA FoodData Central 2026-09-28):
-- 044000042554 is a coloured Oreo variety (Yellow 5, Red 40, Blue 1), so it gave a false green on our Original Oreo page.
-- Original Oreo is 044000032029 (fdcId 2500691, no colours). Doritos' official label lists three colours, not one.
update public.products set barcode = '044000032029', name = 'Oreo Original Cookies' where id = 14;
update public.products
   set ingredients = replace(ingredients, 'artificial color (Yellow 6)', 'artificial color (including Yellow 6, Yellow 5, and Red 40)')
 where id = 13;

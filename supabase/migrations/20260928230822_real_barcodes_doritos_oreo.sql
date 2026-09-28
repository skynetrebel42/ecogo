-- The Figma export invented the catalog barcodes. Two of them belong to other real products in USDA FoodData
-- Central (028400064057 = Tostitos Bite Size, 044000030438 = Wheat Thins), so scanning those packages opened the
-- wrong page. Point them at the real products' records (checked 2026-09-28). The other invented codes match nothing.
update public.products set barcode = '028400335799', name = 'Doritos Nacho Cheese Tortilla Chips' where id = 13;
update public.products set barcode = '044000042554', name = 'Oreo Original Cookies 10.7oz' where id = 14;

-- M6 (owner decision C1): no verified barcode, no barcode. Non-food products have no USDA record to verify against,
-- and their Figma-invented codes could open the wrong page once real camera scanning exists. They stay searchable.
update public.products set barcode = null where id in (2, 5, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 48, 49, 50, 51);

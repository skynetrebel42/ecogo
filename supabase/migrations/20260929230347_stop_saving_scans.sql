-- Scans are no longer saved (owner decision M3-4, 2026-09-29): nothing reads them, and an anonymous insert grant
-- would let anyone flood the table once the site is public (S-04). Existing rows stay (service_role only).
drop policy if exists "Anyone can record a scan" on public.scan_events;
revoke insert on public.scan_events from anon, authenticated;
revoke insert (barcode, product_id, store, price, latitude, longitude) on public.scan_events from anon, authenticated;

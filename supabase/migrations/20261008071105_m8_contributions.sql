-- M8: the submission log for "Add a product" (spec docs/superpowers/specs/2026-10-02-m8-add-product-design.md §5).
-- Only the off-submit Edge Function (service role) writes rows; a signed-in (anonymous) person can read their own.
-- Holds no photos, text or location.
create table public.contributions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  barcode     text not null check (barcode ~ '^[0-9]{8,14}$'),
  status      text not null default 'pending' check (status in ('pending','sent','failed')),
  error       text,
  created_at  timestamptz not null default now()
);
create index contributions_user_day on public.contributions (user_id, created_at);
create index contributions_day on public.contributions (created_at); -- the 200-a-day count across everyone
alter table public.contributions enable row level security;
revoke all on public.contributions from anon, authenticated;
grant select on public.contributions to authenticated;          -- no insert/update/delete for browsers
create policy "Read your own contributions" on public.contributions
  for select to authenticated using (user_id = (select auth.uid()));

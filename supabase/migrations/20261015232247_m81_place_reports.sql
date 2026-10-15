-- M8.1: Map suggestions and reports (spec docs/superpowers/specs/2026-10-15-m81-suggest-report-design.md P4, P5).
-- Only the place-submit Edge Function (service role) inserts rows; the owner reviews them in the Supabase dashboard
-- (status + reviewed_at). A signed-in (anonymous) person can read their own rows, as `contributions` (046).
-- place-submit deletes rows reviewed more than 90 days ago.
create table public.place_reports (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('suggest','report')),
  place_ref    text check (place_ref ~ '^((node|way|relation)/[1-9][0-9]*|county/[1-9][0-9]*)$'),
  fields       jsonb not null,
  status       text not null default 'new' check (status in ('new','approved','rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  check ((kind = 'report') = (place_ref is not null))  -- a report names its place; a suggestion has none
);
create index place_reports_user_day on public.place_reports (user_id, created_at);
create index place_reports_day on public.place_reports (created_at); -- the 50-a-day count across everyone
alter table public.place_reports enable row level security;
revoke all on public.place_reports from anon, authenticated;
grant select on public.place_reports to authenticated;          -- no insert/update/delete for browsers
create policy "Read your own place reports" on public.place_reports
  for select to authenticated using (user_id = (select auth.uid()));

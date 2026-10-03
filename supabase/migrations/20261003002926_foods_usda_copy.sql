-- foods: EcoGo's read-only copy of USDA FoodData Central Branded Foods, one row per barcode. Loaded by
-- scripts/import-usda.mjs with the service role (the owner runs it); browsers can only select.
-- Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §3.

create table public.foods (
  barcode_key      text primary key check (barcode_key <> ''), -- digits, leading zeros stripped (barcodeKey() in lookup.ts)
  barcode          text not null,                              -- as USDA stores it (8, 12 or 14 digits)
  fdc_id           bigint not null,
  name             text not null,
  brand            text not null default '',
  category         text not null default '',                   -- USDA brandedFoodCategory
  ingredients      text not null,
  serving_size     real,
  serving_unit     text not null default '',                   -- "g" or "ml" (older records: GRM, MLT)
  serving_text     text not null default '',                   -- household serving, e.g. "3 cookies"
  added_sugar_100g real,                                       -- per 100 g or ml; null = not listed
  sat_fat_100g     real,
  sodium_100g      real,                                       -- mg
  verdict          text not null check (verdict in ('none', 'some', 'high', 'known', 'no-data')),
  verdict_rank     smallint not null,                          -- orders results and alternatives; the app recomputes the badge
  flags            smallint not null default 0,
  cooked           boolean not null default false,
  engine_rev       smallint not null,
  snapshot         date not null                               -- USDA release date
);

create index foods_category_rank_idx on public.foods (category, verdict_rank);
-- An expression index (not a stored column): saves tens of MB. Queries must use exactly this expression.
create index foods_search_idx on public.foods using gin (to_tsvector('simple', name || ' ' || brand));

-- ── Access: browsers can read, only the service role writes ─────────────────

alter table public.foods enable row level security;
revoke all on public.foods from anon, authenticated;
grant select on public.foods to anon, authenticated;
grant select, insert, update, delete on public.foods to service_role;
create policy "Foods are publicly readable" on public.foods
  for select to anon, authenticated using (true);

-- ── Search and alternatives ─────────────────────────────────────────────────

-- q is a to_tsquery string the app builds from the typed words, e.g. '(ice | ices) & (cream | creams)'.
create function public.search_foods(q text, n integer default 10)
returns setof public.foods
language sql stable
set search_path = ''
as $$
  select f.*
  from public.foods f
  where to_tsvector('simple', f.name || ' ' || f.brand) @@ to_tsquery('simple', q)
  order by ts_rank(to_tsvector('simple', f.name || ' ' || f.brand), to_tsquery('simple', q)) desc, length(f.name), f.name
  limit least(greatest(n, 1), 50)
$$;

-- Same category, a strictly better level than my_rank, complete records only, best first.
create function public.alternatives_for(cat text, my_rank smallint, exclude_key text, n integer default 3)
returns setof public.foods
language sql stable
set search_path = ''
as $$
  select f.*
  from public.foods f
  where cat <> '' and f.category = cat and f.verdict_rank < my_rank and f.barcode_key <> exclude_key
    and f.ingredients <> '' and f.serving_size is not null and f.sodium_100g is not null
  order by f.verdict_rank, f.flags, f.name
  limit least(greatest(n, 1), 20)
$$;

grant execute on function public.search_foods(text, integer), public.alternatives_for(text, smallint, text, integer)
  to anon, authenticated;

-- foods follow-up (M10, measured after the first real import: 430,127 rows, 238 MB).
-- 1. search_foods and alternatives_for were SQL functions with `set search_path`, which Postgres can't inline: they ran
--    on a generic plan that didn't know the search words, and "chocolate" (36,888 matches) took 7.5 s, past the anon
--    role's 3 s statement timeout, so common searches would fail in the app. As plpgsql with EXECUTE ... USING each call
--    is planned with its real values: same results and order, 0.85 s for "chocolate"; alternatives 0.65-0.85 s.
-- 2. An index on snapshot lets the importer find older rows cheaply and remove them in small batches (one DELETE over
--    the whole table hit the statement timeout at the end of the first import).

create or replace function public.search_foods(q text, n integer default 10)
returns setof public.foods
language plpgsql stable
set search_path = ''
as $$
begin
  return query execute
    'select f.* from public.foods f
     where to_tsvector(''simple'', f.name || '' '' || f.brand) @@ to_tsquery(''simple'', $1)
     order by ts_rank(to_tsvector(''simple'', f.name || '' '' || f.brand), to_tsquery(''simple'', $1)) desc, length(f.name), f.name
     limit least(greatest($2, 1), 50)'
    using q, n;
end
$$;

create or replace function public.alternatives_for(cat text, my_rank smallint, exclude_key text, n integer default 3)
returns setof public.foods
language plpgsql stable
set search_path = ''
as $$
begin
  return query execute
    'select f.* from public.foods f
     where $1 <> '''' and f.category = $1 and f.verdict_rank < $2 and f.barcode_key <> $3
       and f.ingredients <> '''' and f.serving_size is not null and f.sodium_100g is not null
     order by f.verdict_rank, f.flags, f.name
     limit least(greatest($4, 1), 20)'
    using cat, my_rank, exclude_key, n;
end
$$;

create index foods_snapshot_idx on public.foods (snapshot);

-- search_foods: shortest names first, then name. Measured as anon (3 s statement timeout) on 430,127 rows, ranking by
-- ts_rank re-reads every match's text and timed out for "cheese" (30,174 matches); this order takes 1.0 s for "cheese"
-- and 1.2 s for "chocolate". Same matches, different order. Planned per call (plpgsql EXECUTE ... USING).

create or replace function public.search_foods(q text, n integer default 10)
returns setof public.foods
language plpgsql stable
set search_path = ''
as $$
begin
  return query execute
    'select f.* from public.foods f
     where to_tsvector(''simple'', f.name || '' '' || f.brand) @@ to_tsquery(''simple'', $1)
     order by length(f.name), f.name
     limit least(greatest($2, 1), 50)'
    using q, n;
end
$$;

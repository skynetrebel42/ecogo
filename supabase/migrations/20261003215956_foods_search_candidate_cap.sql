-- search_foods: take at most 1,000 matching rows from the full-text index, then show the shortest names among them.
-- Sorting every match (30,000+ for "cheese") reads that many heap rows and, with a cold cache, ran past the anon role's
-- 3 s statement timeout. Measured as anon with the cap: "cheese" 0.06 s, "with" 0.25 s. Every result still matches
-- every word; for a very common word the results come from the first 1,000 matches, not all of them.

create or replace function public.search_foods(q text, n integer default 10)
returns setof public.foods
language plpgsql stable
set search_path = ''
as $$
begin
  return query execute
    'select c.* from (
       select f.* from public.foods f
       where to_tsvector(''simple'', f.name || '' '' || f.brand) @@ to_tsquery(''simple'', $1)
       limit 1000) c
     order by length(c.name), c.name
     limit least(greatest($2, 1), 50)'
    using q, n;
end
$$;

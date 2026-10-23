-- 075 H3 (audit C1): nothing invented. No source backs "1,4-dioxane (trace)" on the Tide PODS sample (products id 2),
-- so only that part of its ingredients goes; the guard makes it a no-op if the row has changed since.
update public.products
set ingredients = 'Anionic surfactants, nonionic surfactants, enzymes, fragrance, methylisothiazolinone'
where id = 2
  and ingredients = 'Anionic surfactants, nonionic surfactants, enzymes, fragrance, methylisothiazolinone, 1,4-dioxane (trace)';

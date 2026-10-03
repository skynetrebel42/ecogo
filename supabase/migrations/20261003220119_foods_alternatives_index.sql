-- alternatives_for walks this index in its own order (category, then level, flags, name) over complete records only, so
-- it stops after the first few rows. Without it, "Cheese" (16,494 rows) took 2.97 s as anon with a cold cache, at the
-- 3 s statement timeout; with it, 0.036 s.

create index foods_alternatives_idx on public.foods (category, verdict_rank, flags, name)
  where ingredients <> '' and serving_size is not null and sodium_100g is not null;

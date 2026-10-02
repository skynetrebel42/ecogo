# Data ownership: EcoGo's own copy of USDA Branded Foods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Product lookups, nutrition, text search and "alternatives" read a read-only copy of USDA FoodData Central
Branded Foods that lives in EcoGo's own Supabase database, so the USDA key leaves the public JavaScript and scanning no
longer depends on USDA being reachable.

**Architecture:** one new table, `foods` (about 431,000 products, one row per barcode, each scored by the app's own safety
engine for ordering), read through a small interface (`FoodsSource`) with a Supabase adapter for the app and an in-memory
adapter for tests. `lookup.ts` asks it first and falls back to Open Food Facts live. A script the **owner** runs loads the
table from USDA's download. The product page still computes the badge in the browser.

**Tech Stack:** React 18 + Vite 6, Supabase (Postgres, PostgREST RPC), Node `node --test` with type stripping (Node 24).
No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md`. Read it first: it holds the decisions (O1-O9),
the spike numbers and the table. **Milestone: M10** (order: M7.4 ✓ → M7.5 ✓ → M9 ✓ → **M10** → M8).

**Re-verified 2026-10-02 against `main` at `f5e6fdf`** (M7.5, the USDA key relay, and M9, the real map, have landed). What
changed since this plan was first written: the three call sites now pass `{ relayUrl: USDA_RELAY_URL }` (the Task 4 anchors
are rewritten); `supabase/functions/usda-relay/` exists and `npm test` also runs its tests (Task 4 removes the function's
code and the extra test glob; Task 6 deletes the deployed function and its secret, with the owner's OK); the decision log
is at 027, so this milestone's row is 028; the docs already describe the relay (Task 6's doc edits are rewritten).
**Re-check once more when the Knight's audit batch lands** (it removes the realtime channel from `App.tsx` and makes
`lookup.ts` import `record` from `nutrition.ts`): Task 2 replaces both files as wholes, so if `nutrition.ts` then exports
`record`, keep that export in the replacement and import it in the new `lookup.ts` instead of its own copy; and re-run the
Task 4 greps.

**How this plan was checked (on a scratch copy of `main` at `f5e6fdf`):** every new or replaced file below was copied from
a copy where this plan's edits were applied and the relay removed: `npm test` passed with **178** tests (166 in `src/lib`
on `main`, plus 12 added by this plan; `main` itself runs 174 because 8 more are the relay's), `vite build` succeeded, the
built JavaScript contains none of `api.nal.usda.gov`, `usda-relay` and `DEMO_KEY`, and
`npm run import:usda -- <sample file> --dry-run` printed the expected counts. Every `old_string` below was applied to that
copy (the files have CRLF line endings: the Edit tool copes, a script must too). **Not checked:** the SQL (Task 1 runs it in
a rolled-back transaction first), the headless checks (they need the loaded table), and the import of the real 195 MB file
(measured earlier by a throwaway script: 431,302 products, about 235 MB).

## Global Constraints

- **Branch:** work in a git worktree on branch `data-ownership` (Task 0). **Do not commit to `main` or push until Task 6
  says so.** The app change reads the `foods` table; if it reached the live site before the table is loaded, every
  scan would fall through to Open Food Facts.
- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes). If a
  multi-line `old_string` doesn't match (line endings), use a one-line one.
- **Secrets:** the Supabase service-role key lives only in the owner's gitignored `.env.local` as
  `SUPABASE_SERVICE_ROLE_KEY`. Never print it, paste it into chat, put it in CI or commit it. **The owner runs the import**
  (Task 5).
- **Database work:** use the Supabase connector (project `ecogo` = `gippyavmxxzqxjkuahpt`), not curl. Never edit an
  applied migration; the migration's file name must carry the version the connector assigns.
- **Facts first:** a wrong flag is the worst bug. The launch audit (Task 5) is a gate, not a suggestion. No invented
  numbers in docs: write what you measured.
- **Free tier:** stop and tell the owner if `pg_total_relation_size('public.foods')` is over **400 MB** (limit 500 MB).
- **Open Food Facts is not copied** (ODbL share-alike, crowd-sourced). It stays a live, labelled fallback. 8-digit codes
  never go to Open Food Facts.
- **Text rules:** product pages say "USDA label data, supplied by the manufacturer (snapshot Mon YYYY)"; Profile says
  barcodes and search words go to EcoGo's database (hosted on Supabase) and, if not there, to Open Food Facts.
- **Scope:** only the builder edits `src/` and `scripts/`. This plan touches `lookup.ts`, `ScanTab.tsx`,
  `NutritionPanel.tsx`, `ProductDetailScreen.tsx`, `supabase.ts` and search in `App.tsx`: nothing else may edit them
  meanwhile. M8 (add a product) comes after this plan: its own plan must call `lookupBarcode(code, { foods: supabaseFoods })`
  (no key, no relay URL).
- **M7.5's relay goes away here.** The app stops calling `usda-relay` in Task 4, and its code is removed there; the
  deployed function and its secret `FDC_API_KEY` are deleted in Task 6 **after** the live checks, and only with the owner's
  OK (asked in chat right before, like a deploy). Until then a revert of the app commits still works.
- **Decision log:** one row in PROJECT_HANDOFF's decision log (number 028 at the time of writing; use the next free number)
  that supersedes 016's live USDA lookup and 026 (the relay). Specs link to the log; don't repeat decisions elsewhere.
- **Commits:** one per task, only your own files, by path (`git add <path>`; never `git add -A` or `commit -a`).
  End each message with the attribution line your session gives you.
- **Fixes log:** any fix found during review that isn't in this plan gets an entry in `FIXES_AND_UPDATES.md`.
- **No type check exists** (no `tsc`, no tsconfig): the tests and `vite build` are the safety net, so grep for every name
  you remove.

## Review Focus

Failure modes the spec implies that a person using the app would hit; each is pinned by a test or a gate below.

1. **The database is unreachable or paused.** A scan must say "Couldn't reach the product databases" and offer Try again,
   never "not found", and must not cache the failure. *(Task 2: `errors are retried…`, `our table down but OFF has it…`)*
2. **Search words reach Postgres's `to_tsquery`, which throws on stray syntax** (`& | ! ( ) : *`, quotes, accents).
   Only letters and digits may get through, at most 8 words. *(Task 2: `only letters and digits…`; Task 1 trial)*
3. **One product, many spellings:** 12-, 13- and 14-digit forms, leading zeros, spaces and dashes, and 8-digit UPC-E
   codes (database only, never Open Food Facts). *(Task 2)*
4. **USDA repeats barcodes (4.5% of the file) and writes dates as month/day/year** (`3/22/2018`), which don't sort as text:
   the newest label must win. *(Task 3: `usdaDate`, `keepNewest`.)* The streaming reader must also keep records whole at
   every chunk edge and when a string holds braces, quotes or a trailing backslash. *(Task 3: splitter tests.)*
5. **A badge that isn't true, multiplied by 82,000 products.** *(Task 5: the audit gate.)*

## File structure

| File | Change |
|---|---|
| `supabase/migrations/<version>_foods_usda_copy.sql` | New: table, indexes, RLS, `search_foods`, `alternatives_for` |
| `src/lib/foods.ts` | New, pure: `FoodRow`, `FoodsSource`, `foodRowToProduct`, `tsQueryFor`, `snapshotLabel` |
| `src/lib/foodsFake.ts` | New, tests only: `memoryFoods`, `foodRow`, `rowFromUsdaSearch` |
| `src/lib/foodsDb.ts` | New, browser only: `supabaseFoods` (the Supabase adapter) |
| `src/lib/foodsImport.ts` | New, pure: `usdaRecordToRow`, `usdaDate`, `keepNewest`, `recordSplitter` |
| `scripts/import-usda.mjs`, `scripts/audit-foods.mjs` | New: the owner's loader; the launch-audit sampler |
| `src/lib/lookup.ts` | Replaced: USDA web calls out, `foods` in (`lookupBarcode`, `searchFoods`, `barcodeKey`) |
| `src/lib/nutrition.ts` | Replaced: `usdaNutrition` out, `dbNutrition` in |
| `src/lib/productImporter.ts` | `ProductSource.snapshot?` |
| `src/app/components/useAlternatives.ts` | New: alternatives from `foods` |
| `NutritionPanel.tsx`, `ScanTab.tsx`, `ProductDetailScreen.tsx`, `App.tsx` | Small edits (Task 4) |
| `supabase/functions/usda-relay/index.ts`, `index.test.ts` | Deleted (Task 4); the deployed function and its secret are deleted in Task 6, with the owner's OK |
| `src/lib/supabase.ts`, `package.json` | `USDA_RELAY_URL` removed; `import:usda` script added, and the `test` script goes back to `src/lib` only |
| `.github/workflows/deploy.yml`, `keep-alive.yml` | One comment line about the relay removed; weekly keep-alive added |
| Tests | `foods.test.ts`, `foodsImport.test.ts` new; `lookup.test.ts`, `nutrition.test.ts` replaced; fixture `usda-download/sample-branded_2025-12-18.json` |
| Docs | README, PROJECT_HANDOFF (a decision row), KNOWN_ISSUES, ARCHITECTURE, SYNOPSIS: relay text becomes table text |

---

### Task 0: Worktree and baseline

**Files:** none (sets up the workspace).

- [ ] **Step 1: Create the worktree on a new branch**

From `C:\Users\minhb\Downloads\EcoGo!`:

```bash
git worktree add ../EcoGo-foods -b data-ownership main
```

- [ ] **Step 2: Link `node_modules` (PowerShell, in `EcoGo-foods`)**

```powershell
New-Item -ItemType Junction -Path node_modules -Target "C:\Users\minhb\Downloads\EcoGo!\node_modules"
```

- [ ] **Step 3: Baseline**

Run `npm test` and `npm run build` in `EcoGo-foods`.
Expected: all pass, and a successful build. Note the count N0 (174 on `f5e6fdf`: 166 in `src/lib` plus 8 for the relay);
the counts below are relative to it.

All the paths below are relative to the worktree. No commit.

---

### Task 1: The `foods` table and its two functions

**Files:**
- Create: `supabase/migrations/<version>_foods_usda_copy.sql` (the version comes from step 3)

- [ ] **Step 1: Write the migration to a temporary name**

Create `supabase/migrations/PENDING_foods_usda_copy.sql` with exactly:

```sql
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
```

- [ ] **Step 2: Trial run in a transaction that is rolled back**

With the Supabase connector's `execute_sql`, send ONE call containing, in order: `begin;`, the whole migration above, the
trial block below, and `rollback;`.

```sql
-- Three made-up rows, then the checks. Runs inside the trial transaction, so nothing is kept.
insert into public.foods (barcode_key, barcode, fdc_id, name, brand, category, ingredients, serving_size, serving_unit, sodium_100g,
                          verdict, verdict_rank, flags, engine_rev, snapshot) values
  ('44000032029', '044000032029', 1, 'Chocolate Sandwich Cookies', 'Oreo', 'Cookies & Biscuits', 'SUGAR, FLOUR', 34, 'g', 382, 'none', 0, 0, 1, '2025-12-18'),
  ('1',           '000000000001', 2, 'Red Cookies',                'Test', 'Cookies & Biscuits', 'SUGAR, RED 40', 30, 'g', 100, 'some', 1, 1, 1, '2025-12-18'),
  ('2',           '000000000002', 3, 'Ice Cream Bar',              'Test', 'Ice Cream',          'MILK',          50, 'g',  20, 'none', 0, 0, 1, '2025-12-18');

select
  (select count(*) from public.search_foods('(red | reds) & (cookie | cookies)', 10))                        as red_cookies,   -- 1
  (select count(*) from public.search_foods('(ice | ices) & (cream | creams)', 10))                          as ice_cream,     -- 1
  (select count(*) from public.search_foods('(red | reds)', 10))                                             as red,           -- 1
  (select count(*) from public.search_foods('(cookie | cookies)', 1))                                        as limited,       -- 1 (n = 1)
  (select string_agg(barcode_key, ',') from public.alternatives_for('Cookies & Biscuits', 1::smallint, '1', 3)) as better,      -- 44000032029
  (select count(*) from public.alternatives_for('Cookies & Biscuits', 0::smallint, 'x', 3))                  as none_better,   -- 0
  (select count(*) from public.alternatives_for('', 1::smallint, 'x', 3))                                    as blank_category; -- 0
```

Expected result row: `red_cookies 1, ice_cream 1, red 1, limited 1, better "44000032029", none_better 0, blank_category 0`.
Then confirm nothing was kept: `select to_regclass('public.foods');` returns null. If any statement errors, fix the SQL and
repeat; nothing has been applied yet.

- [ ] **Step 3: Apply it and name the file by its version**

`apply_migration` with name `foods_usda_copy` and the same SQL (without the trial). Then `list_migrations`: take the new
entry's version and rename the file to `supabase/migrations/<version>_foods_usda_copy.sql`.

- [ ] **Step 4: Check access and advisors**

With `execute_sql`:

```sql
select has_table_privilege('anon', 'public.foods', 'select') as anon_select,   -- true
       has_table_privilege('anon', 'public.foods', 'insert') as anon_insert,   -- false
       has_table_privilege('anon', 'public.foods', 'update') as anon_update,   -- false
       has_table_privilege('anon', 'public.foods', 'delete') as anon_delete;   -- false
```

Then, as two separate calls:

```sql
begin; set local role anon; select count(*) from public.foods; rollback;   -- 0, no error
```

```sql
begin; set local role anon;
insert into public.foods (barcode_key, barcode, fdc_id, name, ingredients, verdict, verdict_rank, engine_rev, snapshot)
values ('9', '9', 9, 'x', 'x', 'none', 0, 1, '2025-12-18');
rollback;   -- must fail: permission denied for table foods
```

Run `get_advisors` (security). Expected: nothing new that mentions `foods`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<version>_foods_usda_copy.sql
git commit -m "foods: read-only table for USDA Branded Foods, with search and alternatives functions"
```

---

### Task 2: The data layer and the lookup rewrite (pure code, test first)

**Files:**
- Create: `src/lib/foods.ts`, `src/lib/foodsFake.ts`, `src/lib/foods.test.ts`
- Replace: `src/lib/nutrition.ts`, `src/lib/nutrition.test.ts`, `src/lib/lookup.ts`, `src/lib/lookup.test.ts`
- Modify: `src/lib/productImporter.ts` (add `snapshot?`)

**Interfaces:**
- Produces (used by Tasks 3 and 4):
  - `foods.ts`: `interface FoodRow` (19 columns, see the file), `interface FoodsSource { byBarcode(barcodeKey: string): Promise<FoodRow | null>; search(text: string, limit: number): Promise<FoodRow[]>; alternatives(category: string, myRank: number, excludeKey: string, limit: number): Promise<FoodRow[]> }`, `foodRowToProduct(r: FoodRow): Product`, `tsQueryFor(text: string): string`, `snapshotLabel(iso: string): string`
  - `nutrition.ts`: `dbNutrition(row: NutritionColumns): Nutrition | null`
  - `lookup.ts`: `lookupBarcode(raw: string, opts: { foods: FoodsSource; fetchImpl?: typeof fetch }): Promise<LookupResult>`, `searchFoods(text: string, opts: { foods: FoodsSource }): Promise<SearchResult>`, `barcodeKey(code: string): string`, plus the unchanged `normalizeBarcode`, `isBarcode`, `sameBarcode`, `tidyCase`, `mapOffResponse`, `offEditUrl`, `offAddUrl`, `knownNutrition`
  - `foodsFake.ts`: `memoryFoods(rows, { fail? })`, `foodRow(over?)`, `rowFromUsdaSearch(record)`

- [ ] **Step 1: Check nobody else changed the files you replace**

Run `git diff f5e6fdf -- src/lib/nutrition.ts src/lib/lookup.ts src/lib/nutrition.test.ts src/lib/lookup.test.ts`.
Expected: empty. If the Knight's audit batch changed them, merge those changes into the new files by hand (see the note
under "Re-verified" at the top: `record` may now be exported from `nutrition.ts`).

- [ ] **Step 2: Write the tests**

`src/lib/foods.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foodRowToProduct, tsQueryFor, snapshotLabel } from "./foods.ts";
import { foodRow, rowFromUsdaSearch } from "./foodsFake.ts";
import { analyzeIngredients } from "./safety/analyze.ts";

const record = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/usda/${name}.json`, import.meta.url), "utf8")).foods[0];

test("a foods row maps to a Product with its source, snapshot date and a negative id", () => {
  const rec = record("coke-zero-00049000042566");
  const p = foodRowToProduct(rowFromUsdaSearch(rec));
  assert.equal(p.id, -49000042566);
  assert.equal(p.barcode, "00049000042566");
  assert.equal(p.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
  assert.equal(p.brand, "Coca-Cola Zero");
  assert.equal(p.category, "");
  assert.match(p.ingredients, /^CARBONATED WATER, CARAMEL COLOR/);
  assert.deepEqual(p.source, {
    name: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/food-details/2742717/nutrients",
    crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: "Non Alcoholic Beverages - Ready to Drink",
    snapshot: String(rec.publishedDate),
  });
  assert.ok(analyzeIngredients({ ingredients: p.ingredients }).flags.some(f => f.entry.id === "aspartame"));
});

// Review Focus: untrusted text. USDA writes names in capitals and sometimes prefixes the ingredients.
test("ALL-CAPS names are tidied and an 'INGREDIENTS:' prefix is dropped", () => {
  const d = foodRowToProduct(rowFromUsdaSearch(record("doritos-028400335799")));
  assert.equal(d.name, "Doritos, Tortilla Chips, Nacho Cheese, Nacho Cheese");
  assert.equal(d.brand, "Doritos");
  const o = foodRowToProduct(rowFromUsdaSearch(record("oreo-00044000042554")));
  assert.match(o.ingredients, /^SUGAR, UNBLEACHED ENRICHED FLOUR/);
});

test("a row with a serving and nutrients carries nutrition; one without carries none; an empty name is still shown", () => {
  const oreo = foodRowToProduct(rowFromUsdaSearch(record("oreo-nutrition-044000032029")));
  assert.equal(oreo.nutrition?.serving, "3 cookies (34 g)");
  assert.equal(foodRowToProduct(foodRow({ added_sugar_100g: null, sat_fat_100g: null, sodium_100g: null })).nutrition, undefined);
  assert.equal(foodRowToProduct(foodRow({ name: "" })).name, "Unnamed product");
});

test("search words become a whole-word, plural-either-way Postgres query", () => {
  assert.equal(tsQueryFor("ice cream"), "(ice | ices) & (cream | creams)");
  assert.equal(tsQueryFor("Cookies"), "(cookie | cookies)");
  assert.equal(tsQueryFor("chips"), "(chip | chips)");
  assert.equal(tsQueryFor("glass"), "(glass | glasss)", "'-ss' words are not stemmed");
  assert.equal(tsQueryFor("  "), "");
  assert.equal(tsQueryFor("!!! ???"), "");
});

// Review Focus: the text reaches to_tsquery, which has its own syntax (& | ! ( ) : *) and would throw on a stray one.
test("only letters and digits ever reach the database query; long searches are cut at 8 words", () => {
  const q = tsQueryFor(`a'; drop table foods; -- ) ( & | ! : * <-> é`);
  assert.match(q, /^[a-z0-9 |&()]+$/);
  assert.equal(tsQueryFor("one two three four five six seven eight nine ten").split(" & ").length, 8);
});

test("a snapshot date reads as month and year; anything else is left alone", () => {
  assert.equal(snapshotLabel("2025-12-18"), "Dec 2025");
  assert.equal(snapshotLabel("2024-04-01"), "Apr 2024");
  assert.equal(snapshotLabel("not a date"), "not a date");
});
```

Replace `src/lib/nutrition.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dbNutrition, offNutrition, nutrient, topHigh, DAILY_VALUE } from "./nutrition.ts";
import { rowFromUsdaSearch } from "./foodsFake.ts";

// What the importer would store for a USDA record, then the app's per-serving numbers from it.
const usda = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/usda/${name}.json`, import.meta.url), "utf8")).foods[0];
const off = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/off/${name}.json`, import.meta.url), "utf8")).body.product;
const row = (n: ReturnType<typeof dbNutrition>, id: string) => n!.nutrients.find(x => x.id === id)!;

test("Oreo (USDA): 3 cookies hold 14 g added sugar, 28% DV, High; matches the printed label", () => {
  const n = dbNutrition(rowFromUsdaSearch(usda("oreo-nutrition-044000032029")))!;
  assert.equal(n.serving, "3 cookies (34 g)");
  assert.equal(n.perServing, true);
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [14, 28, "high"]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv, row(n, "satFat").level], [2, 10, null]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv, row(n, "sodium").level], [130, 6, null]);
  assert.equal(topHigh(n)?.short, "High sugar");
});

test("Lay's (USDA): added sugar is not listed (never 'Low'); nothing High", () => {
  const n = dbNutrition(rowFromUsdaSearch(usda("lays-nutrition-028400199148")))!;
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [null, null, null]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv], [1.5, 8]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv], [170, 7]);
  assert.equal(topHigh(n), null);
});

test("Coke Zero (USDA, ml serving): all Low", () => {
  const n = dbNutrition(rowFromUsdaSearch(usda("coke-zero-nutrition-00049000042566")))!;
  assert.equal(n.serving, "1 Can (355 ml)");
  assert.deepEqual(n.nutrients.map(x => x.level), ["low", "low", "low"]);
  assert.equal(row(n, "sodium").amount, 40); // 11 mg/100 ml × 355 ml = 39 → the label declares 40 (nearest 5)
});

test("FDA 5/20 boundaries, classified on the rounded %DV as a label shows it", () => {
  assert.equal(nutrient("satFat", 1, true).level, "low");    // 5%
  assert.equal(nutrient("satFat", 1.1, true).level, "low");  // a label declares 1 g (nearest 0.5) = 5%
  assert.equal(nutrient("sodium", 140, true).level, null);   // 6%
  assert.equal(nutrient("satFat", 3.9, true).level, "high"); // 19.5% → 20
  assert.equal(nutrient("addedSugar", 10, true).level, "high"); // exactly 20%
  assert.equal(nutrient("sodium", 2300, true).dv, 100);
  assert.deepEqual(DAILY_VALUE, { addedSugar: 50, satFat: 20, sodium: 2300 });
});

test("no serving size: per 100 g values, no %DV and no High/Low", () => {
  const n = dbNutrition(rowFromUsdaSearch({ foodNutrients: [{ nutrientName: "Sugars, added", unitName: "G", value: 41.2 }] }))!;
  assert.equal(n.perServing, false);
  assert.equal(n.serving, "100 g");
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [41.2, null, null]);
  assert.equal(dbNutrition(rowFromUsdaSearch({ foodNutrients: [] })), null);
});

test("Open Food Facts: per 100 g when no serving data (Nutella); sodium converted from grams; per serving when given", () => {
  const n = offNutrition(off("nutella-nutrition-3017620422003"))!;
  assert.equal(n.source, "Open Food Facts");
  assert.equal(n.perServing, false);
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "satFat").amount, row(n, "sodium").amount], [52.1, 10.6, 43]);
  assert.equal(topHigh(n), null, "no High/Low without a serving");
  const s = offNutrition({ serving_size: "2 tbsp (37 g)", nutriments: { "added-sugars_serving": 19, "saturated-fat_serving": 4, "sodium_serving": 0.015 } })!;
  assert.equal(s.serving, "2 tbsp (37 g)");
  assert.deepEqual(s.nutrients.map(x => [x.dv, x.level]), [[38, "high"], [20, "high"], [1, "low"]]);
  assert.equal(topHigh(s)?.id, "addedSugar");
  assert.equal(offNutrition({ nutriments: {} }), null);
});

// Final review I1: amounts follow FDA label rounding (21 CFR 101.9(c)) before %DV, so they match the printed label.
test("per-serving amounts use FDA label increments, so they match the can and the 5/20 call", () => {
  const coke = dbNutrition(rowFromUsdaSearch({ servingSize: 355, servingSizeUnit: "MLT", householdServingFullText: "1 Can",
    foodNutrients: [{ nutrientName: "Sugars, added", value: 11 }, { nutrientName: "Sodium, Na", value: 13 }] }))!;
  assert.deepEqual([row(coke, "addedSugar").amount, row(coke, "sodium").amount], [39, 45], "Coca-Cola label: 39 g, 45 mg");
  assert.deepEqual([nutrient("sodium", 448, true).amount, nutrient("sodium", 448, true).level], [450, "high"], "450 mg label = 20% High");
  assert.equal(nutrient("sodium", 127, true).amount, 125, "≤140 mg: nearest 5");
  assert.equal(nutrient("sodium", 4, true).amount, 0, "<5 mg: 0");
  assert.equal(nutrient("satFat", 0.4, true).amount, 0, "<0.5 g: 0");
  assert.equal(nutrient("satFat", 1.3, true).amount, 1.5, "<5 g: nearest 0.5");
  assert.equal(nutrient("satFat", 5.4, true).amount, 5, "≥5 g: nearest 1");
  assert.equal(nutrient("addedSugar", 0.4, true).amount, 0, "<0.5 g: 0");
  assert.equal(nutrient("addedSugar", 39.6, true).amount, 40, "nearest 1 g");
  assert.equal(nutrient("addedSugar", 52.14, false).amount, 52.1, "per 100 g keeps 0.1 g (no label to match)");
});

test("a household serving that already names its weight isn't repeated", () => {
  const n = dbNutrition(rowFromUsdaSearch({ householdServingFullText: "1/6 pizza (130g)", servingSize: 130, servingSizeUnit: "GRM",
    foodNutrients: [{ nutrientName: "Sodium, Na", unitName: "MG", value: 577 }] }))!;
  assert.equal(n.serving, "1/6 pizza (130g)");
  assert.equal(row(n, "sodium").amount, 750);
});

// The importer stores USDA's download spelling of the unit ("g", "ml"); the search API wrote GRM / MLT.
test("serving units: g and ml (download) and GRM / MLT (search) mean the same; an unknown unit falls back to per 100 g", () => {
  const cols = { serving_text: "", added_sugar_100g: null, sat_fat_100g: null, sodium_100g: 100 };
  assert.equal(dbNutrition({ ...cols, serving_size: 30, serving_unit: "g" })!.serving, "30 g");
  assert.equal(dbNutrition({ ...cols, serving_size: 240, serving_unit: "ml" })!.serving, "240 ml");
  assert.equal(dbNutrition({ ...cols, serving_size: 30, serving_unit: "GRM" })!.perServing, true);
  assert.equal(dbNutrition({ ...cols, serving_size: 1, serving_unit: "oz" })!.perServing, false);
  assert.equal(dbNutrition({ ...cols, serving_size: 0, serving_unit: "g" })!.perServing, false);
  assert.equal(dbNutrition({ ...cols, serving_size: null, serving_unit: "" })!.serving, "100 g");
});
```

Replace `src/lib/lookup.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knownNutrition, lookupBarcode, searchFoods, mapOffResponse, normalizeBarcode, barcodeKey, isBarcode, sameBarcode, tidyCase, offEditUrl, offAddUrl } from "./lookup.ts";
import { analyzeIngredients } from "./safety/analyze.ts";
import { foodRow, memoryFoods, rowFromUsdaSearch } from "./foodsFake.ts";

const fixture = (path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), "utf8"));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const NOT_FOUND = () => json(fixture("off/not-found-3017620429996").body, 404);

/** A fake Open Food Facts: answers from `off` by barcode, 404 otherwise. `calls` lists every web request made. */
function fakeOff(off: Record<string, { httpStatus: number; body: unknown }> = {}) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = off[url.match(/product\/(\d+)\.json/)?.[1] ?? ""];
    return hit ? json(hit.body, hit.httpStatus) : NOT_FOUND();
  }) as typeof fetch;
  return { impl, calls };
}
/** The lookup cache lives for the session, so every test below uses barcodes no other test uses. */
const rowFor = (code: string, over = {}) => foodRow({ barcode_key: barcodeKey(code), barcode: code, ...over });

// ── Mapping a foods row ──────────────────────────────────────────────────────

test("a USDA row is found with its source, and Open Food Facts is never asked", async () => {
  const db = memoryFoods([rowFromUsdaSearch(fixture("usda/coke-zero-00049000042566").foods[0])]);
  const off = fakeOff();
  const r = await lookupBarcode("049000042566", { foods: db, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "USDA FoodData Central");
  assert.equal(r.status === "found" && r.product.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
  assert.deepEqual(db.calls, ["byBarcode 49000042566"], "one request, though USDA stores this code as 14 digits");
  assert.equal(off.calls.length, 0);
});

// ── Open Food Facts mapper ─────────────────────────────────────────────────

test("an OFF product maps with English preferred and a crowd-sourced source", () => {
  const f = fixture("off/nutella-3017620422003");
  const r = mapOffResponse(f.body, f.httpStatus);
  assert.equal(r.status, "found");
  if (r.status !== "found") return;
  assert.equal(r.product.id, -3017620422003);
  assert.equal(r.product.name, "Nutella");
  assert.equal(r.product.brand, "Nutella");
  assert.match(r.product.ingredients, /^Sugar, vegetable fat \(palm\)/);
  assert.deepEqual(r.product.source, {
    name: "Open Food Facts", url: "https://world.openfoodfacts.org/product/3017620422003",
    crowdSourced: true, ingredientsLang: "en", additiveCodes: ["en:e322", "en:e322i"], categoryTags: ["en:breakfasts", "en:spreads", "en:sweet-spreads", "en:confectionary-based-spreads", "fr:Nutella"],
  });
});

test("OFF: non-English only keeps its language; 404 and empty shells are not found; 5xx/429 are errors", () => {
  const body = structuredClone(fixture("off/nutella-3017620422003").body);
  delete body.product.ingredients_text_en;
  const fr = mapOffResponse(body, 200);
  assert.equal(fr.status === "found" && fr.product.source?.ingredientsLang, "fr");
  const nf = fixture("off/not-found-3017620429996");
  assert.equal(mapOffResponse(nf.body, nf.httpStatus).status, "not-found");
  const empty = fixture("off/empty-9780000000002");
  assert.equal(mapOffResponse(empty.body, empty.httpStatus).status, "not-found");
  assert.equal(mapOffResponse(null, 503).status, "error");
  assert.equal(mapOffResponse(null, 429).status, "error");
  assert.equal(mapOffResponse("<html>", 200).status, "not-found");
});

test("huge or odd crowd-sourced text still maps and analyzes safely", () => {
  const body = { status: "success", product: { code: "123456789012", product_name: "Big &amp; odd <b>snack</b>", ingredients_text_en: "salt, ".repeat(20000) + "SODIUM NITRITE" } };
  const r = mapOffResponse(body, 200);
  assert.equal(r.status, "found");
  if (r.status !== "found") return;
  assert.equal(analyzeIngredients({ ingredients: r.product.ingredients }).verdict, "high");
});

// ── Barcodes ───────────────────────────────────────────────────────────────

test("barcodes compare by digits, ignoring spaces, dashes and leading zeros", () => {
  assert.equal(normalizeBarcode(" 0 49000-042566 "), "049000042566");
  assert.equal(barcodeKey(" 0 49000-042566 "), "49000042566");
  assert.equal(barcodeKey("00049000042566"), barcodeKey("049000042566"), "a 12-digit UPC and its 14-digit form share a key");
  assert.ok(sameBarcode("049000042566", "00049000042566"));
  assert.ok(!sameBarcode("049000042566", "049000042567"));
  assert.ok(!sameBarcode("", "000"));
  assert.ok(isBarcode("01311501") && isBarcode("00049000042566"));
  assert.ok(!isBarcode("1234") && !isBarcode("123456789012345"));
  assert.equal(tidyCase("LAY'S, CLASSIC POTATO CHIPS"), "Lay's, Classic Potato Chips");
  assert.equal(tidyCase("Coca-Cola Zero"), "Coca-Cola Zero");
});

// ── lookupBarcode: order, cache, errors ────────────────────────────────────

test("a miss in our table falls back to OFF; a miss in both is not found", async () => {
  const db = memoryFoods([]);
  const off = fakeOff({ "3017620422003": fixture("off/nutella-3017620422003") });
  const r = await lookupBarcode("3017620422003", { foods: db, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  assert.equal((await lookupBarcode("3017620429996", { foods: db, fetchImpl: off.impl })).status, "not-found");
});

test("results are cached per barcode, whatever the spelling", async () => {
  const db = memoryFoods([rowFor("036000291452")]);
  const off = fakeOff();
  assert.equal((await lookupBarcode("036000291452", { foods: db, fetchImpl: off.impl })).status, "found");
  const before = db.calls.length;
  assert.equal((await lookupBarcode("0 36000-291452", { foods: db, fetchImpl: off.impl })).status, "found");
  assert.equal((await lookupBarcode("00036000291452", { foods: db, fetchImpl: off.impl })).status, "found");
  assert.equal(db.calls.length, before, "later lookups served from the session cache");
});

// Review Focus: an unreachable source must never read as "not found".
test("errors are retried, never cached, and never read as 'not found'", async () => {
  const down = memoryFoods([], { fail: true });
  const off = fakeOff();
  assert.equal((await lookupBarcode("012000161155", { foods: down, fetchImpl: off.impl })).status, "error", "database down + OFF has nothing = try again");
  const again = down.calls.length;
  assert.equal((await lookupBarcode("012000161155", { foods: down, fetchImpl: off.impl })).status, "error");
  assert.ok(down.calls.length > again, "errors are retried, not cached");
  const web = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  assert.equal((await lookupBarcode("041500000251", { foods: memoryFoods([]), fetchImpl: web })).status, "error", "OFF unreachable + not in our table = try again");
});

test("our table down but OFF has it: show OFF, and look again next time", async () => {
  const down = memoryFoods([], { fail: true });
  const off = fakeOff({ "4006381333931": fixture("off/nutella-3017620422003") });
  const r = await lookupBarcode("4006381333931", { foods: down, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  assert.equal((await lookupBarcode("4006381333931", { foods: down, fetchImpl: off.impl })).status, "found");
  assert.equal(off.calls.length, 2, "an OFF find made while our table was unreachable isn't cached");
});

// 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8). OFF answered the Heinz UPC-E 01311501
// with a UK store product, so 8-digit codes are looked up in our USDA copy only.
test("8-digit codes are looked up in our USDA copy only, never Open Food Facts", async () => {
  const sweetcorn = { httpStatus: 200, body: { status: "success", product: { code: "01311501", product_name: "Sainsbury's Organic Sweetcorn", ingredients_text: "Sweetcorn" } } };
  const off = fakeOff({ "01311501": sweetcorn });
  assert.equal((await lookupBarcode("01311501", { foods: memoryFoods([]), fetchImpl: off.impl })).status, "not-found");
  assert.equal(off.calls.length, 0, "no OFF request");
  const upce = memoryFoods([rowFor("01311502")]);
  assert.equal((await lookupBarcode("01311502", { foods: upce, fetchImpl: off.impl })).status, "found");
});

test("codes outside 8-14 digits never reach the database or the network", async () => {
  const db = memoryFoods([]);
  const off = fakeOff();
  assert.equal((await lookupBarcode("1234", { foods: db, fetchImpl: off.impl })).status, "not-found");
  assert.equal((await lookupBarcode("abc", { foods: db, fetchImpl: off.impl })).status, "not-found");
  assert.equal(db.calls.length + off.calls.length, 0);
});

test("a USDA find carries its nutrition, and list cards can read it afterwards without a request", async () => {
  const db = memoryFoods([rowFromUsdaSearch(fixture("usda/oreo-nutrition-044000032029").foods[0])]);
  assert.equal(knownNutrition("044000032029"), null);
  const r = await lookupBarcode("044000032029", { foods: db, fetchImpl: fakeOff().impl });
  assert.equal(r.status === "found" && r.product.nutrition?.serving, "3 cookies (34 g)");
  await new Promise(resolve => setTimeout(resolve, 0)); // the cache bookkeeping runs after the promise settles
  assert.equal(knownNutrition("0 44000-032029")?.nutrients[0].dv, 28);
  assert.equal(knownNutrition(""), null);
});

// ── Text search ("More from USDA" in search results) ──────────────────────────

test("a text search maps rows to products, each with its source and nutrition", async () => {
  const seen = new Set<string>();
  const rows = fixture("usda/search-ice-cream").foods.map(rowFromUsdaSearch)
    .filter((r: { barcode_key: string }) => r.barcode_key && !seen.has(r.barcode_key) && seen.add(r.barcode_key));
  const db = memoryFoods(rows);
  const a = await searchFoods("Ice  Cream", { foods: db });
  assert.equal(a.status, "ok");
  if (a.status !== "ok") return;
  assert.equal(a.products.length, 10);
  assert.equal(new Set(a.products.map(p => barcodeKey(p.barcode))).size, 10, "distinct barcodes");
  for (const p of a.products) {
    assert.equal(p.source?.name, "USDA FoodData Central");
    assert.ok(p.id < 0, "looked-up ids are negative");
    assert.equal(p.name, "Ice Cream");
  }
  assert.ok(a.products.some(p => p.nutrition), "nutrition comes along");
});

test("searchFoods: one request per text for the session; errors aren't cached; blank text makes no request", async () => {
  const db = memoryFoods([rowFor("028400064057", { name: "Tostitos Bite Size", brand: "Tostitos" })]);
  const a = await searchFoods("Tostitos Bite", { foods: db });
  assert.equal(a.status === "ok" && a.products.length, 1);
  await searchFoods("tostitos  bite", { foods: db });
  assert.equal(db.calls.length, 1, "the second search is served from the session cache");
  assert.equal((await searchFoods("  ", { foods: db })).status, "ok");
  assert.equal(db.calls.length, 1);

  const down = memoryFoods([], { fail: true });
  assert.equal((await searchFoods("granola", { foods: down })).status, "error");
  await searchFoods("granola", { foods: down });
  assert.equal(down.calls.length, 2, "errors are retried");
});

// "Looks wrong? Fix it on Open Food Facts" (owner, 2026-10-01): users edit with their own OFF account; OFF's own AI
// reads nutrition from label photos. Both forms open with the barcode filled in (checked live 2026-10-01).
test("Open Food Facts edit and add links carry the cleaned barcode", () => {
  assert.equal(offEditUrl("3017620422003"), "https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=3017620422003");
  assert.equal(offAddUrl(" 30176-20429996 "), "https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=3017620429996");
});
```

- [ ] **Step 3: Run them to see them fail**

Run `node --test src/lib/foods.test.ts`.
Expected: FAIL with `Cannot find module` for `./foods.ts` (or `./foodsFake.ts`).

- [ ] **Step 4: Create the data layer**

`src/lib/foods.ts`:

```ts
// foods.ts — the `foods` table (EcoGo's read-only copy of USDA Branded Foods): the row shape, row → Product, the search
// query builder and the interface the app reads it through. Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md
// §3, §5. Nothing here touches the network or the browser, so Node tests can load it. Adapters: foodsDb.ts (Supabase)
// and foodsFake.ts (tests).
import type { Product } from "./productImporter.ts";
import { dbNutrition } from "./nutrition.ts";

export interface FoodRow {
  barcode_key: string;          // digits with leading zeros stripped: the barcodeKey() of lookup.ts
  barcode: string;              // as USDA stores it (8, 12 or 14 digits)
  fdc_id: number;
  name: string;
  brand: string;
  category: string;             // USDA brandedFoodCategory, e.g. "Chips, Pretzels & Snacks"
  ingredients: string;
  serving_size: number | null;
  serving_unit: string;         // "g" or "ml" (USDA may also write GRM / MLT)
  serving_text: string;         // household serving, e.g. "3 cookies"
  added_sugar_100g: number | null; // per 100 g or ml; null = not listed
  sat_fat_100g: number | null;
  sodium_100g: number | null;   // mg
  verdict: string;              // the engine's level when the row was imported; orders results, never shown
  verdict_rank: number;         // VERDICT_RANK of that level
  flags: number;                // findings behind it
  cooked: boolean;              // 🔥 acrylamide marker
  engine_rev: number;
  snapshot: string;             // USDA release date, YYYY-MM-DD
}

/** Everything the app asks of the table. Reads only; the browser never writes it. */
export interface FoodsSource {
  byBarcode(barcodeKey: string): Promise<FoodRow | null>;
  search(text: string, limit: number): Promise<FoodRow[]>;
  /** Same category, strictly better level than `myRank`, complete records only, best first. */
  alternatives(category: string, myRank: number, excludeKey: string, limit: number): Promise<FoodRow[]>;
}

/** A `foods` row as the app's Product, with its source and nutrition. Like every looked-up product its id is negative. */
export function foodRowToProduct(r: FoodRow): Product {
  const product: Product = {
    id: -Number(r.barcode_key), // catalog ids are positive, so a looked-up product never collides with one
    barcode: r.barcode, name: r.name || "Unnamed product", brand: r.brand, category: "", description: "",
    ingredients: r.ingredients, imageUrl: "", keywords: [],
    source: {
      name: "USDA FoodData Central", url: `https://fdc.nal.usda.gov/food-details/${r.fdc_id}/nutrients`,
      crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: r.category, snapshot: r.snapshot,
    },
  };
  const nutrition = dbNutrition(r);
  return nutrition ? { ...product, nutrition } : product;
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Typed words → a Postgres to_tsquery string: every word must appear as a whole word, plural either way (like
 * search.ts): "ice creams" → "(ice | ices) & (cream | creams)". Only [a-z0-9] reaches the database. "" = no words.
 */
export function tsQueryFor(text: string): string {
  return words(text).slice(0, 8).map(w => {
    const base = w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
    return `(${base} | ${base}s)`;
  }).join(" & ");
}

/** "2025-12-18" → "Dec 2025" (the label on a product page); anything else is returned as is. */
export function snapshotLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
```

`src/lib/foodsFake.ts` (tests only; never imported by the app):

```ts
// foodsFake.ts — test doubles for the `foods` table: an in-memory FoodsSource, a row builder, and a converter from the
// USDA search-API fixtures already in src/lib/fixtures/usda. Not imported by the app, so it never ships.
import type { FoodRow, FoodsSource } from "./foods.ts";
import { tidyCase } from "./lookup.ts";

/** A complete row; override what a test cares about. */
export function foodRow(over: Partial<FoodRow> = {}): FoodRow {
  return {
    barcode_key: "12345678905", barcode: "012345678905", fdc_id: 1, name: "Test Snack", brand: "Test Brand",
    category: "Chips, Pretzels & Snacks", ingredients: "CORN, SALT", serving_size: 28, serving_unit: "g", serving_text: "1 oz",
    added_sugar_100g: null, sat_fat_100g: 1, sodium_100g: 500, verdict: "none", verdict_rank: 0, flags: 0, cooked: false,
    engine_rev: 1, snapshot: "2025-12-18", ...over,
  };
}

/** A USDA /foods/search record (the shape of the fixtures) as the row the importer would store for it. */
export function rowFromUsdaSearch(f: any): FoodRow {
  const digits = String(f.gtinUpc ?? "").replace(/\D/g, "");
  const per100 = (name: string) => {
    const n = (f.foodNutrients ?? []).find((x: any) => x.nutrientName === name);
    return typeof n?.value === "number" ? n.value : null;
  };
  return foodRow({
    barcode_key: digits.replace(/^0+/, ""), barcode: String(f.gtinUpc ?? ""), fdc_id: f.fdcId ?? 1,
    name: tidyCase(String(f.description ?? "")), brand: tidyCase(String(f.brandName || f.brandOwner || "")),
    category: String(f.foodCategory ?? ""), ingredients: String(f.ingredients ?? "").replace(/^ingredients:\s*/i, ""),
    serving_size: typeof f.servingSize === "number" ? f.servingSize : null, serving_unit: String(f.servingSizeUnit ?? ""),
    serving_text: String(f.householdServingFullText ?? ""),
    added_sugar_100g: per100("Sugars, added"), sat_fat_100g: per100("Fatty acids, total saturated"), sodium_100g: per100("Sodium, Na"),
    snapshot: String(f.publishedDate ?? "2025-12-18"),
  });
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** An in-memory FoodsSource. `fail: true` makes every call throw, like an unreachable database. `calls` logs them. */
export function memoryFoods(rows: FoodRow[], opts: { fail?: boolean } = {}): FoodsSource & { calls: string[] } {
  const calls: string[] = [];
  const guard = () => { if (opts.fail) throw new TypeError("Failed to fetch"); };
  return {
    calls,
    async byBarcode(key) { calls.push(`byBarcode ${key}`); guard(); return rows.find(r => r.barcode_key === key) ?? null; },
    async search(text, limit) {
      calls.push(`search ${text}`); guard();
      const want = words(text);
      return rows.filter(r => { const have = new Set(words(`${r.name} ${r.brand}`)); return want.every(w => have.has(w)); }).slice(0, limit);
    },
    async alternatives(category, myRank, excludeKey, limit) {
      calls.push(`alternatives ${category}`); guard();
      return rows.filter(r => r.category === category && r.verdict_rank < myRank && r.barcode_key !== excludeKey).slice(0, limit);
    },
  };
}
```

- [ ] **Step 5: Replace nutrition and lookup, and add `snapshot` to the source type**

Replace `src/lib/nutrition.ts` with:

```ts
// nutrition.ts — added sugar, saturated fat and sodium per serving, as FDA % Daily Value with FDA's 5/20 rule.
// Spec: docs/superpowers/specs/2026-10-01-m5-nutrition-barcodes-design.md §3, §4.1. A separate signal from the
// concern badge: it never changes it. Pure and import-free, so Node tests can load it.

export type NutrientId = "addedSugar" | "satFat" | "sodium";

export interface NutrientValue {
  id: NutrientId;
  label: string;          // "Added sugar"
  short: string;          // card chip: "High sugar"
  amount: number | null;  // per serving (or per 100 g when there's no serving size); null = not listed
  unit: "g" | "mg";
  dv: number | null;      // % Daily Value, rounded as a label shows it; null when there's no serving size
  level: "high" | "low" | null;
}

export interface Nutrition {
  serving: string;        // "3 cookies (34 g)", or "100 g" when per100
  perServing: boolean;    // false: values are per 100 g/ml and High/Low can't apply (FDA's rule is per serving)
  nutrients: NutrientValue[];
  source: "USDA FoodData Central" | "Open Food Facts";
}

/** FDA Daily Values, adults and children 4+ (checked 2026-10-01). */
export const DAILY_VALUE: Record<NutrientId, number> = { addedSugar: 50, satFat: 20, sodium: 2300 };

export const FDA_RULE = {
  quote: "5% DV or less of a nutrient per serving is considered low. 20% DV or more of a nutrient per serving is considered high.",
  url: "https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels",
  checkedOn: "2026-10-01",
};

const META: Record<NutrientId, { label: string; short: string; unit: "g" | "mg" }> = {
  addedSugar: { label: "Added sugar", short: "High sugar", unit: "g" },
  satFat: { label: "Saturated fat", short: "High sat fat", unit: "g" },
  sodium: { label: "Sodium", short: "High sodium", unit: "mg" },
};
const ORDER: NutrientId[] = ["addedSugar", "satFat", "sodium"];

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const record = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

const nearest = (v: number, step: number) => Math.round(v / step) * step;

/** FDA label increments, 21 CFR 101.9(c): what the printed label declares for this per-serving amount. */
function labelAmount(id: NutrientId, v: number): number {
  if (id === "sodium") return v < 5 ? 0 : v <= 140 ? nearest(v, 5) : nearest(v, 10);
  if (id === "satFat") return v < 0.5 ? 0 : v < 5 ? nearest(v, 0.5) : Math.round(v);
  return v < 0.5 ? 0 : Math.round(v); // added sugars
}

/** One nutrient: per serving, the label's declared amount (FDA increments), %DV from it, then FDA's 5/20 rule.
 *  Per 100 g there's no label to match, so amounts keep 0.1 g / 1 mg and get no %DV. */
export function nutrient(id: NutrientId, amount: number | null, perServing: boolean): NutrientValue {
  const { label, short, unit } = META[id];
  const rounded = amount === null ? null : perServing ? labelAmount(id, amount) : unit === "mg" ? Math.round(amount) : Math.round(amount * 10) / 10;
  const dv = rounded === null || !perServing ? null : Math.round((rounded / DAILY_VALUE[id]) * 100);
  const level = dv === null ? null : dv >= 20 ? "high" : dv <= 5 ? "low" : null;
  return { id, label, short, amount: rounded, unit, dv, level };
}

const UNIT: Record<string, string> = { GRM: "g", G: "g", MLT: "ml", ML: "ml" };

/** The nutrition columns of a `foods` row (spec data-ownership §5): values are per 100 g/ml, scaled by the serving size. */
export interface NutritionColumns {
  serving_size: number | null; serving_unit: string; serving_text: string;
  added_sugar_100g: number | null; sat_fat_100g: number | null; sodium_100g: number | null;
}

export function dbNutrition(row: NutritionColumns): Nutrition | null {
  const per100: Partial<Record<NutrientId, number>> = {};
  for (const [id, v] of [["addedSugar", row.added_sugar_100g], ["satFat", row.sat_fat_100g], ["sodium", row.sodium_100g]] as const) {
    if (num(v) !== null) per100[id] = v as number;
  }
  if (Object.keys(per100).length === 0) return null;
  const size = num(row.serving_size);
  const unit = UNIT[String(row.serving_unit ?? "").toUpperCase()];
  const perServing = size !== null && size > 0 && unit !== undefined;
  const factor = perServing ? size! / 100 : 1;
  const household = String(row.serving_text ?? "").trim();
  // "3 cookies" → "3 cookies (34 g)"; "1/6 pizza (130g)" already names its weight, so it's kept as is.
  const named = /\d\s*(g|ml)\b/i.test(household);
  const serving = !perServing ? "100 g" : household ? (named ? household : `${household} (${size} ${unit})`) : `${size} ${unit}`;
  return {
    serving, perServing, source: "USDA FoodData Central",
    nutrients: ORDER.map(id => nutrient(id, per100[id] === undefined ? null : per100[id]! * factor, perServing)),
  };
}

/** From an Open Food Facts product: `nutriments` per serving when present, else per 100 g. Sodium is stored in grams. */
export function offNutrition(product: unknown): Nutrition | null {
  const p = record(product);
  const n = record(p.nutriments);
  const keys: Record<NutrientId, string> = { addedSugar: "added-sugars", satFat: "saturated-fat", sodium: "sodium" };
  const perServing = ORDER.some(id => num(n[`${keys[id]}_serving`]) !== null);
  const suffix = perServing ? "_serving" : "_100g";
  const raw = ORDER.map(id => num(n[keys[id] + suffix]));
  if (raw.every(v => v === null)) return null;
  const servingText = typeof p.serving_size === "string" ? p.serving_size.trim() : "";
  return {
    serving: perServing ? servingText || "1 serving" : "100 g", perServing, source: "Open Food Facts",
    nutrients: ORDER.map((id, i) => nutrient(id, raw[i] === null ? null : id === "sodium" ? raw[i]! * 1000 : raw[i], perServing)),
  };
}

/** The card chip: the High nutrient with the largest %DV, or null. */
export function topHigh(n: Nutrition | null | undefined): NutrientValue | null {
  const highs = (n?.nutrients ?? []).filter(x => x.level === "high");
  return highs.sort((a, b) => (b.dv ?? 0) - (a.dv ?? 0))[0] ?? null;
}
```

Replace `src/lib/lookup.ts` with:

```ts
// lookup.ts — find a barcode that isn't in the catalog. EcoGo's own copy of USDA FoodData Central first (the `foods`
// table: label data supplied by manufacturers), then Open Food Facts (crowd-sourced, live). Spec:
// docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md. The database is passed in (see foods.ts), and the app's
// own modules are imported without the browser, so Node tests can load this module.
import type { Product, ProductSource } from "./productImporter.ts";
import { offNutrition, type Nutrition } from "./nutrition.ts";
import { foodRowToProduct, type FoodsSource } from "./foods.ts";

export type LookupResult =
  | { status: "found"; product: Product }
  | { status: "not-found" }
  | { status: "error"; message: string };

const OFF = "https://world.openfoodfacts.org/api/v3/product/";
const OFF_FIELDS = "code,product_name,product_name_en,brands,lang,ingredients_text,ingredients_text_en,additives_tags,categories_tags,nutriments,serving_size";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const record = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

// ── Barcodes ─────────────────────────────────────────────────────────────────

/** Digits only: " 0 49000-042566 " → "049000042566". */
export const normalizeBarcode = (raw: string) => raw.replace(/\D/g, "");
/** UPC-E (8) up to GTIN-14. */
export const isBarcode = (code: string) => code.length >= 8 && code.length <= 14;
/** The `foods` table's key: digits without leading zeros, so a 12-digit UPC and its 14-digit form are one product. */
export const barcodeKey = (code: string) => normalizeBarcode(code).replace(/^0+/, "");
/** Same product code, ignoring spaces, dashes and leading zeros (12-digit UPC vs 13/14-digit forms). */
export function sameBarcode(a: string, b: string): boolean {
  const x = barcodeKey(a);
  return x !== "" && x === barcodeKey(b);
}

/** ALL-CAPS label text → "Lay's, Classic Potato Chips"; text with any lowercase letter is left alone. */
export const tidyCase = (s: string) =>
  /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s,(/&-])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase());

function toProduct(code: string, name: string, brand: string, ingredients: string, source: ProductSource): Product {
  return {
    id: -Number(barcodeKey(code)), // catalog ids are positive, so a looked-up product never collides with one
    barcode: code, name: name || "Unnamed product", brand, category: "", description: "", ingredients,
    imageUrl: "", keywords: [], source,
  };
}

// ── EcoGo's copy of USDA FoodData Central ────────────────────────────────────

async function fetchFood(code: string, foods: FoodsSource): Promise<LookupResult> {
  const row = await foods.byBarcode(barcodeKey(code));
  return row ? { status: "found", product: foodRowToProduct(row) } : { status: "not-found" };
}

export type SearchResult = { status: "ok"; products: Product[] } | { status: "error"; message: string };
const searchCache = new Map<string, Promise<SearchResult>>();

/** USDA products matching a text search (up to 10); one request per text per session; errors aren't cached. */
export function searchFoods(text: string, opts: { foods: FoodsSource }): Promise<SearchResult> {
  const q = text.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return Promise.resolve({ status: "ok", products: [] });
  const hit = searchCache.get(q);
  if (hit) return hit;
  const pending: Promise<SearchResult> = opts.foods.search(q, 10)
    .then(rows => ({ status: "ok" as const, products: rows.map(foodRowToProduct) }))
    .catch((err: unknown) => ({ status: "error" as const, message: err instanceof Error ? err.message : String(err) }));
  searchCache.set(q, pending);
  pending.then(r => { if (r.status === "error") searchCache.delete(q); });
  return pending;
}

// ── Open Food Facts ──────────────────────────────────────────────────────────

/** Open Food Facts pages where a user, signed in with their own OFF account, can fix a product or add a missing one
 *  (values or a label photo; OFF's own AI reads nutrition from photos). EcoGo itself never writes to OFF. */
export const offEditUrl = (code: string) => `https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${normalizeBarcode(code)}`;
export const offAddUrl = (code: string) =>
  `https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=${normalizeBarcode(code)}`;

/** Pure: an OFF v3 response body plus its HTTP status → our result. */
export function mapOffResponse(json: unknown, httpStatus: number): LookupResult {
  if (httpStatus === 404) return { status: "not-found" };
  if (httpStatus !== 200) return { status: "error", message: `Open Food Facts returned HTTP ${httpStatus}` };
  const body = record(json);
  if (body.status !== "success" && body.status !== "success_with_warnings") return { status: "not-found" };
  const p = record(body.product);
  const code = normalizeBarcode(str(p.code) || str(body.code));
  const name = str(p.product_name_en) || str(p.product_name);
  const english = str(p.ingredients_text_en);
  const ingredients = english || str(p.ingredients_text);
  if (!code || (!name && !ingredients)) return { status: "not-found" };
  const product = toProduct(code, name, str(p.brands).split(",")[0].trim(), ingredients, {
    name: "Open Food Facts", url: `https://world.openfoodfacts.org/product/${code}`, crowdSourced: true,
    ingredientsLang: english ? "en" : str(p.lang) || "en", additiveCodes: strings(p.additives_tags), categoryTags: strings(p.categories_tags),
  });
  const nutrition = offNutrition(p);
  return { status: "found", product: nutrition ? { ...product, nutrition } : product };
}

async function fetchOff(code: string, f: typeof fetch): Promise<LookupResult> {
  const res = await f(`${OFF}${code}.json?fields=${OFF_FIELDS}`, { headers: { "X-User-Agent": "EcoGo/0.1 (https://github.com/skynetrebel42/ecogo)" } });
  return mapOffResponse(await res.json().catch(() => null), res.status);
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<LookupResult>>();
const nutritionSeen = new Map<string, Nutrition>();

/** Nutrition already fetched this session for a barcode (sync, for list cards); no request is made. */
export const knownNutrition = (barcode: string): Nutrition | null => (barcode ? nutritionSeen.get(barcodeKey(barcode)) ?? null : null);
const safely = (p: Promise<LookupResult>): Promise<LookupResult> =>
  p.catch((err: unknown) => ({ status: "error", message: err instanceof Error ? err.message : String(err) }));

export interface LookupOptions { foods: FoodsSource; fetchImpl?: typeof fetch }

/**
 * Our `foods` table → Open Food Facts → not found. Cached per barcode for the session; errors aren't cached, so Try
 * again can succeed. An unreachable source gives "error", never "not found".
 */
export function lookupBarcode(raw: string, opts: LookupOptions): Promise<LookupResult> {
  const code = normalizeBarcode(raw);
  if (!isBarcode(code)) return Promise.resolve({ status: "not-found" });
  const k = barcodeKey(code);
  const hit = cache.get(k);
  if (hit) return hit;
  const f = opts.fetchImpl ?? fetch;
  let provisional = false; // an OFF find while our database was unreachable: show it, but look again next time
  const pending = (async (): Promise<LookupResult> => {
    const db = await safely(fetchFood(code, opts.foods));
    if (db.status === "found") return db;
    // 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8): OFF answered the Heinz UPC-E
    // 01311501 with a UK store product. Those go to our USDA copy only.
    if (code.length === 8) return db;
    const off = await safely(fetchOff(code, f));
    if (off.status === "found") { provisional = db.status === "error"; return off; }
    return db.status === "error" ? db : off;
  })();
  cache.set(k, pending);
  pending.then(r => {
    if (r.status === "error" || provisional) cache.delete(k);
    if (r.status === "found" && r.product.nutrition) nutritionSeen.set(k, r.product.nutrition);
  });
  return pending;
}
```

In `src/lib/productImporter.ts`, in `interface ProductSource`, add one line after `categoryTags`:

```ts
  categoryTags?: string[]; // Open Food Facts only, e.g. ["en:snacks", "en:potato-crisps"]
  snapshot?: string;       // USDA only: release date of EcoGo's copy of the record, YYYY-MM-DD
}
```

- [ ] **Step 6: Run the whole suite**

Run `npm test`.
Expected: all pass, N0 + 2 tests (176 on `f5e6fdf`; the `foodsImport` tests arrive in Task 3). `npm run build` is expected
to FAIL until Task 4 because the three call sites still pass `relayUrl`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/foods.ts src/lib/foodsFake.ts src/lib/foods.test.ts src/lib/nutrition.ts src/lib/nutrition.test.ts src/lib/lookup.ts src/lib/lookup.test.ts src/lib/productImporter.ts
git commit -m "Lookup reads EcoGo's USDA copy through FoodsSource; USDA web calls and the key option are gone"
```

---

### Task 3: The importer (test first)

**Files:**
- Create: `src/lib/foodsImport.ts`, `src/lib/foodsImport.test.ts`, `src/lib/fixtures/usda-download/sample-branded_2025-12-18.json`, `scripts/import-usda.mjs`
- Modify: `package.json` (one script)

**Interfaces:**
- Consumes: `FoodRow` (Task 2), `assessProduct` (`safety/assess.ts`), `VERDICT_RANK` (`safety/analyze.ts`), `tidyCase` (`lookup.ts`)
- Produces: `usdaRecordToRow(raw: unknown, snapshot: string): FoodRow | null`, `usdaDate(v: unknown): string`, `keepNewest(rows: Map<string, { row: FoodRow; modified: string }>, row: FoodRow, modified: string): void`, `recordSplitter(onRecord: (json: string) => void): (chunk: string) => void`, `ENGINE_REV`

- [ ] **Step 1: Write the fixture and the tests**

`src/lib/fixtures/usda-download/sample-branded_2025-12-18.json` (four records in USDA's real download shape and date format:
an older and a newer record of one Oreo barcode, a hot dog with nitrite, and a record with no label text):

```json
{"BrandedFoods": [
{"foodClass":"Branded","description":"CHOCOLATE SANDWICH COOKIES, CHOCOLATE","foodNutrients":[{"type":"FoodNutrient","id":1,"nutrient":{"id":1093,"number":"307","name":"Sodium, Na","unitName":"mg"},"amount":382},{"type":"FoodNutrient","id":2,"nutrient":{"id":1235,"number":"539","name":"Sugars, added","unitName":"g"},"amount":41.2},{"type":"FoodNutrient","id":3,"nutrient":{"id":1258,"number":"606","name":"Fatty acids, total saturated","unitName":"g"},"amount":5.88}],"modifiedDate":"9/1/2019","availableDate":"9/1/2019","brandOwner":"Nabisco Biscuit Company","brandName":"OREO","dataSource":"LI","gtinUpc":"044000032029","ingredients":"UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, SALT.","marketCountry":"United States","servingSize":34.0,"servingSizeUnit":"g","householdServingFullText":"3 cookies","brandedFoodCategory":"Cookies & Biscuits","fdcId":1111111,"publicationDate":"9/1/2019"},
{"foodClass":"Branded","description":"CHOCOLATE SANDWICH COOKIES, CHOCOLATE","foodNutrients":[{"type":"FoodNutrient","id":4,"nutrient":{"id":1093,"number":"307","name":"Sodium, Na","unitName":"mg"},"amount":382},{"type":"FoodNutrient","id":5,"nutrient":{"id":1235,"number":"539","name":"Sugars, added","unitName":"g"},"amount":41.2},{"type":"FoodNutrient","id":6,"nutrient":{"id":1258,"number":"606","name":"Fatty acids, total saturated","unitName":"g"},"amount":5.88}],"modifiedDate":"11/2/2022","availableDate":"11/2/2022","brandOwner":"Nabisco Biscuit Company","brandName":"OREO","dataSource":"LI","gtinUpc":"00044000032029","ingredients":"INGREDIENTS: UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, COCOA, SALT.","marketCountry":"United States","servingSize":34.0,"servingSizeUnit":"g","householdServingFullText":"3 cookies","brandedFoodCategory":"Cookies & Biscuits","fdcId":2500691,"publicationDate":"11/2/2022"},
{"foodClass":"Branded","description":"BEEF FRANKS","foodNutrients":[{"type":"FoodNutrient","id":7,"nutrient":{"id":1093,"number":"307","name":"Sodium, Na","unitName":"mg"},"amount":1000}],"modifiedDate":"5/1/2024","brandOwner":"Example Meats","brandName":"EXAMPLE","dataSource":"LI","gtinUpc":"012345678905","ingredients":"BEEF, WATER, SALT, SODIUM NITRITE.","marketCountry":"United States","servingSize":50.0,"servingSizeUnit":"g","householdServingFullText":"1 frank","brandedFoodCategory":"Sausages, Hotdogs & Brats","fdcId":3333333},
{"foodClass":"Branded","description":"MYSTERY ITEM WITH NO LABEL TEXT","foodNutrients":[],"modifiedDate":"5/1/2024","brandOwner":"Nobody","gtinUpc":"098765432109","ingredients":"","marketCountry":"United States","brandedFoodCategory":"Other","fdcId":4444444}
]}
```

`src/lib/foodsImport.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { keepNewest, recordSplitter, usdaDate, usdaRecordToRow, ENGINE_REV } from "./foodsImport.ts";
import { dbNutrition } from "./nutrition.ts";
import type { FoodRow } from "./foods.ts";

/** A Branded Foods download record (the shape of FoodData_Central_branded_food_json_*.json). */
const rec = (over: Record<string, unknown> = {}) => ({
  fdcId: 2500691, gtinUpc: "044000032029", description: "CHOCOLATE SANDWICH COOKIES, CHOCOLATE", brandName: "OREO",
  brandOwner: "Nabisco Biscuit Company", ingredients: "INGREDIENTS: UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, SALT.",
  brandedFoodCategory: "Cookies & Biscuits", servingSize: 34, servingSizeUnit: "g", householdServingFullText: "3 cookies",
  modifiedDate: "2023-03-16", marketCountry: "United States",
  foodNutrients: [
    { type: "FoodNutrient", nutrient: { id: 1093, number: "307", name: "Sodium, Na", unitName: "mg" }, amount: 382 },
    { type: "FoodNutrient", nutrient: { id: 1235, number: "539", name: "Sugars, added", unitName: "g" }, amount: 41.2 },
    { type: "FoodNutrient", nutrient: { id: 1258, number: "606", name: "Fatty acids, total saturated", unitName: "g" }, amount: 5.88 },
    { type: "FoodNutrient", nutrient: { id: 1003, number: "203", name: "Protein", unitName: "g" }, amount: 4 },
  ],
  ...over,
});

test("a record becomes a row: key, tidy text, serving, the three nutrients, and the engine's level", () => {
  const row = usdaRecordToRow(rec(), "2025-12-18")!;
  assert.equal(row.barcode_key, "44000032029");
  assert.equal(row.barcode, "044000032029");
  assert.equal(row.fdc_id, 2500691);
  assert.equal(row.name, "Chocolate Sandwich Cookies, Chocolate");
  assert.equal(row.brand, "Oreo");
  assert.equal(row.category, "Cookies & Biscuits");
  assert.equal(row.ingredients, "UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, SALT.");
  assert.deepEqual([row.serving_size, row.serving_unit, row.serving_text], [34, "g", "3 cookies"]);
  assert.deepEqual([row.added_sugar_100g, row.sat_fat_100g, row.sodium_100g], [41.2, 5.88, 382]);
  assert.deepEqual([row.verdict, row.verdict_rank, row.flags, row.cooked, row.engine_rev, row.snapshot], ["none", 0, 0, true, ENGINE_REV, "2025-12-18"]);
});

test("the stored nutrition reproduces the Oreo label: 14 g added sugar, 28% DV, High", () => {
  const n = dbNutrition(usdaRecordToRow(rec(), "2025-12-18")!)!;
  assert.equal(n.serving, "3 cookies (34 g)");
  assert.deepEqual([n.nutrients[0].amount, n.nutrients[0].dv, n.nutrients[0].level], [14, 28, "high"]);
});

test("the level comes from the app's own engine: processed meat with nitrite reads Known, with two findings", () => {
  const row = usdaRecordToRow(rec({ description: "BEEF FRANKS", brandedFoodCategory: "Sausages, Hotdogs & Brats",
    ingredients: "BEEF, WATER, SALT, SODIUM NITRITE." }), "2025-12-18")!;
  assert.deepEqual([row.verdict, row.verdict_rank, row.flags, row.cooked], ["known", 3, 2, false]);
});

// Review Focus: records the table must not hold.
test("no barcode, a zero-only barcode, no ingredients, no id or junk give no row", () => {
  assert.equal(usdaRecordToRow(rec({ gtinUpc: "" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ gtinUpc: "0000-0000" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ ingredients: "  " }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ ingredients: "INGREDIENTS:" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ fdcId: undefined }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(null, "2025-12-18"), null);
  assert.equal(usdaRecordToRow("<html>", "2025-12-18"), null);
});

test("a barcode keeps only its digits; odd or missing nutrients and serving data are tolerated", () => {
  const row = usdaRecordToRow(rec({ gtinUpc: " 0 44000-032029 ", servingSize: "n/a", servingSizeUnit: undefined, householdServingFullText: undefined,
    foodNutrients: [{ nutrient: { number: "307" }, amount: "lots" }, { nutrient: { number: "999" }, amount: 3 }, null, { amount: 1 }] }), "2025-12-18")!;
  assert.deepEqual([row.barcode, row.barcode_key], ["044000032029", "44000032029"]);
  assert.deepEqual([row.serving_size, row.serving_unit, row.serving_text], [null, "", ""]);
  assert.deepEqual([row.added_sugar_100g, row.sat_fat_100g, row.sodium_100g], [null, null, null]);
  assert.equal(dbNutrition(row), null, "no nutrients stored → no nutrition section");
});

// The download writes dates as month/day/year ("3/22/2018" in the December 2025 file), which don't sort as text:
// "9/1/2019" > "11/2/2022" letter by letter. They must be turned into YYYY-MM-DD before anyone compares them.
test("usdaDate: month/day/year becomes sortable YYYY-MM-DD; ISO is kept; anything else is empty", () => {
  assert.equal(usdaDate("3/22/2018"), "2018-03-22");
  assert.equal(usdaDate(" 11/2/2022 "), "2022-11-02");
  assert.equal(usdaDate("2025-12-18"), "2025-12-18");
  assert.equal(usdaDate("2025-12-18T00:00:00Z"), "2025-12-18");
  for (const bad of ["", "soon", "13", undefined, null, 20250101]) assert.equal(usdaDate(bad), "");
  assert.ok(usdaDate("9/1/2019") < usdaDate("11/2/2022"), "as dates, 2019 is older than 2022");
});

// Review Focus: USDA lists a barcode more than once (4.5% of the December 2025 file); the newest label must win.
test("keepNewest: the newest record per barcode wins, in either order; a tie goes to the later record", () => {
  const old = usdaRecordToRow(rec({ fdcId: 1 }), "2025-12-18")!;
  const recent = usdaRecordToRow(rec({ fdcId: 2 }), "2025-12-18")!;
  const [oldDay, recentDay] = [usdaDate("9/1/2019"), usdaDate("11/2/2022")];
  const a = new Map<string, { row: FoodRow; modified: string }>();
  keepNewest(a, old, oldDay); keepNewest(a, recent, recentDay);
  const b = new Map<string, { row: FoodRow; modified: string }>();
  keepNewest(b, recent, recentDay); keepNewest(b, old, oldDay);
  assert.deepEqual([a.get(old.barcode_key)!.row.fdc_id, b.get(old.barcode_key)!.row.fdc_id], [2, 2]);
  keepNewest(b, old, recentDay);
  assert.equal(b.get(old.barcode_key)!.row.fdc_id, 1, "a tie goes to the later record");
  assert.equal(a.size, 1);
});

test("the import script, dry-run on the sample file: one row per barcode, label-less records skipped, nothing written", () => {
  const script = fileURLToPath(new URL("../../scripts/import-usda.mjs", import.meta.url));
  const sample = fileURLToPath(new URL("./fixtures/usda-download/sample-branded_2025-12-18.json", import.meta.url));
  const out = execFileSync(process.execPath, [script, sample, "--dry-run"], { encoding: "utf8" });
  assert.match(out, /Snapshot 2025-12-18: 4 records, 2 products kept/);
  assert.match(out, /1 without a barcode or ingredients/);
  assert.match(out, /"none":1,"known":1/);
  assert.match(out, /Dry run: nothing was written/);
});

// ── The streaming splitter ───────────────────────────────────────────────────

// Braces and quotes inside strings, an escaped quote, a string ending in an escaped backslash, nesting.
const DOC = String.raw`{"BrandedFoods": [
{"a":"x}{\"y","n":{"b":[1,2,{"c":"}"}]}},
{"p":"C:\\"},
{"a":2}
]}`;
const WANT = [String.raw`{"a":"x}{\"y","n":{"b":[1,2,{"c":"}"}]}}`, String.raw`{"p":"C:\\"}`, `{"a":2}`];

function split(chunks: string[]): string[] {
  const out: string[] = [];
  const feed = recordSplitter(json => out.push(json));
  chunks.forEach(feed);
  return out;
}

test("the splitter returns each record whole, however the text is chunked", () => {
  assert.deepEqual(split([DOC]), WANT);
  assert.deepEqual(split([...DOC]), WANT, "one character at a time");
  for (let i = 1; i < DOC.length; i++) assert.deepEqual(split([DOC.slice(0, i), DOC.slice(i)]), WANT, `split at ${i}`);
  for (const r of split([DOC])) JSON.parse(r);
});

test("the splitter finds nothing in an empty list or in text with no records", () => {
  assert.deepEqual(split([`{"BrandedFoods": []}`]), []);
  assert.deepEqual(split([""]), []);
});
```

- [ ] **Step 2: Run to see it fail**

Run `node --test src/lib/foodsImport.test.ts`.
Expected: FAIL with `Cannot find module './foodsImport.ts'`.

- [ ] **Step 3: Write the importer module**

`src/lib/foodsImport.ts`:

```ts
// foodsImport.ts — USDA Branded Foods download → `foods` rows. Used by scripts/import-usda.mjs and its tests.
// Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §4. Pure: no network, no files.
import type { FoodRow } from "./foods.ts";
import { assessProduct } from "./safety/assess.ts";
import { VERDICT_RANK } from "./safety/analyze.ts";
import { tidyCase } from "./lookup.ts";

/** Bump when the library or the rules change, so a row can say which engine scored it. */
export const ENGINE_REV = 1;

// USDA nutrient numbers: added sugars, saturated fat, sodium (amounts are per 100 g/ml).
const NUTRIENT: Record<string, "added_sugar_100g" | "sat_fat_100g" | "sodium_100g"> = {
  "539": "added_sugar_100g", "606": "sat_fat_100g", "307": "sodium_100g",
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

/** The download writes dates as "3/22/2018" (not sortable as text); returns "YYYY-MM-DD", or "" when unreadable. */
export function usdaDate(v: unknown): string {
  const s = text(v);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

/** One record of the Branded Foods JSON → a table row, scored by the app's own engine; null without a barcode or ingredients. */
export function usdaRecordToRow(raw: unknown, snapshot: string): FoodRow | null {
  const r = obj(raw);
  const barcode = text(r.gtinUpc).replace(/\D/g, "");
  const key = barcode.replace(/^0+/, "");
  const ingredients = text(r.ingredients).replace(/^ingredients:\s*/i, "");
  const fdcId = Number(r.fdcId);
  if (!key || !ingredients || !Number.isFinite(fdcId)) return null;

  const row: FoodRow = {
    barcode_key: key, barcode, fdc_id: fdcId,
    name: tidyCase(text(r.description)), brand: tidyCase(text(r.brandName) || text(r.brandOwner)),
    category: text(r.brandedFoodCategory), ingredients,
    serving_size: typeof r.servingSize === "number" && Number.isFinite(r.servingSize) ? r.servingSize : null,
    serving_unit: text(r.servingSizeUnit), serving_text: text(r.householdServingFullText),
    added_sugar_100g: null, sat_fat_100g: null, sodium_100g: null,
    verdict: "no-data", verdict_rank: VERDICT_RANK["no-data"], flags: 0, cooked: false, engine_rev: ENGINE_REV, snapshot,
  };
  for (const n of Array.isArray(r.foodNutrients) ? r.foodNutrients : []) {
    const column = NUTRIENT[text(obj(obj(n).nutrient).number)];
    const amount = obj(n).amount;
    if (column && typeof amount === "number" && Number.isFinite(amount)) row[column] = amount;
  }
  try {
    const a = assessProduct({ name: row.name, category: "", ingredients, source: { foodCategory: row.category }, additiveCodes: [] });
    row.verdict = a.verdict;
    row.verdict_rank = VERDICT_RANK[a.verdict];
    row.flags = a.flags.length + a.concerns.filter(c => c.kind === "food").length;
    row.cooked = a.concerns.some(c => c.kind === "cooking");
  } catch { /* keep "no-data": the app computes the badge itself when the page opens */ }
  return row;
}

/** One row per barcode: the record with the newest modified date wins (a tie goes to the later record). */
export function keepNewest(rows: Map<string, { row: FoodRow; modified: string }>, row: FoodRow, modified: string): void {
  const old = rows.get(row.barcode_key);
  if (!old || modified >= old.modified) rows.set(row.barcode_key, { row, modified });
}

/**
 * For text shaped {"BrandedFoods":[{...},{...}]}: returns a function to feed chunks to, which calls `onRecord` with the
 * JSON text of each record (brace depth 2) however the text is chunked. Braces inside strings are ignored.
 */
export function recordSplitter(onRecord: (json: string) => void): (chunk: string) => void {
  let depth = 0, inStr = false, esc = false, collecting = false;
  let buf: string[] = [];
  return (s: string) => {
    let from = collecting ? 0 : -1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false; continue; }
      if (c === 34) { inStr = true; continue; }
      if (c === 123) { depth++; if (depth === 2) { collecting = true; from = i; } }
      else if (c === 125) {
        if (depth === 2) { buf.push(s.slice(from, i + 1)); onRecord(buf.join("")); buf = []; collecting = false; from = -1; }
        depth--;
      }
    }
    if (collecting) buf.push(s.slice(from));
  };
}
```

- [ ] **Step 4: Write the loader script and its npm script**

`scripts/import-usda.mjs`:

```js
// Loads USDA FoodData Central Branded Foods into the `foods` table. The OWNER runs this, from their own machine:
//   npm run import:usda -- <path to FoodData_Central_branded_food_json_YYYY-MM-DD.zip> [--dry-run]
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored; never commit it, never run this in CI) and the project URL
// from .env. --dry-run parses and scores everything but writes nothing. A .json file works too (the tests' sample).
// Download: https://fdc.nal.usda.gov/download-datasets/ (Branded Foods, JSON, about 195 MB zipped, 3 GB unzipped).
// Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §4.
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { createClient } from "@supabase/supabase-js";
import { keepNewest, recordSplitter, usdaDate, usdaRecordToRow } from "../src/lib/foodsImport.ts";

for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* optional */ } } // existing variables win: .env.local first

const MAX_ROWS = 600_000; // the free tier holds about 430,000 of these comfortably; stop if USDA's file suddenly doubles
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const file = args.find(a => !a.startsWith("--"));
if (!file) { console.error("Usage: npm run import:usda -- <branded_food_json zip or .json> [--dry-run]"); process.exit(1); }
const snapshot = file.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
if (!snapshot) { console.error("The file name must contain USDA's release date, like ..._2025-12-18.zip"); process.exit(1); }

function open() {
  if (file.endsWith(".json")) return createReadStream(file);
  const [cmd, cmdArgs] = process.platform === "win32"
    ? ["C:\\Windows\\System32\\tar.exe", ["-xOf", file]]   // Windows' bsdtar reads zips
    : ["unzip", ["-p", file]];
  const p = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "inherit"] });
  p.on("exit", code => { if (code) { console.error(`${cmd} exited with ${code}`); process.exit(1); } });
  return p.stdout;
}

// One row per barcode, the newest record wins.
const rows = new Map(); // barcode_key -> { row, modified }
const stat = { records: 0, skipped: 0, unreadable: 0 };
const feed = recordSplitter(json => {
  let rec;
  try { rec = JSON.parse(json); } catch { stat.unreadable++; return; }
  stat.records++;
  const row = usdaRecordToRow(rec, snapshot);
  if (!row) { stat.skipped++; return; }
  keepNewest(rows, row, usdaDate(rec.modifiedDate) || usdaDate(rec.publicationDate));
});
const decoder = new StringDecoder("utf8");
let bytes = 0, lastLog = Date.now();
for await (const chunk of open()) {
  bytes += chunk.length;
  feed(decoder.write(chunk));
  if (Date.now() - lastLog > 15000) { lastLog = Date.now(); console.log(`${(bytes / 1e9).toFixed(2)} GB read, ${stat.records} records`); }
}
feed(decoder.end());

const all = [...rows.values()].map(x => x.row);
const levels = {};
for (const r of all) levels[r.verdict] = (levels[r.verdict] ?? 0) + 1;
console.log(`Snapshot ${snapshot}: ${stat.records} records, ${all.length} products kept (one per barcode), ${stat.skipped} without a barcode or ingredients, ${stat.unreadable} unreadable.`);
console.log("Levels:", JSON.stringify(levels));
if (all.length === 0) { console.error("Nothing to load: is this the Branded Foods JSON?"); process.exit(1); }
if (all.length > MAX_ROWS) { console.error(`${all.length} products is more than the ${MAX_ROWS} limit; check the free tier's size before raising it.`); process.exit(1); }
if (dry) { console.log("Dry run: nothing was written."); process.exit(0); }

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set VITE_SUPABASE_URL (in .env) and SUPABASE_SERVICE_ROLE_KEY (in .env.local)."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

for (let i = 0; i < all.length; i += 1000) {
  const batch = all.slice(i, i + 1000);
  for (let attempt = 1; ; attempt++) {
    const { error } = await db.from("foods").upsert(batch, { onConflict: "barcode_key" });
    if (!error) break;
    if (attempt === 3) { console.error(`The batch starting at ${i} failed: ${error.message}`); process.exit(1); }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  if ((i / 1000) % 20 === 0) console.log(`${i + batch.length} / ${all.length} uploaded`);
}
// A full run succeeded: products from older snapshots are gone from USDA's file, so remove them.
const { error, count } = await db.from("foods").delete({ count: "exact" }).lt("snapshot", snapshot);
if (error) { console.error(`Could not remove older snapshots: ${error.message}`); process.exit(1); }
console.log(`Done. ${all.length} products loaded; ${count ?? 0} older rows removed.`);
console.log("Check the size in the Supabase SQL editor: select pg_size_pretty(pg_total_relation_size('public.foods'));");
```

In `package.json`, in `"scripts"`, after the `verify:sources` line (add a comma to it):

```json
    "verify:sources": "node scripts/verify-sources.mjs",
    "import:usda": "node --max-old-space-size=6000 scripts/import-usda.mjs"
```

- [ ] **Step 5: Run the suite and the sample**

Run `npm test`. Expected: all pass, N0 + 12 tests (186 on `f5e6fdf`; Task 4 then drops the relay's 8).

Run `npm run import:usda -- src/lib/fixtures/usda-download/sample-branded_2025-12-18.json --dry-run`.
Expected output:

```
Snapshot 2025-12-18: 4 records, 2 products kept (one per barcode), 1 without a barcode or ingredients, 0 unreadable.
Levels: {"none":1,"known":1}
Dry run: nothing was written.
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/foodsImport.ts src/lib/foodsImport.test.ts src/lib/fixtures/usda-download/sample-branded_2025-12-18.json scripts/import-usda.mjs package.json
git commit -m "scripts: import-usda loads USDA Branded Foods into the foods table (owner runs it); pure mapper, splitter and tests"
```

---

### Task 4: Wire the app to the table

**Files:**
- Create: `src/lib/foodsDb.ts`, `src/app/components/useAlternatives.ts`
- Modify: `src/app/components/NutritionPanel.tsx`, `src/app/components/ScanTab.tsx`, `src/app/components/ProductDetailScreen.tsx`, `src/app/App.tsx`, `src/lib/supabase.ts`, `package.json`
- Delete: `supabase/functions/usda-relay/index.ts`, `supabase/functions/usda-relay/index.test.ts` (M7.5's relay)

**Interfaces:**
- Consumes: `FoodsSource`, `tsQueryFor`, `foodRowToProduct`, `snapshotLabel` (Task 2); `lookupBarcode`, `searchFoods`, `barcodeKey` (Task 2)
- Produces: `supabaseFoods: FoodsSource` (`foodsDb.ts`); `useAlternatives(product: Product, verdict: Verdict): { p: Product; a: Assessment }[]`

- [ ] **Step 1: Check that every `old_string` below still matches**

Run each; every count must be `1` (if one isn't, `main` moved: find the new wording and adapt the edit):

```bash
grep -c 'import { knownNutrition, searchUsda } from "../lib/lookup";' src/app/App.tsx
grep -c 'import { supabase, USDA_RELAY_URL } from "../lib/supabase";' src/app/App.tsx
grep -c 'searchUsda(query, { relayUrl: USDA_RELAY_URL }).then(r => {' src/app/App.tsx
grep -c 'Couldn.t reach USDA right now' src/app/App.tsx
grep -c 'Label data supplied by the makers. Checked first.' src/app/App.tsx
grep -c 'sent to USDA or Open Food Facts' src/app/App.tsx
grep -c 'products={products}' src/app/App.tsx            # expect 3 (ScanTab, SearchResultsScreen, ProductDetailScreen): only the last goes
grep -c 'VERDICT_RANK, escapeRegExp' src/app/components/ProductDetailScreen.tsx
grep -c 'import { USDA_RELAY_URL } from "../../lib/supabase";' src/app/components/ScanTab.tsx src/app/components/NutritionPanel.tsx
grep -c 'relayUrl: USDA_RELAY_URL' src/app/components/ScanTab.tsx src/app/components/NutritionPanel.tsx
```

- [ ] **Step 2: Create the Supabase adapter and the alternatives hook**

`src/lib/foodsDb.ts`:

```ts
// foodsDb.ts — reads the `foods` table through Supabase (the public key can only select). Spec:
// docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §3, §5. Browser only: Node tests use foodsFake.ts instead.
import { supabase } from "./supabase";
import { tsQueryFor, type FoodRow, type FoodsSource } from "./foods";

/** PostgREST errors are plain objects; the lookup code expects Errors. */
function fail(error: { message: string }): never {
  throw new Error(error.message);
}

export const supabaseFoods: FoodsSource = {
  async byBarcode(barcodeKey) {
    const { data, error } = await supabase.from("foods").select("*").eq("barcode_key", barcodeKey).maybeSingle();
    if (error) fail(error);
    return (data as FoodRow | null) ?? null;
  },
  async search(text, limit) {
    const q = tsQueryFor(text);
    if (!q) return [];
    const { data, error } = await supabase.rpc("search_foods", { q, n: limit });
    if (error) fail(error);
    return (data ?? []) as FoodRow[];
  },
  async alternatives(category, myRank, excludeKey, limit) {
    const { data, error } = await supabase.rpc("alternatives_for", { cat: category, my_rank: myRank, exclude_key: excludeKey, n: limit });
    if (error) fail(error);
    return (data ?? []) as FoodRow[];
  },
};
```

`src/app/components/useAlternatives.ts`:

```ts
// useAlternatives.ts — other products in the same USDA category with a strictly better badge, read from the `foods`
// table. Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md O6. Optional: any failure shows nothing.
import { useEffect, useState } from "react";
import type { Product } from "../../lib/productImporter";
import { VERDICT_RANK, type Verdict } from "../../lib/safety/analyze";
import type { Assessment } from "../../lib/safety/assess";
import { foodRowToProduct } from "../../lib/foods";
import { supabaseFoods } from "../../lib/foodsDb";
import { barcodeKey } from "../../lib/lookup";
import { safeAnalyze } from "./verdict";

export interface Alternative { p: Product; a: Assessment }

export function useAlternatives(product: Product, verdict: Verdict): Alternative[] {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  useEffect(() => {
    setAlternatives([]);
    // Only offered when this product has a finding; Open Food Facts products have no USDA category to compare within.
    if (verdict !== "known" && verdict !== "high" && verdict !== "some") return;
    if (!product.barcode || product.source?.crowdSourced) return;
    let live = true;
    const mine = VERDICT_RANK[verdict];
    const self = barcodeKey(product.barcode);
    (async () => {
      // A looked-up USDA product knows its category; a catalog product takes it from its own USDA row.
      const category = product.source?.foodCategory ?? (await supabaseFoods.byBarcode(self))?.category ?? "";
      if (!category) return;
      const rows = await supabaseFoods.alternatives(category, mine, self, 3);
      const found = rows.map(foodRowToProduct)
        .map(p => ({ p, a: safeAnalyze(p) }))
        .filter(({ a }) => VERDICT_RANK[a.verdict] < mine) // the app's engine, not the stored level, decides what is better
        .sort((x, y) => VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict]
          || x.a.flags.length - y.a.flags.length
          || x.p.name.localeCompare(y.p.name));
      if (live) setAlternatives(found);
    })().catch(() => { /* alternatives are optional: stay silent */ });
    return () => { live = false; };
  }, [product.id, verdict]); // eslint-disable-line react-hooks/exhaustive-deps
  return alternatives;
}
```

- [ ] **Step 3: Edit `NutritionPanel.tsx` and `ScanTab.tsx`**

(In the snippets of steps 3-5, a `// was:` or `// after:` line tells you where the edit goes; don't paste it.)

`NutritionPanel.tsx`:

```tsx
// was: import { USDA_RELAY_URL } from "../../lib/supabase";
import { supabaseFoods } from "../../lib/foodsDb";
```

```tsx
// was: lookupBarcode(product.barcode, { relayUrl: USDA_RELAY_URL }).then(r => {
lookupBarcode(product.barcode, { foods: supabaseFoods }).then(r => {
```

`ScanTab.tsx`:

```tsx
// was: import { USDA_RELAY_URL } from "../../lib/supabase";
import { supabaseFoods } from "../../lib/foodsDb";
```

```tsx
// was: await lookupBarcode(barcode, { relayUrl: USDA_RELAY_URL });
await lookupBarcode(barcode, { foods: supabaseFoods });
```

- [ ] **Step 4: Edit `App.tsx`**

```tsx
// was: import { supabase, USDA_RELAY_URL } from "../lib/supabase";
import { supabase } from "../lib/supabase";
```

```tsx
// was: import { knownNutrition, searchUsda } from "../lib/lookup";
import { knownNutrition, searchFoods } from "../lib/lookup";
import { supabaseFoods } from "../lib/foodsDb";
```

```tsx
// was: searchUsda(query, { relayUrl: USDA_RELAY_URL }).then(r => {
searchFoods(query, { foods: supabaseFoods }).then(r => {
```

```tsx
// was: // "More from USDA": real products beyond our catalog (one request per search text per session).
// "More from USDA": real products beyond our catalog, from EcoGo's copy of USDA FoodData Central (one request per search text per session).
```

```tsx
// was: <p className="text-xs text-muted-foreground">Couldn't reach USDA right now.</p>
<p className="text-xs text-muted-foreground">Couldn't search right now.</p>
```

```tsx
// was: { name: "USDA FoodData Central", text: "Label data supplied by the makers. Checked first." },
{ name: "USDA FoodData Central", text: "Label data supplied by the makers, copied into EcoGo's database about twice a year (each product page shows its snapshot date). Checked first. Source: U.S. Department of Agriculture, Agricultural Research Service, FoodData Central, fdc.nal.usda.gov." },
```

```tsx
// was: To find a product, its barcode or search words are sent to USDA or Open Food Facts.
To find a product, its barcode or search words are sent to EcoGo's database (hosted on Supabase) and, if it isn't there, to Open Food Facts.
```

In the `<ProductDetailScreen ... />` element, delete the line `products={products}` (keep the ones on `ScanTab` and `SearchResultsScreen`):

```tsx
                  onToggleSave={toggleSave}
                  onSelectProduct={openProduct}
```

- [ ] **Step 5: Edit `ProductDetailScreen.tsx`**

```tsx
// was: import { VERDICT_RANK, escapeRegExp, type Flag } from "../../lib/safety/analyze";
import { escapeRegExp, type Flag } from "../../lib/safety/analyze";
```

```tsx
// after: import { topHigh } from "../../lib/nutrition";
import { snapshotLabel } from "../../lib/foods";
import { useAlternatives } from "./useAlternatives";
```

```tsx
// props: drop `products`
interface ProductDetailScreenProps {
  product: Product; onBack: () => void; saved: boolean; onToggleSave: () => void;
  onSelectProduct: (p: Product) => void;
}

export default function ProductDetailScreen({ product, onBack, saved, onToggleSave, onSelectProduct }: ProductDetailScreenProps) {
```

Replace the whole `const alternatives = useMemo(() => { ... }, [products, product, analysis]);` block (with its comment line) by:

```tsx
  // Same USDA category, strictly better badge; only offered when this product has concerns (useAlternatives.ts).
  const alternatives = useAlternatives(product, analysis.verdict);
```

The source note (inside `{product.source && (...)}`):

```tsx
// was: : "Label data from USDA FoodData Central, supplied by the manufacturer."}{" "}
                : `Label data from USDA FoodData Central, supplied by the manufacturer${product.source.snapshot ? ` (snapshot ${snapshotLabel(product.source.snapshot)})` : ""}.`}{" "}
```

The alternatives card, a caption between the header row and the list:

```tsx
                <span className="font-bold text-sm">Alternatives with fewer concerns</span>
              </div>
              <p className="px-4 pt-2.5 text-[10px] text-gray-500 leading-snug">
                Other products in this USDA category with fewer findings. Availability near you isn't known.
              </p>
              <div className="divide-y divide-gray-50">
```

(`useMemo` is still used for `analysis`; `safeAnalyze` is still imported and used.)

- [ ] **Step 6: Retire the relay's code (M7.5)**

Nothing calls the relay any more, so remove it from the repository (the deployed function stays until Task 6):

```bash
git rm supabase/functions/usda-relay/index.ts supabase/functions/usda-relay/index.test.ts
```

In `src/lib/supabase.ts` delete the last two lines (the doc comment and `export const USDA_RELAY_URL = ...`) and the blank line
before them. In `package.json` change the `test` script back to

```json
    "test": "node --test \"src/lib/**/*.test.ts\"",
```

- [ ] **Step 7: Build, then look for leftovers**

Run `npm test` (expect all pass: N0 + 12 - 8 tests, 178 on `f5e6fdf`) and `npm run build` (expect success).

```bash
grep -rn "USDA_RELAY_URL\|relayUrl\|usda-relay\|FDC_API_KEY\|fdcKey\|searchUsda\|pickUsdaFood\|usdaNutrition\|api.nal.usda\|DEMO_KEY" src scripts package.json | grep -v fixtures
```

Expected: no output. Then in `dist/assets/*.js`: `grep -c "api.nal.usda.gov"` is `0`, none of `usda-relay` appears, and both `search_foods` and
`alternatives_for` appear.

- [ ] **Step 8: Commit**

```bash
git add src/lib/foodsDb.ts src/app/components/useAlternatives.ts
git commit -m "App reads USDA data from EcoGo's own table: scan, nutrition, search and alternatives; the relay's code is removed" -- src/lib/foodsDb.ts src/app/components/useAlternatives.ts src/app/components/NutritionPanel.tsx src/app/components/ScanTab.tsx src/app/components/ProductDetailScreen.tsx src/app/App.tsx src/lib/supabase.ts package.json supabase/functions/usda-relay/index.ts supabase/functions/usda-relay/index.test.ts
```

---

### Task 5: Load the data, then the launch audit (the owner runs the import)

**Files:**
- Create: `scripts/audit-foods.mjs`; `docs/superpowers/plans/2026-10-02-data-ownership-assets/audit-result.md` (written in step 7)

- [ ] **Step 1: Owner downloads the file**

From https://fdc.nal.usda.gov/download-datasets/ : **Branded Foods, JSON**, `FoodData_Central_branded_food_json_2025-12-18.zip`
(about 195 MB zipped, 3.1 GB unzipped; the file name must keep the date). Save it outside the repository.
(If a newer release exists, use it: the script reads the snapshot date from the file name.)

- [ ] **Step 2: Owner adds the service-role key**

Supabase dashboard → project `ecogo` → Settings → API → the **service_role** (secret) key. Put it in the worktree's
`.env.local` as `SUPABASE_SERVICE_ROLE_KEY=...`. Never paste it into chat.

- [ ] **Step 3: Dry run**

```bash
npm run import:usda -- "<path>\FoodData_Central_branded_food_json_2025-12-18.zip" --dry-run
```

Expected (about 3-6 minutes): roughly `454,000 records`, `431,000 products kept`, about 2,400 without a barcode or
ingredients, and levels close to none 81% / some 9% / high 6% / known 4% (the spike's numbers). A very different result
means the file or a rule changed: stop and look.

- [ ] **Step 4: Load**

Same command without `--dry-run`. About 431 batches; progress prints every 20. Expected last line:
`Done. ~431000 products loaded; 0 older rows removed.`

- [ ] **Step 5: Check size, rows and spot checks (connector `execute_sql`)**

```sql
select count(*) as products, pg_size_pretty(pg_total_relation_size('public.foods')) as total_size from public.foods;
```

Expected: about 431,000 and well under 400 MB (the estimate is 230-240 MB). **Over 400 MB: stop and tell the owner.**
Record the real size in the audit result.

```sql
select barcode_key, name, brand, category, verdict, snapshot from public.foods
where barcode_key in ('49000042566', '44000032029', '28400199148', '28400064057', '28400335799', '49000006582');
```

Expected: six rows (Coke Zero: "Some"; Doritos: "Some"; Lay's, Tostitos: "none"; Oreo: "none"; Diet Coke: "Some"),
snapshot `2025-12-18`.

Search plan: `explain analyze select f.* from public.foods f where to_tsvector('simple', f.name || ' ' || f.brand) @@ to_tsquery('simple', '(oreo | oreos)');`
Expected: a Bitmap Index Scan on `foods_search_idx`. Then
`explain analyze select * from public.search_foods('(chocolate | chocolates)', 10);` Expected: execution time under 1 second.
Record both.

- [ ] **Step 6: Create the audit sampler, run it, read the results**

`scripts/audit-foods.mjs`:

```js
// Prints a random sample of flagged products from the live `foods` table with the reasons the app's own engine gives,
// for the launch audit (spec O8): every "Some", "High" and "Known" badge must hold up against the label text.
//   node scripts/audit-foods.mjs [highKnown=200] [some=100] > audit.md
//   node scripts/audit-foods.mjs --clean-meat > audit-meat.md    (every "Nothing flagged" product in the two meat categories)
// Reads with the public key (the table is world-readable). ponytail: a one-off helper run once per import; no tests.
import { createClient } from "@supabase/supabase-js";
import { assessProduct } from "../src/lib/safety/assess.ts";

process.loadEnvFile(".env");
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const args = process.argv.slice(2);

function show(row, i) {
  const a = assessProduct({ name: row.name, category: "", ingredients: row.ingredients, source: { foodCategory: row.category }, additiveCodes: [] });
  const why = [
    ...a.flags.map(f => `${f.entry.name} (“${f.matchedText}”)`),
    ...a.concerns.map(c => `${c.name}: ${c.reason}`),
  ].join(" · ") || "(nothing)";
  console.log(`### ${i + 1}. ${row.brand} — ${row.name}  (${row.barcode}, ${row.category})`);
  console.log(`Badge now: ${a.verdict} (stored: ${row.verdict})`);
  console.log(`Why: ${why}`);
  console.log(`Label: ${row.ingredients.slice(0, 500)}${row.ingredients.length > 500 ? "…" : ""}`);
  console.log("- [ ] the badge is right for this label\n");
}

/** `n` random rows whose level is one of `levels` (random offsets into the ordered list; one request each). */
async function sample(levels, n) {
  const { count, error } = await db.from("foods").select("barcode_key", { count: "exact", head: true }).in("verdict", levels);
  if (error) throw error;
  const offsets = new Set();
  while (offsets.size < Math.min(n, count)) offsets.add(Math.floor(Math.random() * count));
  const rows = [];
  for (const offset of offsets) {
    const { data, error: e } = await db.from("foods").select("*").in("verdict", levels).order("barcode_key").range(offset, offset);
    if (e) throw e;
    rows.push(...data);
  }
  return rows;
}

if (args.includes("--clean-meat")) {
  const { data, error } = await db.from("foods").select("*").eq("verdict", "none")
    .in("category", ["Pepperoni, Salami & Cold Cuts", "Sausages, Hotdogs & Brats"]).order("barcode_key").limit(500);
  if (error) throw error;
  console.log(`# "Nothing flagged" in the processed-meat categories: ${data.length}\n`);
  data.forEach(show);
} else {
  const highKnown = Number(args[0]) || 200, some = Number(args[1]) || 100;
  console.log(`# Audit sample: ${highKnown} High/Known, ${some} Some\n\n## High / Known\n`);
  (await sample(["high", "known"], highKnown)).forEach(show);
  console.log("## Some\n");
  (await sample(["some"], some)).forEach(show);
}
```

```powershell
node scripts/audit-foods.mjs 200 100 | Out-File -Encoding utf8 "$env:TEMP\audit.md"
node scripts/audit-foods.mjs --clean-meat | Out-File -Encoding utf8 "$env:TEMP\audit-meat.md"
```

Read all of both files (about 300 + 106 entries) and judge each badge against its label text: "Known"/"High" must name a
real finding in the ingredients or the food itself; "Some" must name a library additive actually on the label; a
"Nothing flagged" processed-meat product must really not be processed meat (for example a plant-based hot dog). Ask the owner
to spot-check 20 of your judgments. Typical false-flag causes (from KNOWN_ISSUES): "veggie"/"vegan" in a name, flavouring
text such as "bacon seasoning", a dish named after its meat.

- [ ] **Step 7: Gate**

Write `docs/superpowers/plans/2026-10-02-data-ownership-assets/audit-result.md`: counts per level from the import, size,
timings, how many entries you judged, every false flag with its barcode and cause, and what you changed.

- **Zero false flags:** the gate passes.
- **Any false flag:** fix the rule in `src/lib/safety/foodConcerns.ts` or the library **with a test**, bump `ENGINE_REV` in
  `foodsImport.ts`, re-run the import (step 4), draw a fresh sample and repeat. The gate passes only on a clean sample.
- **More than 5 false flags in the first sample:** stop and tell the owner before fixing: the rules need a design pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/audit-foods.mjs docs/superpowers/plans/2026-10-02-data-ownership-assets/audit-result.md
git commit -m "scripts: audit-foods samples flagged products for the launch audit; audit result recorded"
```

---

### Task 6: Live checks, deploy cleanup, keep-alive, docs, merge, push

**Files:**
- Modify: `docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs`, `.github/workflows/deploy.yml`, `README.md`, `PROJECT_HANDOFF.md`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `SYNOPSIS.md`
- Create: `.github/workflows/keep-alive.yml`

- [ ] **Step 1: Extend the headless check**

In `check-home.mjs`, five edits:

```js
// 1. in the header comment, after: // search result, opened and bookmarked, is listed in Favorites.
// Data ownership: lookups, nutrition, search and alternatives come from our own `foods` table; USDA's API is never called.
```

```js
// 2. was: const errors = [];
const errors = [];
const requests = []; // every URL the page asked for (Network events)
```

```js
// 3. before the line that starts: if (m.method === "Runtime.exceptionThrown") errors.push(...
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
```

```js
// 4. was: await send("Runtime.enable");
  await send("Runtime.enable");
  await send("Network.enable");
```

```js
// 5. immediately BEFORE the line: check("no console errors", errors.length === 0, errors.join(" | "));
  // Data ownership (spec 2026-10-02-m10-data-ownership-design.md §7): lookups, nutrition, search and alternatives come from
  // our own `foods` table. The app never calls USDA's API.
  const scanTyped = (code, text) => run(`(async () => {
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click();
    await __until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes(${JSON.stringify(text)}), 15000);
    await __sleep(800); return document.body.innerText; })()`);
  await back(); await back(); // KIND product → search → home
  await home();
  const tos = await scanTyped("028400064057", "Tostitos");
  check("a barcode outside the catalog is found in our database, with the USDA snapshot date",
    tos.includes("Tostitos") && /snapshot [A-Z][a-z]{2} \d{4}/.test(tos), tos.match(/\(snapshot [^)]*\)/)?.[0] ?? "no snapshot note");
  await back(); await home();
  const dor = await scanTyped("028400335799", "Doritos");
  const alt = await run(`(async () => { await __until(() => document.body.innerText.includes("Alternatives with fewer concerns"), 15000); return document.body.innerText; })()`);
  check("a flagged product shows alternatives from the same USDA category, with the caption",
    dor.includes("Doritos") && alt.includes("Alternatives with fewer concerns") && alt.includes("Availability near you isn't known"));
  await back(); await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("granola");
  const more = await run(`(async () => { const first = () => [...document.querySelectorAll("p")].find(e => e.innerText === "More from USDA FoodData Central")?.parentElement.querySelector("button");
    return !!(await __until(first, 20000)); })()`);
  check("a text search lists more products from our USDA copy", more);
  check("USDA's own API is never called", !requests.some(u => u.includes("api.nal.usda.gov")), requests.filter(u => u.includes("usda")).slice(0, 3).join(" "));
```

- [ ] **Step 2: Run it against a local production build**

```bash
npm run build
npx vite preview --port 4317
```

In another terminal: `node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs http://localhost:4317/`.
Expected: every check passes (the earlier ones plus 4 new) and `0` console errors. Stop the preview afterwards; a stopped
`vite preview` can leave an orphan node holding the port: free it via `Get-NetTCPConnection` → `Stop-Process`.
(The Doritos check needs Doritos to read "Some concern" and its category to have cleaner products: both held in the
December 2025 data; if the data changes, pick another flagged catalog product.)

- [ ] **Step 3: Remove the relay comment from the deploy workflow**

M7.5 already took the key check out of `.github/workflows/deploy.yml`; one comment about the relay is left. Delete this line
(and nothing else):

```yaml
      # No USDA key here: the usda-relay Edge Function holds it as a Supabase secret (M7.5).
```

- [ ] **Step 4: Add the weekly keep-alive**

`.github/workflows/keep-alive.yml`:

```yaml
# Reads one row of the `foods` table each week so Supabase's free tier doesn't pause the project for inactivity (it
# pauses after a week without use). A workaround, not a guarantee: GitHub also switches scheduled workflows off after
# 60 days without repository activity. Real visitors count as activity too. Spec: data-ownership design, O7.
name: Keep Supabase awake

on:
  schedule:
    - cron: "17 6 * * 1"   # Mondays, 06:17 UTC
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Read one row
        run: |
          set -a; . ./.env; set +a   # the project URL and the publishable key: public by design
          curl -fsS "$VITE_SUPABASE_URL/rest/v1/foods?select=barcode_key&limit=1" \
            -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" > /dev/null
```

- [ ] **Step 5: Docs**

The docs already describe M7.5's relay: make them describe the table instead. Grep each stale phrase: `usda-relay`,
`relay`, `FDC_API_KEY`, `relayUrl`, `USDA_RELAY_URL`, `api.nal.usda.gov`, `fetched live`, `USDA via usda-relay`, `One Edge Function`.

- `README.md` (the "Running it needs no API key: USDA lookups go through EcoGo's relay…" paragraph): replace with
  `Running it needs no API key: product lookups read EcoGo's copy of USDA FoodData Central from Supabase. To load or refresh that copy (the owner's job): download USDA's Branded Foods JSON zip, put SUPABASE_SERVICE_ROLE_KEY in .env.local, then run npm run import:usda -- <the zip>.`
- `PROJECT_HANDOFF.md`: the "How to run" lookup paragraph (the one about `usda-relay` and `FDC_API_KEY`) the same way; the
  "Where things stand" lines that say one Edge Function holds the USDA key (it no longer exists); in decision 026's row
  append "Superseded by 028"; and a new row after the last one (027 at the time of writing):
  `| 028 | USDA label data lives in EcoGo's own database: a read-only copy of USDA Branded Foods (one row per barcode, snapshot-dated) replaces live USDA calls; Open Food Facts stays a live, labelled fallback; the usda-relay Edge Function and its secret are retired | Owner, 2026-10-02: alternatives for any product, faster and more reliable scans, search beyond the catalog, safe at public scale | **Done** (M10). Supersedes the live-USDA part of 016 and decision 026 |`
- `KNOWN_ISSUES.md`: strike through the whole section "USDA relay (M7.5, accepted trade-off)" and mark it "moot since
  decision 028 (M10: the relay is gone, so is the shared quota)"; update the roadmap line for M10 to done. Add a
  "Data-ownership follow-ups" section: refresh the copy about twice a year and after any library change (bump
  `ENGINE_REV`); added sugar is present for only about 32% of products, so the sugar row reads "not listed" for most USDA
  products; alternatives have no popularity ranking, so they can be products you can't buy nearby; the keep-alive is a
  workaround; search is whole-word with plural "s" only ("berries" doesn't find "berry"); the audit result (link to
  `audit-result.md`).
- `ARCHITECTURE.md`: the Backend row ("One Edge Function…": none now), the Config row (`.env.local` holds the owner's
  `SUPABASE_SERVICE_ROLE_KEY` for the import, not a USDA key), the `ScanTab`/`lookup.ts` diagram and file rows, the
  `nutrition.ts` row, the `deploy.yml` row (plus `keep-alive.yml`), delete the `supabase/functions/usda-relay/index.ts`
  row, the "Looked-up products" and "Scan: lookup of non-catalog barcodes" rows, and the external-services row for
  `api.nal.usda.gov` (now: the USDA download file, loaded by `scripts/import-usda.mjs`). Add a short "Data" entry for the
  `foods` table, its two functions and the import.
- `SYNOPSIS.md`: the plain-language step about the USDA key relay gets "(retired by the step below)", and a new step says
  in plain words that EcoGo now keeps its own copy of USDA's product data, why, and what it cost (nothing new).

- [ ] **Step 6: Bring the branch up to date and re-run everything**

```bash
git merge main
```

Resolve conflicts if any (docs most likely). Then `npm test` (all pass), `npm run build`, and step 2 again.
Re-run the "still matches" greps of Task 4 if `App.tsx` changed. Commit the docs, the check and the workflows by path:

```bash
git add docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs .github/workflows/deploy.yml .github/workflows/keep-alive.yml README.md PROJECT_HANDOFF.md KNOWN_ISSUES.md ARCHITECTURE.md SYNOPSIS.md
git commit -m "Checks, deploy and docs for EcoGo's own USDA copy: no key in CI, weekly keep-alive"
```

- [ ] **Step 7: Owner approves, then merge and push**

Show the owner: the audit result, the size, the check output and phone-width screenshots of a product page with
alternatives and of search results. **Ask before pushing: a push redeploys the live site.** Then, in the main checkout:
`git merge --ff-only data-ownership` (if main moved, merge main into the branch first), `git push`.

- [ ] **Step 8: After the deploy**

1. In GitHub: Actions → "Keep Supabase awake" → Run workflow once; expected: green.
2. Run `check-home.mjs` against the live URL `https://skynetrebel42.github.io/ecogo/`; expected: all pass.
3. **Ask the owner in chat right before** (a deploy-class change): delete the Edge Function `usda-relay` (Supabase dashboard →
   Edge Functions) and its secret `FDC_API_KEY`. Only after the live checks above pass.
4. The owner confirms the repository secret `VITE_FDC_API_KEY` is gone (M7.5's last step) and may deactivate the USDA API
   key at api.data.gov: the import needs none (the download is public).
5. `git worktree remove ../EcoGo-foods`; delete the branch if merged.

**Rollback:** before step 3, revert Task 4's commit (it restores the relay's code and calls; the function is still
deployed) and push. After step 3 the relay is gone: redeploy it from commit `94a2af0` (`supabase/functions/usda-relay/`),
have the owner re-create the secret, then revert. The table and the migration can stay either way.

---

## Spec coverage

| Spec | Where |
|---|---|
| O1 table, read-only, owner loads | Tasks 1, 3, 5 |
| O2 lookup order; USDA API, key and `DEMO_KEY` removed | Tasks 2, 4, 6 (step 3) |
| O3 Open Food Facts stays live; 8-digit rule | Task 2 |
| O4 badge computed in the app; stored level only orders; `engine_rev` | Tasks 3, 4 (`useAlternatives` re-filters) |
| O5 snapshot date shown; older rows deleted after a full run | Tasks 2, 3, 4 |
| O6 alternatives rule and caption | Tasks 1 (`alternatives_for`), 4 |
| O7 weekly keep-alive | Task 6 |
| O8 launch audit gate | Task 5 |
| O9 privacy text, USDA citation | Task 4 |
| Relay retired (spec §8) | Tasks 4 (its code), 6 (the deployed function and secret) |
| Size budget, rollout order, rollback | Task 5 (size), the task order, Task 6 |

# M10: Data ownership: a read-only copy of USDA Branded Foods in EcoGo's own database: design spec

- **Date:** 2026-10-02
- **Status:** design approved by the owner in chat 2026-10-02 (five sections); **milestone M10** (numbered by the PM chat
  2026-10-02; order: M7.4 → M7.5 USDA key relay → M9 real map → **M10** → M8 add a product). **Not built.** A draft plan
  exists, `docs/superpowers/plans/2026-10-02-data-ownership.md`, written and dry-run against `main` at `854ce20`, **before
  M7.5 and M9**: it must be re-verified against `main` when M9 has landed (its `old_string` greps, the test count, the
  `lookup.ts` baseline) before anyone builds from it.
- **Decided with:** the owner (Minh Bui), 2026-10-02, after the architecture review: **all four goals**: alternatives for
  any product, faster and more reliable scans, search beyond the 51-product catalog, safe at public scale. Chosen
  approach: **a slim USDA copy in Supabase** (not a lookup cache, not static files).

## 1. Why

Today every barcode outside the 51 catalog products is looked up **live** in USDA FoodData Central from the visitor's
browser, then Open Food Facts. That has five costs:
- the USDA key is in the public JavaScript (`VITE_FDC_API_KEY`); USDA's API guide says keys found public are deactivated,
  and a dead key breaks every USDA lookup;
- nothing is shared between visitors, so each first scan pays 1-3 requests (`lookup.ts` `fetchUsda` tries the typed
  digits, then the 14-digit form);
- "Alternatives with fewer concerns" exist only for the 51 catalog products (a looked-up product has no category, and
  `ProductDetailScreen.tsx` filters the catalog by category);
- text search beyond the catalog is a live USDA query (`searchUsda`), limited to 10 results;
- a USDA outage, CORS change or rate limit (1,000 requests an hour per IP) breaks scanning.

USDA publishes the data as CC0 (public domain) twice a year, so EcoGo can hold its own read-only copy.

### 1.1 Size spike (2026-10-02, throwaway; scripts and output were in the author's scratchpad, not the repo)

Input: `FoodData_Central_branded_food_json_2025-12-18.zip` (195 MB; fdc.nal.usda.gov). Kept products with a barcode and an
ingredient list, one per barcode (newest wins).

| Measure | Result |
|---|---|
| Records / with barcode and ingredients / unique barcodes | 454,366 / 451,989 / **431,302** (20,687 repeats merged) |
| US market | 98% |
| USDA categories | 351 |
| Estimated size in Postgres (heap + btree + full-text index) | **about 230-240 MB** of the free tier's 500 MB; an estimate, not measured in Postgres (plus or minus 30%) |
| Nutrition present | sodium 99%, saturated fat 87%, **added sugar 32%** |
| EcoGo's engine over all 431k products (75 s, 0 errors) | Nothing flagged 80.8% · Some 9.2% · High 6.3% · Known 3.6% · 🔥 marker 12.6% |
| Flagged products with at least 3 "Nothing flagged" products in the same USDA category | 82,745 of 82,776, except processed-meat categories (Pepperoni, Salami & Cold Cuts: 77 clean of about 4,700; Sausages, Hotdogs & Brats: 29 of about 4,600) |

Consequence of the 32%: the M5 added-sugar row reads "not listed" for about two-thirds of USDA products. This spec does
not change that rule.

## 2. Decisions

| # | Decision |
|---|---|
| O1 | A read-only table **`foods`** in the owner's Supabase project holds one slim USDA Branded row per barcode. Browsers can only `select`; the table is loaded by a script the **owner** runs with the service-role key (never CI, never committed). |
| O2 | Lookup order becomes: catalog (51) → `foods` (one request) → Open Food Facts live → not found. **USDA's live API, `DEMO_KEY` and the `VITE_FDC_API_KEY` secret are removed.** |
| O3 | **Open Food Facts is not copied** (ODbL share-alike; crowd-sourced). It stays a live, labelled fallback, with the 8-digit rule unchanged (8-digit codes go to `foods` only). |
| O4 | The product page's badge is still computed in the browser by the engine (source of truth). The stored badge only orders search results and alternatives; `engine_rev` records which engine scored a row. |
| O5 | Every row carries USDA's snapshot date, shown on the product page ("USDA label data, snapshot Dec 2025"). Rows from older snapshots are deleted after a full successful import. |
| O6 | Alternatives (any product with a USDA category): same category, **strictly better badge**, then fewest findings, then name; only complete records (ingredients, serving size, sodium); up to 3; caption "Other products in this USDA category with fewer findings. Availability near you isn't known." No popularity ranking. |
| O7 | A scheduled GitHub Action makes one small read of `foods` each week so the free project is not paused for inactivity (a workaround, not a guarantee). |
| O8 | **Launch gate:** an audit of 200 random High/Known and 100 random Some results against the label text, plus the roughly 100 "Nothing flagged" products in the two processed-meat categories. The first pass runs on Sonnet subagents in batches (each entry: flag correct / false flag / unsure, with the label phrase); the builder reviews every false and unsure one plus a random 10% of the correct ones; the owner spot-checks 20. Any confirmed false flag means fix the rule and re-run. *(Owner's change to the gate, 2026-10-02, relayed by the PM chat.)* |
| O9 | Privacy text changes to stay true: barcodes and search words go to EcoGo's database (Supabase) or Open Food Facts, no longer USDA. Profile › Where results come from gets USDA's requested citation and the snapshot date. |

## 3. Data model

One migration (schema only; the 431k rows are loaded by the script, not by a migration).

```
foods(
  barcode_key text primary key,        -- digits, leading zeros stripped: the key() of lookup.ts
  barcode text not null,               -- as USDA stores it
  fdc_id bigint not null, name text not null, brand text not null default '',
  category text not null default '',   -- USDA brandedFoodCategory
  ingredients text not null,
  serving_size real, serving_unit text not null default '',
  serving_text text not null default '',                        -- household serving, "3 cookies"
  added_sugar_100g real, sat_fat_100g real, sodium_100g real,   -- per 100 g/ml; null = not listed
  verdict text not null, verdict_rank smallint not null, flags smallint not null, cooked boolean not null,
  engine_rev smallint not null, snapshot date not null )
```
- Indexes: primary key; btree on `(category, verdict_rank)`; GIN on the **expression**
  `to_tsvector('simple', name || ' ' || brand)` (not a stored column: saves tens of MB).
- RLS on, one `select` policy for `anon`/`authenticated`, explicit `grant select`, no other grants (same pattern as the
  catalog migration). Not in the realtime publication.
- Two stable functions, executable by `anon`: `search_foods(q, n)` (`q` is a `to_tsquery` string built by the app from
  the typed words: every word must match as a whole word, plural either way like `search.ts`; no stemming) and
  `alternatives_for(cat, my_rank, exclude_key, n)` (O6).

## 4. Import script (`scripts/import-usda.mjs`, run by the owner)

- Input: the path to USDA's Branded JSON zip. Streams the file (3.1 GB unzipped), keeps one record per barcode (newest
  `modifiedDate`), drops records with no barcode or no ingredients.
- A **pure module** (`src/lib/foodsImport.ts`: USDA download record → table row, newest-record-wins, and the streaming
  record splitter) is shared with the tests. Nutrients by USDA number: added sugars 539, saturated fat 606, sodium 307
  (amounts per 100 g/ml). The script also accepts an unzipped `.json`, which is how the tests run it on a sample.
- Scores each row with `assessProduct` (same engine as the app) → `verdict`, `verdict_rank`, `flags`, `cooked`,
  `engine_rev`.
- Uploads in batches of 1,000 with supabase-js and `SUPABASE_SERVICE_ROLE_KEY` from the gitignored `.env.local`; upsert by
  `barcode_key`; then deletes rows whose `snapshot` is older. Refuses to run if the file has more than 600,000 products.
- Re-run when USDA publishes (about twice a year) and after the safety library changes. No rescore-only mode yet.
  *(ponytail: full re-import is a few minutes; add a rescore mode if that becomes a chore.)*

## 5. App changes

- **The database seam:** `src/lib/foods.ts` (pure: the row type, the `FoodsSource` interface with `byBarcode`, `search`,
  `alternatives`, row → Product, the search-query builder) with two adapters: `foodsDb.ts` (Supabase, browser only) and
  `foodsFake.ts` (in memory, tests only; never imported by the app). The split keeps `lookup.ts` loadable by Node tests.
- **`lookup.ts`:** drops `fetchUsda`, `searchUsda`'s HTTP, `DEMO_KEY` and `fdcKey`; `lookupBarcode(raw, { foods, fetchImpl })`
  keeps Open Food Facts, the session cache, "errors aren't cached" and "unreachable is an error, never not-found".
  Call sites (`ScanTab.tsx`, `NutritionPanel.tsx`, `App.tsx` search) stop passing `fdcKey`.
- **`nutrition.ts`:** `dbNutrition(row)`: per-100 g values × serving size → per-serving FDA %DV for serving units g and
  ml (other units: not listed); rules unchanged. Catalog products get nutrition from the same `foods` request (no key).
- **Product page:** source note names the snapshot and links the USDA record by `fdc_id`; alternatives use O6 for any
  product that has a USDA category (catalog products take it from their own `foods` row).
- **Search:** catalog results as today; "More from USDA FoodData Central" reads `search_foods`.
- **Profile:** privacy and sources text (O9).
- **Deploy workflow / README / handoff:** remove the `VITE_FDC_API_KEY` secret check and mentions.
- Unchanged: the 51 catalog products, Open Food Facts mapping, the safety engine and library, camera scanning.

## 6. Rollout (the live site never breaks)

1. Migration applied to the live database (empty table; nothing changes for users).
2. The owner runs the import; check row count, `pg_size_pretty(pg_total_relation_size('foods'))` (record it in the
   handoff) and spot-check Coke Zero, Oreo, Lay's against what the app shows now.
3. Launch gate O8 passes.
4. App change on `main`; push after the owner approves.
5. After the deploy: delete the repository secret `VITE_FDC_API_KEY` and the USDA key; add the weekly keep-alive action.
6. Docs: a new decision (supersedes decision 016's live USDA lookup), KNOWN_ISSUES (retire the USDA rate-limit follow-ups).

Rollback: revert the app commit; the table can stay.

## 7. Testing

- `lookup.test.ts` rewritten around the fake adapter: order, session cache, errors not cached, unreachable is an error,
  the 8-digit rule, 12/13/14-digit forms of one product share a key.
- `dbNutrition` reproduces today's %DV for Oreo, Lay's and Coke Zero (the real fixtures already in the repo).
- The import mapper is tested on real records (a few lines of the Branded JSON, kept as a fixture).
- Headless check (vite preview): scan a non-catalog barcode (Tostitos `028400064057`) and assert it is found with the
  USDA source note and **zero requests to `api.nal.usda.gov`**; search a word and see "More from USDA" results.
- All earlier tests and `check-home`/camera checks stay green.

## 8. Dependencies and conflicts (for the PM chat)

- Touches `lookup.ts`, `ScanTab.tsx`, `NutritionPanel.tsx`, `ProductDetailScreen.tsx`, search in `App.tsx` and the Profile
  text: **do not build alongside** another milestone editing those files.
- **M7.5 (USDA key relay) lands first and this milestone retires it.** M7.5 puts the USDA key in a Supabase Edge
  Function (`usda-relay`) and makes `lookup.ts` call it. M10 replaces those calls with the `foods` table, so its final
  task also: removes the relay URL from `src/lib/supabase.ts`, and (with the owner's OK) deletes the Edge Function and its
  `FDC_API_KEY` secret. The plan's `lookup.ts` is a whole-file replacement, so it drops the relay code by itself.
- **M9 (real map)** lands before this and uses its own Supabase table; no overlap beyond the keep-alive action and the
  free-tier budget (`foods` about 240 MB leaves room for the places snapshot).
- **M8 (add a product)** lands after this: its plan must call `lookupBarcode(code, { foods: supabaseFoods })`
  (option shape `{ foods, fetchImpl }`; no key and no relay URL). M8's Open Food Facts flow is unaffected.

## 9. Out of scope

Accounts, persistent favorites, links/routing, copying Open Food Facts, non-food products, popularity ranking, keeping a
USDA proxy or edge-function fallback after this (M7.5's relay is removed here), a rescore-only mode, user-contributed
data, the full nutrient set, Nutri-Score/NOVA.

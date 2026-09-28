# M2: Open Food Facts lookup, cooking note, nutrition section: design spec

> **Superseded 2026-09-28** by `2026-09-28-m2-usda-lookup-design.md` (owner chose USDA as the main source). Kept for
> the verified acrylamide and Nutri-Score facts, which are deferred work.

- **Date:** 2026-09-28
- **Status:** approved in conversation, awaiting written-spec review
- **Designed with:** the owner (Minh Bui). Decisions below are theirs unless marked *recommended default*.
- **Builds on:** M1 safety engine (`docs/superpowers/specs/2026-09-24-safety-engine-design.md`), branch
  `m2-open-food-facts` (stacked on `simplify-cuts`; neither merged to `main` yet).

## 1. Why

M1 answers one narrow question: "is any of 17 officially flagged additives on the label?" The owner pointed out the
blind spot. Potato chips got a green "No concerns" while acrylamide forms when they're fried and their nutrition is
poor. Two fixes followed: the wording is now honest ("No flagged additives", commit `6d24703`), and M2 widens what
the product page tells people. The same "facts / science first" rule still applies: every statement cites an official
source or is labelled as someone else's estimate.

**Done for M2:** scanning (or typing) a barcode that isn't in our 51-product catalog shows a real product page from Open
Food Facts, with the additive check, a cooking note where it applies, and a nutrition section. Nothing crowd-sourced
or estimated is presented as official.

## 2. Decisions

| # | Decision | Source |
|---|---|---|
| D1 | Browser calls Open Food Facts (OFF) directly, cached for the session; no backend, no DB cache | owner (approach A) |
| D2 | Acrylamide is a separate "Formed during cooking" note; it never changes the verdict or list dot | owner |
| D3 | Nutrition section shows OFF's Nutri-Score **letter as plain text** (no official logo) and NOVA group, separate from the additive check | owner |
| D4 | Email Santé publique France for Nutri-Score permission before public launch (pre-launch checklist) | owner |
| D5 | A scan found on OFF is logged as an unknown barcode (`product_id` null) | recommended default |
| D6 | Demo picker gains real non-catalog barcodes plus a "type a barcode" field | recommended default |
| D7 | Gerber Puffs moves to a new food category "Baby Food" (it's baby cereal food, currently skipped as non-food) | recommended default |
| D8 | Nutrition shows only for products looked up on OFF, not for catalog products (amended 2026-09-28: live checks showed catalog barcodes belong to other products on OFF — Doritos' barcode is Tostitos, Oreo's is Wheat Thins) | planning finding |

## 3. Facts this design rests on (verified 2026-09-28, second-agent checked)

**Open Food Facts API**
- Read: `GET https://world.openfoodfacts.org/api/v3/product/{code}.json?fields=…`. Found = `status` `success` or
  `success_with_warnings`; not found = HTTP 404 / `failure`. "Found" can be an empty shell (no name, no ingredients).
- Browser-callable (CORS `*`, `X-User-Agent` allowed). Limit **15 product reads / minute / user**.
- The API normalizes barcodes itself (12-digit UPC-A and its 13-digit EAN-13 match).
- Fields used: `product_name`, `product_name_en`, `brands`, `lang`, `ingredients_text`, `ingredients_text_en`,
  `additives_tags` (`en:e250` form), `nutriscore_grade` (`a`–`e`, `unknown`, `not-applicable`), `nova_group` (1–4 or
  missing), `categories_tags` (hierarchical, includes parents).
- Licence ODbL: credit Open Food Facts with a link to the product's OFF page. OFF states its data has "no
  assurances that the data is accurate": it is crowd-sourced, not official.
- OFF **computes** the Nutri-Score itself (2023 method) and calls its NOVA estimate "experimental".

**Acrylamide** (sources the note cites; quotes verbatim, script-checkable pages)

| Body | URL | Quote |
|---|---|---|
| IARC | https://publications.iarc.who.int/78 | "Acrylamide was classified as probably carcinogenic to humans." |
| EFSA | https://www.efsa.europa.eu/en/press/news/150604 | "acrylamide in food potentially increases the risk of developing cancer for consumers in all age groups" |
| EU | http://publications.europa.eu/resource/celex/32017R2158 | "(a) French fries, other cut (deep fried) products and sliced potato crisps from fresh potatoes;" |
| FDA | https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers | "Should I stop eating foods that are fried, roasted, or baked?" (FDA's answer: No) |
| FDA | https://www.fda.gov/food/process-contaminants-food/acrylamide-and-diet-food-storage-and-food-preparation | "to a golden yellow color rather than a brown color helps reduce acrylamide formation" |

EU Regulation 2017/2158 Article 1(2) food types: (a) French fries, other cut deep-fried products and sliced potato
crisps from fresh potatoes; (b) potato crisps, snacks, crackers and other potato products from potato dough; (c) bread;
(d) breakfast cereals (excluding porridge); (e) fine bakery wares: cookies, biscuits, rusks, cereal bars, scones,
cornets, wafers, crumpets, gingerbread, crackers, crisp breads, bread substitutes; (f) roast and instant coffee;
(g) coffee substitutes; (h) baby food and processed cereal-based food for infants and young children.

## 4. Architecture

```
ScanTab ──(catalog miss)──► lib/off.ts fetchOffProduct(code) ──► world.openfoodfacts.org (v3, cached per session)
   │                              │  mapOffResponse(json, httpStatus) → OffResult (pure, tested on recorded fixtures)
   │                              ▼
   └──► App.openProduct(product) ──► ProductDetailScreen
                                      ├─ verdict: safeAnalyze(p) → analyzeIngredients({ingredients, category, additiveCodes})
                                      ├─ CookingNote: lib/safety/process.ts acrylamideMatch(p)
                                      └─ NutritionPanel: p.off (scanned) or fetchOffProduct(p.barcode) (catalog, lazy)
```

### Units

1. **`src/lib/off.ts`** (new, import-free except `Product` type, so Node tests can load it)
   - `mapOffResponse(json: unknown, httpStatus: number): OffResult`, which is pure:
     `{ status: "found", product: Product } | { status: "not-found" } | { status: "error", message: string }`.
     A found product with no name **and** no ingredients maps to `not-found`.
   - `fetchOffProduct(barcode: string): Promise<OffResult>` builds the v3 URL with the field list, sends
     `X-User-Agent: EcoGo/0.1 (personal project)`, and caches the promise per normalized barcode in a module-level
     `Map` for the session. Network failure or HTTP 429/5xx gives `error` (never `not-found`), and errors aren't cached.
   - Mapped `Product`: `id = -Number(code)` (catalog ids are positive, so no collision), `barcode = code`,
     `name` (prefer `product_name_en`), `brand` (first of `brands`), `category = ""`, `ingredients`
     (prefer `ingredients_text_en`, else `ingredients_text`), no store prices, plus
     `off: { code, url: "https://world.openfoodfacts.org/product/{code}", lang, ingredientsLang: "en" | lang,
     additiveCodes: string[], categoryTags: string[], nutriscore: string | null, nova: 1|2|3|4 | null }`.
2. **`Product` type** (`productImporter.ts`) gains an optional `off?: OffData`. Catalog products never set it.
3. **Safety engine (`analyze.ts`)** gets back `additiveCodes?: string[]` (normalizes `en:e250`/`E 250` → `E250`).
   Codes flag library entries by E-number; ingredients-or-codes present means analyzed (not `no-data`).
   `verdict.tsx` `safeAnalyze` passes `category: p.off ? undefined : p.category` and `additiveCodes: p.off?.additiveCodes`.
4. **`src/lib/safety/process.ts`** (new): `ACRYLAMIDE` (concern text, advice text, `Source[]` from §3) and
   `acrylamideMatch(p: { name: string; category: string; ingredients: string; off?: { categoryTags: string[] } }):
   { euCategory: "a"…"h" } | null`.
   - OFF products: match `categoryTags` against a pinned list of OFF taxonomy ids for (a)–(h), excluding porridge.
     The plan verifies the exact ids against the OFF taxonomy API. Parent tags such as Potato crisps, Chips and fries,
     Breads, Breakfast cereals, Biscuits and crackers, Cereal bars, Rusks, Wafers, Coffees, Instant coffee substitutes,
     Baby foods and Cereals for babies already exist.
   - Catalog products: a name/category/first-ingredient rule. `catalog.test.ts`-style pinning: exactly ids
     **1 Lay's, 14 Oreo, 16 Nature Valley, 18 Pringles, 20 Special K, 40 Wonder bread, 41 Goldfish, 49 Gerber Puffs**
     match. **13 Doritos** (corn, not listed), **15 Cheetos**, **19 Quaker oatmeal** (porridge) and all non-food don't.
   - `verify-sources.mjs` checks `ACRYLAMIDE.sources` as well as `LIBRARY`.
5. **Product page** (`ProductDetailScreen.tsx`):
   - **Cooking note** card (when `acrylamideMatch` is non-null, food only): "Formed during cooking: acrylamide".
     Body: forms when starchy foods are fried, baked or roasted; IARC probably carcinogenic (2A); EFSA potentially
     increases cancer risk; regulators require makers to reduce it; the FDA does not advise avoiding these foods, and
     suggests cooking to golden rather than brown. Expandable sources as for flags. Neutral styling (not red/amber).
   - **Nutrition** section (`NutritionPanel.tsx`, new; food only). Rows:
     - "Nutri-Score: E, lower nutritional quality". Letter meanings: A very good, B good, C average, D/E lower
       nutritional quality; `unknown` → "not enough nutrition data"; `not-applicable` → "not applicable to this
       category".
     - "Processing: NOVA 4, ultra-processed foods" (1 unprocessed or minimally processed, 2 processed culinary
       ingredients, 3 processed foods, 4 ultra-processed foods).
     - Caption: "Calculated by Open Food Facts (Nutri-Score 2023 method, not a US label). NOVA group estimated by Open
       Food Facts from ingredients; experimental." It links to the OFF product page.
     - Shown only when `p.off` is set (D8). Catalog products show no nutrition section until their barcodes are
       verified (KNOWN_ISSUES K-29).
   - **OFF products:** the header note "Product data from Open Food Facts (crowd-sourced) · view on Open Food Facts",
     plus the footer "Data © Open Food Facts contributors, ODbL". When `ingredientsLang !== "en"`: "Ingredients are
     listed in {language}; additive codes were checked, ingredient names may be missed." There are no prices and no
     alternatives (no catalog category).
6. **Scan flow** (`ScanTab.tsx`, `scanService.ts`)
   - Catalog miss leads to an OFF lookup. States: scanning → found (catalog | OFF) | not found | lookup error
     ("Couldn't reach Open Food Facts. Check your connection and try again").
   - Not-found copy (replaces the false "saved for review… analysed and published"): "Not in our catalog or Open Food
     Facts yet. You can add it at openfoodfacts.org." The barcode is still logged.
   - OFF-found scans are logged via the unknown-barcode path (`product_id` null).
   - Demo picker: add Nutella `3017620422003`, Coca-Cola Zero `049000042566`, Life Wtr `012000161155`, and a
     valid-but-absent `3017620429996` (replacing the fake `UNKNOWN-*` entries). Add a "Type a barcode" input
     (8–14 digits).
7. **App state** (`App.tsx`): a session `offProducts` list so OFF products opened this session appear in Saved ›
   Scanned and can be favorited (favorites are still in-memory, per K-16).
8. **Data fix (D7):** a new migration adds category "Baby Food" and moves product 49 into it. `products.csv` is
   updated to match, `FOOD_CATEGORIES` gains "Baby Food", and `expected-flags.json` #49 is re-reviewed against its label.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| Offline / DNS / CORS failure / HTTP 5xx / 429 | "Couldn't reach Open Food Facts" with a retry button; not cached; never shown as "not found" |
| HTTP 404, `failure`, v2-style `status: 0` | Not found |
| Found but no name and no ingredients | Not found |
| Found, name but no ingredients | Product page with verdict "Not enough data"; nutrition and cooking note still shown if data exists |
| Non-English ingredients only | Analyze the text plus additive codes; show the language note |
| Catalog product | No OFF request and no nutrition section (D8) |
| Engine throws | Existing `safeAnalyze` fallback ("Not enough data") |

## 6. Testing

- `src/lib/off.test.ts`: `mapOffResponse` over **recorded** responses committed under `src/lib/fixtures/off/`
  (captured once; tests make no network calls):
  - Nutella (found, French plus English ingredients): English is preferred and the fields map correctly.
  - Coca-Cola Zero (`success_with_warnings`): counts as found, additive codes include `E951`.
  - Absent barcode (404): not found.
  - Empty shell: not found.
  - Error-status inputs.
  - The negative-id rule.
- `analyze.test.ts`: additive codes flag (`en:e951` → aspartame). Codes alone (no text) are analyzed, not `no-data`.
- `process.test.ts`:
  - Across all 51 catalog products, exactly the ids in §4.4 match.
  - OFF tag cases: potato crisps, breakfast cereals, porridge excluded, biscuits and crackers, tortilla chips not listed.
  - The acrylamide match never changes `analyzeIngredients` output.
- `catalog.test.ts`: #49 updated after review; still 51 products.
- `verify-sources`: acrylamide sources pass or are hand-checked (EU Cellar page needs `Accept: application/xhtml+xml`).
- Browser:
  - Nutella shows English ingredients and nutrition E / NOVA 4.
  - Coke Zero is amber (aspartame via code).
  - `3017620429996` shows not found; typing a barcode works.
  - Lay's shows the cooking note (no nutrition, per D8); Doritos has no cooking note; Tide has neither.
  - Offline gives the error state.
  - No console errors.

## 7. Review focus (inputs the tests don't cover that would hurt a real user)

1. The rate limit: re-opening pages and repeated lookups must hit the session cache, not the network.
2. A slow or failed OFF response must never block or blank the product page. Nutrition loads independently.
3. Barcode forms: 12 vs 13 digits, leading zeros, spaces or dashes typed by hand.
4. Crowd-sourced text: odd casing, HTML entities or huge ingredient strings from OFF go through the same engine
   safely.
5. Saved › Scanned with OFF products after re-opening them (negative ids, no duplicates).

## 8. Out of scope

- Camera scanning (M4).
- Persisting OFF data in Supabase.
- Contributing to OFF.
- Other process contaminants (3-MCPD, furan): later, same pattern as acrylamide.
- Nutrient-level warnings beyond Nutri-Score/NOVA.
- The Nutri-Score logo graphic (needs permission, D4).

## 9. Pre-launch checklist additions

- Email `nutriscore@santepubliquefrance.fr` for Nutri-Score use (US falls under "other countries"), per the March 2025
  Conditions of Use.
- Put a contact (public repo URL) in the `X-User-Agent` value once the repo exists (M3).
- Re-check OFF's rate limits and terms.

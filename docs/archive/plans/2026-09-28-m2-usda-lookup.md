# M2 USDA Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any US food barcode outside our 51-product catalog opens a real product page. The data comes from USDA
FoodData Central (manufacturer label data) first and Open Food Facts (crowd-sourced) second, and it gets the same
ingredient safety check as the catalog.

**Architecture:**
- One new module, `src/lib/lookup.ts`, holds pure mappers for both APIs plus a session-cached `lookupBarcode()`
  (USDA → OFF → not found). It is tested on recorded real responses.
- `Product` gains an optional `source` block, so the product page can say where the data came from and the engine can
  use OFF's additive codes.
- ScanTab calls `lookupBarcode()` when the catalog misses.

**Tech Stack:**
- React 18 + Vite 6, Tailwind 4, lucide-react
- Node `node --test` with native TS type stripping (current suite: 94 tests)
- Supabase (Postgres) via the Supabase MCP for one data migration

**Spec:** `docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md`. Read it first. The old Open Food Facts spec and
plan are **superseded**; don't execute them.

## Global Constraints

- **Node tests:** any module a test imports uses `.ts` extensions on relative imports and erasable-only TypeScript
  (no `enum`, `namespace`, parameter properties). Use `import type` for types from modules Node can't load.
- **Writing files:** write code files with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Dependencies:** add none.
- **USDA key:** read in the browser only, as `import.meta.env.VITE_FDC_API_KEY` (it lives in the gitignored
  `.env.local`, which the owner already created). Never print, log or commit its value. Tests pass a fake key.
  Restart the dev server after changing `.env.local`.
- **USDA requests:** `GET https://api.nal.usda.gov/fdc/v1/foods/search?api_key=KEY&dataType=Branded&pageSize=5&query=CODE`.
  Limit: 3,600/hour for the owner's key, a 1-hour block after exceeding it. Everything is session-cached.
- **OFF requests:** `https://world.openfoodfacts.org/api/v3/product/{code}.json?fields=…`, header
  `X-User-Agent: EcoGo/0.1 (personal project)`. Never send the owner's email.
- **Facts first:** every looked-up product shows its source. OFF is always labelled "crowd-sourced". Nothing in this
  plan changes the verdict rules; colours, list dot and sort come only from `analyzeIngredients`.
- **Migrations:** never edit applied migrations; add new ones. Apply them to the live project `gippyavmxxzqxjkuahpt`
  with the Supabase MCP `apply_migration` tool. The owner's approval of this plan approves Task 4's live change.
- **Commits:** commit per task on branch `m2-open-food-facts`. Every message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push (there is no remote yet).
- **Suite:** `npm test` stays green after every task. Task 2 widens its glob to `src/lib/**/*.test.ts`.

## Review Focus

1. **Barcode forms:** USDA stores codes as 8, 12 or 14 digits (Coke Zero only matches `00049000042566`). A typed
   12-digit code, spaces or dashes must still find it. Pinned by Task 2's "USDA is tried as typed, then 14-digit".
2. **Rate limit:** re-scanning or re-opening the same barcode must hit the session cache, not the network. Pinned by
   Task 2's cache test and Task 5 Step 5's network check.
3. **Source down or slow:** an unreachable USDA or OFF must show "Couldn't reach…" with Try again, never "not found"
   and never a blank page. Pinned by Task 2's error tests and Task 5 Step 5's forced-failure check.
4. **Wrong-product matches:** USDA's search is full-text, so a result whose `gtinUpc` isn't this barcode must be
   ignored. Pinned by Task 2's "non-exact hits are rejected".
5. **Untrusted text:** ALL-CAPS names, an "INGREDIENTS:" prefix, huge strings and HTML-ish text must map and analyze
   safely. Pinned by Task 2's tidy-case, prefix and huge-text tests.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/safety/analyze.ts` | `additiveCodes` input (OFF's `en:e951` → aspartame) |
| `src/lib/productImporter.ts` | `ProductSource` type; optional `Product.source` |
| `src/lib/lookup.ts` (new) | Barcode helpers, USDA + OFF mappers, `lookupBarcode()` with session cache |
| `src/lib/lookup.test.ts` (new) | Mapper, order, cache and barcode tests on recorded responses |
| `src/lib/fixtures/usda/*.json`, `src/lib/fixtures/off/*.json` (new) | Recorded real responses (trimmed) |
| `src/app/components/verdict.tsx` | `safeAnalyze` is source-aware |
| `src/app/components/ProductDetailScreen.tsx` | Source note; hides the empty category |
| `supabase/migrations/<version>_real_barcodes_doritos_oreo.sql` (new), `src/data/products.csv` | Replace the two catalog barcodes that belong to other products |
| `src/lib/scanService.ts` | `findProductByBarcode` compares digits (`sameBarcode`) |
| `src/app/components/ScanTab.tsx` | Lookup, error state, honest not-found, real demo barcodes, type-a-barcode |
| `src/app/App.tsx` | Session list of looked-up products for Saved › Scanned |
| Docs | KNOWN_ISSUES, ARCHITECTURE, PROJECT_HANDOFF, SYNOPSIS, spec status |

---

### Task 1: The engine checks additive codes

**Files:** Modify `src/lib/safety/analyze.ts`, `src/lib/safety/analyze.test.ts`

**Interfaces:** Produces `analyzeIngredients(input: { ingredients: string; category?: string; additiveCodes?: string[] }, library?)`.
Codes may look like `en:e951`, `E 951` or `e951`.

- [ ] **Step 1: Write the failing tests.** Append to `analyze.test.ts`, before the "never throws" test (use the file's
  existing `ids` helper and `LIB` constant):
  ```ts
  test("additive codes from Open Food Facts flag by E-number", () => {
    assert.deepEqual(ids(analyzeIngredients({ ingredients: "", additiveCodes: ["en:e951"] }, LIB)), ["aspartame"]);
    assert.deepEqual(ids(analyzeIngredients({ ingredients: "Water", additiveCodes: ["E 250", "en:e330"] }, LIB)), ["sodium-nitrite"]);
  });

  test("codes alone are analyzed, not 'not enough data'", () => {
    assert.equal(analyzeIngredients({ ingredients: "", additiveCodes: ["en:e330"] }, LIB).verdict, "none");
  });
  ```

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. The codes are ignored, so you get `[]` and `no-data`.

- [ ] **Step 3: Implement.** In `analyze.ts`:
  - Add after `normalizeColours`:
    ```ts
    /** "en:e250" (Open Food Facts), "E 250", "e250" → "E250". */
    const normalizeCode = (code: string) => code.replace(/^[a-z]{2}:/i, "").replace(/[\s-]/g, "").toUpperCase();
    ```
  - Change the input type to `input: { ingredients: string; category?: string; additiveCodes?: string[] },`.
  - Replace
    `if (items.length === 0) return { verdict: "no-data", flags: [], checkedCount };`
    with
    ```ts
    const codes = (input.additiveCodes ?? []).map(normalizeCode);
    if (items.length === 0 && codes.length === 0) return { verdict: "no-data", flags: [], checkedCount };
    ```
  - After the `for (const item of items) { … }` loop, add this loop. It uses the existing `flag` helper, which
    de-duplicates by entry id:
    ```ts
    for (const code of codes) {
      for (const { entry } of matchers) if (entry.eCodes.includes(code)) flag(entry, code);
    }
    ```
  - Change the header comment to `// analyze.ts — ingredient text (+ optional additive codes) → verdict and flags.`

- [ ] **Step 4: Run.** Run: `npm test`. Expected: all pass (96), 0 fail.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/safety/analyze.ts src/lib/safety/analyze.test.ts
  git commit -m "Engine: check additive codes (en:e951 → aspartame)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 2: Lookup client (`lookup.ts`): USDA first, then Open Food Facts

**Files:**
- Create: `src/lib/lookup.ts`, `src/lib/lookup.test.ts`, `src/lib/fixtures/usda/coke-zero-00049000042566.json`,
  `src/lib/fixtures/usda/doritos-028400335799.json`, `src/lib/fixtures/usda/oreo-00044000042554.json`,
  `src/lib/fixtures/off/nutella-3017620422003.json`, `src/lib/fixtures/off/not-found-3017620429996.json`,
  `src/lib/fixtures/off/empty-9780000000002.json`
- Modify: `src/lib/productImporter.ts` (types), `package.json` (test glob)

**Interfaces:**
- Consumes: `Product` (productImporter); `analyzeIngredients` with `additiveCodes` (Task 1), in tests only.
- Produces:
  - `interface ProductSource { name: "USDA FoodData Central" | "Open Food Facts"; url: string; crowdSourced: boolean; ingredientsLang: string; additiveCodes: string[] }`
  - `Product.source?: ProductSource`
  - `type LookupResult = { status: "found"; product: Product } | { status: "not-found" } | { status: "error"; message: string }`
  - `normalizeBarcode(raw: string): string`, `isBarcode(code: string): boolean`, `sameBarcode(a: string, b: string): boolean`
  - `tidyCase(s: string): string`
  - `pickUsdaFood(json: unknown, code: string): Product | null`
  - `mapOffResponse(json: unknown, httpStatus: number): LookupResult`
  - `lookupBarcode(raw: string, opts?: { fdcKey?: string; fetchImpl?: typeof fetch }): Promise<LookupResult>`
  - Looked-up products: `id = -Number(code without leading zeros)`, `category = ""`, no store prices.

- [ ] **Step 1: Add the types.** In `src/lib/productImporter.ts`, add above `export interface Product`:
  ```ts
  /** Where a looked-up product's data came from. Catalog products never set it. */
  export interface ProductSource {
    name: "USDA FoodData Central" | "Open Food Facts";
    url: string;             // the record's public page (credit + "view record" link)
    crowdSourced: boolean;   // true for Open Food Facts
    ingredientsLang: string; // "en", or the label's language when no English text exists
    additiveCodes: string[]; // Open Food Facts additive tags, e.g. "en:e951"; always [] for USDA
  }
  ```
  and inside `Product`, after `facebook?: …;`, add `source?: ProductSource;`.

- [ ] **Step 2: Record the fixtures.** Create these files with exactly this content. They are real responses
  captured 2026-09-28. USDA fields are trimmed to the ones we use, and the Oreo ingredients are cut at 400 characters.

  `src/lib/fixtures/usda/coke-zero-00049000042566.json`
  ```json
  {"totalHits":1,"foods":[{"fdcId":2742717,"gtinUpc":"00049000042566","description":"Coca-Cola Zero Sugar Can, 12 fl oz","brandName":"Coca-Cola Zero","brandOwner":"Coca-Cola","ingredients":"CARBONATED WATER, CARAMEL COLOR, PHOSPHORIC ACID, ASPARTAME, POTASSIUM BENZOATE (TO PROTECT TASTE), NATURAL FLAVORS, POTASSIUM CITRATE, ACESULFAME POTASSIUM, CAFFEINE, STEVIA EXTRACT","foodCategory":"Non Alcoholic Beverages - Ready to Drink","marketCountry":"US","publishedDate":"2025-09-18"}]}
  ```
  `src/lib/fixtures/usda/doritos-028400335799.json`
  ```json
  {"totalHits":1,"foods":[{"fdcId":1629973,"gtinUpc":"028400335799","description":"DORITOS, TORTILLA CHIPS, NACHO CHEESE, NACHO CHEESE","brandName":"DORITOS","brandOwner":"Frito-Lay Company","ingredients":"CORN, VEGETABLE OIL (SUNFLOWER, CANOLA, AND/OR CORN OIL), MALTODEXTRIN (MADE FROM CORN), SALT, CHEDDAR CHEESE (MILK, CHEESE CULTURES, SALT, ENZYMES), WHEY, MONOSODIUM GLUTAMATE, BUTTERMILK, ROMANO CHEESE (PART-SKIM COW'S MILK, CHEESE CULTURES, SALT, ENZYMES), WHEY PROTEIN CONCENTRATE, ONION POWDER, CORN FLOUR NATURAL AND ARTIFICIAL FLAVOR, DEXTROSE, TOMATO POWDER, LACTOSE, SPICES, ARTIFICIAL COLOR","foodCategory":"Chips, Pretzels & Snacks","marketCountry":"United States","publishedDate":"2021-03-19"}]}
  ```
  `src/lib/fixtures/usda/oreo-00044000042554.json`
  ```json
  {"totalHits":1,"foods":[{"fdcId":1457443,"gtinUpc":"00044000042554","description":"NABISCO OREO COOKIES OREO 1X10.700 OZ","brandName":"NABISCO OREO","brandOwner":"Mondelez USA","ingredients":"INGREDIENTS: SUGAR, UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN, REDUCED IRON, THIAMINE MONONITRATE VITAMIN B1, RIBOFLAVIN VITAMIN B2, FOLIC ACID), PALM AND/OR CANOLA OIL, DEXTROSE, COCOA (NATURAL AND PROCESSED WITH ALKALI), HIGH FRUCTOSE CORN SYRUP, BROWN SUGAR, PALM KERNEL OIL, CORNSTARCH, BAKING SODA, SALT, SOY LECITHIN, CALCIUM PHOSPHATE, NATURAL AND ARTIFICIAL FLAVOR, ARTIFICIAL COLOR (YEL","foodCategory":"Biscuits/Cookies","marketCountry":"United States","publishedDate":"2021-03-19"}]}
  ```
  `src/lib/fixtures/off/nutella-3017620422003.json`
  ```json
  {"httpStatus":200,"body":{"code":"3017620422003","errors":[],"product":{"additives_tags":["en:e322","en:e322i"],"brands":"Nutella, Ferrero","categories_tags":["en:breakfasts","en:spreads","en:sweet-spreads","en:confectionary-based-spreads","fr:Nutella"],"code":"3017620422003","ingredients_text":"Sucre, huile de palme, NOISETTES 13%, cacao maigre 7,4%, LAIT écrémé en poudre 6,6%, LACTOSERUM en poudre, émulsifiants: lécithines [SOJA), vanilline.","ingredients_text_en":"Sugar, vegetable fat (palm), hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa powder (7.4%), emulsifier: lecithins (soya), flavouring (vanillin).","lang":"fr","nova_group":4,"nutriscore_grade":"e","product_name":"Nutella","product_name_en":"Nutella"},"result":{"id":"product_found","lc_name":"Product found","name":"Product found"},"status":"success","warnings":[]}}
  ```
  `src/lib/fixtures/off/not-found-3017620429996.json`
  ```json
  {"httpStatus":404,"body":{"code":"3017620429996","errors":[{"field":{"id":"code","value":"3017620429996"},"impact":{"id":"failure","lc_name":"Failure","name":"Failure"},"message":{"id":"product_not_found","lc_name":"","name":""}}],"result":{"id":"product_not_found","lc_name":"Product not found","name":"Product not found"},"status":"failure","warnings":[]}}
  ```
  `src/lib/fixtures/off/empty-9780000000002.json`
  ```json
  {"httpStatus":200,"body":{"code":"9780000000002","errors":[],"product":{"categories_tags":["en:soups","en:gazpacho"],"code":"9780000000002","lang":"fr","nutriscore_grade":"unknown"},"result":{"id":"product_found","lc_name":"Product found","name":"Product found"},"status":"success","warnings":[]}}
  ```
  Facts behind the lookup-order tests (checked live 2026-09-28): USDA has no record for `049000042566` (12 digits),
  `3017620422003` (Nutella), `3017620429996`, or `012000161155` (Life Wtr), in either the typed or 14-digit form.

- [ ] **Step 3: Widen the test glob.** In `package.json` replace
  `"test": "node --test \"src/lib/safety/**/*.test.ts\"",` with `"test": "node --test \"src/lib/**/*.test.ts\"",`

- [ ] **Step 4: Write the failing tests** in `src/lib/lookup.test.ts`:
  ```ts
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { lookupBarcode, pickUsdaFood, mapOffResponse, normalizeBarcode, isBarcode, sameBarcode, tidyCase } from "./lookup.ts";
  import { analyzeIngredients } from "./safety/analyze.ts";

  const fixture = (path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), "utf8"));
  const EMPTY_USDA = { totalHits: 0, foods: [] };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  /** A fake network: USDA answers from `usda` by exact query string, OFF from `off` by barcode; everything else is empty/404. */
  function fakeNet(usda: Record<string, unknown>, off: Record<string, { httpStatus: number; body: unknown }>) {
    const calls: string[] = [];
    const impl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://api.nal.usda.gov/")) {
        const q = new URL(url).searchParams.get("query") ?? "";
        return json(usda[q] ?? EMPTY_USDA);
      }
      const code = url.match(/product\/(\d+)\.json/)?.[1] ?? "";
      const hit = off[code];
      return hit ? json(hit.body, hit.httpStatus) : json(fixture("off/not-found-3017620429996").body, 404);
    }) as typeof fetch;
    return { impl, calls };
  }

  // ── USDA mapper ──────────────────────────────────────────────────────────────

  test("a USDA record maps to a Product with its source", () => {
    const p = pickUsdaFood(fixture("usda/coke-zero-00049000042566"), "049000042566");
    assert.ok(p);
    assert.equal(p.id, -49000042566);
    assert.equal(p.barcode, "00049000042566");
    assert.equal(p.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
    assert.equal(p.brand, "Coca-Cola Zero");
    assert.equal(p.category, "");
    assert.equal(p.amazon, undefined);
    assert.match(p.ingredients, /^CARBONATED WATER, CARAMEL COLOR/);
    assert.deepEqual(p.source, {
      name: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/food-details/2742717/nutrients",
      crowdSourced: false, ingredientsLang: "en", additiveCodes: [],
    });
    assert.ok(analyzeIngredients({ ingredients: p.ingredients }).flags.some(f => f.entry.id === "aspartame"));
  });

  // Review Focus 5: untrusted text.
  test("ALL-CAPS names are tidied; an 'INGREDIENTS:' prefix is dropped", () => {
    const d = pickUsdaFood(fixture("usda/doritos-028400335799"), "028400335799");
    assert.equal(d?.name, "Doritos, Tortilla Chips, Nacho Cheese, Nacho Cheese");
    assert.equal(d?.brand, "Doritos");
    const o = pickUsdaFood(fixture("usda/oreo-00044000042554"), "044000042554");
    assert.match(o?.ingredients ?? "", /^SUGAR, UNBLEACHED ENRICHED FLOUR/);
    assert.equal(tidyCase("LAY'S, CLASSIC POTATO CHIPS"), "Lay's, Classic Potato Chips");
    assert.equal(tidyCase("Coca-Cola Zero"), "Coca-Cola Zero");
  });

  // Review Focus 4: wrong-product matches.
  test("non-exact hits, empty results and junk are rejected", () => {
    const tostitos = { foods: [{ fdcId: 1, gtinUpc: "00028400064057", description: "Tostitos Bite Size", ingredients: "CORN" }] };
    assert.equal(pickUsdaFood(tostitos, "049000042566"), null);
    assert.equal(pickUsdaFood(EMPTY_USDA, "049000042566"), null);
    assert.equal(pickUsdaFood(null, "049000042566"), null);
    assert.equal(pickUsdaFood("<html>", "049000042566"), null);
    assert.equal(pickUsdaFood({ foods: [{ gtinUpc: "049000042566" }] }, "049000042566"), null, "no name and no ingredients");
  });

  test("when USDA has several records for a barcode, the newest wins", () => {
    const body = { foods: [
      { fdcId: 1, gtinUpc: "012345678905", description: "Old label", ingredients: "SALT", publishedDate: "2021-03-19" },
      { fdcId: 2, gtinUpc: "00012345678905", description: "New label", ingredients: "SALT", publishedDate: "2025-09-18" },
    ] };
    assert.equal(pickUsdaFood(body, "012345678905")?.name, "New label");
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
      crowdSourced: true, ingredientsLang: "en", additiveCodes: ["en:e322", "en:e322i"],
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
    assert.ok(sameBarcode("049000042566", "00049000042566"));
    assert.ok(!sameBarcode("049000042566", "049000042567"));
    assert.ok(!sameBarcode("", "000"));
    assert.ok(isBarcode("01311501") && isBarcode("00049000042566"));
    assert.ok(!isBarcode("1234") && !isBarcode("123456789012345"));
  });

  // ── lookupBarcode: order, cache, errors ────────────────────────────────────

  // Review Focus 1: USDA stores Coke Zero only as 14 digits.
  test("USDA is tried as typed, then 14-digit; a USDA find never asks OFF", async () => {
    const net = fakeNet({ "00049000042566": fixture("usda/coke-zero-00049000042566") }, {});
    const r = await lookupBarcode("049000042566", { fdcKey: "TEST", fetchImpl: net.impl });
    assert.equal(r.status === "found" && r.product.source?.name, "USDA FoodData Central");
    assert.deepEqual(net.calls.map(u => new URL(u).searchParams.get("query")), ["049000042566", "00049000042566"]);
    assert.ok(net.calls.every(u => u.includes("api_key=TEST")));
  });

  test("USDA miss falls back to OFF; a miss in both is not found", async () => {
    const net = fakeNet({}, { "3017620422003": fixture("off/nutella-3017620422003") });
    const r = await lookupBarcode("3017620422003", { fdcKey: "TEST", fetchImpl: net.impl });
    assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
    assert.equal((await lookupBarcode("3017620429996", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
  });

  // Review Focus 2 and 3.
  test("results are cached per barcode; errors are not, and are never 'not found'", async () => {
    const net = fakeNet({ "00049000042566": fixture("usda/coke-zero-00049000042566") }, {});
    await lookupBarcode("049000042566", { fdcKey: "TEST", fetchImpl: net.impl });
    const before = net.calls.length;
    assert.equal((await lookupBarcode("0 49000-042566", { fdcKey: "TEST", fetchImpl: net.impl })).status, "found");
    assert.equal(net.calls.length, before, "second lookup served from the session cache");

    let calls = 0;
    const down = (async () => { calls++; throw new TypeError("Failed to fetch"); }) as typeof fetch;
    assert.equal((await lookupBarcode("012000161155", { fdcKey: "TEST", fetchImpl: down })).status, "error");
    const again = calls;
    assert.equal((await lookupBarcode("012000161155", { fdcKey: "TEST", fetchImpl: down })).status, "error");
    assert.ok(calls > again, "errors are retried, not cached");

    const usda503 = (async (input: RequestInfo | URL) => String(input).startsWith("https://api.nal.usda.gov/")
      ? json({}, 503) : json(fixture("off/not-found-3017620429996").body, 404)) as typeof fetch;
    assert.equal((await lookupBarcode("041500000251", { fdcKey: "TEST", fetchImpl: usda503 })).status, "error",
      "USDA down + OFF not found = try again, not 'not found'");
  });

  test("USDA down but OFF has it: show OFF", async () => {
    const f = (async (input: RequestInfo | URL) => {
      if (String(input).startsWith("https://api.nal.usda.gov/")) throw new TypeError("Failed to fetch");
      return json(fixture("off/nutella-3017620422003").body);
    }) as typeof fetch;
    const r = await lookupBarcode("03017620422003", { fdcKey: "TEST", fetchImpl: f });
    assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  });

  test("codes outside 8–14 digits never hit the network", async () => {
    const net = fakeNet({}, {});
    assert.equal((await lookupBarcode("1234", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
    assert.equal((await lookupBarcode("abc", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
    assert.equal(net.calls.length, 0);
  });
  ```

- [ ] **Step 5: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/src/lib/lookup.ts`.

- [ ] **Step 6: Implement** `src/lib/lookup.ts`:
  ```ts
  // lookup.ts — find a barcode that isn't in our catalog. USDA FoodData Central first (label data supplied by
  // manufacturers), then Open Food Facts (crowd-sourced). Spec: docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md.
  // Type-only imports, so Node tests can load this module.
  import type { Product, ProductSource } from "./productImporter.ts";

  export type LookupResult =
    | { status: "found"; product: Product }
    | { status: "not-found" }
    | { status: "error"; message: string };

  const USDA = "https://api.nal.usda.gov/fdc/v1/foods/search";
  const OFF = "https://world.openfoodfacts.org/api/v3/product/";
  const OFF_FIELDS = "code,product_name,product_name_en,brands,lang,ingredients_text,ingredients_text_en,additives_tags";

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const record = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

  // ── Barcodes ─────────────────────────────────────────────────────────────────

  /** Digits only: " 0 49000-042566 " → "049000042566". */
  export const normalizeBarcode = (raw: string) => raw.replace(/\D/g, "");
  /** UPC-E (8) up to GTIN-14. */
  export const isBarcode = (code: string) => code.length >= 8 && code.length <= 14;
  const key = (code: string) => normalizeBarcode(code).replace(/^0+/, "");
  /** Same product code, ignoring spaces, dashes and leading zeros (12-digit UPC vs 13/14-digit forms). */
  export function sameBarcode(a: string, b: string): boolean {
    const x = key(a);
    return x !== "" && x === key(b);
  }

  /** ALL-CAPS label text → "Lay's, Classic Potato Chips"; text with any lowercase letter is left alone. */
  export const tidyCase = (s: string) =>
    /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s,(/&-])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase());

  function toProduct(code: string, name: string, brand: string, ingredients: string, source: ProductSource): Product {
    return {
      id: -Number(key(code)), // catalog ids are positive, so a looked-up product never collides with one
      barcode: code, name: name || "Unnamed product", brand, category: "", description: "", ingredients,
      imageUrl: "", keywords: [], source,
    };
  }

  // ── USDA FoodData Central ────────────────────────────────────────────────────

  /** Pure: a USDA /foods/search body → the food whose gtinUpc is this barcode (newest record wins), or null. */
  export function pickUsdaFood(json: unknown, code: string): Product | null {
    const foods = Array.isArray(record(json).foods) ? (record(json).foods as unknown[]).map(record) : [];
    const f = foods
      .filter(x => sameBarcode(str(x.gtinUpc), code)) // the search is full-text: drop anything that isn't this code
      .sort((a, b) => str(b.publishedDate).localeCompare(str(a.publishedDate)))[0];
    if (!f) return null;
    const name = tidyCase(str(f.description));
    const ingredients = str(f.ingredients).replace(/^ingredients:\s*/i, "");
    if (!name && !ingredients) return null;
    return toProduct(str(f.gtinUpc), name, tidyCase(str(f.brandName) || str(f.brandOwner)), ingredients, {
      name: "USDA FoodData Central", url: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
      crowdSourced: false, ingredientsLang: "en", additiveCodes: [],
    });
  }

  /** USDA stores codes as 8, 12 or 14 digits, so try the typed digits, then the 14-digit form. */
  async function fetchUsda(code: string, fdcKey: string, f: typeof fetch): Promise<LookupResult> {
    for (const q of new Set([code, code.padStart(14, "0")])) {
      const res = await f(`${USDA}?api_key=${encodeURIComponent(fdcKey)}&dataType=Branded&pageSize=5&query=${q}`);
      if (!res.ok) return { status: "error", message: `USDA returned HTTP ${res.status}` };
      const product = pickUsdaFood(await res.json().catch(() => null), code);
      if (product) return { status: "found", product };
    }
    return { status: "not-found" };
  }

  // ── Open Food Facts ──────────────────────────────────────────────────────────

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
    return {
      status: "found",
      product: toProduct(code, name, str(p.brands).split(",")[0].trim(), ingredients, {
        name: "Open Food Facts", url: `https://world.openfoodfacts.org/product/${code}`, crowdSourced: true,
        ingredientsLang: english ? "en" : str(p.lang) || "en", additiveCodes: strings(p.additives_tags),
      }),
    };
  }

  async function fetchOff(code: string, f: typeof fetch): Promise<LookupResult> {
    const res = await f(`${OFF}${code}.json?fields=${OFF_FIELDS}`, { headers: { "X-User-Agent": "EcoGo/0.1 (personal project)" } });
    return mapOffResponse(await res.json().catch(() => null), res.status);
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────

  const cache = new Map<string, Promise<LookupResult>>();
  const safely = (p: Promise<LookupResult>): Promise<LookupResult> =>
    p.catch((err: unknown) => ({ status: "error", message: err instanceof Error ? err.message : String(err) }));

  /**
   * USDA → Open Food Facts → not found. Cached per barcode for the session (rate limits); errors aren't cached, so
   * Try again can succeed. An unreachable source gives "error", never "not found".
   */
  export function lookupBarcode(raw: string, opts: { fdcKey?: string; fetchImpl?: typeof fetch } = {}): Promise<LookupResult> {
    const code = normalizeBarcode(raw);
    if (!isBarcode(code)) return Promise.resolve({ status: "not-found" });
    const k = key(code);
    const hit = cache.get(k);
    if (hit) return hit;
    const f = opts.fetchImpl ?? fetch;
    let fdcKey = opts.fdcKey;
    if (!fdcKey) {
      console.warn("[lookup] VITE_FDC_API_KEY is not set; using USDA's DEMO_KEY (30 lookups an hour)");
      fdcKey = "DEMO_KEY";
    }
    const pending = (async (): Promise<LookupResult> => {
      const usda = await safely(fetchUsda(code, fdcKey, f));
      if (usda.status === "found") return usda;
      const off = await safely(fetchOff(code, f));
      if (off.status === "found") return off;
      return usda.status === "error" ? usda : off;
    })();
    cache.set(k, pending);
    pending.then(r => { if (r.status === "error") cache.delete(k); });
    return pending;
  }
  ```

- [ ] **Step 7: Run.** Run: `npm test`. Expected: all pass (96 + 13 = 109), 0 fail.

- [ ] **Step 8: Commit.**
  ```bash
  git add src/lib/lookup.ts src/lib/lookup.test.ts src/lib/fixtures src/lib/productImporter.ts package.json
  git commit -m "Lookup client: USDA FoodData Central first, Open Food Facts fallback

  Pure mappers tested on recorded responses. USDA codes are tried as typed
  and as 14 digits, non-exact search hits are dropped, results are cached
  per session, and an unreachable source is an error, never 'not found'.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 3: Product page shows where the data came from

**Files:** Modify `src/app/components/verdict.tsx`, `src/app/components/ProductDetailScreen.tsx`

**Interfaces:** Consumes `Product.source` (Task 2) and `analyzeIngredients` with `additiveCodes` (Task 1).

- [ ] **Step 1: Source-aware verdict.** In `verdict.tsx` replace
  `return analyzeIngredients({ ingredients: p.ingredients, category: p.category });`
  with
  ```ts
  // Looked-up products have no catalog category (both sources are food databases) and may bring additive codes.
  return analyzeIngredients({ ingredients: p.ingredients, category: p.source ? undefined : p.category, additiveCodes: p.source?.additiveCodes });
  ```

- [ ] **Step 2: Product page.** In `ProductDetailScreen.tsx`:
  - Add at top level, directly below the imports:
    ```tsx
    /** "fr" → "French" (native Intl; falls back to the code). */
    const languageName = (code: string) => {
      try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
    };
    ```
  - In the hero, replace
    ```tsx
                  <span className="text-white/30">·</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
    ```
    with
    ```tsx
                  {product.category && (<>
                    <span className="text-white/30">·</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
                  </>)}
    ```
  - Directly after `<div className="px-4 py-4 space-y-3 pb-10">`, add:
    ```tsx
              {product.source && (
                <div className={`rounded-2xl p-3 text-[11px] leading-snug border ${product.source.crowdSourced
                  ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-white border-gray-100 text-gray-600 shadow-sm"}`}>
                  {product.source.crowdSourced
                    ? "Product data from Open Food Facts (crowd-sourced, may contain errors)."
                    : "Label data from USDA FoodData Central, supplied by the manufacturer."}{" "}
                  <a href={product.source.url} target="_blank" rel="noreferrer" className="font-bold underline">
                    {product.source.crowdSourced ? "View on Open Food Facts" : "View record"}
                  </a>
                  {product.source.ingredientsLang !== "en" && (
                    <span className="block mt-1">
                      Ingredients are listed in {languageName(product.source.ingredientsLang)}; additive codes were checked, ingredient names may be missed.
                    </span>
                  )}
                  {product.source.crowdSourced && <span className="block mt-1 opacity-70">Data © Open Food Facts contributors, ODbL.</span>}
                </div>
              )}
    ```
  - Prices and alternatives need no change: looked-up products have no stores (the price block is hidden) and
    category `""` (no alternatives match).

- [ ] **Step 3: Build and test.** Run: `npm run build` (expected: builds) and `npm test` (expected: 109 pass).
  Catalog product pages look exactly as before (no `source`). Looked-up pages are checked end to end in Task 5.

- [ ] **Step 4: Commit.**
  ```bash
  git add src/app/components/verdict.tsx src/app/components/ProductDetailScreen.tsx
  git commit -m "Product page: show the data source for looked-up products

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 4: Replace the two catalog barcodes that open the wrong product

The Figma export invented all 51 catalog barcodes (checked against USDA 2026-09-28: 49 match nothing). Two belong to
other real products: `028400064057` (our Doritos) is **Tostitos Bite Size**, and `044000030438` (our Oreo) is
**Wheat Thins Sun Dried Tomato**. Point both at the real products' USDA records. The other 49 stay, and are documented
in Task 6 (K-29).

| id | Old | New | USDA record |
|---|---|---|---|
| 13 | `028400064057`, "Doritos Nacho Cheese Party Size 14.5oz" | `028400335799`, "Doritos Nacho Cheese Tortilla Chips" | fdcId 1629973 "DORITOS, TORTILLA CHIPS, NACHO CHEESE" (no size given) |
| 14 | `044000030438`, "Oreo Original Cookies 14.3oz" | `044000042554`, "Oreo Original Cookies 10.7oz" | fdcId 1457443 "NABISCO OREO COOKIES OREO 1X10.700 OZ" (stored as `00044000042554`) |

Names change to match the real package, so the page never claims a size the barcode isn't. Ingredient text and the
hand-reviewed flags stay (keyed by id).

**Files:** Create `supabase/migrations/<version>_real_barcodes_doritos_oreo.sql`. Modify `src/data/products.csv`.

- [ ] **Step 1: CSV.** In `src/data/products.csv` (use Edit with replace_all; each product has one row per store):
  - `13,028400064057,"Doritos Nacho Cheese Party Size 14.5oz"` → `13,028400335799,"Doritos Nacho Cheese Tortilla Chips"`
  - `14,044000030438,"Oreo Original Cookies 14.3oz"` → `14,044000042554,"Oreo Original Cookies 10.7oz"`

- [ ] **Step 2: Test.** Run: `npm test`. Expected: 109 pass (flags are keyed by id).

- [ ] **Step 3: Apply to the live DB.**
  - Call the Supabase MCP `apply_migration` with project `gippyavmxxzqxjkuahpt`, name `real_barcodes_doritos_oreo`,
    and this query:
    ```sql
    -- The Figma export invented the catalog barcodes. Two of them belong to other real products in USDA FoodData
    -- Central (028400064057 = Tostitos Bite Size, 044000030438 = Wheat Thins), so scanning those packages opened the
    -- wrong page. Point them at the real products' records (checked 2026-09-28). The other invented codes match nothing.
    update public.products set barcode = '028400335799', name = 'Doritos Nacho Cheese Tortilla Chips' where id = 13;
    update public.products set barcode = '044000042554', name = 'Oreo Original Cookies 10.7oz' where id = 14;
    ```
  - Call `list_migrations` and save the same SQL as `supabase/migrations/<version>_real_barcodes_doritos_oreo.sql`
    with the version it reports.
  - Verify with `execute_sql`: `select id, barcode, name from products where id in (13, 14);`. Expected: the new
    values above.
  - Run `get_advisors` (security). Expected: no new findings.

- [ ] **Step 4: Commit.**
  ```bash
  git add supabase/migrations src/data/products.csv
  git commit -m "Catalog: real barcodes for Doritos and Oreo

  Their invented barcodes belong to Tostitos and Wheat Thins in USDA
  FoodData Central. Migration applied to the live DB; CSV matches.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 5: Scanning looks up barcodes the catalog doesn't have

**Files:** Modify `src/lib/scanService.ts`, `src/app/components/ScanTab.tsx` (replace the whole file), `src/app/App.tsx`.

**Interfaces:** Consumes `lookupBarcode`, `normalizeBarcode`, `isBarcode`, `sameBarcode` (Task 2) and the Task 4
barcodes. `onScanResult(product)` now also receives looked-up products (negative id, `source` set).

- [ ] **Step 1: Barcode matching.** In `src/lib/scanService.ts`:
  - Add `import { sameBarcode } from "./lookup";` after the Product import.
  - Replace the whole `findProductByBarcode` function, including its doc comment, with:
    ```ts
    /** Look up a barcode in the catalog: same digits, ignoring spaces, dashes and leading zeros (12- vs 13/14-digit forms). */
    export function findProductByBarcode(barcode: string, products: Product[]): Product | null {
      return products.find((p) => sameBarcode(p.barcode, barcode)) ?? null;
    }
    ```
  - In the header comment, replace
    `//   3. Unrecognised barcodes are recorded with product_id = null, which makes`
    `//      them the review queue for growing the catalog.`
    with
    `//   3. Barcodes not in the catalog (looked up in USDA / Open Food Facts, or not`
    `//      found at all) are recorded with product_id = null.`

- [ ] **Step 2: Replace `src/app/components/ScanTab.tsx` entirely with:**
  ```tsx
  // ─────────────────────────────────────────────────────────────────────────────
  // ScanTab.tsx — barcode scan pipeline
  //
  //   1. The user taps "Scan" (demo barcode) or types a barcode.
  //   2. Look up our catalog, then USDA FoodData Central, then Open Food Facts (lib/lookup.ts).
  //      • Catalog product    → scan recorded with its id, product page opens.
  //      • Found by lookup    → scan recorded as an unknown barcode (no catalog id), product page opens.
  //      • Found nowhere      → scan recorded, honest "not found" screen.
  //      • Lookup unreachable → "Couldn't reach…" with Try again; nothing recorded.
  //
  // There is no camera yet (M4): the "Demo" panel picks which barcode to simulate.
  // ─────────────────────────────────────────────────────────────────────────────

  import { useState, useCallback } from "react";
  import { CheckCircle, QrCode, ChevronUp, ChevronDown, MapPin, Clock, Database, X, WifiOff, ExternalLink } from "lucide-react";
  import type { Product } from "../../lib/productImporter";
  import { lookupBarcode, normalizeBarcode, isBarcode } from "../../lib/lookup";
  import { findProductByBarcode, recordProductScan, createPlaceholder, getCurrentLocation, type ScanEvent } from "../../lib/scanService";

  interface DemoBarcode { barcode: string; label: string; category: string }

  const DEMO_BARCODES: DemoBarcode[] = [
    { barcode: "028400315035",  label: "Lay's Classic Chips",        category: "Snacks"          },
    { barcode: "049000006421",  label: "Diet Coke 12-Pack",          category: "Beverages"       },
    { barcode: "049000028905",  label: "Coca-Cola Classic 12-Pack",  category: "Beverages"       },
    { barcode: "028400335799",  label: "Doritos Nacho Cheese",       category: "Snacks"          },
    { barcode: "044000042554",  label: "Oreo Original Cookies",      category: "Snacks"          },
    { barcode: "016000280939",  label: "Nature Valley Granola Bars", category: "Snacks"          },
    { barcode: "070847011443",  label: "Monster Energy Original",    category: "Beverages"       },
    { barcode: "044700032085",  label: "Oscar Mayer Hot Dogs",       category: "Meat"            },
    { barcode: "017800185165",  label: "Purina ONE Dog Food",        category: "Pet Food"        },
    { barcode: "742365003009",  label: "Horizon Organic Milk",       category: "Dairy"           },
    { barcode: "041500058069",  label: "French's Yellow Mustard",    category: "Condiments"      },
    { barcode: "732913222019",  label: "Seventh Generation Laundry", category: "Cleaning"        },
    { barcode: "037000869870",  label: "Tide PODS 42ct",             category: "Cleaning"        },
    { barcode: "300450449989",  label: "Tylenol Extra Strength",     category: "Medicine"        },
    { barcode: "049000042566",  label: "Coca-Cola Zero Sugar",       category: "USDA"            },
    { barcode: "028400064057",  label: "Tostitos Bite Size",         category: "USDA"            },
    { barcode: "3017620422003", label: "Nutella",                    category: "Open Food Facts" },
    { barcode: "3017620429996", label: "Unlisted product",           category: "Not found"       },
  ];

  type ScanState = "idle" | "scanning" | "found" | "not_found" | "error";

  interface ScanTabProps {
    /** Called with the product (catalog or looked up) so App.tsx can open the product page. */
    onScanResult: (product: Product) => void;
    products: Product[];
  }

  export default function ScanTab({ onScanResult, products }: ScanTabProps) {
    const [scanState, setScanState]             = useState<ScanState>("idle");
    const [selectedBarcode, setSelectedBarcode] = useState<DemoBarcode>(DEMO_BARCODES[0]);
    const [selectorOpen, setSelectorOpen]       = useState(false);
    const [typed, setTyped]                     = useState("");
    const [scannedCode, setScannedCode]         = useState("");
    const [lastScanEvent, setLastScanEvent]     = useState<ScanEvent | null>(null);
    const [locationStatus, setLocationStatus]   = useState<"pending" | "granted" | "denied" | null>(null);

    const handleScan = useCallback(async (raw: string, simulateCamera: boolean) => {
      if (scanState === "scanning" || scanState === "found") return;
      const barcode = normalizeBarcode(raw);
      setScanState("scanning");
      setScannedCode(barcode);
      setLastScanEvent(null);
      setSelectorOpen(false);
      setLocationStatus("pending");

      const locationPromise = getCurrentLocation().then((loc) => { setLocationStatus(loc ? "granted" : "denied"); return loc; });
      if (simulateCamera) await new Promise<void>((resolve) => setTimeout(resolve, 2200));

      const catalogProduct = findProductByBarcode(barcode, products);
      let product: Product | null = catalogProduct;
      if (!product) {
        const found = await lookupBarcode(barcode, { fdcKey: import.meta.env.VITE_FDC_API_KEY });
        if (found.status === "error") { setScanState("error"); return; }
        if (found.status === "found") product = found.product;
      }
      const location = await locationPromise;

      if (product) {
        setScanState("found");
        // Only catalog products have a database id; looked-up products are logged as unknown barcodes.
        const event = catalogProduct ? await recordProductScan(catalogProduct, location) : await createPlaceholder(barcode, location);
        if (event) setLastScanEvent(event);
        await new Promise<void>((resolve) => setTimeout(resolve, 900));
        setScanState("idle");
        onScanResult(product);
      } else {
        setScanState("not_found");
        const event = await createPlaceholder(barcode, location);
        if (event) setLastScanEvent(event);
      }
    }, [scanState, products, onScanResult]);

    const resetToIdle = useCallback(() => {
      setScanState("idle");
      setLastScanEvent(null);
      setLocationStatus(null);
    }, []);

    const typedCode   = normalizeBarcode(typed);
    const typedValid  = isBarcode(typedCode);
    const busy        = scanState === "scanning" || scanState === "found";
    const scanBgColor = scanState === "found" ? "#10B981" : scanState === "error" ? "#B45309" : "#1A5C39";

    // ── Not found anywhere ─────────────────────────────────────────────────────
    if (scanState === "not_found") {
      return (
        <div className="h-full flex flex-col" style={{ background: "#1a1200" }}>
          <div className="px-5 pt-5 pb-0 flex items-center justify-between">
            <span className="text-amber-400 text-xs font-bold tracking-widest uppercase">Not found</span>
            <button onClick={resetToIdle} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <X size={14} color="white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mb-5">
              <Database size={40} className="text-amber-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">We couldn't find this barcode yet</h2>
            <p className="text-white/60 text-sm mb-3 leading-relaxed max-w-xs">
              It isn't in our catalog, USDA FoodData Central or Open Food Facts. You can add it to Open Food Facts,
              the free product database, so everyone can see its ingredients.
            </p>
            <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer"
              className="text-amber-300 text-xs font-bold mb-5 inline-flex items-center gap-1">
              Add it at openfoodfacts.org <ExternalLink size={11} />
            </a>
            <div className="bg-white/8 border border-white/15 rounded-2xl px-5 py-3 w-full max-w-xs">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Scanned Barcode</p>
              <p className="text-white font-mono font-bold text-sm tracking-wider">{scannedCode}</p>
            </div>
            {lastScanEvent && (
              <div className="mt-4 flex items-center gap-2 text-xs text-amber-300/60">
                <Clock size={11} />
                <span>Scan saved at {new Date(lastScanEvent.scanned_at).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          <div className="px-5 pb-8 flex-shrink-0">
            <button onClick={resetToIdle} className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl" style={{ background: "#F59E0B" }}>
              Scan Another Product
            </button>
          </div>
        </div>
      );
    }

    // ── Scanner ────────────────────────────────────────────────────────────────
    return (
      <div className="h-full flex flex-col" style={{ background: "#0F1F16" }}>
        <style>{`
          @keyframes scanBeam { 0%, 100% { top: 12%; opacity: 1; } 50% { top: 82%; opacity: 0.8; } }
          @keyframes pulseRing { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        <div className="flex-1 relative flex flex-col items-center justify-center">
          <div className="mb-4 text-center" style={{ animation: "fadeInUp 0.3s ease" }}>
            <p className="text-white/40 text-[10px] mb-1 font-medium tracking-widest uppercase">Selected barcode</p>
            <p className="text-sm font-bold text-white/80">{selectedBarcode.label}</p>
            <p className="text-white/30 text-[10px] font-mono mt-0.5">{selectedBarcode.barcode}</p>
          </div>

          <div className="relative w-56 h-56 mx-auto mb-4">
            {(["top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
               "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
               "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
               "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl"] as const).map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
            ))}
            <div className="absolute inset-6 flex items-end justify-center gap-0.5 pb-3">
              {Array.from({ length: 22 }, (_, i) => (
                <div key={i} className="bg-white/15 rounded-sm" style={{ width: i % 4 === 0 ? 3 : 2, height: 30 + Math.abs(Math.sin(i * 1.3)) * 16 }} />
              ))}
            </div>
            {scanState === "scanning" && (
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
                style={{ animation: "scanBeam 1.5s ease-in-out infinite" }} />
            )}
            {scanState === "found" && (
              <>
                <div className="absolute inset-0 rounded-2xl border-2 border-green-400" style={{ animation: "pulseRing 0.6s ease-out" }} />
                <div className="absolute inset-0 flex items-center justify-center"><CheckCircle size={48} className="text-green-400" /></div>
              </>
            )}
            {scanState === "error" && (
              <div className="absolute inset-0 flex items-center justify-center"><WifiOff size={44} className="text-amber-400" /></div>
            )}
          </div>

          <p className="text-white/50 text-sm text-center px-6">
            {scanState === "scanning" ? "Looking up…"
              : scanState === "found" ? "✓ Product found!"
              : scanState === "error" ? "Couldn't reach the product databases. Check your connection and try again."
              : "Tap to scan"}
          </p>

          {scanState === "scanning" && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
              <MapPin size={10} />
              <span>{locationStatus === "pending" ? "Getting location…" : locationStatus === "granted" ? "Location captured" : "Location unavailable"}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex-shrink-0 space-y-3">
          <button onClick={() => setSelectorOpen((o) => !o)} disabled={busy}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 disabled:opacity-40 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <QrCode size={14} className="text-white/50 flex-shrink-0" />
              <span className="text-white/70 text-xs font-medium truncate">Demo: {selectedBarcode.label}</span>
            </div>
            {selectorOpen ? <ChevronDown size={14} className="text-white/40 flex-shrink-0" /> : <ChevronUp size={14} className="text-white/40 flex-shrink-0" />}
          </button>

          {selectorOpen && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {DEMO_BARCODES.map((demo) => {
                const active = demo.barcode === selectedBarcode.barcode;
                return (
                  <button key={demo.barcode} onClick={() => { setSelectedBarcode(demo); setSelectorOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors"
                    style={{ background: active ? "rgba(255,255,255,0.10)" : "transparent" }}>
                    <div>
                      <p className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-white/70"}`}>{demo.label}</p>
                      <p className="text-[9px] text-white/30 font-mono">{demo.barcode}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${demo.category === "Not found" ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-white/50"}`}>
                      {demo.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); if (typedValid && !busy) handleScan(typedCode, false); }} className="flex gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" aria-label="Barcode number"
              placeholder="Or type a barcode (8–14 digits)"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 text-white text-xs placeholder:text-white/30 outline-none focus:border-green-400" />
            <button type="submit" disabled={!typedValid || busy} className="px-4 rounded-2xl bg-white/10 text-white text-xs font-bold disabled:opacity-40">
              Look up
            </button>
          </form>
          {typed.trim() !== "" && !typedValid && (
            <p className="text-[10px] text-amber-300/80 -mt-1 px-1">Enter the 8–14 digits under the barcode.</p>
          )}

          <button onClick={() => (scanState === "error" ? handleScan(scannedCode, false) : handleScan(selectedBarcode.barcode, true))}
            disabled={busy}
            className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl transition-all disabled:opacity-50"
            style={{ background: scanBgColor }}>
            {scanState === "error" ? "Try again" : scanState === "scanning" ? "Looking up…" : scanState === "found" ? "✓ Product Found" : "📷 Tap to Scan"}
          </button>

          <p className="text-center text-white/25 text-[10px]">
            {products.length} catalog products · others looked up in USDA FoodData Central, then Open Food Facts
          </p>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Session list in `App.tsx`.**
  - After `const [scannedIds, setScannedIds] = useState<number[]>([2, 6]);` add:
    ```tsx
    // Products looked up in USDA / Open Food Facts this session (not in the catalog; negative ids).
    const [lookedUp, setLookedUp] = useState<Product[]>([]);
    ```
  - Replace
    `onScanResult={(p) => { setScannedIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]); openProduct(p); }}`
    with
    ```tsx
    onScanResult={(p) => {
      if (p.source) setLookedUp(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p]);
      setScannedIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
      openProduct(p);
    }}
    ```
  - Replace
    `<SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct={openProduct} products={products} />`
    with
    `<SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct={openProduct} products={[...products, ...lookedUp]} />`

- [ ] **Step 4: Build and test.** Run: `npm run build` (expected: builds) and `npm test` (expected: 109 pass).

- [ ] **Step 5: Verify in the browser.** Start the dev server (preview tool or `npm run dev`), open
  http://localhost:5173, click "Continue as Guest", and open the Scan tab. Each check makes at most two USDA requests
  and one OFF request.
  - **Coca-Cola Zero Sugar** (demo): the page shows the white "Label data from USDA FoodData Central, supplied by the
    manufacturer. View record" note. The verdict flags aspartame (amber). No prices or alternatives, and no "·" before an
    empty category.
  - **Tostitos Bite Size** (demo, the old fake Doritos code): opens the USDA Tostitos record, **not** our Doritos.
  - **Doritos Nacho Cheese** (demo, `028400335799`): opens the catalog Doritos page with prices and no source note.
  - **Nutella** (demo): the amber "Product data from Open Food Facts (crowd-sourced, may contain errors)" note with the
    ODbL line, English ingredients starting "Sugar, vegetable fat (palm)", and verdict "No flagged additives".
  - **Unlisted product** (demo): "We couldn't find this barcode yet", with the barcode and the openfoodfacts.org link.
    There's no "saved for review" text.
  - **Typed barcodes:**
    - `0 49000-042566` opens Coke Zero with **no new network request** (check `read_network_requests` for
      `api.nal.usda.gov`).
    - `12ab` shows "Enter the 8–14 digits under the barcode." with Look up disabled.
  - **Saved › Scanned** lists Coke Zero and Nutella once each, even after scanning Coke Zero twice.
  - **Forced failure (Review Focus 3):** in the browser console run
    `window.__f = window.fetch; window.fetch = () => Promise.reject(new TypeError("offline"))`, then type
    `012000161155` and Look up. Expected: "Couldn't reach the product databases…" with "Try again". Then run
    `window.fetch = window.__f` and tap Try again. Expected: Life Wtr loads from Open Food Facts (it isn't in USDA).
  - **Key in use:** the console has no "DEMO_KEY" warning. Apart from the forced failure, there are no console errors.
  - Take a screenshot of the Coke Zero page for the owner.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/scanService.ts src/app/components/ScanTab.tsx src/app/App.tsx
  git commit -m "Scan: look up USDA, then Open Food Facts, when the catalog misses

  Honest not-found screen (replaces the false 'saved for review' text), an
  error state with Try again, real demo barcodes, a type-a-barcode field,
  and looked-up products in Saved › Scanned. Barcodes match across forms.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 6: Docs

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec.

- [ ] **Step 1: `KNOWN_ISSUES.md`.**
  - Roadmap step 4: rename it "Product lookup (USDA first, Open Food Facts fallback)" and mark it "✅ done
    <date>" with the commit range. Summary: USDA + OFF lookup, the source note, additive codes, the honest not-found
    screen, and the Doritos/Oreo barcode fix.
  - Add a Medium row (or update K-29 if it exists): `| K-29 | The Figma export invented the catalog barcodes: 49 of 51 match nothing in USDA FoodData Central (checked 2026-09-28), so scanning the real package opens the USDA record instead of our featured page (correct data, but no prices). Doritos and Oreo, whose codes belonged to other products, were fixed in M2. Fix: when a product's real package is in hand, replace its barcode (one migration per batch). | products.csv, DB |`
  - Mark K-13 ("always says saved for review") fixed in Task 5's commit.
  - "Later (after done)": add "Acrylamide cooking note, Nutri-Score/NOVA and Baby Food category (deferred from M2;
    verified sources in `specs/2026-09-28-m2-open-food-facts-design.md`)".
  - "Before going public": add "set `VITE_FDC_API_KEY` on the host" and "put the public repo URL in OFF's
    `X-User-Agent`".
- [ ] **Step 2: `ARCHITECTURE.md`.**
  - File map: `src/lib/lookup.ts` (USDA + OFF lookup, pure mappers plus session cache, import-free for tests) and
    `src/lib/fixtures/{usda,off}/*.json` (recorded responses).
  - Data map: a row "Looked-up products: fetched live per session from USDA FoodData Central (manufacturer label data)
    or Open Food Facts (crowd-sourced); never stored".
  - External services: USDA FoodData Central (key `VITE_FDC_API_KEY` in `.env.local`, 3,600/hour) and Open Food Facts
    (no key).
  - Feature inventory: "Scan: lookup of non-catalog barcodes" is working. Scripts: `npm test` covers `src/lib/**`.
- [ ] **Step 3: `PROJECT_HANDOFF.md` and `SYNOPSIS.md`.**
  - Owner goals table, "Product data" row: "Curated 51 stay as featured; any other barcode is looked up in **USDA
    FoodData Central** (official manufacturer label data), then **Open Food Facts** (crowd-sourced, labelled)".
  - Decision log: add `| 016 | USDA FoodData Central is the primary lookup, Open Food Facts a labelled fallback | Owner wants a diverse lineup from a trustworthy US source; OFF is crowd-sourced and worldwide | **Done** (M2) |`.
  - How to run: add "Create `.env.local` with `VITE_FDC_API_KEY=<free key from https://fdc.nal.usda.gov/api-key-signup>`;
    without it the app uses USDA's `DEMO_KEY` (30 lookups/hour)".
  - Phase line: "M2 (product lookup) done; next is M3 (deploy + public repo)". SYNOPSIS: mark step 4 done, and change the
    next-session prompt to start M3.
- [ ] **Step 4: Spec.** Status line → `implemented (<first>…<last> commits)`.
- [ ] **Step 5: Run and commit.** `npm test` passes, then:
  ```bash
  git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md
  git commit -m "Docs: M2 done (USDA + Open Food Facts lookup); K-29 invented catalog barcodes

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

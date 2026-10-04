> **Superseded 2026-09-28**: do not execute. The owner chose USDA as the main source; see `specs/2026-09-28-m2-usda-lookup-design.md`.

# M2 Open Food Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A barcode outside our 51-product catalog opens a real product page from Open Food Facts (OFF). That page shows the
additive check, an acrylamide "Formed during cooking" note where it applies, and a separate nutrition section.

**Architecture:**
- A pure mapper plus a session-cached fetch (`src/lib/off.ts`) turns OFF v3 responses into our `Product` shape, with an
  optional `off` block.
- The safety engine takes OFF additive codes again.
- A new `process.ts` decides the acrylamide note from OFF categories or a catalog rule.
- The product page gains two small components.
- ScanTab looks up OFF when the catalog misses.

**Tech Stack:**
- React 18 + Vite 6, Tailwind 4, lucide-react
- Node 24 `node --test` with native TS type stripping
- Supabase (Postgres) via MCP for the one migration

**Spec:** `docs/superpowers/specs/2026-09-28-m2-open-food-facts-design.md` (amended with D8: nutrition only for
OFF-looked-up products).

## Global Constraints

- **Node tests:** any module a test imports must use `.ts` extensions on relative imports and erasable-only TypeScript
  (no `enum`, `namespace`, parameter properties). Use `import type` for types from modules Node can't load.
- **Writing files:** write code files with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Dependencies:** add none.
- **Facts first:**
  - Every health statement cites an official source with a verbatim quote (<= 25 words).
  - OFF data is labelled "crowd-sourced, not official".
  - Nutri-Score appears as a plain-text letter, never the logo.
- **OFF requests:** `https://world.openfoodfacts.org/api/v3/product/{code}.json?fields=…`, header
  `X-User-Agent: EcoGo/0.1 (personal project)`. Never send the owner's email. Session cache; OFF allows about 15 product
  lookups per minute per user.
- **The verdict:** colours, list dot and sort come only from `analyzeIngredients`. The cooking note and nutrition never
  change it.
- **Migrations:** never edit applied migrations, add new ones. Apply to the live project `gippyavmxxzqxjkuahpt` with
  the Supabase MCP `apply_migration` tool.
- **Commits:** commit per task. Every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Suite:** `npm test` stays green after every task. Task 3 widens its glob to `src/lib/**/*.test.ts`.

## Review Focus

1. **Rate limit:** re-scanning or re-opening the same OFF barcode must hit the session cache, not the network.
   Pinned by Task 3's "lookups are cached per barcode; errors are not".
2. **OFF slow or down:** this must show "Couldn't reach Open Food Facts" with a retry, never "not found" and never a
   blank page. Pinned by Task 3's error-mapping tests and Task 6 Step 5's forced-failure browser check.
3. **Hand-typed barcodes:** 12 vs 13 digits, spaces, dashes and leading zeros must match the same product. Pinned by
   Task 3's "barcodes compare by digits…" and used by `findProductByBarcode` in Task 6.
4. **Crowd-sourced text:** huge strings, odd casing and HTML-ish text must map and analyze safely. Pinned by Task 3's
   "huge or odd crowd-sourced text…".
5. **Saved › Scanned:** an OFF product scanned twice appears once. Pinned by Task 6 Step 5's browser check (dedupe by
   id in `App.tsx`).

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<version>_baby_food_category.sql` (new) | Adds category "Baby Food", moves product 49 |
| `src/data/products.csv` | Product 49 → "Baby Food" |
| `src/lib/safety/analyze.ts` | `FOOD_CATEGORIES` += "Baby Food"; `additiveCodes` input back |
| `src/lib/safety/fixtures/expected-flags.json` | #49 re-reviewed |
| `src/lib/productImporter.ts` | `OffData` type; optional `Product.off` |
| `src/lib/off.ts` (new) | `mapOffResponse`, `fetchOffProduct` (session cache), `normalizeBarcode`, `sameBarcode`, `nutriScoreText`, `novaText` |
| `src/lib/fixtures/off/*.json` (new) | Recorded OFF responses for tests |
| `src/lib/off.test.ts` (new) | Mapper, cache, barcode and nutrition-text tests |
| `src/lib/safety/process.ts` (new) | `ACRYLAMIDE` note plus `acrylamideMatch` |
| `src/lib/safety/process.test.ts` (new) | Catalog and OFF-tag matching |
| `scripts/verify-sources.mjs` | Also checks acrylamide sources |
| `src/app/components/verdict.tsx` | `safeAnalyze` is OFF-aware |
| `src/app/components/CookingNote.tsx` (new) | The acrylamide card |
| `src/app/components/NutritionPanel.tsx` (new) | Nutri-Score letter plus NOVA (OFF products only) |
| `src/app/components/ProductDetailScreen.tsx` | Renders the two cards plus the OFF source note |
| `src/lib/scanService.ts` | `findProductByBarcode` uses `sameBarcode` |
| `src/app/components/ScanTab.tsx` | OFF lookup, error state, honest not-found, demo barcodes, typed barcode |
| `src/app/App.tsx` | Session `offProducts` for Saved › Scanned |
| Docs | KNOWN_ISSUES, ARCHITECTURE, PROJECT_HANDOFF, SYNOPSIS, spec status |

---

### Task 1: Gerber Puffs becomes food ("Baby Food" category)

**Files:**
- Create: `supabase/migrations/<version>_baby_food_category.sql` (version from the MCP, Step 5)
- Modify: `src/data/products.csv:108-109`, `src/lib/safety/analyze.ts:15-17`, `src/lib/safety/fixtures/expected-flags.json:50`

**Interfaces:** Produces the category name `"Baby Food"` (in `FOOD_CATEGORIES`, the CSV and the DB). Task 4 relies on
product 49 having it.

- [ ] **Step 1: Write the failing expectation.** In `expected-flags.json` replace
  `"49": {"verdict": "non-food", "flags": []},` with `"49": {"verdict": "none", "flags": []},`
  (reviewed against the label: "Whole wheat flour, whole grain oat flour, sugar, wheat starch, apple juice concentrate,
  natural strawberry flavor, vitamin E". Nothing in the library applies, and "vitamin E" is not an E-number.)

- [ ] **Step 2: Run the suite.** Run: `npm test`. Expected: FAIL. `#49 Gerber Graduates Puffs…` gets verdict
  `non-food`, expected `none`.

- [ ] **Step 3: Make it food.**
  - In `src/data/products.csv` lines 108 and 109, replace `Nestle,"Baby Care",` with `Nestle,"Baby Food",` (both rows).
  - In `src/lib/safety/analyze.ts`, replace
    `"Beverages", "Bread", "Breakfast", "Condiments", "Dairy", "Frozen", "Meat", "Snacks",`
    with
    `"Baby Food", "Beverages", "Bread", "Breakfast", "Condiments", "Dairy", "Frozen", "Meat", "Snacks",`

- [ ] **Step 4: Run the suite.** Run: `npm test`. Expected: all pass (94).

- [ ] **Step 5: Apply the migration to the live DB.**
  - Call the Supabase MCP `apply_migration` with project `gippyavmxxzqxjkuahpt`, name `baby_food_category`, and this
    query:
    ```sql
    -- Gerber Puffs (id 49) is baby cereal food, not a baby-care product: move it to a food category so the safety
    -- check runs on it. Pampers wipes (id 48) stay in 'Baby Care'.
    insert into public.categories (name) values ('Baby Food') on conflict (name) do nothing;
    update public.products
       set category_id = (select id from public.categories where name = 'Baby Food')
     where id = 49;
    ```
  - Then call `list_migrations` and save the same SQL as `supabase/migrations/<version>_baby_food_category.sql`, using
    the version it reports (file names match the project's history).
  - Verify with `execute_sql`: `select p.id, c.name from products p join categories c on c.id = p.category_id where p.id in (48, 49);`
    Expected: 48 → Baby Care, 49 → Baby Food.

- [ ] **Step 6: Commit.**
  ```bash
  git add supabase/migrations src/data/products.csv src/lib/safety/analyze.ts src/lib/safety/fixtures/expected-flags.json
  git commit -m "Gerber Puffs is food: new 'Baby Food' category

  It was filed under 'Baby Care', so the safety check skipped it. Migration
  applied to the live DB; CSV and expected flags (#49: none) updated.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 2: The engine checks OFF additive codes again

**Files:** Modify `src/lib/safety/analyze.ts`, `src/lib/safety/analyze.test.ts`

**Interfaces:** Produces `analyzeIngredients(input: { ingredients: string; category?: string; additiveCodes?: string[] }, library?)`.
Codes may be `en:e951`, `E 951` or `e951`.

- [ ] **Step 1: Write the failing tests.** Append to `analyze.test.ts`, before the "never throws" test:
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
  - After the `for (const item of items) { … }` loop add:
    ```ts
    for (const code of codes) {
      for (const { entry } of matchers) if (entry.eCodes.includes(code)) flag(entry, code);
    }
    ```
  - Change the header comment to `// analyze.ts — ingredient text (+ optional additive codes) → verdict and flags.`

- [ ] **Step 4: Run.** Run: `npm test`. Expected: all pass (96).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/lib/safety/analyze.ts src/lib/safety/analyze.test.ts
  git commit -m "Engine: check Open Food Facts additive codes (en:e951 → aspartame)

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 3: Open Food Facts client (`off.ts`)

**Files:**
- Create: `src/lib/off.ts`, `src/lib/off.test.ts`, `src/lib/fixtures/off/nutella-3017620422003.json`,
  `…/coke-zero-049000042566.json`, `…/not-found-3017620429996.json`, `…/empty-9780000000002.json`
- Modify: `src/lib/productImporter.ts` (Product type), `package.json` (test glob)

**Interfaces:**
- Consumes: `Product` (productImporter), `analyzeIngredients` (Task 2) in one test.
- Produces:
  - `interface OffData { code: string; url: string; lang: string; ingredientsLang: string; additiveCodes: string[]; categoryTags: string[]; nutriscore: string | null; nova: 1 | 2 | 3 | 4 | null }`
  - `Product.off?: OffData`
  - `type OffResult = { status: "found"; product: Product } | { status: "not-found" } | { status: "error"; message: string }`
  - `mapOffResponse(json: unknown, httpStatus: number): OffResult`
  - `fetchOffProduct(barcode: string, fetchImpl?: typeof fetch): Promise<OffResult>`
  - `normalizeBarcode(raw: string): string`
  - `sameBarcode(a: string, b: string): boolean`
  - `nutriScoreText(grade: string | null): string`
  - `novaText(nova: number | null): string`

- [ ] **Step 1: Add the type.** In `src/lib/productImporter.ts`, add above `export interface Product`:
  ```ts
  /** Data only products looked up on Open Food Facts carry (catalog products never set it). Crowd-sourced, not official. */
  export interface OffData {
    code: string;              // normalized barcode OFF returned
    url: string;               // the product's OFF page (licence: credit OFF with this link)
    lang: string;              // product's main language
    ingredientsLang: string;   // "en" when English ingredients were available, else `lang`
    additiveCodes: string[];   // e.g. ["en:e951"]
    categoryTags: string[];    // hierarchical OFF category ids, e.g. "en:potato-crisps"
    nutriscore: string | null; // "a"–"e", "unknown", "not-applicable" (OFF's own calculation)
    nova: 1 | 2 | 3 | 4 | null;
  }
  ```
  and inside `Product`, after `facebook?: …;`, add `off?: OffData;`.

- [ ] **Step 2: Record the fixtures.** Create these four files with exactly this content. They are real OFF v3
  responses captured 2026-09-28, with long ingredient text trimmed.

  `src/lib/fixtures/off/nutella-3017620422003.json`
  ```json
  {"httpStatus":200,"body":{"code":"3017620422003","errors":[],"product":{"additives_tags":["en:e322","en:e322i"],"brands":"Nutella, Ferrero","categories_tags":["en:breakfasts","en:spreads","en:sweet-spreads","en:confectionary-based-spreads","fr:Nutella"],"code":"3017620422003","ingredients_text":"Sucre, huile de palme, NOISETTES 13%, cacao maigre 7,4%, LAIT écrémé en poudre 6,6%, LACTOSERUM en poudre, émulsifiants: lécithines [SOJA), vanilline.","ingredients_text_en":"Sugar, vegetable fat (palm), hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa powder (7.4%), emulsifier: lecithins (soya), flavouring (vanillin).","lang":"fr","nova_group":4,"nutriscore_grade":"e","product_name":"Nutella","product_name_en":"Nutella"},"result":{"id":"product_found","lc_name":"Product found","name":"Product found"},"status":"success","warnings":[]}}
  ```
  `src/lib/fixtures/off/coke-zero-049000042566.json`
  ```json
  {"httpStatus":200,"body":{"code":"0049000042566","errors":[],"product":{"additives_tags":["en:e150c","en:e212","en:e338","en:e950","en:e951"],"brands":"Coca-Cola","categories_tags":["en:beverages","en:carbonated-drinks","en:sodas","en:colas","en:diet-sodas"],"code":"0049000042566","ingredients_text":"Carbonated water, caramel color, phosphoric acid, aspartame, potassium benzoate (to protect taste), natural flavors, potassium citrate, acesulfame potassium, caffeine.","ingredients_text_en":"Carbonated water, caramel color, phosphoric acid, aspartame, potassium benzoate (to protect taste), natural flavors, potassium citrate, acesulfame potassium, caffeine.","lang":"en","nova_group":4,"nutriscore_grade":"c","product_name":"Coca-Cola Zero Sugar","product_name_en":"Coca-Cola Zero Sugar"},"result":{"id":"product_found","lc_name":"Product found","name":"Product found"},"status":"success_with_warnings","warnings":[{"field":{"id":"code","value":"0049000042566"},"impact":{"id":"none","lc_name":"None","name":"None"},"message":{"id":"different_normalized_product_code","lc_name":"","name":""}}]}}
  ```
  `src/lib/fixtures/off/not-found-3017620429996.json`
  ```json
  {"httpStatus":404,"body":{"code":"3017620429996","errors":[{"field":{"id":"code","value":"3017620429996"},"impact":{"id":"failure","lc_name":"Failure","name":"Failure"},"message":{"id":"product_not_found","lc_name":"","name":""}}],"result":{"id":"product_not_found","lc_name":"Product not found","name":"Product not found"},"status":"failure","warnings":[]}}
  ```
  `src/lib/fixtures/off/empty-9780000000002.json`
  ```json
  {"httpStatus":200,"body":{"code":"9780000000002","errors":[],"product":{"categories_tags":["en:soups","en:gazpacho"],"code":"9780000000002","lang":"fr","nutriscore_grade":"unknown"},"result":{"id":"product_found","lc_name":"Product found","name":"Product found"},"status":"success","warnings":[]}}
  ```

- [ ] **Step 3: Widen the test glob.** In `package.json` replace
  `"test": "node --test \"src/lib/safety/**/*.test.ts\"",` with `"test": "node --test \"src/lib/**/*.test.ts\"",`

- [ ] **Step 4: Write the failing tests** in `src/lib/off.test.ts`:
  ```ts
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { mapOffResponse, fetchOffProduct, normalizeBarcode, sameBarcode, nutriScoreText, novaText } from "./off.ts";
  import { analyzeIngredients } from "./safety/analyze.ts";

  const fixture = (name: string) =>
    JSON.parse(readFileSync(new URL(`./fixtures/off/${name}.json`, import.meta.url), "utf8")) as { httpStatus: number; body: any };
  const map = (name: string) => { const f = fixture(name); return mapOffResponse(f.body, f.httpStatus); };

  test("a found product maps to a Product with OFF data, preferring English", () => {
    const r = map("nutella-3017620422003");
    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    const p = r.product;
    assert.equal(p.id, -3017620422003);
    assert.equal(p.name, "Nutella");
    assert.equal(p.brand, "Nutella");
    assert.equal(p.category, "");
    assert.match(p.ingredients, /^Sugar, vegetable fat \(palm\)/);
    assert.equal(p.amazon, undefined);
    assert.equal(p.off?.url, "https://world.openfoodfacts.org/product/3017620422003");
    assert.equal(p.off?.lang, "fr");
    assert.equal(p.off?.ingredientsLang, "en");
    assert.deepEqual(p.off?.additiveCodes, ["en:e322", "en:e322i"]);
    assert.ok(p.off?.categoryTags.includes("en:spreads"));
    assert.equal(p.off?.nutriscore, "e");
    assert.equal(p.off?.nova, 4);
  });

  test("'success_with_warnings' counts as found and keeps additive codes", () => {
    const r = map("coke-zero-049000042566");
    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.equal(r.product.barcode, "0049000042566");
    assert.equal(r.product.id, -49000042566);
    assert.ok(r.product.off?.additiveCodes.includes("en:e951"));
    assert.deepEqual(analyzeIngredients({ ingredients: "", additiveCodes: r.product.off?.additiveCodes }).flags.map(f => f.entry.id), ["aspartame"]);
  });

  test("HTTP 404 is not found; a found shell with no name and no ingredients is not found", () => {
    assert.equal(map("not-found-3017620429996").status, "not-found");
    assert.equal(map("empty-9780000000002").status, "not-found");
  });

  test("non-English ingredients without an English version keep their language", () => {
    const body = structuredClone(fixture("nutella-3017620422003").body);
    delete body.product.ingredients_text_en;
    const r = mapOffResponse(body, 200);
    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.equal(r.product.off?.ingredientsLang, "fr");
    assert.match(r.product.ingredients, /^Sucre/);
  });

  test("server errors are errors; junk is not found; neither is ever found", () => {
    assert.equal(mapOffResponse(null, 503).status, "error");
    assert.equal(mapOffResponse(null, 429).status, "error");
    assert.equal(mapOffResponse("<html>", 200).status, "not-found");
    assert.equal(mapOffResponse({ status: "failure" }, 200).status, "not-found");
    assert.equal(mapOffResponse({ status: "success", product: { product_name: "No code" } }, 200).status, "not-found");
  });

  // Review Focus 4: crowd-sourced text is untrusted.
  test("huge or odd crowd-sourced text still maps and analyzes safely", () => {
    const body = { status: "success", product: { code: "123456789012", product_name: "Big &amp; odd <b>snack</b>", ingredients_text_en: "salt, ".repeat(20000) + "SODIUM NITRITE" } };
    const r = mapOffResponse(body, 200);
    assert.equal(r.status, "found");
    if (r.status !== "found") return;
    assert.equal(analyzeIngredients({ ingredients: r.product.ingredients }).verdict, "high");
  });

  // Review Focus 3: hand-typed barcodes.
  test("barcodes compare by digits, ignoring spaces, dashes and leading zeros", () => {
    assert.equal(normalizeBarcode(" 0 49000-042566 "), "049000042566");
    assert.ok(sameBarcode("049000042566", "0049000042566"));
    assert.ok(sameBarcode("049000042566", "0 49000-042566"));
    assert.ok(!sameBarcode("049000042566", "049000042567"));
    assert.ok(!sameBarcode("", "000"));
  });

  // Review Focus 1: the rate limit.
  test("lookups are cached per barcode; errors are not", async () => {
    let calls = 0;
    const ok = (async () => { calls++; return new Response(JSON.stringify(fixture("coke-zero-049000042566").body), { status: 200 }); }) as typeof fetch;
    assert.equal((await fetchOffProduct("049000042566", ok)).status, "found");
    assert.equal((await fetchOffProduct("0 49000-042566", ok)).status, "found");
    assert.equal(calls, 1);

    let fails = 0;
    const down = (async () => { fails++; throw new TypeError("Failed to fetch"); }) as typeof fetch;
    assert.equal((await fetchOffProduct("3017620429996", down)).status, "error");
    assert.equal((await fetchOffProduct("3017620429996", down)).status, "error");
    assert.equal(fails, 2);
  });

  test("barcodes outside 8–14 digits never hit the network", async () => {
    let calls = 0;
    const f = (async () => { calls++; return new Response("{}", { status: 200 }); }) as typeof fetch;
    assert.equal((await fetchOffProduct("1234", f)).status, "not-found");
    assert.equal((await fetchOffProduct("123456789012345", f)).status, "not-found");
    assert.equal(calls, 0);
  });

  test("nutrition text follows OFF's grade values", () => {
    assert.equal(nutriScoreText("e"), "E, lower nutritional quality");
    assert.equal(nutriScoreText("a"), "A, very good nutritional quality");
    assert.equal(nutriScoreText("unknown"), "not enough nutrition data");
    assert.equal(nutriScoreText("not-applicable"), "not applicable to this category");
    assert.equal(nutriScoreText(null), "not enough nutrition data");
    assert.equal(novaText(4), "NOVA 4, ultra-processed foods");
    assert.equal(novaText(null), "not enough data");
  });
  ```

- [ ] **Step 5: Run.** Run: `npm test`. Expected: FAIL. `Cannot find module …/src/lib/off.ts`.

- [ ] **Step 6: Implement** `src/lib/off.ts`:
  ```ts
  // off.ts — Open Food Facts lookup for barcodes outside our catalog.
  // Spec: docs/superpowers/specs/2026-09-28-m2-open-food-facts-design.md §4.1. OFF data is crowd-sourced, not official.
  // Type-only imports, so Node tests can load this module.
  import type { OffData, Product } from "./productImporter.ts";

  export type OffResult =
    | { status: "found"; product: Product }
    | { status: "not-found" }
    | { status: "error"; message: string };

  const API = "https://world.openfoodfacts.org/api/v3/product/";
  const FIELDS = "code,product_name,product_name_en,brands,lang,ingredients_text,ingredients_text_en,additives_tags,nutriscore_grade,nova_group,categories_tags";

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

  /** Digits only. OFF itself treats 12-digit UPC-A and its 13-digit EAN-13 form as the same product. */
  export const normalizeBarcode = (raw: string) => raw.replace(/\D/g, "");

  /** Same product code, ignoring spaces, dashes and leading zeros. */
  export function sameBarcode(a: string, b: string): boolean {
    const x = normalizeBarcode(a).replace(/^0+/, "");
    return x !== "" && x === normalizeBarcode(b).replace(/^0+/, "");
  }

  /** Pure: an OFF v3 response body plus its HTTP status → our result. */
  export function mapOffResponse(json: unknown, httpStatus: number): OffResult {
    if (httpStatus === 404) return { status: "not-found" };
    if (httpStatus !== 200) return { status: "error", message: `Open Food Facts returned HTTP ${httpStatus}` };
    const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
    if (body.status !== "success" && body.status !== "success_with_warnings") return { status: "not-found" };
    const p = (body.product && typeof body.product === "object" ? body.product : {}) as Record<string, unknown>;
    const code = normalizeBarcode(str(p.code) || str(body.code));
    const name = str(p.product_name_en) || str(p.product_name);
    const english = str(p.ingredients_text_en);
    const ingredients = english || str(p.ingredients_text);
    if (!code || (!name && !ingredients)) return { status: "not-found" };
    const lang = str(p.lang) || "en";
    const off: OffData = {
      code,
      url: `https://world.openfoodfacts.org/product/${code}`,
      lang,
      ingredientsLang: english ? "en" : lang,
      additiveCodes: strings(p.additives_tags),
      categoryTags: strings(p.categories_tags),
      nutriscore: str(p.nutriscore_grade) || null,
      nova: p.nova_group === 1 || p.nova_group === 2 || p.nova_group === 3 || p.nova_group === 4 ? p.nova_group : null,
    };
    return {
      status: "found",
      product: {
        id: -Number(code), // catalog ids are positive, so an OFF product never collides with one
        barcode: code,
        name: name || "Unnamed product",
        brand: str(p.brands).split(",")[0].trim(),
        category: "",
        description: "",
        ingredients,
        imageUrl: "",
        keywords: [],
        off,
      },
    };
  }

  const cache = new Map<string, Promise<OffResult>>();

  /** Session-cached lookup (OFF allows ~15 product reads/min per user). Errors aren't cached, so a retry can succeed. */
  export function fetchOffProduct(barcode: string, fetchImpl: typeof fetch = fetch): Promise<OffResult> {
    const code = normalizeBarcode(barcode);
    if (code.length < 8 || code.length > 14) return Promise.resolve({ status: "not-found" });
    const hit = cache.get(code);
    if (hit) return hit;
    const pending: Promise<OffResult> = fetchImpl(`${API}${code}.json?fields=${FIELDS}`, {
      headers: { "X-User-Agent": "EcoGo/0.1 (personal project)" },
    })
      .then(async res => mapOffResponse(await res.json().catch(() => null), res.status))
      .catch((err: unknown) => ({ status: "error", message: err instanceof Error ? err.message : String(err) }));
    cache.set(code, pending);
    pending.then(r => { if (r.status === "error") cache.delete(code); });
    return pending;
  }

  const NUTRI: Record<string, string> = {
    a: "very good nutritional quality", b: "good nutritional quality", c: "average nutritional quality",
    d: "lower nutritional quality", e: "lower nutritional quality",
  };
  const NOVA: Record<number, string> = {
    1: "unprocessed or minimally processed foods", 2: "processed culinary ingredients", 3: "processed foods", 4: "ultra-processed foods",
  };

  /** OFF's Nutri-Score grade as plain text (never the logo — see spec D3/D4). */
  export function nutriScoreText(grade: string | null): string {
    if (grade && NUTRI[grade]) return `${grade.toUpperCase()}, ${NUTRI[grade]}`;
    if (grade === "not-applicable") return "not applicable to this category";
    return "not enough nutrition data";
  }

  export function novaText(nova: number | null): string {
    return nova && NOVA[nova] ? `NOVA ${nova}, ${NOVA[nova]}` : "not enough data";
  }
  ```

- [ ] **Step 7: Run.** Run: `npm test`. Expected: all pass (96 + 10 = 106).

- [ ] **Step 8: Commit.**
  ```bash
  git add src/lib/off.ts src/lib/off.test.ts src/lib/fixtures/off src/lib/productImporter.ts package.json
  git commit -m "Open Food Facts client: mapper, session cache, barcode matching

  Pure mapper tested on recorded v3 responses (found, warnings, 404, empty
  shell); errors are never 'not found' and never cached.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 4: Acrylamide cooking-note rule (`process.ts`)

**Files:** Create `src/lib/safety/process.ts`, `src/lib/safety/process.test.ts`. Modify `scripts/verify-sources.mjs`.

**Interfaces:**
- Consumes: `Source` (library.ts), `FOOD_CATEGORIES` (analyze.ts, with "Baby Food" from Task 1), `parseProductsCSV`.
- Produces:
  - `interface ProcessNote { name: string; summary: string; concern: string; context: string; sources: Source[] }`
  - `ACRYLAMIDE: ProcessNote`
  - `type EuCategory = "a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"`
  - `acrylamideMatch(p: { name: string; category: string; ingredients: string; off?: { categoryTags: string[] } }): { euCategory: EuCategory } | null`

The spec §6 check "the acrylamide match never changes the verdict" is structural: `analyze.ts` never imports
`process.ts`, and `catalog.test.ts` keeps pinning every verdict. So there's no separate test for it.

- [ ] **Step 1: Write the failing tests** in `src/lib/safety/process.test.ts`:
  ```ts
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { ACRYLAMIDE, acrylamideMatch } from "./process.ts";
  import { parseProductsCSV } from "../productImporter.ts";

  const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
  const off = (tags: string[]) => acrylamideMatch({ name: "x", category: "", ingredients: "", off: { categoryTags: tags } })?.euCategory ?? null;

  test("exactly the reviewed catalog products get the acrylamide note", () => {
    // Lay's, Oreo, Nature Valley, Pringles, Special K, Wonder bread, Goldfish, Gerber Puffs (EU Reg 2017/2158 Art. 1(2)).
    // Not: Doritos/Cheetos (corn, not listed), Quaker oatmeal (porridge excluded), frozen foods, drinks, non-food.
    assert.deepEqual(catalog.filter(p => acrylamideMatch(p)).map(p => p.id), [1, 14, 16, 18, 20, 40, 41, 49]);
  });

  test("Open Food Facts categories: potato crisps, cereals and biscuits match; porridge and corn chips don't", () => {
    assert.equal(off(["en:snacks", "en:crisps", "en:potato-crisps", "en:salty-snacks-made-from-potato"]), "a");
    assert.equal(off(["en:snacks", "en:chips-and-fries", "en:crisps", "en:corn-chips"]), null); // Tostitos (live data)
    assert.equal(off(["en:breakfasts", "en:breakfast-cereals"]), "d");
    assert.equal(off(["en:breakfasts", "en:breakfast-cereals", "en:porridge"]), null);
    assert.equal(off(["en:snacks", "en:biscuits-and-crackers", "en:biscuits", "en:crackers-appetizers"]), "e"); // Wheat Thins (live data)
    assert.equal(off(["en:breads"]), "c");
    assert.equal(off(["en:coffees"]), "f");
    assert.equal(off(["en:baby-foods", "en:cereals-for-babies"]), "h");
    assert.equal(off(["en:beverages", "en:colas"]), null);
    assert.equal(off([]), null);
  });

  test("acrylamide sources are complete (verify:sources checks the quotes)", () => {
    assert.ok(ACRYLAMIDE.sources.length >= 3);
    for (const s of ACRYLAMIDE.sources) {
      assert.match(s.url, /^https?:\/\//); // the EU Cellar copy only serves plain http
      assert.ok(s.quote.trim() && s.quote.trim().split(/\s+/).length <= 25, s.url);
      assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    }
  });
  ```

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. `Cannot find module …/process.ts`.

- [ ] **Step 3: Implement** `src/lib/safety/process.ts`:
  ```ts
  // process.ts — substances that form during cooking (never on an ingredient list). Starts with acrylamide.
  // Spec: docs/superpowers/specs/2026-09-28-m2-open-food-facts-design.md §3, §4.4. Shown as a note: it never changes
  // the additive verdict.
  import type { Source } from "./library.ts";
  import { FOOD_CATEGORIES } from "./analyze.ts";

  export interface ProcessNote { name: string; summary: string; concern: string; context: string; sources: Source[] }

  const CHECKED = "2026-09-28";

  export const ACRYLAMIDE: ProcessNote = {
    name: "Acrylamide",
    summary: "Forms when starchy foods are fried, baked or roasted; it is not an added ingredient.",
    concern: "IARC classifies it as probably carcinogenic to humans (Group 2A), and EFSA says it potentially increases cancer risk.",
    context: "EU law requires makers of these foods to keep it as low as reasonably achievable. The FDA does not advise avoiding fried, roasted or baked foods; cooking to golden rather than brown helps reduce it.",
    sources: [
      { body: "IARC", basis: "iarc-2a", finding: "Group 2A (probably carcinogenic to humans), IARC Monographs vol. 60 (1994)",
        url: "https://publications.iarc.who.int/78", quote: "Acrylamide was classified as probably carcinogenic to humans.", checkedOn: CHECKED },
      { body: "EFSA", basis: "context", finding: "EFSA's 2015 opinion: acrylamide in food potentially increases cancer risk for all age groups",
        url: "https://www.efsa.europa.eu/en/press/news/150604",
        quote: "acrylamide in food potentially increases the risk of developing cancer for consumers in all age groups", checkedOn: CHECKED },
      { body: "EU", basis: "context", finding: "Regulation (EU) 2017/2158 requires makers of fries, crisps, bread, breakfast cereals, biscuits, coffee and baby food to reduce it",
        url: "http://publications.europa.eu/resource/celex/32017R2158",
        quote: "(a) French fries, other cut (deep fried) products and sliced potato crisps from fresh potatoes;", checkedOn: CHECKED },
      { body: "FDA", basis: "context", finding: "FDA's Q&A answers 'No' to whether people should stop eating fried, roasted or baked foods",
        url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers",
        quote: "Should I stop eating foods that are fried, roasted, or baked?", checkedOn: CHECKED },
      { body: "FDA", basis: "context", finding: "FDA home-cooking advice: fry and toast to golden rather than brown",
        url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-and-diet-food-storage-and-food-preparation",
        quote: "to a golden yellow color rather than a brown color helps reduce acrylamide formation", checkedOn: CHECKED },
    ],
  };

  /** EU Regulation 2017/2158 Article 1(2) food types. */
  export type EuCategory = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

  // OFF category ids verified against the OFF taxonomy on 2026-09-28. Tags are hierarchical (a product carries its
  // parents), so parents cover children. Generic "en:crisps" / "en:chips-and-fries" are NOT listed: they include corn chips.
  const OFF_TAGS: [string, EuCategory][] = [
    ["en:potato-fries", "a"], ["en:potato-crisps", "a"], ["en:salty-snacks-made-from-potato", "b"],
    ["en:breads", "c"], ["en:breakfast-cereals", "d"],
    ["en:biscuits-and-crackers", "e"], ["en:cereal-bars", "e"], ["en:gingerbreads", "e"],
    ["en:coffees", "f"], ["en:instant-coffees", "f"], ["en:instant-coffee-substitutes", "g"], ["en:baby-foods", "h"],
  ];

  const BAKERY_WORDS = /\b(cookies?|biscuits?|crackers?|wafers?|rusks?|gingerbread|crispbreads?|(granola|cereal) bars?)\b/i;
  const CEREAL_FLOUR_FIRST = /^(enriched |whole grain |whole )?(wheat |oat |rice |rye )?flour\b/i;

  /** Which EU acrylamide food type a product is, or null. OFF products by category tags; catalog products by rule. */
  export function acrylamideMatch(p: { name: string; category: string; ingredients: string; off?: { categoryTags: string[] } }): { euCategory: EuCategory } | null {
    if (p.off) {
      const tags = new Set(p.off.categoryTags);
      for (const [tag, euCategory] of OFF_TAGS) {
        if (euCategory === "d" && tags.has("en:porridge")) continue; // (d) excludes porridge
        if (tags.has(tag)) return { euCategory };
      }
      return null;
    }
    if (!FOOD_CATEGORIES.has(p.category)) return null;
    const first = p.ingredients.trim();
    if (p.category === "Bread") return { euCategory: "c" };
    if (p.category === "Breakfast") return /\b(oat ?meal|oats|porridge)\b/i.test(p.name) ? null : { euCategory: "d" };
    if (p.category === "Baby Food") return { euCategory: "h" };
    if (p.category === "Snacks") {
      if (/^potato(es)?\b/i.test(first)) return { euCategory: "a" };
      if (/^dried potato(es)?\b/i.test(first)) return { euCategory: "b" };
      // EU (e): "a cracker is a dry biscuit (a baked product based on cereal flour)"
      if (BAKERY_WORDS.test(p.name) || CEREAL_FLOUR_FIRST.test(first)) return { euCategory: "e" };
    }
    if (/\b(coffee|espresso)\b/i.test(p.name) && !/creamer/i.test(p.name)) return { euCategory: "f" };
    return null;
  }
  ```

- [ ] **Step 4: Run.** Run: `npm test`. Expected: all pass (109).

- [ ] **Step 5: Check the sources.** In `scripts/verify-sources.mjs`:
  - Add `import { ACRYLAMIDE } from "../src/lib/safety/process.ts";` after the LIBRARY import.
  - Replace `for (const entry of LIBRARY) {` with
    `for (const entry of [...LIBRARY, { id: "acrylamide", sources: ACRYLAMIDE.sources }]) {`
  - In the fetch headers add `Accept: "text/html,application/xhtml+xml", "Accept-Language": "en",` next to `User-Agent`
    (the EU Cellar copy only returns its text for an XHTML Accept header).
  - Run: `npm run verify:sources`. Expected: 0 fail. The 5 acrylamide sources are pass or unverifiable. Open any
    unverifiable acrylamide URL in the browser and confirm its quote by hand. Record which ones in the commit message.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/safety/process.ts src/lib/safety/process.test.ts scripts/verify-sources.mjs
  git commit -m "Acrylamide cooking-note rule (EU 2017/2158 food types)

  OFF products match by category tags (potato-specific, porridge excluded);
  catalog products by a rule pinned to 8 reviewed products. Sources: IARC,
  EFSA, EU, FDA. verify:sources: <P> pass, 0 fail, <U> unverifiable (hand-checked: <list>).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```
  Replace `<P>`, `<U>` and `<list>` with Step 5's real numbers.

---

### Task 5: Product page: OFF-aware verdict, cooking note, nutrition, source note

**Files:**
- Create: `src/app/components/CookingNote.tsx`, `src/app/components/NutritionPanel.tsx`
- Modify: `src/app/components/verdict.tsx`, `src/app/components/ProductDetailScreen.tsx`

**Interfaces:** Consumes `Product.off` and `nutriScoreText`/`novaText` (Task 3), and `ACRYLAMIDE`/`acrylamideMatch`
(Task 4).

- [ ] **Step 1: OFF-aware verdict.** In `verdict.tsx` replace
  `return analyzeIngredients({ ingredients: p.ingredients, category: p.category });`
  with
  ```ts
  // OFF products have no catalog category (all OFF products are food) and bring their additive codes.
  return analyzeIngredients({ ingredients: p.ingredients, category: p.off ? undefined : p.category, additiveCodes: p.off?.additiveCodes });
  ```

- [ ] **Step 2: Create `src/app/components/CookingNote.tsx`:**
  ```tsx
  // CookingNote.tsx — "Formed during cooking" note (acrylamide). Informational: it never changes the verdict.
  import { useState } from "react";
  import { ChevronDown, ExternalLink, Flame } from "lucide-react";
  import type { Product } from "../../lib/productImporter";
  import { ACRYLAMIDE, acrylamideMatch } from "../../lib/safety/process";

  export default function CookingNote({ product }: { product: Product }) {
    const [open, setOpen] = useState(false);
    if (!acrylamideMatch(product)) return null;
    return (
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
          <Flame size={16} className="flex-shrink-0 mt-0.5 text-gray-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Formed during cooking: acrylamide</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-snug">{ACRYLAMIDE.summary} {ACRYLAMIDE.concern}</p>
          </div>
          <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-3 ml-7 space-y-2">
            <p className="text-[11px] text-gray-600 bg-gray-50 rounded-xl p-2.5 leading-snug">
              <strong>Regulator context:</strong> {ACRYLAMIDE.context}
            </p>
            {ACRYLAMIDE.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-[11px] leading-snug text-primary">
                <span className="font-bold">{s.body}:</span> {s.finding} <ExternalLink size={9} className="inline" />
                <span className="block text-[9px] text-gray-400">Source checked {s.checkedOn}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Create `src/app/components/NutritionPanel.tsx`:**
  ```tsx
  // NutritionPanel.tsx — Open Food Facts' Nutri-Score letter and NOVA group, shown apart from the additive check.
  // Only for products looked up on OFF: catalog barcodes aren't verified to be the same product (spec D8, K-29).
  import { Apple, ExternalLink } from "lucide-react";
  import type { Product } from "../../lib/productImporter";
  import { novaText, nutriScoreText } from "../../lib/off";

  export default function NutritionPanel({ product }: { product: Product }) {
    const off = product.off;
    if (!off) return null;
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Apple size={15} className="text-primary" />
          <span className="font-bold text-sm">Nutrition</span>
        </div>
        <p className="text-xs text-gray-700"><strong>Nutri-Score:</strong> {nutriScoreText(off.nutriscore)}</p>
        <p className="text-xs text-gray-700 mt-1"><strong>Processing:</strong> {novaText(off.nova)}</p>
        <p className="text-[10px] text-gray-400 mt-3 leading-snug">
          Calculated by Open Food Facts (Nutri-Score 2023 method, not a US label). NOVA group estimated by Open Food
          Facts from ingredients; experimental.{" "}
          <a href={off.url} target="_blank" rel="noreferrer" className="text-primary">
            View on Open Food Facts <ExternalLink size={9} className="inline" />
          </a>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 4: Wire them into `ProductDetailScreen.tsx`.**
  - Imports, after the `./verdict` import:
    ```tsx
    import CookingNote from "./CookingNote";
    import NutritionPanel from "./NutritionPanel";
    ```
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
  - At the start of the scrollable body, directly after `<div className="px-4 py-4 space-y-3 pb-10">`, add:
    ```tsx
              {product.off && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-[11px] text-amber-900 leading-snug">
                  Product data from Open Food Facts (crowd-sourced, not official).{" "}
                  <a href={product.off.url} target="_blank" rel="noreferrer" className="font-bold underline">View on Open Food Facts</a>
                  {product.off.ingredientsLang !== "en" && (
                    <span className="block mt-1">
                      Ingredients are listed in {languageName(product.off.ingredientsLang)}; additive codes were checked, ingredient names may be missed.
                    </span>
                  )}
                  <span className="block mt-1 text-amber-800/70">Data © Open Food Facts contributors, ODbL.</span>
                </div>
              )}
    ```
  - Directly after the closing `)}` of the "Flagged ingredients" block, add `<CookingNote product={product} />`.
  - Directly after the "Full ingredient list" card's closing `</div>`, add `<NutritionPanel product={product} />`.

- [ ] **Step 5: Build and test.** Run: `npm run build` (expected: builds) and `npm test` (expected: 109 pass).

- [ ] **Step 6: Verify in the browser.** With the dev server running (`npm run dev -- --port 5173 --strictPort`, in
  the background), open http://localhost:5173 and click "Continue as Guest".
  - Search "lay", open Lay's. Expected:
    - a "Formed during cooking: acrylamide" card, and expanding it shows 5 sources with "Source checked" dates;
    - no nutrition section (D8);
    - the verdict is still green "No flagged additives".
  - Doritos has no cooking note. Tide has neither card. Gerber Puffs is analyzed ("No flagged additives", not
    "Food only") and has the cooking note.
  - The console has no errors.
  - (OFF products are checked end to end in Task 6.)

- [ ] **Step 7: Commit.**
  ```bash
  git add src/app/components/verdict.tsx src/app/components/CookingNote.tsx src/app/components/NutritionPanel.tsx src/app/components/ProductDetailScreen.tsx
  git commit -m "Product page: cooking note, nutrition section, Open Food Facts source note

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 6: Scan flow looks up Open Food Facts

**Files:** Modify `src/lib/scanService.ts`, `src/app/components/ScanTab.tsx` (replace whole file), `src/app/App.tsx`.

**Interfaces:** Consumes `fetchOffProduct`, `normalizeBarcode`, `sameBarcode` (Task 3). `onScanResult(product)` now
also receives OFF products (negative id, `off` set).

- [ ] **Step 1: Barcode matching.** In `src/lib/scanService.ts`:
  - Add `import { sameBarcode } from "./off";` after the Product import.
  - Replace the whole `findProductByBarcode` function with:
    ```ts
    /** Look up a barcode in the catalog: same digits, ignoring spaces, dashes and leading zeros (12- vs 13-digit forms). */
    export function findProductByBarcode(barcode: string, products: Product[]): Product | null {
      return products.find((p) => sameBarcode(p.barcode, barcode)) ?? null;
    }
    ```
  - In the header comment, replace
    `//   3. Unrecognised barcodes are recorded with product_id = null, which makes`
    `//      them the review queue for growing the catalog.`
    with
    `//   3. Barcodes not in the catalog (found on Open Food Facts or not at all) are`
    `//      recorded with product_id = null.`

- [ ] **Step 2: Replace `src/app/components/ScanTab.tsx` entirely with:**
  ```tsx
  // ─────────────────────────────────────────────────────────────────────────────
  // ScanTab.tsx — barcode scan pipeline
  //
  //   1. The user taps "Scan" (demo barcode) or types a barcode.
  //   2. Look up our catalog, then Open Food Facts (lib/off.ts).
  //      • Catalog product      → scan recorded with its id, product page opens.
  //      • Open Food Facts find → scan recorded as an unknown barcode (no catalog id), product page opens.
  //      • Found nowhere        → scan recorded, honest "not found" screen.
  //      • Lookup failed        → "Couldn't reach Open Food Facts" with retry; nothing recorded.
  //
  // There is no camera yet (M4): the "Demo" panel picks which barcode to simulate.
  // ─────────────────────────────────────────────────────────────────────────────

  import { useState, useCallback } from "react";
  import { CheckCircle, QrCode, ChevronUp, ChevronDown, MapPin, Clock, Database, X, WifiOff, ExternalLink } from "lucide-react";
  import type { Product } from "../../lib/productImporter";
  import { fetchOffProduct, normalizeBarcode } from "../../lib/off";
  import { findProductByBarcode, recordProductScan, createPlaceholder, getCurrentLocation, type ScanEvent } from "../../lib/scanService";

  interface DemoBarcode { barcode: string; label: string; category: string }

  const DEMO_BARCODES: DemoBarcode[] = [
    { barcode: "028400315035",  label: "Lay's Classic Chips",        category: "Snacks"          },
    { barcode: "049000006421",  label: "Diet Coke 12-Pack",          category: "Beverages"       },
    { barcode: "049000028905",  label: "Coca-Cola Classic 12-Pack",  category: "Beverages"       },
    { barcode: "028400064057",  label: "Doritos Nacho Cheese",       category: "Snacks"          },
    { barcode: "044000030438",  label: "Oreo Original Cookies",      category: "Snacks"          },
    { barcode: "016000280939",  label: "Nature Valley Granola Bars", category: "Snacks"          },
    { barcode: "070847011443",  label: "Monster Energy Original",    category: "Beverages"       },
    { barcode: "044700032085",  label: "Oscar Mayer Hot Dogs",       category: "Meat"            },
    { barcode: "017800185165",  label: "Purina ONE Dog Food",        category: "Pet Food"        },
    { barcode: "742365003009",  label: "Horizon Organic Milk",       category: "Dairy"           },
    { barcode: "041500058069",  label: "French's Yellow Mustard",    category: "Condiments"      },
    { barcode: "732913222019",  label: "Seventh Generation Laundry", category: "Cleaning"        },
    { barcode: "037000869870",  label: "Tide PODS 42ct",             category: "Cleaning"        },
    { barcode: "300450449989",  label: "Tylenol Extra Strength",     category: "Medicine"        },
    { barcode: "3017620422003", label: "Nutella",                    category: "Open Food Facts" },
    { barcode: "049000042566",  label: "Coca-Cola Zero Sugar",       category: "Open Food Facts" },
    { barcode: "012000161155",  label: "Life Wtr",                   category: "Open Food Facts" },
    { barcode: "3017620429996", label: "Unlisted product",           category: "Not found"       },
  ];

  type ScanState = "idle" | "scanning" | "found" | "not_found" | "error";

  interface ScanTabProps {
    /** Called with the product (catalog or Open Food Facts) so App.tsx can open the product page. */
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
        const off = await fetchOffProduct(barcode);
        if (off.status === "error") { setScanState("error"); return; }
        if (off.status === "found") product = off.product;
      }
      const location = await locationPromise;

      if (product) {
        setScanState("found");
        // Only catalog products have a database id; Open Food Facts finds are logged as unknown barcodes.
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
    const typedValid  = typedCode.length >= 8 && typedCode.length <= 14;
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
            <h2 className="text-2xl font-extrabold text-white mb-2">Not in our catalog or Open Food Facts yet</h2>
            <p className="text-white/60 text-sm mb-3 leading-relaxed max-w-xs">
              You can add it to Open Food Facts, the free product database we use, so everyone can see its ingredients.
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
              : scanState === "error" ? "Couldn't reach Open Food Facts. Check your connection and try again."
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

          <button onClick={() => (scanState === "error" ? handleScan(scannedCode, false) : handleScan(selectedBarcode.barcode, true))}
            disabled={busy}
            className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl transition-all disabled:opacity-50"
            style={{ background: scanBgColor }}>
            {scanState === "error" ? "Try again" : scanState === "scanning" ? "Looking up…" : scanState === "found" ? "✓ Product Found" : "📷 Tap to Scan"}
          </button>

          <p className="text-center text-white/25 text-[10px]">
            {DEMO_BARCODES.length} demo barcodes · {products.length} catalog products · others looked up on Open Food Facts
          </p>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Session list in `App.tsx`.**
  - After `const [scannedIds, setScannedIds] = useState<number[]>([2, 6]);` add:
    ```tsx
    // Products found on Open Food Facts this session (not in the catalog; negative ids).
    const [offProducts, setOffProducts] = useState<Product[]>([]);
    ```
  - Replace
    `onScanResult={(p) => { setScannedIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]); openProduct(p); }}`
    with
    ```tsx
    onScanResult={(p) => {
      if (p.off) setOffProducts(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p]);
      setScannedIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
      openProduct(p);
    }}
    ```
  - Replace
    `<SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct={openProduct} products={products} />`
    with
    `<SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct={openProduct} products={[...products, ...offProducts]} />`

- [ ] **Step 4: Build and test.** Run: `npm run build` (expected: builds) and `npm test` (expected: 109 pass).

- [ ] **Step 5: Verify in the browser** (dev server, "Continue as Guest", Scan tab). Each check uses at most one new OFF
  request (rate limit):
  - **Nutella** (demo) opens a product page with:
    - the amber "Product data from Open Food Facts (crowd-sourced, not official)" note, with no language note (English
      ingredients were available);
    - English ingredients starting "Sugar, vegetable fat (palm)…";
    - verdict "No flagged additives";
    - Nutrition "Nutri-Score: E, lower nutritional quality" and "Processing: NOVA 4, ultra-processed foods";
    - no cooking note (spreads aren't listed), no prices, no alternatives.
  - **Coca-Cola Zero Sugar** (demo) is amber "1 ingredient of some concern" (aspartame) with Nutri-Score C.
  - **Unlisted product** (demo) shows "Not in our catalog or Open Food Facts yet" with the barcode and the
    openfoodfacts.org link. There's no "saved for review" text.
  - **Typed barcodes:**
    - "3017620422003" opens Nutella with no new network request (cache).
    - " 0 28400-315035 " (spaces and a dash) opens the catalog Lay's page.
  - **Saved › Scanned** lists Nutella and Coke Zero once each, even after scanning Nutella twice.
  - **Forced failure (Review Focus 2):** in the browser console run
    `window.__f = window.fetch; window.fetch = () => Promise.reject(new TypeError("offline"))`, then type
    `012000161155` and Look up. Expected: the error state "Couldn't reach Open Food Facts…" with "Try again". Then
    run `window.fetch = window.__f` and tap Try again → Life Wtr loads ("No flagged additives", Nutri-Score B, NOVA 1).
    This also proves errors weren't cached.
  - The console has no errors apart from the forced one.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/scanService.ts src/app/components/ScanTab.tsx src/app/App.tsx
  git commit -m "Scan: look up Open Food Facts when the catalog misses

  Honest not-found screen (replaces the false 'saved for review' text),
  lookup-error state with retry, real demo barcodes, a type-a-barcode field,
  and OFF products in Saved › Scanned. Barcodes match across 12/13 digits.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

---

### Task 7: Docs

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec.

- [ ] **Step 1: `KNOWN_ISSUES.md`.**
  - Roadmap step 4: mark "✅ done 2026-09-28" with the commit range. Summary: OFF lookup, additive codes, the
    acrylamide cooking note, nutrition for OFF products, the Baby Food category, and the honest not-found screen.
  - Add a Medium row: `| K-29 ✔ | Featured-catalog barcodes are not the real products: on Open Food Facts, Doritos' barcode (028400064057) is Tostitos and Oreo's (044000030438) is Wheat Thins; Lay's, Special K, Wonder bread and Gerber aren't on OFF. Scanning a real Tostitos bag opens Doritos. Nutrition is therefore shown only for OFF lookups (spec D8). Fix: check each catalog barcode against OFF and correct or blank it. | products.csv, DB |`
  - Mark K-13 ("always says saved for review") fixed in Task 6's commit.
  - Pre-launch list ("Before going public"): add "email nutriscore@santepubliquefrance.fr for Nutri-Score use" and "put
    the public repo URL in OFF's X-User-Agent".
- [ ] **Step 2: `ARCHITECTURE.md`.**
  - File map rows: `src/lib/off.ts` (OFF client; pure mapper plus session cache; import-free for tests),
    `src/lib/safety/process.ts` (acrylamide note), `CookingNote.tsx`, `NutritionPanel.tsx` and
    `src/lib/fixtures/off/*.json` (recorded OFF responses).
  - Data map: a row "OFF products: fetched live per session, never stored; crowd-sourced".
  - Feature inventory: OFF lookup, cooking note and nutrition are working.
  - Scripts: `npm test` covers `src/lib/**`.
- [ ] **Step 3: `PROJECT_HANDOFF.md` and `SYNOPSIS.md`.**
  - Phase line: "M2 (Open Food Facts) done; next is M3 (deploy + public repo)".
  - SYNOPSIS: mark step 4 done, and change the next-session prompt to start M3.
- [ ] **Step 4: Spec.** Status line → `implemented (<first>…<last> commits)`.
- [ ] **Step 5: Run and commit.** `npm test` passes, then:
  ```bash
  git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-09-28-m2-open-food-facts-design.md
  git commit -m "Docs: M2 done (Open Food Facts, cooking note, nutrition); K-29 catalog barcodes

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

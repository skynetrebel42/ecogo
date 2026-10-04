# M5 Nutrition, Softer Processed-Meat Rule, Real Barcodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Product pages show added sugar, saturated fat and sodium as FDA %DV per serving, with High/Low per FDA's 5/20 rule,
  and list cards show one "High …" chip.
- Products that only contain processed meat read High concern.
- Every food catalog product carries a USDA-verified barcode with its real label, or no barcode.

**Architecture:**
- A pure `nutrition.ts` maps USDA search records (per 100 g × serving size) and Open Food Facts `nutriments`.
- `lookup.ts` attaches `Product.nutrition` and remembers it per session, so cards can show chips without requests.
- The product page fetches nutrition for catalog products through their now-verified barcode.
- Catalog data changes come from one owner-approved JSON file, applied to the CSV by a reusable script that also
  prints the migration.

**Tech Stack:** React 18 + Vite 6, Tailwind 4, lucide-react, Node `node --test` (128 tests now, 139 after), and the
Supabase MCP for one data migration.

**Spec:** `docs/superpowers/specs/2026-10-01-m5-nutrition-barcodes-design.md`. Read it first. The mockup the owner
chose (layout B + C) is at https://claude.ai/artifact/3tZQE5dWyfQFkfiu5dEjNB.

**How this plan was checked:** every code block below was applied to a scratch copy of `main` (`f123eea`) on
2026-10-01. The suite passed 139/139 and `vite build` succeeded. In a dev server, using the updated CSV and live USDA
lookups:
- Oreo's page showed Nutrition "3 cookies (34 g) · Added sugar 14 g · 28% DV · High", saturated fat 10% and sodium
  6%, with a "High in added sugar" hero chip;
- after opening Oreo, its snacks card showed "High sugar";
- DiGiorno read "High concern · Contains processed meat: Pepperoni", with saturated fat 25% and sodium 33%, both High.

**Assets** (owner-approved data and recorded responses, committed with this plan) are in
`docs/superpowers/plans/2026-10-01-m5-assets/`:
- `verified-barcodes.json`: 31 verified products and 3 removed;
- `fixtures/usda/*-nutrition-*.json` (3 files) and `fixtures/off/nutella-nutrition-3017620422003.json`.

## Global Constraints

- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Line endings:** repo files have CRLF. Use one-line `old_string`s or the exact blocks below; if a multi-line match
  fails, edit line by line.
- **Dependencies:** add none.
- **Facts first:**
  - The Daily Values are added sugars 50 g, saturated fat 20 g and sodium 2,300 mg.
  - The FDA rule is quoted verbatim (`FDA_RULE.quote`).
  - A missing nutrient is "not listed", never Low.
  - Without a serving size there's no %DV and no High/Low.
- **Separate signal:** nutrition never changes the concern badge or its sort. Its colours are slate only, never red or
  green, and levels are written out ("High"/"Low").
- **Rate limit:** list cards never trigger lookups. Only the product page does, once per product per session (cached).
- **Migrations:** never edit applied ones. Apply new ones with the Supabase MCP `apply_migration` on
  `gippyavmxxzqxjkuahpt`, then run `get_advisors`. The owner approved Task 3's barcode table (2026-10-01), so approving
  this plan approves that live change.
- **Commits:** commit per task on `main`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Ask the owner before any push: it redeploys the live site.
- **Suite:** `npm test` and `npm run build` stay green after every task.

## Review Focus

1. **Missing nutrients** (Lay's has no added-sugar value) must read "not listed", never "Low" or 0%. Pinned by Task 2's
   Lay's test.
2. **Rate limit:** a search list must never fire lookups, and re-opening a product must hit the session cache. Pinned
   by Task 2's `knownNutrition` test and Task 4 Step 5's network check.
3. **Wrong-product scans:** no food catalog barcode may be unverified. Pinned by Task 3's `verified-barcodes.test.ts`.
4. **5/20 boundaries:** exactly 20% is High, exactly 5% is Low, and rounding follows the printed label. Pinned by
   Task 2's boundary test.
5. **Serving text:** "1/6 pizza (130g)" must not become "1/6 pizza (130g) (130 g)". Pinned by Task 2's serving test.

---

## File structure

| File | Change |
|---|---|
| `src/lib/safety/foodConcerns.ts` (+ test, `assess.test.ts`) | "Contains processed meat" → severity `high` |
| `src/lib/nutrition.ts` (new) + `nutrition.test.ts` (new) | `usdaNutrition`, `offNutrition`, `nutrient`, `topHigh`, `DAILY_VALUE`, `FDA_RULE` |
| `src/lib/fixtures/usda/*-nutrition-*.json`, `src/lib/fixtures/off/nutella-nutrition-…json` (new) | Recorded responses |
| `src/lib/productImporter.ts` | `Product.nutrition?` |
| `src/lib/lookup.ts` (+ test) | Attaches nutrition; `knownNutrition(barcode)`; OFF fields add `nutriments,serving_size` |
| `src/data/verified-barcodes.json` (new), `scripts/apply-verified-barcodes.mjs` (new) | Approved catalog data and its applier |
| `src/data/products.csv`, `supabase/migrations/<version>_real_catalog_barcodes.sql` (new) | Real barcodes, names, labels |
| `src/lib/safety/fixtures/expected-flags.json`, `src/lib/safety/verified-barcodes.test.ts` (new) | Reviewed flags; K-29 guard |
| `src/app/components/NutritionPanel.tsx` (new), `ProductDetailScreen.tsx`, `src/app/App.tsx`, `ScanTab.tsx` | UI |

---

### Task 1: Products that only contain processed meat read High

**Files:** Modify `src/lib/safety/foodConcerns.ts`, `src/lib/safety/foodConcerns.test.ts`, `src/lib/safety/assess.test.ts`.

**Interfaces:** `processed-meat` concerns keep `severity: "known"` for "Processed meat: …" and USDA-category reasons.
"Contains processed meat: …" reasons get `severity: "high"` and an extra context sentence.

- [ ] **Step 1: Write the failing test.** Append to `foodConcerns.test.ts`:
```ts
// M5 decision N6: being processed meat is Known; only containing some is High.
test("processed meat: products that ARE it read known; products that only contain it read high", () => {
  const level = (p: Partial<FoodInput>) => foodConcerns({ name: "", category: "Meat", ingredients: "", ...p }).find(c => c.id === "processed-meat")?.severity ?? null;
  assert.equal(level({ name: "Classic Beef Hot Dogs", ingredients: "Beef, water, salt" }), "known");
  assert.equal(level({ name: "Pepperoni Pizza", category: "Frozen", ingredients: "Flour, water, pepperoni (pork, beef, salt)" }), "high");
  assert.equal(level({ name: "Baked Beans", category: "Condiments", ingredients: "Beans, water, sugar, bacon (pork, salt, sodium nitrite)" }), "high");
  assert.equal(level({ name: "Classic Beef Links", category: "", ingredients: "BEEF, WATER, SALT", source: { foodCategory: "Sausages, Hotdogs & Brats" } }), "known");
  const digiorno = foodConcerns(catalog.find(p => p.id === 42)!).find(c => c.id === "processed-meat")!;
  assert.equal(digiorno.severity, "high");
  assert.match(digiorno.context, /much smaller than IARC's 50 g daily portion/);
  for (const id of [6, 36, 38]) assert.equal(foodConcerns(catalog.find(p => p.id === id)!).find(c => c.id === "processed-meat")?.severity, "known", `#${id}`);
});
```
  In `assess.test.ts`:
  - rename the first test to `"catalog: only the three products that ARE processed meat change level (to known); DiGiorno (contains it) stays high; acrylamide changes nothing"`;
  - change its expected list to `[[6, "known"], [36, "known"], [38, "known"]]`. DiGiorno's additive verdict is already
    `high`, so it no longer changes.

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. DiGiorno's severity is `known`.

- [ ] **Step 3: Implement** in `foodConcerns.ts`, inside `processedMeat`:
  - Replace the line
    `if (inName) return { ...PROCESSED_MEAT, reason: \`${DISH.test(p.name) ? "Contains processed meat" : "Processed meat"}: ${inName[1]}\` };`
    with
    `if (inName) return DISH.test(p.name) ? containsProcessedMeat(inName[1]) : { ...PROCESSED_MEAT, reason: \`Processed meat: ${inName[1]}\` };`
  - Replace `if (m) return { ...PROCESSED_MEAT, reason: \`Contains processed meat: ${m[1]}\` };` with
    `if (m) return containsProcessedMeat(m[1]);`
  - After the closing `}` of `processedMeat`, add:
```ts
/** A product that only CONTAINS processed meat reads High, not Known (owner decision N6, M5 spec §4.4). */
function containsProcessedMeat(word: string): FoodConcern {
  return {
    ...PROCESSED_MEAT, severity: "high", reason: `Contains processed meat: ${word}`,
    context: `${PROCESSED_MEAT.context} The amount here is likely much smaller than IARC's 50 g daily portion.`,
  };
}
```

- [ ] **Step 4: Run.** Run: `npm test`. Expected: 129 pass, 0 fail.

- [ ] **Step 5: Commit.**
```bash
git add src/lib/safety/foodConcerns.ts src/lib/safety/foodConcerns.test.ts src/lib/safety/assess.test.ts
git commit -m "Processed meat: products that only contain it read High, not Known

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Nutrition data (`nutrition.ts`) and the lookup

**Files:**
- Create: `src/lib/nutrition.ts`, `src/lib/nutrition.test.ts`, and the 4 fixtures, copied from the assets folder.
- Modify: `src/lib/productImporter.ts`, `src/lib/lookup.ts`, `src/lib/lookup.test.ts`.

**Interfaces:**
- Produces:
  - `Nutrition { serving; perServing; nutrients: NutrientValue[]; source }`
  - `NutrientValue { id; label; short; amount; unit; dv; level }`
  - `usdaNutrition(food: unknown): Nutrition | null`, `offNutrition(product: unknown): Nutrition | null`
  - `nutrient(id, amount, perServing)`, `topHigh(n)`
  - `DAILY_VALUE`, `FDA_RULE`
  - `Product.nutrition?: Nutrition`
  - `knownNutrition(barcode: string): Nutrition | null` (lookup.ts)

- [ ] **Step 1: Copy the fixtures.**
```bash
cp docs/superpowers/plans/2026-10-01-m5-assets/fixtures/usda/*.json src/lib/fixtures/usda/
cp docs/superpowers/plans/2026-10-01-m5-assets/fixtures/off/*.json src/lib/fixtures/off/
```
  These are real responses recorded 2026-10-01, trimmed to the fields used. Oreo is 3 cookies (34 g) with added sugar
  41.2 g per 100 g; Lay's has no added-sugar row; Coke Zero is 355 ml; Nutella (OFF) has per-100 g values only.

- [ ] **Step 2: Write the failing tests:** create `src/lib/nutrition.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usdaNutrition, offNutrition, nutrient, topHigh, DAILY_VALUE } from "./nutrition.ts";

const usda = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/usda/${name}.json`, import.meta.url), "utf8")).foods[0];
const off = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/off/${name}.json`, import.meta.url), "utf8")).body.product;
const row = (n: ReturnType<typeof usdaNutrition>, id: string) => n!.nutrients.find(x => x.id === id)!;

test("Oreo (USDA): 3 cookies hold 14 g added sugar, 28% DV, High; matches the printed label", () => {
  const n = usdaNutrition(usda("oreo-nutrition-044000032029"))!;
  assert.equal(n.serving, "3 cookies (34 g)");
  assert.equal(n.perServing, true);
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [14, 28, "high"]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv, row(n, "satFat").level], [2, 10, null]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv, row(n, "sodium").level], [130, 6, null]);
  assert.equal(topHigh(n)?.short, "High sugar");
});

test("Lay's (USDA): added sugar is not listed (never 'Low'); nothing High", () => {
  const n = usdaNutrition(usda("lays-nutrition-028400199148"))!;
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [null, null, null]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv], [1.5, 8]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv], [170, 7]);
  assert.equal(topHigh(n), null);
});

test("Coke Zero (USDA, ml serving): all Low", () => {
  const n = usdaNutrition(usda("coke-zero-nutrition-00049000042566"))!;
  assert.equal(n.serving, "1 Can (355 ml)");
  assert.deepEqual(n.nutrients.map(x => x.level), ["low", "low", "low"]);
  assert.equal(row(n, "sodium").amount, 39);
});

test("FDA 5/20 boundaries, classified on the rounded %DV as a label shows it", () => {
  assert.equal(nutrient("satFat", 1, true).level, "low");    // 5%
  assert.equal(nutrient("satFat", 1.1, true).level, null);   // 6% (rounded 1.1 g = 5.5% → 6)
  assert.equal(nutrient("satFat", 3.9, true).level, "high"); // 19.5% → 20
  assert.equal(nutrient("addedSugar", 10, true).level, "high"); // exactly 20%
  assert.equal(nutrient("sodium", 2300, true).dv, 100);
  assert.deepEqual(DAILY_VALUE, { addedSugar: 50, satFat: 20, sodium: 2300 });
});

test("no serving size: per 100 g values, no %DV and no High/Low", () => {
  const n = usdaNutrition({ foodNutrients: [{ nutrientName: "Sugars, added", unitName: "G", value: 41.2 }] })!;
  assert.equal(n.perServing, false);
  assert.equal(n.serving, "100 g");
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [41.2, null, null]);
  assert.equal(usdaNutrition({ foodNutrients: [] }), null);
  assert.equal(usdaNutrition(null), null);
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

test("a household serving that already names its weight isn't repeated", () => {
  const n = usdaNutrition({ householdServingFullText: "1/6 pizza (130g)", servingSize: 130, servingSizeUnit: "GRM",
    foodNutrients: [{ nutrientName: "Sodium, Na", unitName: "MG", value: 577 }] })!;
  assert.equal(n.serving, "1/6 pizza (130g)");
  assert.equal(row(n, "sodium").amount, 750);
});
```

- [ ] **Step 3: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/nutrition.ts`.

- [ ] **Step 4: Implement:** create `src/lib/nutrition.ts`:
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

/** One nutrient: amount rounded like a label (g to 0.1, mg whole), %DV rounded, then FDA's 5/20 rule. */
export function nutrient(id: NutrientId, amount: number | null, perServing: boolean): NutrientValue {
  const { label, short, unit } = META[id];
  const rounded = amount === null ? null : unit === "mg" ? Math.round(amount) : Math.round(amount * 10) / 10;
  const dv = rounded === null || !perServing ? null : Math.round((rounded / DAILY_VALUE[id]) * 100);
  const level = dv === null ? null : dv >= 20 ? "high" : dv <= 5 ? "low" : null;
  return { id, label, short, amount: rounded, unit, dv, level };
}

const USDA_NAMES: Record<string, NutrientId> = { "Sugars, added": "addedSugar", "Fatty acids, total saturated": "satFat", "Sodium, Na": "sodium" };
const UNIT: Record<string, string> = { GRM: "g", G: "g", MLT: "ml", ML: "ml" };

/** From a USDA /foods/search record: `foodNutrients` are per 100 g/ml; scale by `servingSize`. */
export function usdaNutrition(food: unknown): Nutrition | null {
  const f = record(food);
  const per100: Partial<Record<NutrientId, number>> = {};
  for (const n of Array.isArray(f.foodNutrients) ? f.foodNutrients.map(record) : []) {
    const id = USDA_NAMES[String(n.nutrientName)];
    const v = num(n.value);
    if (id && v !== null) per100[id] = v;
  }
  if (Object.keys(per100).length === 0) return null;
  const size = num(f.servingSize);
  const unit = UNIT[String(f.servingSizeUnit ?? "").toUpperCase()];
  const perServing = size !== null && size > 0 && unit !== undefined;
  const factor = perServing ? size! / 100 : 1;
  const household = typeof f.householdServingFullText === "string" ? f.householdServingFullText.trim() : "";
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

- [ ] **Step 5: Wire it into the lookup.**
  - In `src/lib/productImporter.ts`, after `  source?: ProductSource;` in `interface Product`, add:
    `  nutrition?: import("./nutrition.ts").Nutrition; // per serving, for looked-up products (catalog: fetched by barcode)`
  - In `src/lib/lookup.ts`:
    - after the `import type { Product, ProductSource }` line, add
      `import { usdaNutrition, offNutrition, type Nutrition } from "./nutrition.ts";`
    - append `,nutriments,serving_size` to the `OFF_FIELDS` string;
    - in `pickUsdaFood`, change `return toProduct(str(f.gtinUpc), …` to `const product = toProduct(str(f.gtinUpc), …`
      (the same arguments). After its closing `});` add:
```ts
  const nutrition = usdaNutrition(f);
  return nutrition ? { ...product, nutrition } : product;
```
    - in `mapOffResponse`, replace the final `return { status: "found", product: toProduct(…) };` block with:
```ts
  const product = toProduct(code, name, str(p.brands).split(",")[0].trim(), ingredients, {
    name: "Open Food Facts", url: `https://world.openfoodfacts.org/product/${code}`, crowdSourced: true,
    ingredientsLang: english ? "en" : str(p.lang) || "en", additiveCodes: strings(p.additives_tags), categoryTags: strings(p.categories_tags),
  });
  const nutrition = offNutrition(p);
  return { status: "found", product: nutrition ? { ...product, nutrition } : product };
```
    - after `const cache = new Map<string, Promise<LookupResult>>();` add:
```ts
const nutritionSeen = new Map<string, Nutrition>();

/** Nutrition already fetched this session for a barcode (sync, for list cards); no request is made. */
export const knownNutrition = (barcode: string): Nutrition | null => (barcode ? nutritionSeen.get(key(barcode)) ?? null : null);
```
    - in `lookupBarcode`, replace `pending.then(r => { if (r.status === "error" || provisional) cache.delete(k); });` with:
```ts
  pending.then(r => {
    if (r.status === "error" || provisional) cache.delete(k);
    if (r.status === "found" && r.product.nutrition) nutritionSeen.set(k, r.product.nutrition);
  });
```
  - In `src/lib/lookup.test.ts`:
    - change the import's start to `import { knownNutrition, lookupBarcode, ` (keeping the rest);
    - append:
```ts
test("a USDA find carries its nutrition, and list cards can read it afterwards without a request", async () => {
  const net = fakeNet({ "044000032029": fixture("usda/oreo-nutrition-044000032029") }, {});
  assert.equal(knownNutrition("044000032029"), null);
  const r = await lookupBarcode("044000032029", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(r.status === "found" && r.product.nutrition?.serving, "3 cookies (34 g)");
  await new Promise(resolve => setTimeout(resolve, 0)); // the cache bookkeeping runs after the promise settles
  assert.equal(knownNutrition("0 44000-032029")?.nutrients[0].dv, 28);
  assert.equal(knownNutrition(""), null);
});
```

- [ ] **Step 6: Run.** Run: `npm test`. Expected: 137 pass, 0 fail.

- [ ] **Step 7: Commit.**
```bash
git add src/lib/nutrition.ts src/lib/nutrition.test.ts src/lib/fixtures src/lib/productImporter.ts src/lib/lookup.ts src/lib/lookup.test.ts
git commit -m "Nutrition: FDA %DV per serving (added sugar, sat fat, sodium) from USDA and OFF

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Real catalog barcodes and labels (K-29)

The owner approved this table on 2026-10-01: 31 food products matched to a USDA record (same brand, product and
flavour; closest pack size; newest record), and 3 removed (#3 KIND variety, #4 Gatorade 12-pack, #44 Ben & Jerry's).
Names and ingredients come from the record. The engine on the real labels changes exactly three products:

| # | Before (Figma text) | After (real label) |
|---|---|---|
| 6 | high: sodium nitrite | none: "uncured", cultured celery juice instead (still Known as processed meat) |
| 38 | some: BHA | none: the real label has no BHA |
| 42 | high: sodium nitrite | high: sodium nitrite + BHA (the real pepperoni has BHA) |

**Files:**
- Create: `src/data/verified-barcodes.json` (copied from assets), `scripts/apply-verified-barcodes.mjs`,
  `src/lib/safety/verified-barcodes.test.ts`, `supabase/migrations/<version>_real_catalog_barcodes.sql`.
- Modify: `src/data/products.csv` (by the script), `src/lib/safety/fixtures/expected-flags.json`,
  `src/lib/safety/foodConcerns.test.ts`, `src/app/components/ScanTab.tsx`.

- [ ] **Step 1: Write the failing test.**
  - Copy `docs/superpowers/plans/2026-10-01-m5-assets/verified-barcodes.json` to `src/data/verified-barcodes.json`.
  - Create `src/lib/safety/verified-barcodes.test.ts`:
```ts
// K-29: the Figma export invented the catalog barcodes. A food product may only carry a barcode verified against USDA
// FoodData Central (src/data/verified-barcodes.json, approved by the owner 2026-10-01), so a scan never opens the wrong
// product, and its name and ingredients are that record's real label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseProductsCSV } from "../productImporter.ts";
import { FOOD_CATEGORIES } from "./analyze.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const data = JSON.parse(readFileSync(new URL("../../data/verified-barcodes.json", import.meta.url), "utf8")) as {
  verified: { id: number; barcode: string; fdcId: number; name: string; ingredients: string }[];
  removed: { id: number; reason: string }[];
};

test("every food catalog product has a verified barcode or none", () => {
  const verified = new Map(data.verified.map(v => [v.id, v]));
  for (const p of catalog.filter(p => FOOD_CATEGORIES.has(p.category))) {
    if (p.barcode === "") continue;
    assert.equal(p.barcode, verified.get(p.id)?.barcode, `#${p.id} ${p.name}: barcode ${p.barcode} is not verified`);
  }
});

test("verified products carry their USDA record's name and full label; removed ones have no barcode", () => {
  for (const v of data.verified) {
    const p = catalog.find(c => c.id === v.id);
    assert.ok(p, `#${v.id} exists`);
    assert.equal(p!.name, v.name, `#${v.id} name`);
    assert.equal(p!.ingredients, v.ingredients, `#${v.id} ingredients`);
    assert.match(v.barcode, /^\d{8,14}$/);
    assert.ok(Number.isInteger(v.fdcId), `#${v.id} fdcId`);
  }
  for (const r of data.removed) assert.equal(catalog.find(c => c.id === r.id)?.barcode, "", `#${r.id} barcode removed`);
  assert.equal(new Set(data.verified.map(v => v.barcode)).size, data.verified.length, "barcodes are unique");
});
```

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. The invented barcodes and names aren't verified.

- [ ] **Step 3: The applier:** create `scripts/apply-verified-barcodes.mjs`:
```js
// Applies src/data/verified-barcodes.json to src/data/products.csv (barcode, name, ingredients; removed → empty
// barcode) and prints the matching SQL migration. Usage: node scripts/apply-verified-barcodes.mjs > migration.sql
// Rerun whenever the JSON changes; the DB change itself goes through a new migration (never edit applied ones).
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("src/data/verified-barcodes.json", root), "utf8"));
const csvPath = new URL("src/data/products.csv", root);
const text = readFileSync(csvPath, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";

/** Split one CSV line into fields, keeping quoted commas; "" is an escaped quote. */
function split(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const quote = (v) => (/[",\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v);
const quoteAlways = (v) => `"${v.replace(/"/g, '""')}"`;

const lines = text.split(/\r?\n/);
const header = split(lines[0]);
const col = (name) => { const i = header.indexOf(name); if (i < 0) throw new Error(`no column ${name}`); return i; };
const [ID, BARCODE, NAME, INGREDIENTS] = ["id", "barcode", "product_name", "ingredients"].map(col);
const byId = new Map(data.verified.map((v) => [String(v.id), v]));
const removed = new Set(data.removed.map((r) => String(r.id)));
let touched = 0;
const outLines = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const f = split(line);
  const v = byId.get(f[ID]);
  if (!v && !removed.has(f[ID])) return line;
  touched++;
  if (v) { f[BARCODE] = v.barcode; f[NAME] = v.name; f[INGREDIENTS] = v.ingredients; } else f[BARCODE] = "";
  return f.map((x, j) => (j === NAME || j === INGREDIENTS ? quoteAlways(x) : quote(x))).join(",");
});
writeFileSync(csvPath, outLines.join(nl));
console.error(`products.csv: ${touched} rows updated`);

const sql = (s) => `'${s.replace(/'/g, "''")}'`;
console.log(`-- Real catalog barcodes (K-29). The Figma export invented them; each verified product now carries the barcode,`);
console.log(`-- name and full ingredient label of its USDA FoodData Central record (checked ${data.checkedOn}, approved by the`);
console.log(`-- owner). Products with no reliable match lose their barcode so a scan can never open the wrong product.`);
for (const v of data.verified) {
  console.log(`update public.products set barcode = ${sql(v.barcode)}, name = ${sql(v.name)}, ingredients = ${sql(v.ingredients)} where id = ${v.id}; -- fdcId ${v.fdcId}`);
}
console.log(`update public.products set barcode = null where id in (${data.removed.map((r) => r.id).join(", ")});`);
```
  Run: `node scripts/apply-verified-barcodes.mjs > "$SCRATCH/m5-barcodes.sql"` (`$SCRATCH` = the session scratchpad).
  Expected: `products.csv: 77 rows updated` on stderr, and a 35-line SQL file.

- [ ] **Step 4: Reviewed expectations.**
  - In `src/lib/safety/fixtures/expected-flags.json`, set exactly these three lines (each a one-line edit):
    - `"6": {"verdict": "none", "flags": []},`
    - `"38": {"verdict": "none", "flags": []},`
    - `"42": {"verdict": "high", "flags": ["sodium-nitrite", "bha"]},`
  - In `foodConcerns.test.ts`, replace `[6, "Processed meat: Hot Dogs"]` with `[6, "Processed meat: Franks"]`: the real
    name is "Oscar Mayer Classic Uncured Beef Franks 10ct".

- [ ] **Step 5: Run.** Run: `npm test`. Expected: 139 pass, 0 fail.

- [ ] **Step 6: Demo barcodes.** In `src/app/components/ScanTab.tsx`'s `DEMO_BARCODES`, replace these barcodes (and
  labels where shown), one line each:
  - `028400315035` → `028400199148`
  - `049000006421`, "Diet Coke 12-Pack" → `049000006582`, "Diet Coke 12 fl oz"
  - `049000028905`, "Coca-Cola Classic 12-Pack" → `049000006346`, "Coca-Cola 12 fl oz"
  - `016000280939` → `016000115828`
  - `070847011443` → `070847024446`
  - `044700032085`, "Oscar Mayer Hot Dogs" → `044700075050`, "Oscar Mayer Beef Franks"
  - `742365003009` → `742365228407`
  - `041500058069` → `041500000251`

  Non-food codes stay as they are.

- [ ] **Step 7: Apply to the live DB.**
  - Call `apply_migration` (project `gippyavmxxzqxjkuahpt`, name `real_catalog_barcodes`) with the contents of
    `$SCRATCH/m5-barcodes.sql`.
  - Call `list_migrations` and save the same SQL as `supabase/migrations/<version>_real_catalog_barcodes.sql`.
  - Verify with `execute_sql`:
    `select id, barcode, name, left(ingredients, 40) from products where id in (1, 3, 6, 14, 42, 44) order by id;`
    Expected:
    - 1 = `028400199148` "Lay's Classic Potato Chips 8oz";
    - 3 and 44 = null barcode;
    - 6 = `044700075050` "Oscar Mayer Classic Uncured Beef Franks 10ct", ingredients starting "BEEF, WATER";
    - 42 = `071921962395`.
  - Run `get_advisors` (security). Expected: nothing new.

- [ ] **Step 8: Commit.**
```bash
git add src/data/verified-barcodes.json scripts/apply-verified-barcodes.mjs src/data/products.csv src/lib/safety/verified-barcodes.test.ts src/lib/safety/fixtures/expected-flags.json src/lib/safety/foodConcerns.test.ts src/app/components/ScanTab.tsx supabase/migrations
git commit -m "Catalog: real USDA barcodes, names and labels for 31 foods; 3 unverifiable codes removed (K-29)

Real labels change three results: Oscar Mayer franks are uncured (no added
nitrite), Jimmy Dean has no BHA, DiGiorno's pepperoni has BHA. Migration
applied to the live DB; CSV generated from src/data/verified-barcodes.json.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nutrition on the page and the cards

**Files:** Create `src/app/components/NutritionPanel.tsx`. Modify `ProductDetailScreen.tsx` and `src/app/App.tsx`.

**Interfaces:** Consumes `knownNutrition`, `lookupBarcode` (lookup.ts), `topHigh`, `FDA_RULE`, `Nutrition`
(nutrition.ts), and `FOOD_CATEGORIES`. Produces `useNutrition(product): NutritionState`, `NutritionPanel`, and
`NutritionChip`.

- [ ] **Step 1: Create `src/app/components/NutritionPanel.tsx`:**
```tsx
// NutritionPanel.tsx — added sugar, saturated fat and sodium as FDA % Daily Value per serving (M5 spec §4.2, §4.3).
// A separate signal from the concern badge, in slate (never red or green); "High"/"Low" are always written out.

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { FOOD_CATEGORIES } from "../../lib/safety/analyze";
import { knownNutrition, lookupBarcode } from "../../lib/lookup";
import { FDA_RULE, type Nutrition } from "../../lib/nutrition";

export type NutritionState =
  | { status: "none" }                       // non-food, or a catalog product without a verified barcode
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; nutrition: Nutrition };

/** Looked-up products bring their nutrition; catalog food products fetch it once per session by their verified barcode. */
export function useNutrition(product: Product): NutritionState {
  const ready = product.nutrition ?? knownNutrition(product.barcode);
  const canLookUp = !product.source && product.barcode !== "" && FOOD_CATEGORIES.has(product.category);
  const [state, setState] = useState<NutritionState>(ready ? { status: "ready", nutrition: ready } : canLookUp ? { status: "loading" } : { status: "none" });
  useEffect(() => {
    if (ready) { setState({ status: "ready", nutrition: ready }); return; }
    if (!canLookUp) { setState({ status: "none" }); return; }
    let live = true;
    setState({ status: "loading" });
    lookupBarcode(product.barcode, { fdcKey: import.meta.env.VITE_FDC_API_KEY }).then(r => {
      if (!live) return;
      const n = r.status === "found" ? r.product.nutrition : undefined;
      setState(n ? { status: "ready", nutrition: n } : { status: "unavailable" });
    });
    return () => { live = false; };
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

const SLATE = { text: "#1E293B", bg: "#F1F5F9", border: "#CBD5E1", bar: "#E2E8F0", fill: "#475569", fillHigh: "#1E293B" };

export default function NutritionPanel({ state }: { state: NutritionState }) {
  if (state.status === "none") return null;
  const n = state.status === "ready" ? state.nutrition : null;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="font-bold text-sm">Nutrition</span>
        {n && <span className="text-[11px] text-gray-500 text-right">{n.perServing ? "per serving" : "per"} · {n.serving}</span>}
      </div>
      {state.status === "loading" && <p className="text-xs text-gray-500">Nutrition loading…</p>}
      {state.status === "unavailable" && <p className="text-xs text-gray-500">Nutrition not available for this product.</p>}
      {n && (
        <div className="space-y-3">
          {n.nutrients.map(x => (
            <div key={x.id}>
              <div className="flex justify-between gap-2 text-xs">
                <span><strong>{x.label}</strong> · {x.amount === null ? "not listed" : `${x.amount} ${x.unit}`}</span>
                <span style={{ color: SLATE.text, fontWeight: x.level === "high" ? 800 : 500 }}>
                  {x.dv === null ? "" : `${x.dv}% DV`}{x.level ? ` · ${x.level === "high" ? "High" : "Low"}` : ""}
                </span>
              </div>
              {x.dv !== null && (
                <div className="h-2 rounded mt-1.5" style={{ background: SLATE.bar }}>
                  <div className="h-2 rounded" style={{ width: `${Math.min(x.dv, 100)}%`, background: x.level === "high" ? SLATE.fillHigh : SLATE.fill }} />
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-gray-500 leading-snug">
            {n.perServing ? <>FDA: “{FDA_RULE.quote}” </> : <>Values per 100 g: FDA's high/low guide is per serving, so none is applied. </>}
            <a href={FDA_RULE.url} target="_blank" rel="noreferrer" className="text-primary">FDA Daily Values <ExternalLink size={9} className="inline" /></a>
            <span className="block mt-1">
              {n.source === "Open Food Facts" ? "From Open Food Facts (crowd-sourced, may contain errors)." : "From the label data the manufacturer sent USDA FoodData Central."}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Slate chip for the top High nutrient: "High sugar" on cards, "High in added sugar" in the hero. */
export function NutritionChip({ text, onDark = false }: { text: string; onDark?: boolean }) {
  return onDark
    ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">{text}</span>
    : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ background: SLATE.bg, borderColor: SLATE.border, color: SLATE.text }}>{text}</span>;
}
```

- [ ] **Step 2: `ProductDetailScreen.tsx`.**
  - After the `./verdict` import, add two lines:
    `import NutritionPanel, { NutritionChip, useNutrition } from "./NutritionPanel";`
    `import { topHigh } from "../../lib/nutrition";`
  - After `const best = bestPrice(product);` add:
```tsx
  const nutrition = useNutrition(product);
  const highNutrient = topHigh(nutrition.status === "ready" ? nutrition.nutrition : null);
```
  - In the hero chip row, directly after the `{formsWhenCooked(analysis) && ( … 🔥 Forms when cooked … )}` block,
    add:
    `{highNutrient && <NutritionChip onDark text={\`High in ${highNutrient.label.toLowerCase()}\`} />}`
  - Directly before `{/* ── Full ingredient list ── */}` add `<NutritionPanel state={nutrition} />` and an empty line.

- [ ] **Step 3: `App.tsx`, the product card.**
  - After the `./components/verdict` import, add three lines:
    `import { NutritionChip } from "./components/NutritionPanel";`
    `import { topHigh } from "../lib/nutrition";`
    `import { knownNutrition } from "../lib/lookup";`
  - In `ProductCard`, after `const look = VERDICT_STYLE[a.verdict];` add:
```tsx
  // Only nutrition already known this session: a list never triggers lookups (USDA rate limit).
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
```
  - After the card's `{formsWhenCooked(a) && <span …>🔥 forms when cooked</span>}` line, add
    `{high && <NutritionChip text={high.short} />}`.

- [ ] **Step 4: Build and test.** Run `npm run build` (expected: builds) and `npm test` (expected: 139 pass).

- [ ] **Step 5: Verify in the browser** (dev server, "Continue as Guest"). The live DB now has the real barcodes
  (Task 3).
  - **Search "oreo", open it:**
    - the hero shows "High in added sugar";
    - Nutrition reads "per serving · 3 cookies (34 g)", "Added sugar · 14 g · 28% DV · High", "Saturated fat · 2 g ·
      10% DV" and "Sodium · 130 mg · 6% DV";
    - the FDA quote and link are there, with the line "From the label data the manufacturer sent USDA FoodData Central";
    - the Ingredients text is the real label, starting "UNBLEACHED ENRICHED FLOUR".
  - **Back, search "snacks":** Oreo's card shows a slate "High sugar" chip, and Lay's shows none (nothing High).
  - **Re-open Oreo:** no new `api.nal.usda.gov` request (count with the Performance API, without printing URLs that
    contain the key).
  - **Search "pizza", open DiGiorno:** "High concern", "Contains processed meat: Pepperoni", serving "1/6 pizza
    (130g)" (not repeated), saturated fat and sodium High.
  - **Lay's page:** "Added sugar · not listed", with no % or level.
  - **Type `049000042566` (Coke Zero):** Nutrition shows Low ×3.
  - **Tide:** no Nutrition section.
  - **Colour:** nothing red or green inside the Nutrition section. **The console:** no errors.
  - Take screenshots of Oreo's Nutrition section and the snacks list for the owner.

- [ ] **Step 6: Commit.**
```bash
git add src/app/components/NutritionPanel.tsx src/app/components/ProductDetailScreen.tsx src/app/App.tsx
git commit -m "UI: Nutrition section (FDA %DV, 5/20 rule) and 'High …' chips on cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs, then ask about pushing

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec.

- [ ] **Step 1: `KNOWN_ISSUES.md`.**
  - Roadmap: "M5 ✅ <date>", summarized in one line: nutrition (FDA %DV, B + C), the softer processed-meat rule, and
    31 verified catalog barcodes with real labels.
  - K-29 → resolved for food products (3 removed, listed); non-food barcodes are unverified and documented.
  - Add "Catalog prices and store ratings are still Figma-invented" as a Low item.
  - "Hidden-risk candidates": add "Uncured meats cured with celery juice/powder still contain nitrite (e.g. Oscar Mayer
    Uncured Beef Franks): verify an official source before flagging", alongside glycidyl esters, benzene and
    aflatoxins.
  - Next: M6 camera + mobile layout; the search fix; the Home redesign (mockup first).
- [ ] **Step 2: `ARCHITECTURE.md`.**
  - File map: `nutrition.ts`, `NutritionPanel.tsx`, `src/data/verified-barcodes.json` (the source of truth for catalog
    barcodes), `scripts/apply-verified-barcodes.mjs`.
  - Feature inventory: nutrition (working).
- [ ] **Step 3: `PROJECT_HANDOFF.md`.**
  - Decision log:
    - `| 020 | Nutrition: FDA %DV per serving for added sugar, sat fat, sodium; High ≥ 20%, Low ≤ 5% (FDA's rule); separate from the concern badge | Owner, 2026-10-01 (mockup layout B + C) | **Done** (M5) |`
    - `| 021 | Catalog food products use USDA-verified barcodes and their real labels; unverifiable codes removed | Owner, 2026-10-01: trust first; Figma text was invented | **Done** (M5) |`
  - Phase line.
- [ ] **Step 4: `SYNOPSIS.md` and the spec.** Update the state; set the spec status to `implemented (<first>…<last>)`.
- [ ] **Step 5: Commit, then ask.** Run `npm test`, then:
```bash
git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-10-01-m5-nutrition-barcodes-design.md
git commit -m "Docs: M5 done (nutrition, softer processed-meat rule, verified barcodes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
  Ask the owner: "Push to GitHub? This updates the live site." Push only on a yes, then confirm the Actions run and
  check Oreo's Nutrition on the live site.

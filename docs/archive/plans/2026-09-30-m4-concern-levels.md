# M4 Concern Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every product shows one concern badge that darkens with the official finding: Nothing flagged, then Some
concern, High concern and Known carcinogen. Processed meat reads "Known carcinogen". Fried and baked starchy foods get a
"🔥 Forms when cooked" marker. Nothing reads green.

**Architecture:**
- The engine gains a top level, `known` (IARC Group 1).
- A new pure module, `foodConcerns.ts`, finds processed meat (it raises the level) and acrylamide (a marker only).
- `assess.ts` combines it with the additive check.
- `verdict.tsx` turns the result into one darkening hue and a filled-circle icon.
- The product page groups findings by where they come from.

**Tech Stack:** React 18 + Vite 6, Tailwind 4, lucide-react. Tests are Node `node --test` with native TypeScript type
stripping. The current suite has 113 tests; this plan ends at 126.

**Spec:** `docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md`. Read it first.

**How this plan was checked:** every code block below was applied to a scratch copy of `main` (`605eeac`) on
2026-09-30. There, the suite passed 126/126 and `vite build` succeeded. In a running dev server:
- the meat search showed hot dogs, SPAM and sausage as "Known carcinogen", and nuggets and tuna as "Nothing flagged";
- the snacks search showed "🔥 forms when cooked" on Lay's, Oreo, Nature Valley, Pringles and Goldfish, but not on
  Doritos or Cheetos (corn) or KIND bars;
- the SPAM page showed the "In the ingredients" and "The food itself" groups.

## Global Constraints

- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Line endings:** the repo's files have Windows line endings since the M3 history rewrite. With the Edit tool, use
  one-line `old_string`s or the exact blocks below. If a multi-line match fails, edit line by line.
- **Dependencies:** add none.
- **Facts first:**
  - Levels come only from a source's `basis`, through `deriveSeverity`.
  - Every food-level concern carries verbatim quotes of 25 words or fewer.
  - Acrylamide never sets a level (spec L6).
- **Colour:** no green anywhere in the concern display. The level is always shown as word + icon + shade (WCAG 1.4.1).
  The badge colours were contrast-checked at 5.06–9.57:1 (AA needs 4.5).
- **Node tests:** modules under `src/lib` use `.ts` import extensions and erasable-only TypeScript.
- **Commits:** commit per task on `main`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  The repo's `user.email` is already the owner's GitHub no-reply address; don't change it. Ask the owner before
  pushing, because every push redeploys the live site.
- **Suite:** `npm test` and `npm run build` stay green after every task.

## Review Focus

1. **Meat-free products** ("Vegan Italian Sausage", "imitation bacon bits", "bacon flavor") must not read "Known
   carcinogen". Pinned by Task 2's "meat-free versions…" test.
2. **Look-alike words** ("graham", "Frank's RedHot", "ham-free") must not match. Pinned by the same test.
3. **Corn chips** share USDA's "Chips, Pretzels & Snacks" category with potato chips, but must not get 🔥. Pinned by
   Task 2's USDA acrylamide test.
4. **A hot dog with no ingredient list** must read Known, not "Not enough data". Pinned by Task 3's test.
5. **Readable without colour:** in greyscale the four levels must still be distinguishable, by the word and the
   circle's fill. Pinned by Task 4 Step 4's greyscale check.

---

## File structure

| File | Change |
|---|---|
| `src/lib/safety/library.ts` | `Severity` gains `"known"`, plus `SEVERITY_RANK`; `iarc-1` derives `known`; `Source.body` allows `"WHO"` |
| `src/lib/safety/analyze.ts` | `Verdict` gains `"known"`; rank and sort by `SEVERITY_RANK` |
| `src/lib/safety/foodConcerns.ts` (new) | Processed meat and acrylamide rules, with sources |
| `src/lib/safety/assess.ts` (new) | Strongest of the additive check and food concerns |
| `src/lib/productImporter.ts`, `src/lib/lookup.ts` | `ProductSource.foodCategory` (USDA) and `categoryTags` (OFF) |
| `scripts/verify-sources.mjs` | Also checks the food-concern sources |
| `src/app/components/verdict.tsx` | Rewritten: darkening styles, level icon, `safeAnalyze` → `assessProduct` |
| `src/app/components/ProductDetailScreen.tsx` | Findings grouped by origin; 🔥 chip; new small print |
| `src/app/App.tsx` | Product card: category icon, level icon, 🔥 line |
| Tests | `library.test.ts`, `analyze.test.ts`, `lookup.test.ts` (edited); `foodConcerns.test.ts`, `assess.test.ts` (new) |

---

### Task 1: A top level, "known" (IARC Group 1)

**Files:** Modify `src/lib/safety/library.ts`, `src/lib/safety/analyze.ts`, `src/lib/safety/library.test.ts`,
`src/lib/safety/analyze.test.ts`.

**Interfaces:** Produces `Severity = "known" | "high" | "some"`, `SEVERITY_RANK: Record<Severity, number>`
(`some` 1, `high` 2, `known` 3), and `Verdict` with `"known"`. `VERDICT_RANK` becomes `none` 0, `some` 1, `high` 2,
`known` 3, `no-data` 4, `non-food` 5.

- [ ] **Step 1: Write the failing tests.**
  - In `library.test.ts`, change the import to `import { LIBRARY, deriveSeverity } from "./library.ts";`.
  - Replace the last test's assertion line
    `for (const e of LIBRARY) assert.ok(e.severity === "high" || e.severity === "some", `…
    with
    `for (const e of LIBRARY) assert.ok(e.severity === "known" || e.severity === "high" || e.severity === "some", \`${e.id}: needs an IARC/ban/warning-label source\`);`
  - Append to `library.test.ts`:
```ts
test("an IARC Group 1 source derives the 'known' level", () => {
  const s = { body: "WHO", finding: "t", url: "https://example.org", quote: "t", checkedOn: "2026-09-30" } as const;
  assert.equal(deriveSeverity([{ ...s, basis: "iarc-2a" }, { ...s, basis: "iarc-1" }]), "known");
  assert.equal(deriveSeverity([{ ...s, basis: "iarc-2a" }]), "high");
});
```
  - Append to `analyze.test.ts`. It uses the file's existing `src` and `LIB`, and `LibraryEntry` is already imported:
```ts
test("a Group 1 entry gives the 'known' verdict and sorts first", () => {
  const known: LibraryEntry = { id: "group-one", name: "Group one", aliases: ["group one"], eCodes: [], severity: "known", concern: "t", sources: [{ ...src, basis: "iarc-1" }] };
  const a = analyzeIngredients({ ingredients: "Aspartame, group one", category: "Snacks" }, [...LIB, known]);
  assert.equal(a.verdict, "known");
  assert.deepEqual(a.flags.map(f => f.entry.id), ["group-one", "aspartame"]);
});
```

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. `deriveSeverity` returns `"high"` for `iarc-1`, and the verdict
  is `"high"`.

- [ ] **Step 3: Implement `library.ts`.**
  - Replace `export type Severity = "high" | "some";` with:
```ts
export type Severity = "known" | "high" | "some";

/** Stronger is higher; also orders flags on the product page. */
export const SEVERITY_RANK: Record<Severity, number> = { some: 1, high: 2, known: 3 };
```
  - In `interface Source`, replace `body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO/JECFA";` with
    `body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO" | "WHO/JECFA";`. The library test's `BODIES` set stays as it is:
    library entries don't use `"WHO"`.
  - Replace `const HIGH_BASES: ReadonlySet<Basis> = new Set(["iarc-1", "iarc-2a", "banned-eu", "banned-us"]);` with
    two lines:
    `const KNOWN_BASES: ReadonlySet<Basis> = new Set(["iarc-1"]);`
    `const HIGH_BASES: ReadonlySet<Basis> = new Set(["iarc-2a", "banned-eu", "banned-us"]);`
  - In `deriveSeverity`, add this as the first line of the body:
    `if (sources.some(s => KNOWN_BASES.has(s.basis))) return "known";`

- [ ] **Step 4: Implement `analyze.ts`.**
  - Replace `import { LIBRARY, type LibraryEntry } from "./library.ts";` with
    `import { LIBRARY, SEVERITY_RANK, type LibraryEntry } from "./library.ts";`
  - Replace `export type Verdict = "high" | "some" | "none" | "no-data" | "non-food";` with
    `export type Verdict = "known" | "high" | "some" | "none" | "no-data" | "non-food";`
  - Replace the `VERDICT_RANK` line with
    `export const VERDICT_RANK: Record<Verdict, number> = { none: 0, some: 1, high: 2, known: 3, "no-data": 4, "non-food": 5 };`
  - Replace the two lines `flags.sort((a, b) => (a.entry.severity === b.entry.severity ? 0 : …));` and
    `const verdict: Verdict = flags.some(f => f.entry.severity === "high") ? "high" : …;` with:
```ts
  flags.sort((a, b) => SEVERITY_RANK[b.entry.severity] - SEVERITY_RANK[a.entry.severity]);
  const top = Math.max(0, ...flags.map(f => SEVERITY_RANK[f.entry.severity]));
  const verdict: Verdict = (["none", "some", "high", "known"] as const)[top];
```

- [ ] **Step 5: Run.** Run: `npm test`. Expected: 115 pass, 0 fail. The 51 catalog results are unchanged: no library
  entry has an `iarc-1` source.

- [ ] **Step 6: Commit.**
```bash
git add src/lib/safety/library.ts src/lib/safety/analyze.ts src/lib/safety/library.test.ts src/lib/safety/analyze.test.ts
git commit -m "Engine: add the 'known' level for IARC Group 1 findings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Food-level concerns (processed meat, acrylamide)

**Files:**
- Create: `src/lib/safety/foodConcerns.ts`, `src/lib/safety/foodConcerns.test.ts`.
- Modify: `src/lib/productImporter.ts`, `src/lib/lookup.ts`, `src/lib/lookup.test.ts`, `scripts/verify-sources.mjs`.

**Interfaces:**
- Consumes: `Severity`, `Source` (Task 1), `FOOD_CATEGORIES` (analyze.ts), `parseIngredients` (parse.ts).
- Produces:
  - `FoodConcern { id: "processed-meat" | "acrylamide"; kind: "food" | "cooking"; severity?: Severity; name; reason; concern; context; sources }`
  - `FoodInput { name; category; ingredients; source?: { foodCategory?: string; categoryTags?: string[] } }`
  - `foodConcerns(p: FoodInput): FoodConcern[]`, `acrylamideMatch(p: FoodInput): EuCategory | null`
  - `PROCESSED_MEAT`, `ACRYLAMIDE`
  - `ProductSource.foodCategory?: string` (USDA) and `ProductSource.categoryTags?: string[]` (OFF), both filled in by
    `lookup.ts`.

Facts behind the rules:
- The processed-meat definition, examples and quotes are in spec §3. The WHO page quotes are script-checkable; the
  IARC Q&A PDF was hand-checked on 2026-09-30.
- The acrylamide quotes were verified for the superseded M2 spec.
- USDA `foodCategory` values were sampled from real records on 2026-09-30 by searching about 28 product types.
  Potato and tortilla chips both come back as "Chips, Pretzels & Snacks", so snacks are decided by their first
  ingredient.

- [ ] **Step 1: Source fields.**
  - In `src/lib/productImporter.ts`, inside `interface ProductSource`, after the `additiveCodes` line, add:
```ts
  foodCategory?: string;   // USDA only, e.g. "Chips, Pretzels & Snacks" (drives the food-level checks)
  categoryTags?: string[]; // Open Food Facts only, e.g. ["en:snacks", "en:potato-crisps"]
```
  - In `src/lib/lookup.ts`:
    - Append `,categories_tags` to the `OFF_FIELDS` string.
    - In `pickUsdaFood`'s source object, replace `crowdSourced: false, ingredientsLang: "en", additiveCodes: [],` with
      `crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: str(f.foodCategory),`.
    - In `mapOffResponse`'s source object, replace `additiveCodes: strings(p.additives_tags),` with
      `additiveCodes: strings(p.additives_tags), categoryTags: strings(p.categories_tags),`.
  - In `src/lib/lookup.test.ts`, the two `assert.deepEqual(... .source, {...})` expectations each gain the new field:
    - the Coke Zero one: `foodCategory: "Non Alcoholic Beverages - Ready to Drink",` after `additiveCodes: [],`;
    - the Nutella one: `categoryTags: ["en:breakfasts", "en:spreads", "en:sweet-spreads", "en:confectionary-based-spreads", "fr:Nutella"],`
      after `additiveCodes: ["en:e322", "en:e322i"],`.

- [ ] **Step 2: Write the failing tests:** create `src/lib/safety/foodConcerns.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foodConcerns, acrylamideMatch, PROCESSED_MEAT, ACRYLAMIDE, type FoodInput } from "./foodConcerns.ts";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const meat = (p: Partial<FoodInput>) => foodConcerns({ name: "", category: "Meat", ingredients: "", ...p }).find(c => c.id === "processed-meat")?.reason ?? null;
const usda = (foodCategory: string, name = "x", ingredients = "") => acrylamideMatch({ name, category: "", ingredients, source: { foodCategory } });
const off = (tags: string[]) => acrylamideMatch({ name: "x", category: "", ingredients: "", source: { categoryTags: tags } });

test("catalog: exactly the reviewed products are processed meat, with their reasons", () => {
  const hits = catalog.map(p => [p.id, foodConcerns(p).find(c => c.id === "processed-meat")?.reason] as const).filter(([, r]) => r);
  assert.deepEqual(hits, [
    [6, "Processed meat: Hot Dogs"],
    [36, "Processed meat: SPAM"],
    [38, "Processed meat: Sausage"],
    [42, "Contains processed meat: Pepperoni"],
  ]);
});

test("catalog: exactly the reviewed products get the acrylamide marker", () => {
  // Lay's, Oreo, Nature Valley, Pringles, Special K, Wonder bread, Goldfish (EU Reg 2017/2158 Art. 1(2)).
  // Not: Doritos/Cheetos (corn), Quaker oatmeal (porridge), frozen foods, drinks, non-food (incl. Gerber, "Baby Care").
  assert.deepEqual(catalog.filter(p => acrylamideMatch(p)).map(p => p.id), [1, 14, 16, 18, 20, 40, 41]);
});

// Review Focus 1 and 2.
test("processed meat: meat-free versions, flavourings and look-alike words don't match", () => {
  assert.equal(meat({ name: "Vegan Italian Sausage" }), null);
  assert.equal(meat({ name: "Plant-Based Bacon" }), null);
  assert.equal(meat({ name: "Salad Topping", ingredients: "Imitation bacon bits (soy flour, canola oil)" }), null);
  assert.equal(meat({ name: "Chips", category: "Snacks", ingredients: "Potatoes, oil, bacon flavor" }), null);
  assert.equal(meat({ name: "Graham Crackers", category: "Snacks", ingredients: "Enriched graham flour, sugar" }), null);
  assert.equal(meat({ name: "Frank's RedHot Original", category: "Condiments", ingredients: "Aged cayenne red peppers, vinegar" }), null);
  assert.equal(meat({ name: "Seasoning", ingredients: "Wheat flour, ham-free seasoning" }), null);
  assert.equal(meat({ name: "Pulled Pork", ingredients: "Pork, natural smoke flavor, salt" }), null);
  assert.equal(meat({ name: "Chicken Nuggets", ingredients: "Chicken, water, salt" }), null);
});

test("processed meat: real cases match, including inside other foods", () => {
  assert.equal(meat({ name: "Turkey Bacon" }), "Processed meat: Bacon");
  assert.equal(meat({ name: "Original Beef Jerky" }), "Processed meat: Jerky");
  assert.equal(meat({ name: "Club Sandwich Kit", ingredients: "Bread (wheat flour), ham (pork, water, salt, sodium nitrite)" }), "Contains processed meat: ham");
  assert.equal(meat({ name: "Breakfast Bowl", category: "Frozen", ingredients: "Potatoes, eggs, sausage (pork, salt, spices)" }), "Contains processed meat: sausage");
  assert.equal(meat({ name: "Classic Franks", category: "", source: { foodCategory: "Sausages, Hotdogs & Brats" } }),
    'Processed meat (USDA category "Sausages, Hotdogs & Brats")');
  assert.equal(meat({ name: "Bacon Air Freshener", category: "Cleaning" }), null, "non-food never matches");
});

// Review Focus 3: corn chips share USDA's chip category with potato chips.
test("acrylamide: USDA categories, decided by the first ingredient for snacks", () => {
  assert.equal(usda("Chips, Pretzels & Snacks", "Classic Potato Chips", "POTATOES, VEGETABLE OIL, SALT"), "a");
  assert.equal(usda("Chips, Pretzels & Snacks", "Tortilla Chips", "CORN, VEGETABLE OIL, SALT"), null);
  assert.equal(usda("Breads & Buns"), "c");
  assert.equal(usda("Cereal", "Honey Nut Cereal"), "d");
  assert.equal(usda("Cereal", "Instant Oatmeal Maple"), null);
  assert.equal(usda("Crackers & Biscotti"), "e");
  assert.equal(usda("Coffee"), "f");
  assert.equal(usda("Non Alcoholic Beverages - Ready to Drink"), null);
  assert.equal(usda(""), null);
});

test("acrylamide: Open Food Facts tags; porridge and corn chips excluded", () => {
  assert.equal(off(["en:snacks", "en:crisps", "en:potato-crisps"]), "a");
  assert.equal(off(["en:snacks", "en:chips-and-fries", "en:crisps", "en:corn-chips"]), null);
  assert.equal(off(["en:breakfasts", "en:breakfast-cereals"]), "d");
  assert.equal(off(["en:breakfasts", "en:breakfast-cereals", "en:porridge"]), null);
  assert.equal(off(["en:snacks", "en:biscuits-and-crackers"]), "e");
  assert.equal(off(["en:beverages", "en:colas"]), null);
  assert.equal(off([]), null);
});

test("food-level sources are complete (verify:sources checks the quotes)", () => {
  for (const c of [PROCESSED_MEAT, ACRYLAMIDE]) {
    assert.ok(c.sources.length >= 3, c.id);
    assert.ok(c.sources.some(s => s.basis !== "context"), `${c.id}: needs a classification source`);
    for (const s of c.sources) {
      assert.match(s.url, /^https?:\/\//);
      assert.ok(s.quote.trim() && s.quote.trim().split(/\s+/).length <= 25, s.url);
      assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  assert.equal(PROCESSED_MEAT.severity, "known");
  assert.equal(ACRYLAMIDE.severity, undefined, "acrylamide never sets a level (decision L6)");
});
```

- [ ] **Step 3: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/foodConcerns.ts`.

- [ ] **Step 4: Implement:** create `src/lib/safety/foodConcerns.ts`:
```ts
// foodConcerns.ts — concerns about the food itself or how it's made, which an ingredient list doesn't show.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.2. Processed meat raises the badge
// (IARC Group 1). Acrylamide is a cooking marker only: it never changes the badge (decision L6).
import type { Severity, Source } from "./library.ts";
import { FOOD_CATEGORIES } from "./analyze.ts";
import { parseIngredients } from "./parse.ts";

export interface FoodConcern {
  id: "processed-meat" | "acrylamide";
  kind: "food" | "cooking";  // "food" can raise the badge; "cooking" is a marker only
  severity?: Severity;       // processed meat: "known"; acrylamide: none
  name: string;
  reason: string;            // why this product matched, e.g. "Contains processed meat: pepperoni"
  concern: string;           // one plain-English sentence
  context: string;           // regulator context shown next to the finding
  sources: Source[];
}

/** What the rules read: a catalog product, or a looked-up one (with its USDA category or OFF tags). */
export interface FoodInput {
  name: string;
  category: string;
  ingredients: string;
  source?: { foodCategory?: string; categoryTags?: string[] };
}

const CHECKED = "2026-09-30";
const WHO_QA = "https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat";
const IARC_QA = "https://www.iarc.who.int/wp-content/uploads/2018/07/Monographs-QA_Vol114.pdf"; // PDF: hand-checked 2026-09-30

// ── Processed meat (IARC Group 1) ────────────────────────────────────────────

export const PROCESSED_MEAT: Omit<FoodConcern, "reason"> = {
  id: "processed-meat", kind: "food", severity: "known", name: "Processed meat",
  concern: "IARC classifies eating processed meat as carcinogenic to humans (Group 1): it causes colorectal cancer.",
  context: "Group 1 describes how strong the evidence is, not how dangerous something is: IARC says this does not mean processed meat is as dangerous as smoking. Its estimate: each 50 g eaten daily raises colorectal cancer risk by about 18%. WHO advises eating it in moderation.",
  sources: [
    { body: "WHO", basis: "iarc-1", finding: "Group 1 (carcinogenic to humans): consumption of processed meat (IARC Monographs vol. 114, 2015)",
      url: WHO_QA, quote: "Processed meat has been classified as Group 1, carcinogenic to humans.", checkedOn: CHECKED },
    { body: "WHO", basis: "context", finding: "WHO's definition: meat that is salted, cured, fermented or smoked",
      url: WHO_QA, quote: "Processed meat refers to meat that has been transformed through salting, curing, fermentation, smoking or other processes to enhance flavour or improve preservation.", checkedOn: CHECKED },
    { body: "IARC", basis: "context", finding: "IARC: being in Group 1 with tobacco does not mean equally dangerous",
      url: IARC_QA, quote: "this does NOT mean that they are all equally dangerous", checkedOn: CHECKED },
    { body: "IARC", basis: "context", finding: "IARC's risk estimate: about 18% higher colorectal cancer risk per 50 g eaten daily",
      url: IARC_QA, quote: "every 50 gram portion of processed meat eaten daily increases the risk of colorectal cancer by about 18%", checkedOn: CHECKED },
  ],
};

// IARC's examples ("hot dogs (frankfurters), ham, sausages, corned beef, and biltong or beef jerky as well as canned
// meat") plus common cured/smoked meats. Whole words only ("graham" is not ham). "franks" is left out: it matches
// "Frank's RedHot".
const PM_WORD = /\b(hot ?dogs?|frankfurters?|wieners?|bacon|hams?|sausages?|salami|pepperoni|chorizo|bologna|pastrami|corned beef|jerky|biltong|prosciutto|spam|luncheon meat|deli meats?|cold cuts?|(?:cured|smoked) (?:pork|beef|turkey|chicken|meat))\b/i;
// Meat-free versions and flavourings aren't meat.
const NOT_MEAT = /\b(imitation|vegan|vegetarian|plant[- ]based|meatless|meat[- ]free|veggie)\b|\b(?:bacon|ham|sausage|pepperoni|salami|jerky)[- ]flavou?r/i;
// A dish named after its meat ("Pepperoni Pizza") contains processed meat rather than being it.
const DISH = /\b(pizzas?|sandwich(es)?|wraps?|salads?|soups?|pasta|burritos?|calzones?|biscuits?|bagels?|pockets?|bites|kits?)\b/i;
// USDA categories that are processed meat by definition (sampled from real records 2026-09-30).
const PM_USDA = new Set(["Sausages, Hotdogs & Brats", "Frozen Sausages, Hotdogs & Brats", "Pepperoni, Salami & Cold Cuts", "Canned Meat"]);

function processedMeat(p: FoodInput): FoodConcern | null {
  if (p.category && !FOOD_CATEGORIES.has(p.category)) return null;
  if (NOT_MEAT.test(p.name)) return null;
  const inName = p.name.match(PM_WORD); // reasons keep the label's own casing ("SPAM", "Hot Dogs")
  if (inName) return { ...PROCESSED_MEAT, reason: `${DISH.test(p.name) ? "Contains processed meat" : "Processed meat"}: ${inName[1]}` };
  if (p.source?.foodCategory && PM_USDA.has(p.source.foodCategory)) {
    return { ...PROCESSED_MEAT, reason: `Processed meat (USDA category "${p.source.foodCategory}")` };
  }
  for (const item of parseIngredients(p.ingredients)) {
    if (NOT_MEAT.test(item)) continue;
    const m = item.match(PM_WORD);
    if (m) return { ...PROCESSED_MEAT, reason: `Contains processed meat: ${m[1]}` };
  }
  return null;
}

// ── Acrylamide (cooking marker) ──────────────────────────────────────────────

const M2_CHECKED = "2026-09-28"; // sources verified for the superseded M2 spec §3

export const ACRYLAMIDE: FoodConcern = {
  id: "acrylamide", kind: "cooking", name: "Acrylamide",
  reason: "Forms when starchy foods are fried, baked or roasted; it isn't an added ingredient.",
  concern: "IARC classifies acrylamide as probably carcinogenic to humans (Group 2A), and EFSA says it potentially increases cancer risk.",
  context: "EU law requires makers of these foods to keep it as low as reasonably achievable. The FDA does not advise avoiding fried, roasted or baked foods; cooking to golden rather than brown helps reduce it.",
  sources: [
    { body: "IARC", basis: "iarc-2a", finding: "Group 2A (probably carcinogenic to humans), IARC Monographs vol. 60 (1994)",
      url: "https://publications.iarc.who.int/78", quote: "Acrylamide was classified as probably carcinogenic to humans.", checkedOn: M2_CHECKED },
    { body: "EFSA", basis: "context", finding: "EFSA's 2015 opinion: acrylamide in food potentially increases cancer risk for all age groups",
      url: "https://www.efsa.europa.eu/en/press/news/150604",
      quote: "acrylamide in food potentially increases the risk of developing cancer for consumers in all age groups", checkedOn: M2_CHECKED },
    { body: "EU", basis: "context", finding: "Regulation (EU) 2017/2158 requires makers of fries, crisps, bread, breakfast cereals, biscuits, coffee and baby food to reduce it",
      url: "http://publications.europa.eu/resource/celex/32017R2158",
      quote: "(a) French fries, other cut (deep fried) products and sliced potato crisps from fresh potatoes;", checkedOn: M2_CHECKED },
    { body: "FDA", basis: "context", finding: "FDA's Q&A answers 'No' to whether people should stop eating fried, roasted or baked foods",
      url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers",
      quote: "Should I stop eating foods that are fried, roasted, or baked?", checkedOn: M2_CHECKED },
    { body: "FDA", basis: "context", finding: "FDA home-cooking advice: fry and toast to golden rather than brown",
      url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-and-diet-food-storage-and-food-preparation",
      quote: "to a golden yellow color rather than a brown color helps reduce acrylamide formation", checkedOn: M2_CHECKED },
  ],
};

/** EU Regulation 2017/2158 Article 1(2) food types. */
export type EuCategory = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

// OFF category ids (verified against the OFF taxonomy 2026-09-28). Tags are hierarchical, so parents cover children.
// Generic "en:crisps" / "en:chips-and-fries" are NOT listed: they include corn chips.
const OFF_TAGS: [string, EuCategory][] = [
  ["en:potato-fries", "a"], ["en:potato-crisps", "a"], ["en:salty-snacks-made-from-potato", "b"],
  ["en:breads", "c"], ["en:breakfast-cereals", "d"],
  ["en:biscuits-and-crackers", "e"], ["en:cereal-bars", "e"], ["en:gingerbreads", "e"],
  ["en:coffees", "f"], ["en:instant-coffees", "f"], ["en:instant-coffee-substitutes", "g"], ["en:baby-foods", "h"],
];

// USDA foodCategory values (sampled from real records 2026-09-30). "snack" = decided by the first ingredient, because
// potato chips and corn tortilla chips share "Chips, Pretzels & Snacks".
const USDA_CATEGORIES: Record<string, EuCategory | "snack"> = {
  "French Fries, Potatoes & Onion Rings": "a", "Chips, Pretzels & Snacks": "snack",
  "Breads & Buns": "c", "Processed Cereal Products": "d", "Cereal": "d",
  "Biscuits/Cookies": "e", "Cookies & Biscuits": "e", "Crackers & Biscotti": "e", "Flavored Snack Crackers": "e",
  "Snack, Energy & Granola Bars": "e", "Coffee": "f",
};
const CATALOG_CATEGORIES: Record<string, EuCategory | "snack"> = { Snacks: "snack", Bread: "c", Breakfast: "d" };

const PORRIDGE = /\b(oat ?meal|oats|porridge|grits)\b/i;            // (d) excludes porridge
const BAKERY_WORDS = /\b(cookies?|biscuits?|crackers?|wafers?|rusks?|gingerbread|crispbreads?|(granola|cereal) bars?)\b/i;
const CEREAL_FLOUR_FIRST = /^(enriched |unbleached enriched |whole grain |whole )?(wheat |oat |rice |rye )?flour\b/i;

function snack(name: string, ingredients: string): EuCategory | null {
  const first = ingredients.trim();
  if (/^potato(es)?\b/i.test(first)) return "a";
  if (/^dried potato(es)?\b/i.test(first)) return "b";
  // EU (e): "a cracker is a dry biscuit (a baked product based on cereal flour)"
  if (BAKERY_WORDS.test(name) || CEREAL_FLOUR_FIRST.test(first)) return "e";
  return null;
}

/** Which EU acrylamide food type a product is, or null. */
export function acrylamideMatch(p: FoodInput): EuCategory | null {
  if (p.source?.categoryTags) { // Open Food Facts
    const tags = new Set(p.source.categoryTags);
    for (const [tag, eu] of OFF_TAGS) {
      if (eu === "d" && tags.has("en:porridge")) continue;
      if (tags.has(tag)) return eu;
    }
    return null;
  }
  const bucket = p.source ? USDA_CATEGORIES[p.source.foodCategory ?? ""] : CATALOG_CATEGORIES[p.category];
  if (!p.source && !FOOD_CATEGORIES.has(p.category)) return null;
  if (bucket === "snack") return snack(p.name, p.ingredients);
  if (bucket === "d" && PORRIDGE.test(p.name)) return null;
  if (bucket) return bucket;
  if (/\b(coffee|espresso)\b/i.test(p.name) && !/creamer/i.test(p.name)) return "f";
  return null;
}

/** Food-level concerns for a product: processed meat first, then the acrylamide marker. */
export function foodConcerns(p: FoodInput): FoodConcern[] {
  const out: FoodConcern[] = [];
  const meat = processedMeat(p);
  if (meat) out.push(meat);
  if (acrylamideMatch(p)) out.push(ACRYLAMIDE);
  return out;
}
```

- [ ] **Step 5: Run.** Run: `npm test`. Expected: 122 pass, 0 fail.

- [ ] **Step 6: Check the sources.** In `scripts/verify-sources.mjs`:
  - After the `LIBRARY` import, add `import { PROCESSED_MEAT, ACRYLAMIDE } from "../src/lib/safety/foodConcerns.ts";`
  - Replace `for (const entry of LIBRARY) {` with `for (const entry of [...LIBRARY, PROCESSED_MEAT, ACRYLAMIDE]) {`
  - In the fetch headers, add `Accept: "text/html,application/xhtml+xml", "Accept-Language": "en",` next to `User-Agent`.
    The EU Cellar copy only returns its text for an XHTML Accept header.
  - Run: `npm run verify:sources`. Expected: 0 fail. The IARC PDF reports "unverifiable" (a PDF): it was hand-checked on
    2026-09-30. Open any other unverifiable food-concern URL in the browser and confirm its quote by hand. Record which
    ones in the commit message.

- [ ] **Step 7: Commit.**
```bash
git add src/lib/safety/foodConcerns.ts src/lib/safety/foodConcerns.test.ts src/lib/productImporter.ts src/lib/lookup.ts src/lib/lookup.test.ts scripts/verify-sources.mjs
git commit -m "Food-level concerns: processed meat (IARC Group 1) and acrylamide marker

Processed meat matches IARC's examples by whole word in the name or
ingredients (meat-free versions excluded) or by USDA category; acrylamide
matches the EU 2017/2158 food types and never sets a level.
verify:sources: <P> pass, 0 fail, <U> unverifiable (hand-checked: <list>).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
  Replace `<P>`, `<U>` and `<list>` with Step 6's real numbers.

---

### Task 3: Combine into one level (`assess.ts`)

**Files:** Create `src/lib/safety/assess.ts`, `src/lib/safety/assess.test.ts`.

**Interfaces:** Produces `Assessment extends Analysis { concerns: FoodConcern[] }` and
`assessProduct(p: FoodInput & { additiveCodes?: string[] }): Assessment`. Task 4 calls it from `safeAnalyze`.

- [ ] **Step 1: Write the failing tests:** create `src/lib/safety/assess.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessProduct } from "./assess.ts";
import { analyzeIngredients } from "./analyze.ts";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));

test("catalog: only the four processed-meat products change level (to known); acrylamide changes nothing", () => {
  const changed = catalog
    .map(p => ({ id: p.id, before: analyzeIngredients(p).verdict, after: assessProduct(p).verdict }))
    .filter(r => r.before !== r.after);
  assert.deepEqual(changed.map(r => [r.id, r.after]), [[6, "known"], [36, "known"], [38, "known"], [42, "known"]]);
  const lays = assessProduct(catalog.find(p => p.id === 1)!);
  assert.ok(lays.concerns.some(c => c.id === "acrylamide"));
  assert.equal(lays.verdict, analyzeIngredients(catalog.find(p => p.id === 1)!).verdict);
});

// Review Focus 4.
test("a hot dog with no ingredient list still reads known, not 'not enough data'", () => {
  assert.equal(assessProduct({ name: "Beef Hot Dogs", category: "Meat", ingredients: "" }).verdict, "known");
  assert.equal(assessProduct({ name: "Mystery Snack", category: "Snacks", ingredients: "" }).verdict, "no-data");
});

test("non-food stays non-food, with no food-level concerns", () => {
  const a = assessProduct({ name: "Bacon Scented Candle", category: "Cleaning", ingredients: "Paraffin wax" });
  assert.equal(a.verdict, "non-food");
  assert.deepEqual(a.concerns, []);
});

test("looked-up products: USDA category drives the level; additive codes still count", () => {
  const franks = assessProduct({ name: "Classic Franks", category: "", ingredients: "BEEF, WATER, SALT", source: { foodCategory: "Sausages, Hotdogs & Brats" } });
  assert.equal(franks.verdict, "known");
  const cola = assessProduct({ name: "Diet Cola", category: "", ingredients: "", additiveCodes: ["en:e951"], source: { categoryTags: ["en:colas"] } });
  assert.equal(cola.verdict, "some");
});
```

- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/assess.ts`.

- [ ] **Step 3: Implement:** create `src/lib/safety/assess.ts`:
```ts
// assess.ts — one product → its concern level: the strongest of the additive check and the food-level concerns.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.3. Pure, so Node tests can load it.
import { analyzeIngredients, type Analysis, type Verdict } from "./analyze.ts";
import { SEVERITY_RANK } from "./library.ts";
import { foodConcerns, type FoodConcern, type FoodInput } from "./foodConcerns.ts";

export interface Assessment extends Analysis { concerns: FoodConcern[] }

const LEVELS: readonly Verdict[] = ["none", "some", "high", "known"];

export function assessProduct(p: FoodInput & { additiveCodes?: string[] }): Assessment {
  // Looked-up products have no catalog category (both sources are food databases).
  const a = analyzeIngredients({ ingredients: p.ingredients, category: p.source ? undefined : p.category, additiveCodes: p.additiveCodes });
  if (a.verdict === "non-food") return { ...a, concerns: [] };
  let concerns: FoodConcern[] = [];
  try {
    concerns = foodConcerns(p);
  } catch (err) {
    console.error("[safety] food-level check failed; showing the additive result only", err);
  }
  const foodTop = Math.max(0, ...concerns.map(c => (c.kind === "food" && c.severity ? SEVERITY_RANK[c.severity] : 0)));
  const current = LEVELS.indexOf(a.verdict); // -1 = no-data: a food concern still lifts it
  return { ...a, concerns, verdict: foodTop > Math.max(current, 0) ? LEVELS[foodTop] : a.verdict };
}
```

- [ ] **Step 4: Run.** Run: `npm test`. Expected: 126 pass, 0 fail.

- [ ] **Step 5: Commit.**
```bash
git add src/lib/safety/assess.ts src/lib/safety/assess.test.ts
git commit -m "Assess: concern level = strongest of additives and food-level concerns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The darkening badge, everywhere

**Files:** Replace `src/app/components/verdict.tsx`. Modify `src/app/components/ProductDetailScreen.tsx` and
`src/app/App.tsx`.

**Interfaces:** Consumes `assessProduct` / `Assessment` (Task 3) and `Severity` / `Source` (Task 1).
`safeAnalyze(p)` keeps its name and now returns an `Assessment`. New exports: `formsWhenCooked(a)` and
`categoryIcon(category)`.

- [ ] **Step 1: Replace `src/app/components/verdict.tsx` entirely with:**
```tsx
// verdict.tsx — how a concern level looks, shared by the product page and product lists.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.4: one hue that darkens with the official
// level, always word + icon + shade (never colour alone), and no green.

import type { CSSProperties } from "react";
import { HelpCircle } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import type { Verdict } from "../../lib/safety/analyze";
import { assessProduct, type Assessment } from "../../lib/safety/assess";

type IconProps = { size?: number; style?: CSSProperties; className?: string };

/** A circle filled by level: ○ empty, ◔ quarter, ◑ half, ● full. */
function levelIcon(fill: 0 | 0.25 | 0.5 | 1) {
  return function LevelIcon({ size = 16, style, className }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        style={style} className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill={fill === 1 ? "currentColor" : "none"} />
        {fill === 0.25 && <path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="currentColor" stroke="none" />}
        {fill === 0.5 && <path d="M12 12 L12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" stroke="none" />}
      </svg>
    );
  };
}

export const VERDICT_STYLE: Record<Verdict, {
  label: string; short: string; color: string; bg: string; gradient: string; Icon: (p: IconProps) => JSX.Element;
}> = {
  none:       { label: "Nothing flagged",  short: "Nothing flagged",  color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: levelIcon(0) },
  some:       { label: "Some concern",     short: "Some concern",     color: "#BE123C", bg: "#FFE4E6", gradient: "linear-gradient(160deg, #4c0519, #e11d48)", Icon: levelIcon(0.25) },
  high:       { label: "High concern",     short: "High concern",     color: "#9F1239", bg: "#FECDD3", gradient: "linear-gradient(160deg, #3b0414, #be123c)", Icon: levelIcon(0.5) },
  known:      { label: "Known carcinogen", short: "Known carcinogen", color: "#881337", bg: "#FDA4AF", gradient: "linear-gradient(160deg, #1f020a, #881337)", Icon: levelIcon(1) },
  "no-data":  { label: "Not enough data",  short: "No data",          color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
  "non-food": { label: "Ingredient check covers food & drinks for now", short: "Food only", color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
};

const NO_DATA: Assessment = { verdict: "no-data", flags: [], checkedCount: 0, concerns: [] };

/** Never let the engine blank a screen: an unexpected error shows "Not enough data" and is logged. */
export function safeAnalyze(p: Product): Assessment {
  try {
    return assessProduct({ ...p, additiveCodes: p.source?.additiveCodes });
  } catch (err) {
    console.error("[safety] assessment failed for product", p.id, err);
    return NO_DATA;
  }
}

/** True when the product gets the 🔥 "forms when cooked" marker. */
export const formsWhenCooked = (a: Assessment) => a.concerns.some(c => c.kind === "cooking");

/** "Known carcinogen · 2 findings", "Some concern · 1 finding", or the plain label. */
export function verdictHeadline(a: Assessment): string {
  const n = a.flags.length + a.concerns.filter(c => c.kind === "food").length;
  if (a.verdict === "known" || a.verdict === "high" || a.verdict === "some") return `${VERDICT_STYLE[a.verdict].label} · ${n} finding${n === 1 ? "" : "s"}`;
  if (a.verdict === "none") return `Nothing flagged among ${a.checkedCount} additives with an official finding`;
  return VERDICT_STYLE[a.verdict].label;
}

/** Small category icon for neutral product cards (decision L3: no colour per food type). */
const CATEGORY_ICON: Record<string, string> = {
  Beverages: "🥤", Bread: "🍞", Breakfast: "🥣", Condiments: "🧂", Dairy: "🧀", Frozen: "🧊", Meat: "🥩", Snacks: "🍪",
  Cleaning: "🧽", "Personal Care": "🧴", "Baby Care": "🍼", Medicine: "💊", "Pet Food": "🐾",
};
export const categoryIcon = (category: string) => CATEGORY_ICON[category] ?? "🛒";
```

- [ ] **Step 2: `ProductDetailScreen.tsx`.** Make these replacements in order.

  (a) The header comment and imports: replace from `// Ingredient safety verdict from the safety engine` through
  `import { VERDICT_STYLE, safeAnalyze, verdictHeadline } from "./verdict";` with:
```tsx
// Concern level from the safety engine (src/lib/safety): the strongest official
// finding among the ingredients (additives), the food itself (processed meat) and
// what forms when it's cooked (acrylamide, a marker only). Every finding shows its
// sources. Also: price comparison and same-category alternatives.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  ArrowLeft, Bookmark, Share2, ShoppingBag, DollarSign, Star,
  TrendingUp, ChevronDown, ExternalLink, FlaskConical, Flame,
} from "lucide-react";
import { bestPrice, type Product } from "../../lib/productImporter";
import { VERDICT_RANK, escapeRegExp, type Flag } from "../../lib/safety/analyze";
import type { Severity, Source } from "../../lib/safety/library";
import type { Assessment } from "../../lib/safety/assess";
import { VERDICT_STYLE, safeAnalyze, verdictHeadline, formsWhenCooked } from "./verdict";
```
  (b) Replace the whole `const SMALL_PRINT … };` block (7 lines) with:
```tsx
const SMALL_PRINT: Record<Assessment["verdict"], string> = {
  known:      "Tap a finding to see its official sources.",
  high:       "Tap a finding to see its official sources.",
  some:       "Tap a finding to see its official sources.",
  none:       "No hazard flags from IARC, EU or FDA. This doesn't rate nutrition (coming next).",
  "no-data":  "This product has no ingredient list yet.",
  "non-food": "Checks for cleaning, personal-care and other products are coming later.",
};

/** One row on the product page: an additive flag or a food-level concern. */
interface Finding { id: string; name: string; severity?: Severity; concern: string; detail: string; context?: string; sources: Source[] }

/** Findings grouped by where they come from; empty groups are dropped. */
function findingGroups(a: Assessment): { title: string; findings: Finding[] }[] {
  const fromConcerns = (kind: "food" | "cooking") => a.concerns.filter(c => c.kind === kind).map(c => ({
    id: c.id, name: c.name, severity: c.severity, concern: c.concern, detail: c.reason, context: c.context, sources: c.sources,
  }));
  return [
    { title: "In the ingredients", findings: a.flags.map(({ entry, matchedText }) => ({
      id: entry.id, name: entry.name, severity: entry.severity, concern: entry.concern,
      detail: `Listed as “${matchedText}”`, context: entry.context, sources: entry.sources,
    })) },
    { title: "The food itself", findings: fromConcerns("food") },
    { title: "Formed when cooked", findings: fromConcerns("cooking") },
  ].filter(g => g.findings.length > 0);
}

const COOKING_LOOK = { short: "Forms when cooked", color: "#4B5563", bg: "#F3F4F6", Icon: Flame };
```
  (c) The row component's first three lines,
    `function FlagRow({ flag, open, onToggle }: { flag: Flag; open: boolean; onToggle: () => void }) {`,
    `  const { entry, matchedText } = flag;` and `  const look = VERDICT_STYLE[entry.severity];`, become two lines:
```tsx
function FindingRow({ finding: entry, open, onToggle }: { finding: Finding; open: boolean; onToggle: () => void }) {
  const look = entry.severity ? VERDICT_STYLE[entry.severity] : COOKING_LOOK;
```
  The rest of the row body reads `entry.name`, `entry.concern`, `entry.context` and `entry.sources`; `Finding` has the
  same fields, so they work unchanged.
  (d) Replace `<p className="text-[10px] text-gray-400 mt-0.5">Listed as “{matchedText}”</p>` with
    `<p className="text-[10px] text-gray-400 mt-0.5">{entry.detail}</p>`.
  (e) In `alternatives`, replace `if (analysis.verdict !== "high" && analysis.verdict !== "some") return [];` with
    `if (analysis.verdict !== "known" && analysis.verdict !== "high" && analysis.verdict !== "some") return [];`.
  (f) In the hero, directly after the store chips' closing `))}` (the line after `{s.icon} {s.name === "FB Marketplace" ? "FB" : s.name}` / `</span>`), add:
```tsx
              {formsWhenCooked(analysis) && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">🔥 Forms when cooked</span>
              )}
```
  (g) Replace `{SMALL_PRINT[analysis.verdict](analysis)}` with `{SMALL_PRINT[analysis.verdict]}`.
  (h) Replace the whole `{/* ── Flagged ingredients ── */}` block (from that comment through its closing `)}`) with:
```tsx
          {/* ── Findings, grouped by where they come from ── */}
          {findingGroups(analysis).map(g => (
            <div key={g.title} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">{g.title}</div>
              <div className="divide-y divide-gray-50">
                {g.findings.map(f => (
                  <FindingRow key={f.id} finding={f} open={openFlag === f.id}
                    onToggle={() => setOpenFlag(openFlag === f.id ? null : f.id)} />
                ))}
              </div>
            </div>
          ))}
```

- [ ] **Step 3: `App.tsx`, the product card.**
  - Replace `import { VERDICT_STYLE, safeAnalyze } from "./components/verdict";` with
    `import { VERDICT_STYLE, safeAnalyze, formsWhenCooked, categoryIcon } from "./components/verdict";`
  - In `ProductCard`:
    - replace `const look = VERDICT_STYLE[safeAnalyze(product).verdict];` with two lines,
      `const a = safeAnalyze(product);` and `const look = VERDICT_STYLE[a.verdict];`;
    - replace the left tile (the `<div className="w-14 h-14 rounded-xl …" style={{ background: look.bg }}>` with the
      `ShoppingBag` inside it) with:
```tsx
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-2xl" aria-hidden="true">
        {categoryIcon(product.category)}
      </div>
```
    - replace the right-hand `<div className="flex items-center gap-1.5 flex-shrink-0">` block (the dot and
      `look.short`) with:
```tsx
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: look.color }}>
          <look.Icon size={12} /> {look.short}
        </span>
        {formsWhenCooked(a) && <span className="text-[9px] text-muted-foreground">🔥 forms when cooked</span>}
      </div>
```

- [ ] **Step 4: Build, test and verify in the browser.** Run `npm run build` (expected: builds) and `npm test`
  (expected: 126 pass). Start the dev server, click "Continue as Guest", and check:
  - **Search "meat":** Oscar Mayer, SPAM and Jimmy Dean show a filled circle and "Known carcinogen". Tyson nuggets and
    StarKist tuna show an empty circle and "Nothing flagged". Category icons are 🥩, and there's no green.
  - **Search "snacks":** Lay's, Oreo, Nature Valley, Pringles and Goldfish show "🔥 forms when cooked". Doritos and
    Cheetos show "Some concern" without 🔥. Gerber shows "Food only".
  - **SPAM's page:**
    - a dark hero, "Known carcinogen · 2 findings";
    - an "In the ingredients" group (Sodium nitrite, High concern) and a "The food itself" group (Processed meat,
      reason "Processed meat: SPAM");
    - expanding Processed meat shows the context text and 4 sources with "Source checked" dates.
  - **DiGiorno's page:** "Contains processed meat: Pepperoni".
  - **Lay's page:**
    - a grey hero "Nothing flagged", the small print "No hazard flags from IARC, EU or FDA. This doesn't rate nutrition
      (coming next).";
    - a "🔥 Forms when cooked" chip;
    - a "Formed when cooked" group whose Acrylamide row expands to 5 sources, including the FDA's "golden rather than
      brown" advice.
  - **Typed `049000042566` (Coke Zero, USDA):** "Some concern" (aspartame), with a quarter-filled circle.
  - **Greyscale (Review Focus 5):** in the console run `document.documentElement.style.filter = "grayscale(1)"`. The
    four levels must still be told apart by word and circle fill. Then reset it to `""`.
  - **The console:** no errors.
  - Take a screenshot of the "meat" search and of SPAM's page for the owner.

- [ ] **Step 5: Commit.**
```bash
git add src/app/components/verdict.tsx src/app/components/ProductDetailScreen.tsx src/app/App.tsx
git commit -m "UI: one darkening concern badge, findings grouped by origin, cooking marker

No green anywhere: Nothing flagged (grey) -> Some -> High -> Known carcinogen,
always word + filled-circle icon + shade. Cards use a category icon.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs, then the owner decides on pushing

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec.

- [ ] **Step 1: `KNOWN_ISSUES.md`.** Roadmap: add "M4 concern levels ✅ <date>". Summarize it in one line: the
  darkening badge, processed meat Known carcinogen, the acrylamide marker, no green. Then reorder the next steps:
  - M5: FDA nutrition line plus fixing the catalog barcodes (K-29);
  - M6: camera and mobile layout;
  - the search fix ("ice cream" → soda: `k.includes(q.split(" ")[0])` in `SearchResultsScreen`) as its own small item.
- [ ] **Step 2: `ARCHITECTURE.md`.**
  - File map: add `foodConcerns.ts` and `assess.ts`.
  - Feature inventory: "Concern badge (4 levels)", "Processed meat", "Acrylamide marker" all working.
- [ ] **Step 3: `PROJECT_HANDOFF.md`.**
  - Phase line.
  - Decision log: add `| 019 | One darkening concern badge, no green; level = strongest official finding (additives + food itself); acrylamide is a marker only | Owner, 2026-09-30: "Nothing flagged" isn't "healthy"; avoid flagging the whole bread aisle | **Done** (M4) |`.
- [ ] **Step 4: `SYNOPSIS.md` and the spec.**
  - SYNOPSIS: update the current state.
  - The spec's status line becomes `implemented (<first>…<last> commits)`.
- [ ] **Step 5: Commit, then ask.** Run `npm test`, then:
```bash
git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md
git commit -m "Docs: M4 done (concern levels, processed meat, acrylamide marker)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
  Ask the owner: "Push to GitHub? This updates the live site." Push only on a yes, then confirm the Actions run
  succeeds and check the live site for the "meat" search.

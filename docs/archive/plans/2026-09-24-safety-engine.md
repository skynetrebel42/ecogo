# Safety Engine (M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace EcoGo's fake product scoring with an evidence-first ingredient safety check. It flags only ingredients with an official health concern, each with its sources. The work starts with the approved codebase cleanup.

**Architecture:** A pure TypeScript engine in `src/lib/safety/` (`library.ts` verified data, `parse.ts` label splitting, `analyze.ts` matching → verdict) is used by the product page and product lists through one shared UI file, `src/app/components/verdict.tsx`. It is deterministic at runtime, with no network and no AI. The library is AI-researched at development time and every source is machine-checked. Tests run on Node's built-in test runner.

**Tech Stack:** React 18 + Vite 6 + TypeScript (type-stripped by esbuild/Node, no tsc in the repo), Node 24 `node --test`, Supabase (unchanged in this plan).

**Spec:** `docs/superpowers/specs/2026-09-24-safety-engine-design.md`. Read it first; this plan implements it.

## Global Constraints

- Node 24+ runs the tests directly: `node --test "src/lib/safety/**/*.test.ts"`. Relative imports inside `src/lib/safety/` **must** include the `.ts` extension. No enums or other non-erasable TypeScript in `src/lib/safety/`.
- **No new dependencies** (runtime or dev). The cleanup in Task 0 removes 53.
- The engine never calls the network or an AI at runtime. The free tier only.
- Library: **official concerns only** (IARC Group 1/2A/2B for ingestion, EU/FDA food bans or revocations, EU-mandated warning labels). Every entry has ≥1 source with `url`, a verbatim `quote` (≤25 words) and `checkedOn`. `severity === deriveSeverity(sources)`.
- Aliases are lowercase and trimmed, ≥3 characters, unique across the library. E-codes match `^E\d{3,4}[A-Z]?$`.
- Food categories exactly: Beverages, Bread, Breakfast, Condiments, Dairy, Frozen, Meat, Snacks.
- Exact user-facing copy:
  - Verdict labels: "High-concern ingredient", "Ingredients of some concern", "No ingredients of concern found", "Not enough data", "Ingredient check covers food & drinks for now".
  - Attribution: "Ingredient profiles researched with AI and verified against IARC, EU and FDA sources."
- On this Windows machine, create or edit code files with an editor or the file-writing tool, **never shell heredocs**, because Git Bash collapses backslashes and silently breaks regexes.
- Every task ends with `npm run build` passing, `npm test` passing (from Task 1 on), and one commit. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- If agents are used (e.g. for Task 2 research): ≤3 agents, explicit `effort: "medium"`, and a 20-minute watchdog. Never relaunch a job unchanged after a usage-limit failure.

## Review Focus

Real-world inputs the spec doesn't spell out, most likely first. Each has a test in Task 1:

1. **Negated mentions** ("no titanium dioxide", "free from aspartame", "nitrite-free") must never be flagged, since they claim absence. Tests: `parse.test.ts` "negated mentions are dropped"; `analyze.test.ts` "'no aspartame' / 'nitrite-free' do not flag".
2. **An unclosed bracket** on a label ("Enriched flour (wheat flour, niacin, sodium nitrite") must still check the items inside it. Test: `parse.test.ts` "an unclosed bracket still yields its inner items".
3. **The same additive named twice**, by name and E-code ("Sodium nitrite (E250)"), is one flag, not two. Test: `analyze.test.ts` "an ingredient named and coded is flagged once".
4. **ALL-CAPS labels, non-breaking spaces and unicode dashes** from real packaging still match. Tests: `parse.test.ts` "non-breaking spaces and unicode dashes are normalized"; `analyze.test.ts` "ALL-CAPS labels match".
5. **"vitamin E 250 IU"** is a vitamin dose, not additive E250. Test: `analyze.test.ts` "'vitamin E 250' is not read as E250".

---

## File Structure

| Path | Task | Responsibility |
|---|---|---|
| `src/lib/safety/library.ts` | 1 (types), 2 (data) | Library types, `deriveSeverity`, `LIBRARY` data |
| `src/lib/safety/parse.ts` | 1 | Label text → flat item list (sub-ingredients, filler, allergens, negations) |
| `src/lib/safety/analyze.ts` | 1 | Items + codes → `Analysis` (verdict, flags); `VERDICT_RANK`, `FOOD_CATEGORIES` |
| `src/lib/safety/parse.test.ts`, `analyze.test.ts` | 1 | Engine unit tests (with a test-only library) |
| `src/lib/safety/library.test.ts` | 2 | Library integrity (sources, severity, aliases, codes) |
| `scripts/verify-sources.mjs` | 2 | Network check: each source's quote appears on its page |
| `scripts/export-catalog-fixture.mjs` | 3 | Exports the 51 products from `products.csv` via the app's importer |
| `src/lib/safety/fixtures/catalog.json` | 3 | Generated test input (id, name, category, ingredients) |
| `src/lib/safety/fixtures/expected-flags.json` | 3 | Hand-reviewed expected verdict + flags per product |
| `src/lib/safety/catalog.test.ts` | 3 | Zero-false-alarms check over all 51 products |
| `src/app/components/verdict.tsx` | 4 | Verdict colours/labels/icons, `safeAnalyze`, `verdictHeadline` |
| `src/app/components/ProductDetailScreen.tsx` | 4 | Rewritten product page (verdict, flags, ingredients, prices, alternatives) |
| `src/app/App.tsx` | 0, 4, 5 | Dead-code removal; product-list badges and sorting; honest labels |
| `package.json`, `vite.config.ts`, `src/styles/theme.css`, `ATTRIBUTIONS.md` | 0 | Cleanup |
| `index.html`, docs (`KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, spec) | 5 | Honest meta text; status updates |

---

### Task 0: Codebase cleanup (roadmap M0)

Removes about 5,800 lines of unused code and 53 unused dependencies with **no behaviour change**, so later diffs stay reviewable.

**Files:**
- Delete: `src/app/components/ui/` (48 files), `src/app/components/figma/`, `default_shadcn_theme.css`, `src/styles/globals.css`, `guidelines/`, `pnpm-workspace.yaml`
- Modify: `package.json`, `package-lock.json` (regenerated), `vite.config.ts`, `src/styles/theme.css`, `src/app/App.tsx`, `ATTRIBUTIONS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/app/App.tsx` whose scoring import is exactly `import { scoreColorHex, gradeBadgeClass } from "../lib/scoring";`, with `Resource` having no `x`/`y`. Task 4's edits depend on this.

- [ ] **Step 1: Record the baseline**

Run: `npm run build`
Expected: `✓ 1660 modules transformed` and `✓ built`. Note the JS bundle size (about 778 KB).

- [ ] **Step 2: Delete unused files**

```bash
git rm -r -q src/app/components/ui src/app/components/figma default_shadcn_theme.css src/styles/globals.css guidelines pnpm-workspace.yaml
```

- [ ] **Step 3: Replace `package.json` with exactly this**

```json
{
  "name": "@figma/my-make-file",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "leaflet": "^1.9.4",
    "leaflet.markercluster": "^1.5.3",
    "lucide-react": "0.487.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tw-animate-css": "1.3.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.1.12",
    "@types/leaflet": "^1.9.21",
    "@vitejs/plugin-react": "4.7.0",
    "tailwindcss": "4.1.12",
    "vite": "6.3.5"
  }
}
```

- [ ] **Step 4: Regenerate the lockfile**

Run: `npm install --no-audit --no-fund`
Then: `npm ls --depth=0`
Expected: exactly the 12 packages above, no `UNMET` or `extraneous`.

- [ ] **Step 5: Replace `vite.config.ts` with exactly this** (drops the resolver for the non-existent `src/assets`)

```ts
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
```

- [ ] **Step 6: Remove the unused dark-mode tokens from `src/styles/theme.css`**

Nothing toggles dark mode, and no `dark:` classes remain after Step 2. Delete line 1 (`@custom-variant dark (&:is(.dark *));`) and lines 44–80 (the `.dark { … }` block plus the blank line after it):

```bash
sed -i '44,80d;1d' src/styles/theme.css
grep -c "dark" src/styles/theme.css
```
Expected: `0`.

- [ ] **Step 7: Delete dead code in `src/app/App.tsx`**

The line numbers are for `App.tsx` as of commit `98a6654`. Delete them in one pass: line 83 (`ethicalLabel`), 86–151 (SVG `CityMap`, `ScoreRing`, `ScoreBar`), and 718–805 (the unused inline `MapTab`):

```bash
sed -i '718,805d;86,151d;83d' src/app/App.tsx
grep -cE "CityMap|ScoreRing|ScoreBar|function MapTab|ethicalLabel" src/app/App.tsx
```
Expected: `0`.

- [ ] **Step 8: Fix the imports in `src/app/App.tsx`**

Replace
```ts
import { scoreColorHex, gradeBadgeClass, gradeToVerdict } from "../lib/scoring";
import {
  Home, Map, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Share2, Bookmark, Shield, DollarSign, Star, AlertTriangle, CheckCircle,
  ShoppingBag, Leaf, Zap, Package, Shirt, Bike, Building2, Wifi, Utensils,
  Clock, Phone, X, Plus, Bell, Moon, QrCode, Award, Settings, Sparkles,
  TrendingUp, MapPin
} from "lucide-react";
```
with
```ts
import { scoreColorHex, gradeBadgeClass } from "../lib/scoring";
import {
  Home, Map, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Bookmark, Shield, DollarSign, Star, AlertTriangle, CheckCircle,
  ShoppingBag, Leaf, Package, Shirt, Bike, Building2, Wifi, Utensils,
  Plus, Bell, Moon, QrCode, Award, Settings, Sparkles, MapPin
} from "lucide-react";
```

- [ ] **Step 9: Remove the `x`/`y` fields that only the deleted SVG map read**

In the `Resource` interface, replace
```ts
  hours: string; phone?: string | null; description: string; x: number; y: number;
```
with
```ts
  hours: string; phone?: string | null; description: string;
```

Replace the whole `const RESOURCES: Resource[] = [ … ];` block with:
```ts
const RESOURCES: Resource[] = [
  { id: 1,  name: "Community Food Pantry",   type: "food-bank",   address: "142 Oak Street",       hours: "Mon–Fri 9am–5pm",      phone: "(555) 234-5678", description: "Hot meals and dry goods. No ID required." },
  { id: 2,  name: "Second Harvest Hub",      type: "food-bank",   address: "389 Maple Avenue",     hours: "Daily 8am–7pm",        phone: "(555) 876-5432", description: "Fresh produce and pantry staples. 200+ families weekly." },
  { id: 3,  name: "Goodwill Drop-Off",       type: "donation",    address: "55 Central Boulevard", hours: "Mon–Sat 8am–8pm",      phone: "(555) 345-6789", description: "Clothing, furniture, electronics. Tax receipt provided." },
  { id: 4,  name: "Habitat ReStore",         type: "donation",    address: "201 Pine Road",        hours: "Tue–Sat 9am–6pm",      phone: "(555) 456-7890", description: "Home improvement items and appliances." },
  { id: 5,  name: "Winter Warmth Drive",     type: "clothing",    address: "78 Elm Street",        hours: "Wed–Sun 10am–4pm",     phone: "(555) 567-8901", description: "Coats, hats, and warm clothing for all ages." },
  { id: 6,  name: "Thread & Share Co-op",    type: "clothing",    address: "315 Birch Way",        hours: "Mon, Wed, Fri 12–6pm", phone: "(555) 678-9012", description: "Free clothing exchange — take what you need." },
  { id: 7,  name: "Community Bike Shop",     type: "bike-repair", address: "92 River Drive",       hours: "Sat–Sun 10am–3pm",     phone: "(555) 789-0123", description: "Free repairs, tire changes, and safety checks." },
  { id: 8,  name: "Pedal Forward Workshop",  type: "bike-repair", address: "420 Lake Avenue",      hours: "Tue, Thu 4pm–8pm",     phone: "(555) 890-1234", description: "DIY repair station with tools and spare parts." },
  { id: 9,  name: "City Hall Restrooms",     type: "restroom",    address: "1 Civic Plaza",        hours: "Mon–Fri 7am–9pm",      phone: null,             description: "Clean, accessible public restrooms. ADA compliant." },
  { id: 10, name: "Central Park Facilities", type: "restroom",    address: "Park Boulevard",       hours: "Daily 6am–10pm",       phone: null,             description: "Restrooms and water fountains throughout the park." },
  { id: 11, name: "Public Library WiFi",     type: "wifi",        address: "250 Knowledge Drive",  hours: "Mon–Sat 8am–8pm",      phone: "(555) 901-2345", description: "High-speed internet. Computers available." },
  { id: 12, name: "Community Center WiFi",   type: "wifi",        address: "88 Unity Avenue",      hours: "Daily 7am–11pm",       phone: "(555) 012-3456", description: "Free WiFi, charging stations, and computer terminals." },
];
```

In `rowToResource`, replace
```ts
description: r.description ?? "", x: r.x ?? 0, y: r.y ?? 0 };
```
with
```ts
description: r.description ?? "" };
```

- [ ] **Step 10: `ATTRIBUTIONS.md`**. Delete the first paragraph (the shadcn/ui line; those components are gone). Keep the Unsplash paragraph.

- [ ] **Step 11: Verify nothing changed for users**

Run: `npm run build`
Expected: builds (fewer modules than 1660 is fine; errors are not).
Run: `npm run dev`. In the browser at http://localhost:5173, click Continue as Guest, then check Home, Map, Scan, Saved and Profile, open a product from search, and go back. Every tab must look and work exactly as before, and the console must show no errors. The Supabase websocket may log reconnects if offline.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Cleanup: remove unused UI kit, 53 dependencies and dead code

No behaviour change: deletes src/app/components/ui (48 files, imported by
nothing), figma helper, template leftovers, the unused dark-mode tokens,
the dead SVG map / score widgets in App.tsx, and x/y resource fields only
that map read. Dependencies 61 -> 7 (+ @types/leaflet as dev).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Safety engine: parsing, matching, verdicts

**Files:**
- Create: `src/lib/safety/library.ts`, `src/lib/safety/parse.ts`, `src/lib/safety/analyze.ts`
- Test: `src/lib/safety/parse.test.ts`, `src/lib/safety/analyze.test.ts`
- Modify: `package.json` (`"test"` script)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `library.ts`:
    - `type Severity = "high" | "some"`
    - `type Basis`, `interface Source`, `interface LibraryEntry`
    - `deriveSeverity(sources: Source[]): Severity | null`
    - `LIBRARY: LibraryEntry[]` (empty until Task 2)
  - `parse.ts`: `parseIngredients(text: string): string[]`
  - `analyze.ts`:
    - `type Verdict = "high" | "some" | "none" | "no-data" | "non-food"`
    - `interface Flag { entry: LibraryEntry; matchedText: string }`
    - `interface Analysis { verdict: Verdict; flags: Flag[]; checkedCount: number }`
    - `VERDICT_RANK: Record<Verdict, number>`
    - `FOOD_CATEGORIES: ReadonlySet<string>`
    - `analyzeIngredients(input: { ingredients: string; category?: string; additiveCodes?: string[] }, library?: LibraryEntry[]): Analysis`

- [ ] **Step 1: Add the test script to `package.json`**

In `"scripts"`, add `"test": "node --test \"src/lib/safety/**/*.test.ts\""` so it reads:
```json
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "node --test \"src/lib/safety/**/*.test.ts\""
  },
```

- [ ] **Step 2: Write the failing parser tests: `src/lib/safety/parse.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredients } from "./parse.ts";

test("a comma between digits does not split a chemical name", () => {
  const items = parseIngredients("Water, 1,4-dioxane (trace), salt");
  assert.ok(items.includes("1,4-dioxane"));
  assert.ok(!items.includes("1"));
  assert.ok(!items.includes("4-dioxane"));
});

test("sub-ingredients inside parentheses are extracted", () => {
  const items = parseIngredients("Enriched flour, pepperoni (pork, beef, salt, spices, sodium nitrite), mozzarella");
  assert.ok(items.includes("pepperoni"));
  assert.ok(items.includes("sodium nitrite"));
  assert.ok(items.includes("mozzarella"));
});

test("nested brackets are expanded at every depth", () => {
  const items = parseIngredients("seasoning (cheese [milk, salt, enzymes], Yellow 6)");
  assert.deepEqual(items, ["seasoning", "cheese", "milk", "salt", "enzymes", "Yellow 6"]);
});

test("label filler prefixes are removed but the items after them are kept", () => {
  const items = parseIngredients("Ingredients: Wheat flour, water, contains 2% or less of: salt, yeast");
  assert.deepEqual(items, ["Wheat flour", "water", "salt", "yeast"]);
});

test("semicolons split, and 'inactive:' is filler", () => {
  const items = parseIngredients("Acetaminophen 500mg; inactive: corn starch, hypromellose");
  assert.deepEqual(items, ["Acetaminophen 500mg", "corn starch", "hypromellose"]);
});

test("allergen statements are dropped", () => {
  const items = parseIngredients("Sugar, cocoa butter. Contains: Milk, Soy. May contain traces of peanuts, tree nuts.");
  assert.deepEqual(items, ["Sugar", "cocoa butter"]);
});

test("and/or separates alternatives", () => {
  const items = parseIngredients("Vegetable Oil (Sunflower, Corn, and/or Canola Oil)");
  assert.deepEqual(items, ["Vegetable Oil", "Sunflower", "Corn", "Canola Oil"]);
});

test("trailing periods and footnote asterisks are stripped", () => {
  assert.deepEqual(parseIngredients("Organic sugar*, salt."), ["Organic sugar", "salt"]);
});

// Review Focus: an unclosed bracket must not hide the rest of the label.
test("an unclosed bracket still yields its inner items", () => {
  const items = parseIngredients("Enriched flour (wheat flour, niacin, sodium nitrite");
  assert.ok(items.includes("sodium nitrite"));
});

// Review Focus: negated mentions are claims of absence, not ingredients.
test("negated mentions are dropped", () => {
  const items = parseIngredients("Pork, water, no titanium dioxide, free from aspartame, nitrite-free, salt");
  assert.deepEqual(items, ["Pork", "water", "salt"]);
});

// Review Focus: odd whitespace and dash characters from real labels are normalized.
test("non-breaking spaces and unicode dashes are normalized", () => {
  const items = parseIngredients("sodium nitrite, E‑250");
  assert.deepEqual(items, ["sodium nitrite", "E-250"]);
});

test("empty and non-string input yield an empty list", () => {
  assert.deepEqual(parseIngredients(""), []);
  assert.deepEqual(parseIngredients("   "), []);
  assert.deepEqual(parseIngredients(undefined as unknown as string), []);
});
```

- [ ] **Step 3: Write the failing engine tests: `src/lib/safety/analyze.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeIngredients, VERDICT_RANK } from "./analyze.ts";
import type { LibraryEntry } from "./library.ts";

const src = { body: "IARC", finding: "test", url: "https://example.org", quote: "test", checkedOn: "2026-09-24" } as const;

/** Test-only library: the engine is tested independently of the real library's content. */
const LIB: LibraryEntry[] = [
  { id: "sodium-nitrite", name: "Sodium nitrite", aliases: ["sodium nitrite"], eCodes: ["E250"], severity: "high", concern: "t", sources: [{ ...src, basis: "iarc-2a" }] },
  { id: "aspartame", name: "Aspartame", aliases: ["aspartame"], eCodes: ["E951"], severity: "some", concern: "t", sources: [{ ...src, basis: "iarc-2b" }] },
  { id: "brilliant-blue", name: "Blue 1", aliases: ["blue 1"], eCodes: ["E133"], severity: "some", concern: "t", sources: [{ ...src, basis: "eu-warning-label" }] },
  { id: "caramel-iv", name: "Sulphite ammonia caramel", aliases: ["sulphite ammonia caramel"], eCodes: ["E150D"], severity: "some", concern: "t", sources: [{ ...src, basis: "iarc-2b" }] },
];
const food = (ingredients: string, extra: Partial<{ category: string; additiveCodes: string[] }> = {}) =>
  analyzeIngredients({ ingredients, category: "Snacks", ...extra }, LIB);
const ids = (a: ReturnType<typeof food>) => a.flags.map(f => f.entry.id);

test("names match only as whole phrases (the old '1' → 'Blue 1' false alarm is gone)", () => {
  assert.deepEqual(ids(food("Water, 1,4-dioxane (trace)")), []);
  assert.deepEqual(ids(food("Acetaminophen 500mg")), []);
  assert.deepEqual(ids(food("Red 40, Blue 1")), ["brilliant-blue"]);
});

test("a flagged sub-ingredient inside parentheses is found", () => {
  const a = food("Enriched flour, pepperoni (pork, beef, salt, spices, sodium nitrite)");
  assert.deepEqual(ids(a), ["sodium-nitrite"]);
  assert.equal(a.flags[0].matchedText, "sodium nitrite");
});

test("E-codes match with or without a space, hyphen or brackets", () => {
  for (const text of ["E250", "e 250", "E-250", "preservative (E250)"]) {
    assert.deepEqual(ids(food(text)), ["sodium-nitrite"], text);
  }
});

test("generic terms are not flagged; the precise form is", () => {
  assert.deepEqual(ids(food("Carbonated water, caramel color, phosphoric acid")), []);
  assert.deepEqual(ids(food("caramel color (E150d)")), ["caramel-iv"]);
});

test("additive codes from Open Food Facts are matched", () => {
  assert.deepEqual(ids(food("", { additiveCodes: ["en:e951"] })), ["aspartame"]);
});

test("verdicts follow severity, and high-concern flags come first", () => {
  assert.equal(food("salt, sugar").verdict, "none");
  assert.equal(food("aspartame").verdict, "some");
  const both = food("aspartame, sodium nitrite");
  assert.equal(both.verdict, "high");
  assert.deepEqual(ids(both), ["sodium-nitrite", "aspartame"]);
});

test("no ingredient text means not enough data; non-food categories are not analyzed", () => {
  assert.equal(food("   ").verdict, "no-data");
  assert.equal(analyzeIngredients({ ingredients: "sodium nitrite", category: "Cleaning" }, LIB).verdict, "non-food");
  assert.equal(analyzeIngredients({ ingredients: "sodium nitrite" }, LIB).verdict, "high"); // no category = food (Open Food Facts)
});

test("checkedCount reports the library size", () => {
  assert.equal(food("salt").checkedCount, LIB.length);
});

test("VERDICT_RANK orders fewest concerns first", () => {
  assert.ok(VERDICT_RANK.none < VERDICT_RANK.some && VERDICT_RANK.some < VERDICT_RANK.high);
  assert.ok(VERDICT_RANK.high < VERDICT_RANK["no-data"] && VERDICT_RANK["no-data"] < VERDICT_RANK["non-food"]);
});

// Review Focus: the same additive named twice (name + E-code) is one flag, not two.
test("an ingredient named and coded is flagged once", () => {
  assert.deepEqual(ids(food("Sodium nitrite (E250), salt, E 250")), ["sodium-nitrite"]);
});

// Review Focus: ALL-CAPS labels match.
test("ALL-CAPS labels match", () => {
  assert.deepEqual(ids(food("PORK, WATER, SODIUM NITRITE")), ["sodium-nitrite"]);
});

// Review Focus: "vitamin E" followed by a dose is not an E-number.
test("'vitamin E 250' is not read as E250", () => {
  assert.deepEqual(ids(food("vitamin E 250 IU, water")), []);
});

// Review Focus: negated mentions never flag.
test("'no aspartame' / 'nitrite-free' do not flag", () => {
  assert.deepEqual(ids(food("Water, no aspartame, nitrite-free")), []);
});

test("the engine never throws on hostile input", () => {
  const nasty = ["", "((((", "))))", "[{(", ",,,;;;", "\u0000￿", "🍕".repeat(500), "a, ".repeat(5000), "E".repeat(10000)];
  for (const text of nasty) assert.doesNotThrow(() => food(text));
  assert.doesNotThrow(() => analyzeIngredients({ ingredients: undefined as unknown as string }, LIB));
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `ERR_MODULE_NOT_FOUND` for `./parse.ts` / `./analyze.ts`.

- [ ] **Step 5: Create `src/lib/safety/library.ts`**

```ts
// library.ts — the verified ingredient library for the safety engine.
// Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §5.
// Every entry must pass `npm run verify:sources` and the integrity test before it ships.

export type Severity = "high" | "some";

/** What a source establishes. "context" = a regulator's intake position; it never sets severity. */
export type Basis =
  | "iarc-1" | "iarc-2a" | "iarc-2b"
  | "banned-eu" | "banned-us"
  | "eu-warning-label"
  | "context";

export interface Source {
  body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO/JECFA";
  basis: Basis;
  finding: string;   // e.g. "Group 2B: possibly carcinogenic to humans"
  url: string;       // official page
  quote: string;     // short verbatim phrase from that page (checked by verify:sources)
  checkedOn: string; // YYYY-MM-DD
}

export interface LibraryEntry {
  id: string;          // slug, e.g. "sodium-nitrite"
  name: string;        // display name
  aliases: string[];   // lowercase label spellings, >= 3 characters, unique across the library
  eCodes: string[];    // e.g. ["E250"]
  severity: Severity;  // must equal deriveSeverity(sources)
  concern: string;     // one plain-English sentence
  context?: string;    // regulator intake position shown next to the flag
  sources: Source[];
}

const HIGH_BASES: ReadonlySet<Basis> = new Set(["iarc-1", "iarc-2a", "banned-eu", "banned-us"]);
const SOME_BASES: ReadonlySet<Basis> = new Set(["iarc-2b", "eu-warning-label"]);

/** Severity is mechanical: the strongest basis among an entry's sources. null = no severity-bearing source. */
export function deriveSeverity(sources: Source[]): Severity | null {
  if (sources.some(s => HIGH_BASES.has(s.basis))) return "high";
  if (sources.some(s => SOME_BASES.has(s.basis))) return "some";
  return null;
}

export const LIBRARY: LibraryEntry[] = [];
```

- [ ] **Step 6: Create `src/lib/safety/parse.ts`**

```ts
// parse.ts — raw ingredient text → flat list of ingredient items (original letter case kept for display).
// Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §6.

const OPEN = "([{";
const CLOSE = ")]}";

/** Label filler that prefixes real ingredients; the items after it are kept. */
const FILLER_PREFIXES: RegExp[] = [
  /^ingredients?\s*:\s*/i,
  /^(?:contains\s+)?(?:less\s+than\s+)?\d+(?:\.\d+)?\s*%\s+(?:or\s+less\s+)?of(?:\s+(?:each\s+of\s+)?the\s+following)?\s*:?\s*/i,
  /^(?:in)?active(?:\s+ingredients?)?\s*:\s*/i,
];

/** "no titanium dioxide", "free from aspartame", "nitrite-free" state an absence, not an ingredient. */
const NEGATION = /^(?:no|free\s+from|without)\s|\b[a-z0-9]+-free\b/i;

export function parseIngredients(text: string): string[] {
  if (typeof text !== "string") return [];
  const cleaned = text
    .replace(/[   ]/g, " ")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\bmay\s+contain\b[^.]*(?:\.|$)/gi, " ")
    .replace(/(^|\.)\s*contains\s*:[^.]*(?:\.|$)/gi, "$1 ")
    .replace(/\band\s*\/\s*or\b/gi, ",");
  const out: string[] = [];
  for (const part of splitTopLevel(cleaned)) expand(part, out);
  return out;
}

/** Split on commas and semicolons outside brackets; a comma between two digits ("1,4-dioxane") is not a separator. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    const digitComma = ch === "," && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "");
    if (depth === 0 && (ch === ";" || (ch === "," && !digitComma))) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/** "parent (a, b) rest" → parent + rest, then a and b — at every nesting depth; unclosed brackets run to the end. */
function expand(raw: string, out: string[]): void {
  const item = stripFiller(raw.trim());
  const open = item.search(/[([{]/);
  if (open === -1) {
    emit(item, out);
    return;
  }
  let depth = 0;
  let close = -1;
  for (let i = open; i < item.length; i++) {
    if (OPEN.includes(item[i])) depth++;
    else if (CLOSE.includes(item[i]) && --depth === 0) {
      close = i;
      break;
    }
  }
  const inner = item.slice(open + 1, close === -1 ? item.length : close);
  const rest = close === -1 ? "" : item.slice(close + 1);
  expand(`${item.slice(0, open)} ${rest}`, out);
  for (const sub of splitTopLevel(inner)) expand(sub, out);
}

function emit(raw: string, out: string[]): void {
  const item = stripFiller(raw.replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim())
    .replace(/^[\s.,:;*•-]+|[\s.,:;*•]+$/g, "");
  if (item && !NEGATION.test(item)) out.push(item);
}

function stripFiller(s: string): string {
  let prev: string;
  do {
    prev = s;
    for (const re of FILLER_PREFIXES) s = s.replace(re, "");
  } while (s !== prev);
  return s.trim();
}
```

- [ ] **Step 7: Create `src/lib/safety/analyze.ts`**

```ts
// analyze.ts — ingredient text (+ optional additive codes) → verdict and flags.
// Deterministic: no network, no AI. Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §4, §6.

import { LIBRARY, type LibraryEntry } from "./library.ts";
import { parseIngredients } from "./parse.ts";

export type Verdict = "high" | "some" | "none" | "no-data" | "non-food";
export interface Flag { entry: LibraryEntry; matchedText: string }
export interface Analysis { verdict: Verdict; flags: Flag[]; checkedCount: number }

/** "Fewest concerns first" order; lower is better. no-data / non-food sort last. */
export const VERDICT_RANK: Record<Verdict, number> = { none: 0, some: 1, high: 2, "no-data": 3, "non-food": 4 };

/** Categories the library covers (food & drinks first). */
export const FOOD_CATEGORIES: ReadonlySet<string> = new Set([
  "Beverages", "Bread", "Breakfast", "Condiments", "Dairy", "Frozen", "Meat", "Snacks",
]);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** E-numbers in label text: "E250", "E 250", "E-250", "e150d" — but never "vitamin E 250". */
const E_CODE = /(?<!vitamin\s)(?<![a-z0-9])e[\s-]?(\d{3,4}[a-z]?)(?![a-z0-9])/g;

/** "en:e250" (Open Food Facts), "E 250", "e250" → "E250". */
const normalizeCode = (code: string) => code.replace(/^[a-z]{2}:/i, "").replace(/[\s-]/g, "").toUpperCase();

export function analyzeIngredients(
  input: { ingredients: string; category?: string; additiveCodes?: string[] },
  library: LibraryEntry[] = LIBRARY,
): Analysis {
  const checkedCount = library.length;
  if (input.category !== undefined && !FOOD_CATEGORIES.has(input.category)) {
    return { verdict: "non-food", flags: [], checkedCount };
  }
  const text = typeof input.ingredients === "string" ? input.ingredients : "";
  const codes = (input.additiveCodes ?? []).map(normalizeCode);
  if (!text.trim() && codes.length === 0) return { verdict: "no-data", flags: [], checkedCount };

  const matchers = library.map(entry => ({
    entry,
    aliases: entry.aliases.map(a => new RegExp(`(?<![a-z0-9])${escapeRegExp(a)}(?![a-z0-9])`)),
  }));
  const flags: Flag[] = [];
  const flagged = new Set<string>();
  const flag = (entry: LibraryEntry, matchedText: string) => {
    if (flagged.has(entry.id)) return;
    flagged.add(entry.id);
    flags.push({ entry, matchedText });
  };

  for (const item of parseIngredients(text)) {
    const lower = item.toLowerCase();
    const itemCodes = [...lower.matchAll(E_CODE)].map(m => `E${m[1].toUpperCase()}`);
    for (const { entry, aliases } of matchers) {
      if (aliases.some(re => re.test(lower)) || itemCodes.some(c => entry.eCodes.includes(c))) flag(entry, item);
    }
  }
  for (const code of codes) {
    for (const { entry } of matchers) if (entry.eCodes.includes(code)) flag(entry, code);
  }

  flags.sort((a, b) => (a.entry.severity === b.entry.severity ? 0 : a.entry.severity === "high" ? -1 : 1));
  const verdict: Verdict = flags.some(f => f.entry.severity === "high") ? "high" : flags.length > 0 ? "some" : "none";
  return { verdict, flags, checkedCount };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test`
Expected: `ℹ tests 26`, `ℹ pass 26`, `ℹ fail 0`.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: builds. The engine isn't imported by the app yet, so the UI is unchanged.

- [ ] **Step 10: Commit**

```bash
git add package.json src/lib/safety
git commit -m "Add safety engine: ingredient parsing, whole-word matching, verdicts

Pure TypeScript, deterministic, no network: parses labels (sub-ingredients,
filler, allergen statements, negations), matches whole phrases and E-codes,
and returns a verdict with flags. 26 tests on Node's built-in runner,
including the review-focus cases. Library data comes next.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The verified ingredient library

**Files:**
- Create: `src/lib/safety/library.test.ts`, `scripts/verify-sources.mjs`
- Modify: `src/lib/safety/library.ts` (fill `LIBRARY`), `package.json` (`"verify:sources"` script)

**Interfaces:**
- Consumes: `LibraryEntry`, `Source`, `deriveSeverity` from Task 1.
- Produces: `LIBRARY` entries with these **exact ids**, which Task 3's expected file uses: `sodium-nitrite`, `allura-red`, `aspartame`, `sunset-yellow`, `bha`. Other ids are free-form slugs.

- [ ] **Step 1: Write the failing integrity test: `src/lib/safety/library.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, deriveSeverity } from "./library.ts";

const BODIES = new Set(["IARC", "EU", "FDA", "EFSA", "WHO/JECFA"]);

test("the library is not empty", () => {
  assert.ok(LIBRARY.length > 0);
});

test("ids are unique slugs", () => {
  const ids = LIBRARY.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("aliases are lowercase, trimmed, at least 3 characters and unique across the library", () => {
  const seen = new Map<string, string>();
  for (const e of LIBRARY) {
    for (const a of e.aliases) {
      assert.equal(a, a.trim().toLowerCase(), `${e.id}: alias "${a}" must be lowercase and trimmed`);
      assert.ok(a.length >= 3, `${e.id}: alias "${a}" is shorter than 3 characters`);
      assert.ok(!seen.has(a), `alias "${a}" is used by both ${seen.get(a)} and ${e.id}`);
      seen.set(a, e.id);
    }
  }
});

test("E-codes are well-formed and unique; every entry has something to match", () => {
  const seen = new Map<string, string>();
  for (const e of LIBRARY) {
    assert.ok(e.aliases.length + e.eCodes.length > 0, `${e.id}: needs an alias or an E-code`);
    for (const c of e.eCodes) {
      assert.match(c, /^E\d{3,4}[A-Z]?$/, `${e.id}: bad E-code ${c}`);
      assert.ok(!seen.has(c), `E-code ${c} is used by both ${seen.get(c)} and ${e.id}`);
      seen.set(c, e.id);
    }
  }
});

test("every entry is fully sourced", () => {
  for (const e of LIBRARY) {
    assert.ok(e.name.trim() && e.concern.trim(), `${e.id}: name and concern are required`);
    assert.ok(e.sources.length > 0, `${e.id}: at least one source is required`);
    for (const s of e.sources) {
      assert.ok(BODIES.has(s.body), `${e.id}: unknown body ${s.body}`);
      assert.match(s.url, /^https:\/\//, `${e.id}: source url must be https`);
      assert.ok(s.finding.trim(), `${e.id}: finding is required`);
      assert.ok(s.quote.trim(), `${e.id}: quote is required`);
      assert.ok(s.quote.trim().split(/\s+/).length <= 25, `${e.id}: keep quotes short (<= 25 words)`);
      assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${e.id}: checkedOn must be YYYY-MM-DD`);
    }
  }
});

test("severity is exactly what the sources establish", () => {
  for (const e of LIBRARY) {
    assert.equal(e.severity, deriveSeverity(e.sources), `${e.id}: severity must match its sources`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL on "the library is not empty"; everything else passes.

- [ ] **Step 3: Create `scripts/verify-sources.mjs` and the npm script**

```js
// Checks every library source: fetches its URL and confirms the recorded quote appears on the page.
// Usage: npm run verify:sources   (needs the internet; run whenever src/lib/safety/library.ts changes)
// "unverifiable" (blocked, PDF, JS-only page) means: open the page by hand and confirm the quote before keeping the entry.
import { LIBRARY } from "../src/lib/safety/library.ts";

const normalize = (s) => s
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[‐-―]/g, "-")
  .replace(/\s+/g, " ")
  .toLowerCase()
  .trim();

const totals = { pass: 0, fail: 0, unverifiable: 0 };
for (const entry of LIBRARY) {
  for (const source of entry.sources) {
    let status;
    let detail = "";
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "EcoGo source check (personal project)" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok) { status = "unverifiable"; detail = `HTTP ${res.status}`; }
      else if (!/html|text/.test(type)) { status = "unverifiable"; detail = type || "unknown content type"; }
      else if (normalize(await res.text()).includes(normalize(source.quote))) status = "pass";
      else { status = "fail"; detail = "quote not found on page"; }
    } catch (err) {
      status = "unverifiable";
      detail = err?.message ?? String(err);
    }
    totals[status]++;
    console.log(`${status.toUpperCase().padEnd(13)} ${entry.id} · ${source.body} · ${source.url}${detail ? ` (${detail})` : ""}`);
  }
}
console.log(`\n${totals.pass} pass, ${totals.fail} fail, ${totals.unverifiable} unverifiable`);
if (totals.fail > 0) process.exitCode = 1;
```

In `package.json` `"scripts"`, add `"verify:sources": "node scripts/verify-sources.mjs"`.

- [ ] **Step 4: Research and draft the entries (the AI-research step)**

For each candidate below, open the official page, confirm the classification, and draft a `LibraryEntry` in `src/lib/safety/library.ts` inside `export const LIBRARY: LibraryEntry[] = [ … ];`.

Rules:
- `quote` is copied **verbatim** from the page (≤25 words) and must contain the classification or ban wording.
- `basis` follows the spec §5 mapping. **An IARC classification counts only if its evaluation covers ingestion.** Titanium dioxide's IARC 2B is about inhalation, so its basis is the EU ban.
- Where a food regulator's intake position exists (e.g. WHO/JECFA for aspartame), add it as a second source with `basis: "context"` and summarize it in `context`.
- Aliases: US label spellings included ("yellow 6", "yellow no. 6", "fd&c yellow no. 6"); lowercase; no generic terms (never "caramel color").

Starting points (official):
- IARC list of classifications: https://monographs.iarc.who.int/agents-classified-by-the-iarc/ and the individual monograph pages on https://publications.iarc.who.int/
- EU food additives regulation incl. Annex V warning label: https://eur-lex.europa.eu/eli/reg/2008/1333/oj
- EU titanium dioxide ban: https://eur-lex.europa.eu/eli/reg/2022/63/oj
- FDA Red No. 3: https://www.fda.gov/food/food-additives-petitions/fdc-red-no-3
- FDA brominated vegetable oil: https://www.fda.gov/food/food-additives-petitions/brominated-vegetable-oil-bvo
- WHO/IARC + JECFA aspartame: https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released

| id (use exactly) | name | aliases | eCodes | expected basis |
|---|---|---|---|---|
| `sodium-nitrite` | Sodium nitrite | sodium nitrite | E250 | iarc-2a (ingested nitrite, nitrosation) |
| `potassium-nitrite` | Potassium nitrite | potassium nitrite | E249 | iarc-2a |
| `sodium-nitrate` | Sodium nitrate | sodium nitrate | E251 | iarc-2a |
| `potassium-nitrate` | Potassium nitrate | potassium nitrate | E252 | iarc-2a |
| `titanium-dioxide` | Titanium dioxide | titanium dioxide | E171 | banned-eu |
| `brominated-vegetable-oil` | Brominated vegetable oil | brominated vegetable oil | — | banned-us |
| `erythrosine` | Erythrosine (Red No. 3) | erythrosine, red 3, red no. 3, fd&c red no. 3 | E127 | banned-us |
| `potassium-bromate` | Potassium bromate | potassium bromate | E924 | iarc-2b |
| `tartrazine` | Tartrazine (Yellow 5) | tartrazine, yellow 5, yellow no. 5, fd&c yellow no. 5 | E102 | eu-warning-label |
| `quinoline-yellow` | Quinoline yellow | quinoline yellow | E104 | eu-warning-label |
| `sunset-yellow` | Sunset yellow (Yellow 6) | sunset yellow, yellow 6, yellow no. 6, fd&c yellow no. 6 | E110 | eu-warning-label |
| `carmoisine` | Carmoisine | carmoisine, azorubine | E122 | eu-warning-label |
| `ponceau-4r` | Ponceau 4R | ponceau 4r | E124 | eu-warning-label |
| `allura-red` | Allura red (Red 40) | allura red, red 40, red no. 40, fd&c red no. 40 | E129 | eu-warning-label |
| `aspartame` | Aspartame | aspartame | E951 | iarc-2b (+ WHO/JECFA context) |
| `bha` | BHA (butylated hydroxyanisole) | bha, butylated hydroxyanisole | E320 | iarc-2b |

Then scan the same official lists for other ingestion-relevant additives common in US groceries, aiming for roughly 30–50 entries in total. Any extra entry that flags a catalog product will surface in Task 3 for review.

The entry format (sodium nitrite shown). **Its `url` and `quote` must pass Step 5** and are replaced with whatever the official page actually says:

```ts
  {
    id: "sodium-nitrite",
    name: "Sodium nitrite",
    aliases: ["sodium nitrite"],
    eCodes: ["E250"],
    severity: "high",
    concern: "Can form cancer-causing nitrosamines in the body; common in cured and processed meats.",
    context: "Permitted as a preservative in the US and EU within set limits.",
    sources: [
      {
        body: "IARC",
        basis: "iarc-2a",
        finding: "Group 2A: ingested nitrate or nitrite under conditions that result in endogenous nitrosation is probably carcinogenic to humans",
        url: "https://monographs.iarc.who.int/agents-classified-by-the-iarc/",
        quote: "probably carcinogenic to humans",
        checkedOn: "2026-09-24",
      },
    ],
  },
```

- [ ] **Step 5: Verify every source**

Run: `npm run verify:sources`
Expected: `0 fail`. For each `FAIL`, fix the quote or URL from the real page, or drop the entry. For each `UNVERIFIABLE`, open the page in a browser, confirm the quote by hand, and list it in the commit message. If a verification drops one of `sodium-nitrite`, `allura-red`, `aspartame`, `sunset-yellow` or `bha`, note it: Task 3's expected file changes accordingly.

- [ ] **Step 6: Run the integrity tests**

Run: `npm test`
Expected: all pass: 26 engine tests + 6 integrity tests.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/verify-sources.mjs src/lib/safety/library.ts src/lib/safety/library.test.ts
git commit -m "Add verified ingredient library (<N> entries) and source checks

Official concerns only (IARC ingestion classifications, EU/FDA bans,
EU warning labels); every entry cites its source with a verbatim quote.
verify:sources: <P> pass, 0 fail, <U> unverifiable (checked by hand: <list>).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Replace `<N>`, `<P>`, `<U>` and `<list>` with the real numbers from Step 5.

---

### Task 3: The zero-false-alarms check over all 51 products

**Files:**
- Create: `scripts/export-catalog-fixture.mjs`, `src/lib/safety/fixtures/catalog.json` (generated), `src/lib/safety/fixtures/expected-flags.json`, `src/lib/safety/catalog.test.ts`

**Interfaces:**
- Consumes: `analyzeIngredients` (Task 1), `LIBRARY` ids (Task 2).
- Produces: the committed regression guarantee; `npm test` fails on any unreviewed flag.

- [ ] **Step 1: Create `scripts/export-catalog-fixture.mjs`**

```js
// Exports { id, name, category, ingredients } for every product in src/data/products.csv,
// using the app's own CSV importer (loaded through Vite so its "?raw" CSV import works).
// Usage: node scripts/export-catalog-fixture.mjs [outFile]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.argv[3] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = process.argv[2] ?? path.join(root, "src/lib/safety/fixtures/catalog.json");
const vite = await import(pathToFileURL(createRequire(path.join(root, "package.json")).resolve("vite")).href);
const server = await vite.createServer({
  root, configFile: path.join(root, "vite.config.ts"), appType: "custom", logLevel: "error",
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { PRODUCTS } = await server.ssrLoadModule("/src/lib/productImporter.ts");
  const fixture = PRODUCTS.map(({ id, name, category, ingredients }) => ({ id, name, category, ingredients }));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Wrote ${fixture.length} products to ${path.relative(root, outFile)}`);
} finally {
  await server.close();
}
```

- [ ] **Step 2: Generate the fixture**

Run: `node scripts/export-catalog-fixture.mjs`
Expected: `Wrote 51 products to src/lib/safety/fixtures/catalog.json`.

- [ ] **Step 3: Write the failing test: `src/lib/safety/catalog.test.ts`**

```ts
// The zero-false-alarms check: every product in the catalog gets exactly the hand-reviewed flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeIngredients } from "./analyze.ts";

interface FixtureProduct { id: number; name: string; category: string; ingredients: string }
const read = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
const catalog: FixtureProduct[] = read("catalog.json");
const expected: Record<string, { verdict: string; flags: string[] }> = read("expected-flags.json");

test("the fixture and the expected file cover the same 51 products", () => {
  assert.equal(catalog.length, 51);
  assert.deepEqual(catalog.map(p => String(p.id)).sort(), Object.keys(expected).sort());
});

for (const p of catalog) {
  test(`#${p.id} ${p.name}: exactly the reviewed flags`, () => {
    const a = analyzeIngredients({ ingredients: p.ingredients, category: p.category });
    assert.deepEqual(
      { verdict: a.verdict, flags: a.flags.map(f => f.entry.id).sort() },
      { verdict: expected[p.id].verdict, flags: [...expected[p.id].flags].sort() },
    );
    for (const f of a.flags) {
      assert.ok(p.ingredients.toLowerCase().includes(f.matchedText.toLowerCase()), `"${f.matchedText}" appears on the label`);
    }
  });
}
```

Run: `npm test`
Expected: FAIL with `ENOENT … expected-flags.json`.

- [ ] **Step 4: Create `src/lib/safety/fixtures/expected-flags.json`**

Each flag below was reviewed against the product's real ingredient list. Every flag is an ingredient actually on the label that has an official concern:
- **#4:** Red 40
- **#6, #36:** sodium nitrite
- **#42:** sodium nitrite, inside the pepperoni
- **#7:** aspartame
- **#13, #15:** Yellow 6
- **#38:** BHA

Plain "caramel color" (#7, #8) is correctly not flagged.

```json
{
  "1": {"verdict": "none", "flags": []},
  "2": {"verdict": "non-food", "flags": []},
  "3": {"verdict": "none", "flags": []},
  "4": {"verdict": "some", "flags": ["allura-red"]},
  "5": {"verdict": "non-food", "flags": []},
  "6": {"verdict": "high", "flags": ["sodium-nitrite"]},
  "7": {"verdict": "some", "flags": ["aspartame"]},
  "8": {"verdict": "none", "flags": []},
  "9": {"verdict": "none", "flags": []},
  "10": {"verdict": "none", "flags": []},
  "11": {"verdict": "none", "flags": []},
  "12": {"verdict": "none", "flags": []},
  "13": {"verdict": "some", "flags": ["sunset-yellow"]},
  "14": {"verdict": "none", "flags": []},
  "15": {"verdict": "some", "flags": ["sunset-yellow"]},
  "16": {"verdict": "none", "flags": []},
  "17": {"verdict": "none", "flags": []},
  "18": {"verdict": "none", "flags": []},
  "19": {"verdict": "none", "flags": []},
  "20": {"verdict": "none", "flags": []},
  "21": {"verdict": "non-food", "flags": []},
  "22": {"verdict": "non-food", "flags": []},
  "23": {"verdict": "non-food", "flags": []},
  "24": {"verdict": "non-food", "flags": []},
  "25": {"verdict": "non-food", "flags": []},
  "26": {"verdict": "non-food", "flags": []},
  "27": {"verdict": "non-food", "flags": []},
  "28": {"verdict": "non-food", "flags": []},
  "29": {"verdict": "non-food", "flags": []},
  "30": {"verdict": "non-food", "flags": []},
  "31": {"verdict": "non-food", "flags": []},
  "32": {"verdict": "none", "flags": []},
  "33": {"verdict": "none", "flags": []},
  "34": {"verdict": "none", "flags": []},
  "35": {"verdict": "none", "flags": []},
  "36": {"verdict": "high", "flags": ["sodium-nitrite"]},
  "37": {"verdict": "none", "flags": []},
  "38": {"verdict": "some", "flags": ["bha"]},
  "39": {"verdict": "none", "flags": []},
  "40": {"verdict": "none", "flags": []},
  "41": {"verdict": "none", "flags": []},
  "42": {"verdict": "high", "flags": ["sodium-nitrite"]},
  "43": {"verdict": "none", "flags": []},
  "44": {"verdict": "none", "flags": []},
  "45": {"verdict": "none", "flags": []},
  "46": {"verdict": "none", "flags": []},
  "47": {"verdict": "none", "flags": []},
  "48": {"verdict": "non-food", "flags": []},
  "49": {"verdict": "non-food", "flags": []},
  "50": {"verdict": "non-food", "flags": []},
  "51": {"verdict": "non-food", "flags": []}
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass (26 + 6 + 52). If a product fails:
- **The engine found a flag not in the file** (only possible for extra library entries from Task 2): check that ingredient on the label against its source. If it's real, add it to that product's `flags`, adjust the `verdict`, and say why in the commit. If it isn't, fix the alias; never weaken the test.
- **A listed flag is missing** (a Task 2 entry was dropped): remove it from the file and note it in the commit.

- [ ] **Step 6: Commit**

```bash
git add scripts/export-catalog-fixture.mjs src/lib/safety/fixtures src/lib/safety/catalog.test.ts
git commit -m "Add zero-false-alarms check over all 51 catalog products

Every product is compared with hand-reviewed expected flags: 3 high
(sodium nitrite, incl. inside pepperoni), 5 some (Red 40, aspartame,
Yellow 6 x2, BHA), 26 none, 17 non-food. Plain caramel color is not flagged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Product page, list badges and sorting

**Files:**
- Create: `src/app/components/verdict.tsx`
- Rewrite: `src/app/components/ProductDetailScreen.tsx` (complete new content below; deletes the old knowledge base, hand-written explanations, score ring and category bars)
- Modify: `src/app/App.tsx` (imports, `ProductCard`, `SearchResultsScreen` sorting, `<ProductDetailScreen>` props)

**Interfaces:**
- Consumes: `analyzeIngredients`, `VERDICT_RANK`, `Analysis`, `Flag`, `Verdict` (Task 1), a filled `LIBRARY` (Task 2).
- Produces:
  - `verdict.tsx`:
    - `VERDICT_STYLE: Record<Verdict, { label; short; color; bg; gradient; Icon }>`
    - `safeAnalyze(p: Product): Analysis`
    - `verdictHeadline(a: Analysis): string`
  - `ProductDetailScreen` props add `onSelectProduct: (p: Product) => void`.

- [ ] **Step 1: Create `src/app/components/verdict.tsx`**

```tsx
// verdict.tsx — how a safety verdict looks, shared by the product page and product lists.

import { AlertTriangle, CheckCircle, HelpCircle, ShieldAlert } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { analyzeIngredients, type Analysis, type Verdict } from "../../lib/safety/analyze";

export const VERDICT_STYLE: Record<Verdict, {
  label: string; short: string; color: string; bg: string; gradient: string; Icon: typeof CheckCircle;
}> = {
  high:       { label: "High-concern ingredient",         short: "High concern", color: "#B91C1C", bg: "#FEE2E2", gradient: "linear-gradient(160deg, #450a0a, #dc2626)", Icon: ShieldAlert },
  some:       { label: "Ingredients of some concern",     short: "Some concern", color: "#B45309", bg: "#FEF3C7", gradient: "linear-gradient(160deg, #78350f, #d97706)", Icon: AlertTriangle },
  none:       { label: "No ingredients of concern found", short: "No concerns",  color: "#15803D", bg: "#DCFCE7", gradient: "linear-gradient(160deg, #064e3b, #10b981)", Icon: CheckCircle },
  "no-data":  { label: "Not enough data",                 short: "No data",      color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
  "non-food": { label: "Ingredient check covers food & drinks for now", short: "Food only", color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
};

const NO_DATA: Analysis = { verdict: "no-data", flags: [], checkedCount: 0 };

/** Never let the engine blank a screen: an unexpected error shows "Not enough data" and is logged. */
export function safeAnalyze(p: Product): Analysis {
  try {
    return analyzeIngredients({ ingredients: p.ingredients, category: p.category });
  } catch (err) {
    console.error("[safety] analysis failed for product", p.id, err);
    return NO_DATA;
  }
}

/** "1 high-concern ingredient · 1 of some concern", "2 ingredients of some concern", or the verdict label. */
export function verdictHeadline(a: Analysis): string {
  const high = a.flags.filter(f => f.entry.severity === "high").length;
  const some = a.flags.length - high;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (a.verdict === "high") return some ? `${plural(high, "high-concern ingredient")} · ${some} of some concern` : plural(high, "high-concern ingredient");
  if (a.verdict === "some") return `${plural(some, "ingredient")} of some concern`;
  return VERDICT_STYLE[a.verdict].label;
}
```

- [ ] **Step 2: Replace `src/app/components/ProductDetailScreen.tsx` entirely with this**

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailScreen.tsx — product page
//
// Ingredient safety verdict from the safety engine (src/lib/safety): only
// ingredients with an official health concern are flagged, and every flag shows
// its sources. Also: price comparison and same-category alternatives.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  ArrowLeft, Bookmark, Share2, ShoppingBag, DollarSign, Star, MapPin,
  TrendingUp, ChevronDown, ExternalLink, FlaskConical,
} from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { VERDICT_RANK, type Analysis, type Flag } from "../../lib/safety/analyze";
import { VERDICT_STYLE, safeAnalyze, verdictHeadline } from "./verdict";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lowestPrice = (p: Product) => Math.min(p.amazon?.price ?? Infinity, p.walmart?.price ?? Infinity, p.facebook?.price ?? Infinity);

const SMALL_PRINT: Record<Analysis["verdict"], (a: Analysis) => string> = {
  high:       () => "Tap an ingredient to see its official sources.",
  some:       () => "Tap an ingredient to see its official sources.",
  none:       a => `Checked against ${a.checkedCount} ingredients with an official health concern.`,
  "no-data":  () => "This product has no ingredient list yet.",
  "non-food": () => "Checks for cleaning, personal-care and other products are coming later.",
};

/** The full ingredient text with the label phrases that triggered flags highlighted. */
function HighlightedIngredients({ text, flags }: { text: string; flags: Flag[] }) {
  const terms = [...new Set(flags.map(f => f.matchedText))].filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) => i % 2 === 1
        ? <mark key={i} className="bg-red-100 text-red-800 rounded px-0.5 font-semibold">{part}</mark>
        : <span key={i}>{part}</span>)}
    </>
  );
}

function FlagRow({ flag, open, onToggle }: { flag: Flag; open: boolean; onToggle: () => void }) {
  const { entry, matchedText } = flag;
  const look = VERDICT_STYLE[entry.severity];
  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <look.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: look.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{entry.name}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: look.bg, color: look.color }}>{look.short}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{entry.concern}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Listed as “{matchedText}”</p>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 ml-7 space-y-2">
          {entry.context && (
            <p className="text-[11px] text-gray-600 bg-gray-50 rounded-xl p-2.5 leading-snug">
              <strong>Regulator context:</strong> {entry.context}
            </p>
          )}
          {entry.sources.map((s, i) => (
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

interface ProductDetailScreenProps {
  product: Product; onBack: () => void; saved: boolean; onToggleSave: () => void;
  products: Product[]; onSelectProduct: (p: Product) => void;
}

export default function ProductDetailScreen({ product, onBack, saved, onToggleSave, products, onSelectProduct }: ProductDetailScreenProps) {
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const analysis = useMemo(() => safeAnalyze(product), [product]);
  const look = VERDICT_STYLE[analysis.verdict];
  const bestPrice = lowestPrice(product);

  // Same category, strictly better verdict; only offered when this product has concerns.
  const alternatives = useMemo(() => {
    if (analysis.verdict !== "high" && analysis.verdict !== "some") return [];
    const mine = VERDICT_RANK[analysis.verdict];
    return products
      .filter(p => p.id !== product.id && p.category === product.category)
      .map(p => ({ p, a: safeAnalyze(p) }))
      .filter(({ a }) => VERDICT_RANK[a.verdict] < mine)
      .sort((x, y) => VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict]
        || x.a.flags.length - y.a.flags.length
        || lowestPrice(x.p) - lowestPrice(y.p))
      .slice(0, 3);
  }, [products, product, analysis]);

  const stores = [
    product.amazon   ? { name: "Amazon",        icon: "📦", price: product.amazon.price,   color: "#FF9900", distance: "Online (2-day)", avail: "In Stock",                rating: product.amazon.rating  } : null,
    product.walmart  ? { name: "Walmart",        icon: "🛒", price: product.walmart.price,  color: "#0071CE", distance: "0.8 mi away",    avail: "In Stock",                rating: product.walmart.rating } : null,
    product.facebook ? { name: "FB Marketplace", icon: "👥", price: product.facebook.price, color: "#1877F2", distance: "1.2 mi away",    avail: product.facebook.condition, rating: null                  } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ── */}
      <div className="flex-shrink-0 relative" style={{ background: look.gradient, minHeight: 268 }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft size={18} color="white" />
          </button>
          <div className="flex gap-2">
            <button onClick={onToggleSave} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Bookmark size={16} fill={saved ? "white" : "none"} color="white" />
            </button>
            <button aria-label="Share" className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Share2 size={16} color="white" />
            </button>
          </div>
        </div>

        <div className="pt-16 pb-5 px-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xl">
            <ShoppingBag size={36} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.brand}</span>
              <span className="text-white/30">·</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight mb-2">{product.name}</h1>
            {Number.isFinite(bestPrice) && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-extrabold text-white">${bestPrice.toFixed(2)}</span>
                <span className="text-sm text-white/60">best price</span>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {stores.map(s => (
                <span key={s.name} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {s.icon} {s.name === "FB Marketplace" ? "FB" : s.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 w-[84px] flex flex-col items-center gap-1.5 text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl">
              <look.Icon size={30} style={{ color: look.color }} />
            </div>
            <span className="text-[10px] font-extrabold text-white leading-tight">{look.short}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
        <div className="px-4 py-4 space-y-3 pb-10">

          {/* ── Verdict ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: `4px solid ${look.color}` }}>
            <div className="flex items-center gap-2">
              <look.Icon size={18} style={{ color: look.color }} />
              <span className="font-extrabold text-sm" style={{ color: look.color }}>{verdictHeadline(analysis)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{SMALL_PRINT[analysis.verdict](analysis)}</p>
          </div>

          {/* ── Flagged ingredients ── */}
          {analysis.flags.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">Ingredients of concern</div>
              <div className="divide-y divide-gray-50">
                {analysis.flags.map(f => (
                  <FlagRow key={f.entry.id} flag={f} open={openFlag === f.entry.id}
                    onToggle={() => setOpenFlag(openFlag === f.entry.id ? null : f.entry.id)} />
                ))}
              </div>
            </div>
          )}

          {/* ── Full ingredient list ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={15} className="text-primary" />
              <span className="font-bold text-sm">Ingredients</span>
            </div>
            {product.ingredients.trim()
              ? <p className="text-xs text-gray-600 leading-relaxed"><HighlightedIngredients text={product.ingredients} flags={analysis.flags} /></p>
              : <p className="text-xs text-gray-400 italic">No ingredient list available.</p>}
            <p className="text-[10px] text-gray-400 mt-3 leading-snug">
              Ingredient profiles researched with AI and verified against IARC, EU and FDA sources.
              Classifications describe potential hazards; this is not medical advice.
            </p>
          </div>

          {/* ── Price Comparison ── */}
          {stores.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <DollarSign size={15} className="text-primary" />
                <span className="font-bold text-sm">Price Comparison</span>
                <span className="ml-auto text-primary font-extrabold text-sm">${bestPrice.toFixed(2)} best</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 border-b border-gray-100">
                {["Store", "Price", "Distance", "Availability"].map(h => (
                  <span key={h} className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
                ))}
              </div>
              {stores.map(store => (
                <div key={store.name} className="grid grid-cols-4 px-4 py-3 border-b last:border-0 border-gray-50 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{store.icon}</span>
                    <div>
                      <p className="text-[11px] font-bold leading-tight">{store.name}</p>
                      {store.rating && <div className="flex items-center gap-0.5 mt-0.5"><Star size={8} className="fill-amber-400 text-amber-400" /><span className="text-[9px] text-gray-400">{store.rating}</span></div>}
                    </div>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: store.color }}>${store.price.toFixed(2)}</span>
                  <div className="flex items-center gap-1"><MapPin size={9} className="text-gray-400 flex-shrink-0" /><span className="text-[10px] text-gray-500 leading-tight">{store.distance}</span></div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${store.avail === "In Stock" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{store.avail}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Alternatives with fewer concerns ── */}
          {alternatives.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <TrendingUp size={15} className="text-green-600" />
                <span className="font-bold text-sm">Alternatives with fewer concerns</span>
              </div>
              <div className="divide-y divide-gray-50">
                {alternatives.map(({ p, a }) => {
                  const altLook = VERDICT_STYLE[a.verdict];
                  const altPrice = lowestPrice(p);
                  return (
                    <button key={p.id} onClick={() => onSelectProduct(p)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: altLook.bg }}>
                        <ShoppingBag size={20} style={{ color: altLook.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">{p.brand}</p>
                        <p className="text-sm font-semibold leading-tight">{p.name}</p>
                        {Number.isFinite(altPrice) && <p className="text-xs text-gray-500 mt-0.5">from ${altPrice.toFixed(2)}</p>}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: altLook.bg, color: altLook.color }}>{altLook.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/App.tsx`: imports**

Replace
```ts
import { scoreColorHex, gradeBadgeClass } from "../lib/scoring";
```
with
```ts
import { scoreColorHex } from "../lib/scoring";
import { VERDICT_RANK } from "../lib/safety/analyze";
import { VERDICT_STYLE, safeAnalyze } from "./components/verdict";
```
In the lucide import, delete `AlertTriangle, ` (its only use was the old product-card flag icon). Delete the line `const ethicalBadge = (g: string) => gradeBadgeClass(g);`.

- [ ] **Step 4: `src/app/App.tsx`: `ProductCard` verdict badge**

Replace
```tsx
  const bp = bestPrice(product);
  const bg = product.safetyScore >= 80 ? "#DCFCE7" : product.safetyScore >= 60 ? "#FEF3C7" : "#FEE2E2";
  const ic = product.safetyScore >= 80 ? "#15803D" : product.safetyScore >= 60 ? "#D97706" : "#DC2626";
  return (
    <button onClick={() => onSelect(product)}
      className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3 active:scale-98 transition-transform">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <ShoppingBag size={24} style={{ color: ic }} />
      </div>
```
with
```tsx
  const bp = bestPrice(product);
  const look = VERDICT_STYLE[safeAnalyze(product).verdict];
  return (
    <button onClick={() => onSelect(product)}
      className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3 active:scale-98 transition-transform">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: look.bg }}>
        <ShoppingBag size={24} style={{ color: look.color }} />
      </div>
```
and replace
```tsx
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${ethicalBadge(product.ethicalScore)}`}>{product.ethicalScore}</span>
        <span className="text-xs font-bold font-mono" style={{ color: scoreColor(product.safetyScore) }}>{product.safetyScore}%</span>
        {product.flaggedIngredients.length > 0 && <AlertTriangle size={11} className="text-red-500" />}
      </div>
```
with
```tsx
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="w-2 h-2 rounded-full" style={{ background: look.color }} />
        <span className="text-[10px] font-bold" style={{ color: look.color }}>{look.short}</span>
      </div>
```

- [ ] **Step 5: `src/app/App.tsx`: search sorting**

Replace
```tsx
  const [sortBy, setSortBy] = useState<"health" | "price" | "ethics">("health");
```
with
```tsx
  const [sortBy, setSortBy] = useState<"concerns" | "price">("concerns");
```
Replace
```tsx
  const results = [...raw].sort((a, b) => {
    if (sortBy === "price") return bestPrice(a) - bestPrice(b);
    if (sortBy === "health") return b.safetyScore - a.safetyScore;
    return a.ethicalScore.localeCompare(b.ethicalScore);
  });
```
with
```tsx
  const results = raw
    .map(p => ({ p, a: safeAnalyze(p) }))
    .sort((x, y) => sortBy === "price"
      ? bestPrice(x.p) - bestPrice(y.p)
      : VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict] || x.a.flags.length - y.a.flags.length)
    .map(({ p }) => p);
```
Replace
```tsx
          {(["health", "price", "ethics"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sortBy === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
```
with
```tsx
          {([["concerns", "Fewest concerns"], ["price", "Price"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sortBy === key ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {label}
            </button>
          ))}
```

- [ ] **Step 6: `src/app/App.tsx`: tappable alternatives**

Replace
```tsx
                <ProductDetailScreen
                  product={selectedProduct}
                  onBack={() => setSubScreen(null)}
                  saved={savedIds.includes(selectedProduct.id)}
                  onToggleSave={toggleSave}
                  products={products}
                />
```
with
```tsx
                <ProductDetailScreen
                  key={selectedProduct.id}
                  product={selectedProduct}
                  onBack={() => setSubScreen(null)}
                  saved={savedIds.includes(selectedProduct.id)}
                  onToggleSave={toggleSave}
                  products={products}
                  onSelectProduct={openProduct}
                />
```

- [ ] **Step 7: Build and test**

Run: `npm run build` → builds.
Run: `npm test` → all pass.
Run: `grep -nE "ethicalBadge|safetyScore|AlertTriangle" src/app/App.tsx` → no output.

- [ ] **Step 8: Verify in the running app**

Run `npm run dev` and open http://localhost:5173. Continue as Guest. The Live banner must show. Search each product name and open it:

| Search | Expected product page |
|---|---|
| digiorno | Red hero, "1 high-concern ingredient"; the flag "Sodium nitrite", listed as "sodium nitrite", is highlighted inside the pepperoni text; tapping it shows sources with links and a "Source checked" date |
| oscar | Red, sodium nitrite |
| diet coke | Amber, aspartame, with regulator context when expanded; "caramel color" not highlighted |
| doritos | Amber, Yellow 6 |
| horizon, tropicana | Green, "No ingredients of concern found" and "Checked against N ingredients…" |
| tide, tylenol | Grey, "Ingredient check covers food & drinks for now" |

Also check:
- On Diet Coke, "Alternatives with fewer concerns" lists only Beverages. Tapping one opens that product, and the page resets to the top with no flag expanded.
- On a green product, no alternatives section appears.
- Search results show coloured dots with "High concern" / "Some concern" / "No concerns" / "Food only". "Fewest concerns" puts green first and grey last; "Price" sorts by price.
- Saved › Favorites / Scanned cards show the same dots.
- The console has no errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/components/verdict.tsx src/app/components/ProductDetailScreen.tsx src/app/App.tsx
git commit -m "Product page and lists show the evidence-first safety verdict

Verdict + flagged ingredients with official sources replace the score ring,
letter grade, hand-written 'AI Evaluation' text and category bars. Product
cards show a verdict dot, search sorts by fewest concerns, and
alternatives are same-category, strictly better and tappable (fixes K-08, K-09).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Honest labels and docs

**Files:**
- Modify: `src/app/App.tsx` (label text only), `index.html`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, `docs/superpowers/specs/2026-09-24-safety-engine-design.md`

**Interfaces:**
- Consumes: the finished Tasks 0–4.
- Produces: no "AI"/"SmartScore™" claims anywhere in the app, and docs that match the code.

- [ ] **Step 1: Rename the Home place-rating labels in `src/app/App.tsx`** (text only; the `smartScore` data field keeps its name)

Make these exact replacements:
- `// Minimum SmartScore for a recommendation to surface (configurable in HomeTab)` → `// Minimum rating for a recommendation to surface (configurable in HomeTab)`
- `{/* SmartScore badge */}` → `{/* Rating badge */}`
- `<div className="text-[9px] text-muted-foreground mt-0.5">SmartScore™</div>` → `<div className="text-[9px] text-muted-foreground mt-0.5">Rating</div>`
- `<span>SmartScore threshold passed: <strong` → `<span>Rating threshold passed: <strong`
- `SmartScore™ Filter</span>` → `Rating Filter</span>`

- [ ] **Step 2: `index.html` meta description**

Replace the `content` of `<meta name="description" …>` with:
`Scan food products to see which ingredients carry an official health concern, with sources. Plus a map of community resources.`

- [ ] **Step 3: Confirm no fake-AI wording remains**

Run: `grep -rnE "SmartScore|AI Evaluation|Explainable AI|AI-powered" src index.html`
Expected: no output.

- [ ] **Step 4: Update the docs**

- **`KNOWN_ISSUES.md`:**
  - Prefix the K-02, K-03, K-08 and K-09 rows' first cell with strikethrough plus ✅. Start each description with "**Fixed in M1 (safety engine, `<Task 4 commit>`).**" and keep the original text after "*Original issue:*".
  - Mark K-18 "moot: hand-written explanations were deleted".
  - In "Maintainability", replace the dead-code and unused-dependencies bullets with "Resolved by the M0 cleanup (`<Task 0 commit>`)."
  - In the roadmap, mark step 3 "✅ done" with the commit range.
- **`ARCHITECTURE.md`:**
  - File map: remove the `ui/*` and `figma` rows; add rows for `src/lib/safety/*` ("Safety engine: verified library, parser, analyzer; tested by `npm test`") and `src/app/components/verdict.tsx`.
  - Data map: the "Ingredient KB" row becomes "`src/lib/safety/library.ts` (verified, sourced)". The "Scores" and "Explanations / AI text" rows become "Replaced by the ingredient verdict (M1)".
  - Feature inventory: the product-detail rows become "working", with notes from Task 4 Step 8.
  - Stack row: dependencies are now 7 runtime.
- **`PROJECT_HANDOFF.md`:** in "Where things stand", set the phase line to "M0 cleanup and M1 safety engine done; next is M2 (Open Food Facts lookup)".
- **`SYNOPSIS.md`:** mark step 3 done, and change the next-session prompt to start M2.
- **Spec:** change the status line to "implemented (`<Task 0 commit>`…`<Task 4 commit>`)".

- [ ] **Step 5: Final checks**

Run: `npm test` → all pass. Run: `npm run build` → builds. Open the app and spot-check DiGiorno's page and the Home tab ("Rating Filter").

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Honest labels and docs for the M1 safety engine

Home place ratings say 'Rating' instead of 'SmartScore', the page meta no
longer claims 'AI-powered'; KNOWN_ISSUES, ARCHITECTURE, handoff, synopsis
and the spec reflect M0 + M1 (K-02, K-03, K-08, K-09 fixed).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

# Safety engine (roadmap M1) — design spec

- **Date:** 2026-09-24
- **Status:** implemented (`6497847`…`c017d93`, branch `m1-safety-engine`)
- **Designed with:** the owner (Minh Bui), through a brainstorming session on 2026-09-23/24
- **Roadmap context:** M1 of 4 toward "functional". The prototype is done when a real phone-camera scan of a food product
  gives a trustworthy safety result. M2 (Open Food Facts lookup) and M4 (camera) feed products into this engine.

## 1. Goal

Replace the Figma prototype's fake scoring (hand-typed numbers labelled "AI Evaluation" / "SmartScore™", and an
ingredient matcher that produces 70 false high-risk labels across the 51 products) with an engine users can **trust**.
For any food product with an ingredient list, it says which ingredients carry an **official** health concern, how
serious each is, and where that comes from.

The owner's original intent was for AI to analyze each ingredient and synthesize the scores. This design keeps AI in
that role (researching and drafting every ingredient profile), but only after every claim has been checked against an
official source, and never as a live judgement at scan time.

## 2. Principles

1. **Facts and science first.** No claim without an official source. Where a hazard classification (e.g. IARC) and
   a food regulator's intake position differ, show both.
2. **Deterministic at runtime.** Same input, same answer. No network calls and no AI while the app runs. It's free,
   instant, and works offline.
3. **One engine for every product:** featured products from the database, the offline CSV fallback, and (in M2) Open
   Food Facts products.
4. **Honest scope.** When the engine can't know, it says so ("Not enough data", "food & drinks for now"). A green
   result always states how many ingredients it was checked against.
5. **AI's role:** it researches and drafts library entries at development time, and every entry is verified before
   inclusion. A later, optional AI-written summary (roadmap "C") may explain results, but never decides them.

## 3. Decisions (owner answers, 2026-09-23/24)

| Question | Decision |
|---|---|
| What does the result measure? | Harmful / suspicious ingredients, not nutrition |
| What counts as "suspicious"? | **Official concerns only:** IARC classifications, EU or US (FDA) food bans or revocations, EU-mandated warning labels |
| Headline format | **Verdict + list of flagged ingredients** (severity + source each). **No 0–100 safety number** |
| Featured products' hand-entered category scores | **Removed from the product page**; the data stays in the database, unused |
| Where AI sits | **A now:** AI-researched, source-checked library, deterministic matching. **C later:** optional labelled AI summary. Live per-scan AI (B) rejected on cost and trust |
| Sub-ingredients | Checked (e.g. sodium nitrite inside "pepperoni (…)") |
| Product types | Food & drinks first |

## 4. Architecture

New module folder `src/lib/safety/` (pure TypeScript, no React, no Vite-only imports, relative imports written with
explicit `.ts` extensions so Node can run the tests directly):

| File | Responsibility |
|---|---|
| `library.ts` | The verified ingredient library (data), its types, and `deriveSeverity` |
| `parse.ts` | `parseIngredients(text)`: raw ingredient text → flat list including sub-ingredients (original letter case kept for display; matching lowercases) |
| `analyze.ts` | `analyzeIngredients(input, library?)`: list + optional additive codes → verdict and flags |

Plus one shared UI file, `src/app/components/verdict.tsx`: the verdict colours, labels and icons, and
`safeAnalyze(product)`, used by both the product page and the product lists.

```ts
// library.ts
export type Severity = "high" | "some";
export type Basis = "iarc-1" | "iarc-2a" | "iarc-2b" | "banned-eu" | "banned-us" | "eu-warning-label" | "context";
export interface Source {
  body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO/JECFA";
  basis: Basis;      // what this source establishes; "context" (an intake position) never sets severity
  finding: string;   // e.g. "Group 2B: possibly carcinogenic to humans"
  url: string;       // official page
  quote: string;     // short verbatim phrase from that page, used by the automated source check
  checkedOn: string; // YYYY-MM-DD
}
export interface LibraryEntry {
  id: string;          // slug, e.g. "sodium-nitrite"
  name: string;        // display name
  aliases: string[];   // lowercase label spellings, each >= 3 characters (e.g. "bha"), unique across the library
  eCodes: string[];    // e.g. ["E250"]
  severity: Severity;  // must equal deriveSeverity(sources) (section 5)
  concern: string;     // one plain-English sentence
  context?: string;    // regulator intake position, e.g. "WHO/JECFA kept the acceptable daily intake unchanged"
  sources: Source[];   // >= 1, at least one severity-bearing
}
export function deriveSeverity(sources: Source[]): Severity | null;
export const LIBRARY: LibraryEntry[];

// parse.ts
export function parseIngredients(text: string): string[];

// analyze.ts
export type Verdict = "high" | "some" | "none" | "no-data" | "non-food";
export interface Flag { entry: LibraryEntry; matchedText: string }
export interface Analysis { verdict: Verdict; flags: Flag[]; checkedCount: number }
export const VERDICT_RANK: Record<Verdict, number>;  // none 0 < some 1 < high 2 < no-data 3 < non-food 4
export const FOOD_CATEGORIES: ReadonlySet<string>;
export function analyzeIngredients(
  input: {
    ingredients: string;
    category?: string;         // decides food vs non-food; omitted = food (e.g. Open Food Facts)
    additiveCodes?: string[];  // e.g. Open Food Facts "en:e250" (M2); optional
  },
  library?: LibraryEntry[],    // defaults to LIBRARY; tests pass their own
): Analysis;
```

**Data flow:** product → `analyzeIngredients({ ingredients, category })` → `Analysis` → UI. Called at render time
and memoized per product. **No database change is needed for M1**; ingredient text is already stored.

## 5. The ingredient library

- **Contents:** only ingredients with an official concern. Ingredients not in the library are shown plainly, with no
  claim. There are no "generally safe" entries.
- **Severity mapping (mechanical):**

  | Severity | Qualifies when a source shows… |
  |---|---|
  | **high** | IARC Group 1 or 2A for the ingredient; **or** banned or revoked for food use in the EU or by the FDA |
  | **some** | IARC Group 2B; **or** an EU-mandated warning label |

  An IARC classification counts only when its evaluation covers **eating or drinking** the substance.
  Inhalation-only classifications don't count; titanium dioxide's IARC 2B is about inhaled dust, so its basis is the
  EU food ban instead.

- **Precise-form rule:** aliases name only the concerning form. Generic terms that cover both safe and concerning
  forms (e.g. plain "caramel color") are not aliased.
- **Initial candidates.** Each must pass verification before inclusion; the list is not itself a claim:
  - nitrites and nitrates (E249–E252)
  - titanium dioxide (E171)
  - potassium bromate (E924)
  - brominated vegetable oil
  - erythrosine / Red No. 3 (E127)
  - the six EU warning-label colours (E102, E104, E110, E122, E124, E129)
  - aspartame (E951)
  - BHA (E320)
  - further additives found in the official lists
  - Target: roughly 30–50 entries common in US groceries.
- **Build process:**
  1. AI compiles candidates from the official lists: IARC classifications, EU additive rules and warning-label annex,
     and FDA bans and revocations.
  2. AI drafts each entry, including source URL, finding, and a short verbatim `quote`.
  3. The source check (`npm run verify:sources`) fetches every URL and confirms the `quote` appears. Entries that
     fail are fixed or dropped. Pages that block automated fetching are checked by hand and noted.
  4. The library is committed. Changes are reviewed in git diffs, and every flag in the app shows its sources and
     "checked on" date.
- **User-facing attribution:** "Ingredient profiles researched with AI and verified against IARC, EU and FDA sources."

## 6. Parsing and matching rules

**Parsing (`parse.ts`):**
1. Split on commas and semicolons at the top level only (not inside `()`, `[]`, `{}`).
2. Never split a comma between digits ("1,4-dioxane", "2,6-…").
3. For "parent (a, b, c)", keep the parent and also emit each inner item. Nested parentheses are expanded the same
   way at every depth.
4. Remove label filler prefixes but keep the items after them: "ingredients:", "contains 2% or less of:",
   "less than 2% of:", "inactive:". Remove trailing periods.
5. Drop allergen statements, which are not ingredients: any clause starting "may contain", and a "contains:" clause
   that forms its own sentence after the ingredient list (US format "Contains: Milk, Soy.").
6. Normalize: unify dashes, quotes and non-breaking spaces, collapse whitespace, treat "and/or" as a separator. Keep
   the original letter case for display; matching lowercases.
7. Drop negated mentions, which state an absence rather than an ingredient: items starting "no", "free from" or
   "without", and "…-free" words ("nitrite-free").

**Matching (`analyze.ts`):**
1. An alias matches only as a **whole phrase** (word boundaries on both sides). There is no reverse or substring
   matching.
2. E-codes match with or without a space or brackets ("E250", "E 250", "(E250)"). Also accepted from
   `additiveCodes` (e.g. "en:e250").
3. Each library entry is flagged at most once per product. `matchedText` records the label text that triggered it.

**Verdict:**

| Condition (checked in order) | Verdict |
|---|---|
| `category` is not a food category | `non-food` → "Ingredient check covers food & drinks for now" |
| ingredient text is empty or whitespace | `no-data` → "Not enough data" |
| any flag with severity `high` | `high` → "High-concern ingredient" (+ count) |
| any flag with severity `some` | `some` → "Ingredients of some concern" (+ count) |
| otherwise | `none` → "No ingredients of concern found" + "checked against N official-concern ingredients" |

Food categories: Beverages, Bread, Breakfast, Condiments, Dairy, Frozen, Meat, Snacks. Accepted limitation: Baby Care
(e.g. Gerber puffs) and Pet Food count as non-food for now.

## 7. UI changes

- **Product page (`ProductDetailScreen.tsx`):**
  - The verdict badge replaces the score ring, grade badge, "AI Evaluation Summary", "Why This Score?" and category
    bars.
  - Below it comes the list of flags. Each has a name, severity chip and concern, and tapping it reveals its sources
    (links, "checked on"), regulator context, and the label text that matched.
  - Then the full ingredient list with flagged items highlighted, and the attribution line.
  - Removed components and data: `INGREDIENT_DB`, `SCORE_EXPLANATIONS`, `DIMENSION_EXPLANATIONS`,
    `PRODUCT_EVALUATIONS`, `getEvaluation`, `getDimExpl`, `getExplanation`, `parseIngredientList`,
    `matchIngredient`, `getIngredients`, `ScoreRingLarge`, `ConfidenceIndicator`, `WeightedBreakdown`,
    `WhyThisScore`, `DimensionBar`. `IngredientLearnMore` is replaced by the flag detail view.
  - The hero gradient keys off the verdict: red for `high`, amber for `some`, green for `none`, neutral grey for
    `no-data` / `non-food`.
- **"Alternatives with fewer concerns"** (renamed from "Healthier alternatives", since the engine doesn't judge
  healthiness): same category, strictly better verdict (`high` → `some` → `none`), up to 3, tappable (opens that
  product via a new `onSelectProduct` prop; the screen is keyed by product id so it resets). The section is hidden when there are none, and for `none`, `no-data` and `non-food`
  products. Fixes K-08.
- **Product lists (`ProductCard` in `App.tsx`):** a verdict dot and short label replace the ethical-grade badge and
  `safetyScore%` (grey for `no-data` / `non-food`).
- **Search sorting:** "Fewest concerns" (`none`, then `some`, then `high`, then fewer flags first; `no-data` and
  `non-food` last) and "Price". The "Health" and "Ethics" sorts are removed.
- **Honest labels:** Home's place filter "SmartScore™" becomes "Rating", and the file header comment and `index.html`
  meta description drop the "AI-powered" and "Explainable AI" claims.
- **Unchanged:** price comparison, map, scan flow, saved lists.

## 8. Testing

All tests run with Node's built-in runner (no new dependency), via `npm test` =
`node --test "src/lib/safety/**/*.test.ts"`.

1. **`parse.test.ts`:**
   - "1,4-dioxane (trace)" stays one ingredient.
   - "pepperoni (pork, beef, salt, spices, sodium nitrite)" yields "sodium nitrite".
   - "contains 2% or less of:" is removed.
   - "Acetaminophen 500mg; inactive: corn starch" splits into both parts.
   - "may contain traces of…" is dropped.
2. **`analyze.test.ts`:**
   - "acetaminophen" matches nothing.
   - "sodium nitrite", "E250" and "E 250" match.
   - Plain "caramel color" is not flagged.
   - The verdict order holds.
   - Empty text gives `no-data`, and a non-food category gives `non-food`.
   - The engine never throws on arbitrary strings, including empty, very long and odd Unicode.
3. **`catalog.test.ts` (the zero-false-alarms check):**
   - Every product in `src/lib/safety/fixtures/catalog.json` (id, name, category, ingredients for all 51) is compared
     against `src/lib/safety/fixtures/expected-flags.json` (product id → exact entry ids).
   - Any extra or missing flag fails the test.
   - The expected file is built by reviewing each flag against its source, and the owner may spot-check it.
   - The fixture is exported from `products.csv` by `scripts/export-catalog-fixture.mjs`, which uses the app's own
     importer through Vite (the technique already used to generate the seed).
4. **`library.test.ts` (integrity):**
   - Every entry has at least one source with url, quote and checkedOn.
   - Severity equals what the mapping in section 5 derives from its sources.
   - Aliases are at least 3 characters and unique across entries; E-codes are well-formed.
5. **Source check (network, run when the library changes):** `npm run verify:sources` = `node scripts/verify-sources.mjs`
   reports pass, fail or unverifiable per source. If agents help with research or verification, they follow the
   guardrails: small jobs, capped effort, a 20-minute watchdog.

**In the running app**, check each product below, then the list badges and alternatives:

| Product | Expected |
|---|---|
| DiGiorno pizza (id 42) | high: sodium nitrite, matched inside the pepperoni |
| Oscar Mayer hot dogs (id 6) | high: sodium nitrite |
| Diet Coke (id 7) | some: aspartame, with regulator context; caramel color not flagged |
| Doritos (id 13) | some: Yellow 6 (E110), EU warning label |
| Horizon milk (35), Tropicana (9) | none, with the "checked against N" small print |
| Tide (2), Tylenol (50) | non-food message |

Actual results follow whatever verification confirms, and the expected file is the source of truth.

## 9. Error handling

- `analyzeIngredients` never throws for string input (enforced by tests).
- The product page wraps the call. On an unexpected error it shows "Not enough data" and logs the error, and it never
  blanks the screen.
- Missing or odd fields in products (e.g. an Open Food Facts product without ingredients) resolve to `no-data`.

## 10. Delivery

Four commits, each verified before the next:
1. `src/lib/safety/parse.ts` + `analyze.ts` + tests, with a minimal test library; `npm test` added.
2. The verified library, the fixture export and expected flags, the integrity test and `verify:sources`.
3. UI swap: product page, list badges, sorting, alternatives.
4. Delete the replaced code and fake labels. Update docs: ARCHITECTURE, and KNOWN_ISSUES (K-02, K-03, K-08 and
   K-09 fixed; K-18 moot).

## 11. Non-goals (M1)

- Open Food Facts lookup (M2), camera scanning (M4), deployment (M3).
- Nutrition scoring. The AI-written summary ("C").
- Non-food ingredient analysis. A normalized `ingredients` database table.
- Removing the unused score fields from the `Product` type or the database. Map and other screens.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Official pages block automated fetching | Manual check, recorded in the verify report |
| Small library means many green results | The "checked against N" small print; the library grows over time |
| IARC hazard ≠ dietary risk (misread as alarmist) | Regulator `context` shown with every flag where one exists |
| Wording drifts into medical advice | Concern sentences state the classification, not advice; keep the existing "not medical advice" note |

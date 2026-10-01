# M4: concern levels, processed meat, acrylamide marker: design spec

- **Date:** 2026-09-30
- **Status:** implemented (`639de14`…`103c615`, plus the docs commits)
- **Designed with:** the owner (Minh Bui), in a brainstorm on 2026-09-30. Decisions are theirs unless marked
  *recommended default*.
- **Builds on:** the M1 safety engine (`specs/2026-09-24-safety-engine-design.md`) and the M2 lookup
  (`specs/2026-09-28-m2-usda-lookup-design.md`). The acrylamide sources come from the superseded
  `specs/2026-09-28-m2-open-food-facts-design.md` §3.

## 1. Why

The app shows red/amber/green. Green reads as "healthy", which EcoGo can't back up: Oreo is green only because no
additive in it has an official hazard finding. Meanwhile the hidden risks people underestimate get no flag at all,
because they aren't additives: processed meat (IARC Group 1) and acrylamide, which forms when starchy foods are fried or
baked. The owner wants a product to show at a glance whether it deserves caution, with every level backed by an
official finding.

Market check (2026-09-30): Yuka, Bobby Approved, Fig, Fooducate, Osana and others all publish their own composite
scores. Yuka is 60% Nutri-Score, 30% additives and 10% organic, and dietitians and the World Cancer Research Fund
criticise it for an arbitrary weighting and for penalising trace additives. EcoGo's difference is that **every level is
an official classification**, quoted and linked, with no invented score.

**Done for M4:**
- Every product shows one concern badge that gets darker as the official finding gets stronger.
- Processed meat, including processed meat inside other foods, reads "Known carcinogen".
- Fried and baked starchy foods carry a "🔥 Forms when cooked" marker, with an explanation and sources.
- No product reads green.

## 2. Decisions

| # | Decision | Source |
|---|---|---|
| L1 | One badge in a **single hue that darkens**: Nothing flagged (grey) → Some concern → High concern → Known carcinogen (darkest). Always word + icon + shade, never colour alone (WCAG 1.4.1) | owner |
| L2 | No green anywhere. The empty state is neutral grey "Nothing flagged", and its page text says it doesn't rate nutrition | owner (after discussion) |
| L3 | Cards stay neutral, with a small category icon; no colour per food type | owner |
| L4 | The level is the **strongest official finding** among additives and food-level concerns, derived mechanically from the source basis | owner |
| L5 | Food-level concerns in this version: **processed meat** (raises the badge) and **acrylamide** (a marker only) | owner |
| L6 | Acrylamide never changes the badge. It's in bread, cereal and coffee at low levels, and the FDA advises against avoiding these foods | owner |
| L7 | FDA nutrition ("High in added sugar, 28% DV") is the **next** spec, together with fixing catalog barcodes (K-29) | owner |
| L8 | Out of scope: the fake Home sections (left as they are), search, camera, red meat, alcohol | owner |

## 3. Facts this design rests on (verified 2026-09-30)

**Processed meat.** IARC Q&A, Monographs vol. 114: https://www.iarc.who.int/wp-content/uploads/2018/07/Monographs-QA_Vol114.pdf
(a PDF; `verify:sources` can't read it, so it was hand-checked). WHO Q&A:
https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat
(HTML, script-checkable).

| Use | Quote | Page |
|---|---|---|
| Definition (drives the rule) | "Processed meat refers to meat that has been transformed through salting, curing, fermentation, smoking or other processes to enhance flavour or improve preservation." | WHO |
| Classification (basis `iarc-1`) | "Processed meat has been classified as Group 1, carcinogenic to humans." | WHO |
| Examples (drives the rule) | "Examples of processed meat include hot dogs (frankfurters), ham, sausages, corned beef, and biltong or beef jerky as well as canned meat and meat-based preparations and sauces." | IARC |
| Context shown to users | "this does NOT mean that they are all equally dangerous" | IARC |
| Context shown to users | "every 50 gram portion of processed meat eaten daily increases the risk of colorectal cancer by about 18%" | IARC |

**Acrylamide** (the marker). Quotes verbatim from the superseded M2 spec §3:
- IARC: https://publications.iarc.who.int/78
- EFSA: https://www.efsa.europa.eu/en/press/news/150604
- EU Regulation 2017/2158 (Article 1(2) food types (a)–(h)): http://publications.europa.eu/resource/celex/32017R2158
- FDA "Should I stop eating…" (answer: no): https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers
- FDA "golden yellow… rather than brown": https://www.fda.gov/food/process-contaminants-food/acrylamide-and-diet-food-storage-and-food-preparation

## 4. Design

### 4.1 Levels (`library.ts`, `analyze.ts`)

- `Severity` becomes `"known" | "high" | "some"`. `deriveSeverity` returns `"known"` for basis `iarc-1`; the current
  mapping is otherwise unchanged (2A / bans → high; 2B / EU warning label → some). No existing library entry has
  `iarc-1`, so all 51 hand-reviewed catalog results keep their level.
- `Verdict` gains `"known"`. The rank becomes none 0, some 1, high 2, known 3, no-data 4, non-food 5.

### 4.2 Food-level concerns (`src/lib/safety/foodConcerns.ts`, new)

```ts
interface FoodConcern {
  id: "processed-meat" | "acrylamide";
  kind: "food" | "cooking";        // "food" can raise the badge; "cooking" is a marker only
  severity?: Severity;             // processed meat: "known"; acrylamide: undefined
  reason: string;                  // e.g. "Contains pepperoni (processed meat)"
  sources: Source[];
}
foodConcerns(p: { name: string; category: string; ingredients: string; source?: ProductSource; foodCategory?: string; categoryTags?: string[] }): FoodConcern[]
```

- **Processed meat:** it matches whole words in the name or the ingredients (the same whole-word matcher as the
  library): hot dog, frankfurter, wiener, bacon, ham, sausage, salami, pepperoni, chorizo, bologna, pastrami,
  corned beef, jerky, biltong, prosciutto, spam, luncheon meat, deli meat, plus "cured"/"smoked" next to a meat word.
  - **In the ingredients**, it's "Contains pepperoni (processed meat)".
  - **In the name or category**, it's "Processed meat".
  - **Not matched:** fresh meat, chicken nuggets and canned tuna. They aren't salted, cured, smoked or fermented,
    meaning *recommended default*: conservative, no flag without a clear match.
  - **Negations** ("ham-free", "no bacon bits") use the parser's existing negation handling.
- **Acrylamide:** it matches the EU 2017/2158 food types:
  - **Catalog products:** by category and name (chips, fries, crisps, bread, cereal but not porridge or oatmeal,
    cookies, crackers, biscuits, granola bars, coffee).
  - **USDA products:** by `foodCategory`, mapped from a pinned list that the plan verifies against real USDA values
    (e.g. "Chips, Pretzels & Snacks", "Biscuits/Cookies", "Bread & Buns", "Cereal").
  - **Open Food Facts products:** by category tags, from a pinned list (the superseded spec §4.4).
- **Non-food never matches.** This includes Gerber Puffs, which stays in "Baby Care" until the Baby Food fix.
- `ProductSource` gains `foodCategory?: string` (USDA) and `categoryTags?: string[]` (OFF), which `lookup.ts` fills in.

### 4.3 Combining (`verdict.tsx`)

`assess(p)` returns `{ verdict, flags, concerns }`:
- the additive analysis, as today;
- plus `foodConcerns(p)`;
- the verdict is the strongest of the additive verdict and any `kind: "food"` concern.

**Precedence:** non-food stays non-food. A food concern lifts "no-data" (a hot dog with no ingredient list still reads
Known). The `safeAnalyze` fallback is kept.

### 4.4 Look (`verdict.tsx` styles)

- One hue that darkens (deep red at the top), with an icon per level:
  - ○ Nothing flagged: grey
  - ◔ Some concern: light
  - ◑ High concern: medium
  - ● Known carcinogen: dark
- "Not enough data" and "Food only" stay neutral grey with their own icons.
- Contrast: text on each badge meets WCAG AA (4.5:1).

### 4.5 Where it shows

- **Cards** (Home, search, Saved): a category icon, the badge, and "🔥 forms when cooked" when acrylamide matches.
- **Product page:**
  - the badge in the hero;
  - findings grouped as **In the ingredients** (additives, as today), **The food itself** (processed meat) and
    **Formed when cooked** (acrylamide);
  - each finding gets a plain-English line, a regulator-context line, and expandable verbatim sources with
    "Source checked" dates;
  - processed meat shows both IARC context quotes (§3);
  - acrylamide shows the FDA advice;
  - the grey state's text: "No hazard flags from IARC, EU or FDA. This doesn't rate nutrition (coming next)." With the
    🔥 marker it's scoped, so it doesn't contradict the acrylamide section: "No hazard flags from IARC, EU or FDA in the
    ingredients or the food itself; see what forms when it's cooked below. …" (final-review fix).
- **Sort "Fewest concerns" and alternatives:** use the new rank. A hot dog suggests same-category products ranked lower.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| Food-concern code throws | Caught by `safeAnalyze`; additive result only, error logged |
| Non-English Open Food Facts ingredients | Processed-meat words are English-only, so the existing language note covers it; category tags still drive acrylamide |
| Ambiguous word ("ham" inside "graham") | Whole-word matching only; pinned by a test |

## 6. Testing

- `foodConcerns.test.ts`:
  - **catalog pinning:** processed meat matches exactly #6 Oscar Mayer franks, #36 SPAM, #38 Jimmy Dean sausage and
    #42 DiGiorno pepperoni (via ingredient). Acrylamide matches exactly #1 Lay's, #14 Oreo, #16 Nature Valley,
    #18 Pringles, #20 Special K, #40 Wonder, #41 Goldfish. The plan confirms both lists against the CSV before pinning.
  - **edge cases:** "graham crackers" isn't ham; "ham-free" isn't processed meat; "turkey bacon" is; "oatmeal" isn't
    acrylamide.
  - **looked-up products:** USDA `foodCategory` and OFF tag examples.
- `library.test.ts`: the `known` level derives from `iarc-1`.
- `catalog.test.ts`: still exactly the reviewed additive flags. The verdict changes only for the four processed-meat
  products (now `known`).
- `verify:sources`: the WHO processed-meat page passes. The IARC PDF is marked hand-checked, like the existing
  JS-rendered pages.
- **Browser:**
  - Oscar Mayer and DiGiorno are dark "Known carcinogen", and DiGiorno says "Contains pepperoni".
  - Lay's is grey with 🔥, and its page shows the acrylamide section with the FDA advice.
  - Diet Coke is light "Some concern"; Tide is "Food only".
  - No green anywhere; the badges read correctly with a greyscale filter.

## 7. Out of scope

FDA nutrition (next spec, L7), red meat, alcohol, other process contaminants (glycidyl esters, benzene, aflatoxins:
later candidates, each needing source checks), Home fakes, search, camera.

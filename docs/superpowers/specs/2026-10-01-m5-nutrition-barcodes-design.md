# M5: nutrition line, softer processed-meat rule, real catalog barcodes: design spec

- **Date:** 2026-10-01
- **Status:** draft, awaiting the owner's review
- **Designed with:** the owner (Minh Bui), 2026-10-01, through multiple-choice questions and the clickable mockup
  https://claude.ai/artifact/3tZQE5dWyfQFkfiu5dEjNB (they chose layout B + C).
- **Builds on:** M4 (`specs/2026-09-30-m4-concern-levels-design.md`): the concern badge, `foodConcerns.ts`, `assess.ts`.

## 1. Why

"Nothing flagged" says nothing about nutrition: Oreo has no flagged additive, but 3 cookies hold 14 g of added sugar,
28% of the FDA Daily Value. The owner wants that shown, as an official fact rather than a made-up score.

Two more things the owner decided on:
- **Small amounts of processed meat:** a product that only contains a little (beans with bacon) currently reads
  "Known carcinogen", the same as a pack of hot dogs.
- **Catalog barcodes:** the Figma export invented them (K-29). 22 could open the wrong real product, and catalog
  products can't get nutrition without a real barcode.

**Done for M5:**
- Product pages show a Nutrition section (added sugar, saturated fat, sodium) as FDA %DV per serving, with High and Low
  per the FDA's 5/20 rule.
- List cards show one "High …" chip.
- Products that only contain processed meat read "High concern".
- Every catalog barcode is either verified against USDA or removed.

## 2. Decisions (owner, 2026-10-01)

| # | Decision |
|---|---|
| N1 | Layout **B + C**: a Nutrition section on the product page (three bars, %DV, serving size), plus at most one chip on list cards for the highest nutrient that is High ("High sugar", "High sat fat", "High sodium") |
| N2 | Nutrients: **added sugar, saturated fat, sodium** (the three in FDA's proposed front-of-package label). No calories |
| N3 | **High** = 20% DV or more per serving; **Low** = 5% DV or less; in between, just the %. FDA's own rule, quoted on the page |
| N4 | Nutrition is a separate signal: slate colours, and it never changes the concern badge or its sort |
| N5 | Sources: USDA label data, plus Open Food Facts nutrition labelled crowd-sourced |
| N6 | Processed meat: a product that **is** processed meat stays Known carcinogen; a product that only **contains** it becomes High concern ("Contains processed meat: Pepperoni") |
| N7 | Catalog barcodes: each food product gets its real barcode only when a USDA record matches on name, brand and full ingredient list. Otherwise its barcode is **removed** (it stays searchable, but a scan can't open the wrong product). The owner sees the match table before the change |
| N8 | Catalog products with a verified barcode get nutrition by a session-cached USDA lookup of that barcode |

## 3. Facts this design rests on (verified 2026-10-01)

**FDA** (https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels and
https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label):
- "5% DV or less of a nutrient per serving is considered low. 20% DV or more of a nutrient per serving is considered high."
- Daily Values (adults and children 4+): added sugars 50 g, saturated fat 20 g, sodium 2,300 mg.

**USDA FoodData Central:**
- **Search results** (`/foods/search`) carry `foodNutrients` per 100 g or 100 ml (names "Sugars, added",
  "Fatty acids, total saturated", "Sodium, Na") and `servingSize` + `servingSizeUnit`.
- **Per serving** = per-100 × servingSize / 100. Checked against the `/food/{fdcId}` `labelNutrients` on 2026-10-01:
  - Oreo (`044000032029`, 34 g): added sugar 41.2 → **14.0 g (28%)**, sat fat 5.88 → 2.0 g (10%), sodium 382 → 130 mg (6%);
  - Lay's (`028400421584`, 28 g): sat fat 1.5 g (8%), sodium 170 mg (7%), **no added-sugar value**;
  - Coke Zero (`00049000042566`, 355 ml): all 0.
- A missing nutrient is **"not listed"**, never 0.
- `householdServingFullText` ("3 cookies") is in the detail record and is sometimes in search. Show it when present,
  else the gram amount.

**Open Food Facts:** `nutriments` holds per-serving values (`…_serving`), or per-100 g values plus `serving_size`.
Added sugars are often missing (so "not listed"). The plan pins the exact field names from recorded fixtures.

## 4. Design

### 4.1 Nutrition data (`src/lib/nutrition.ts`, new, pure)

```ts
type NutrientId = "addedSugar" | "satFat" | "sodium";
interface NutrientValue { id: NutrientId; amount: number | null; unit: "g" | "mg"; dv: number | null; level: "high" | "low" | null }
interface Nutrition { serving: string; nutrients: NutrientValue[]; source: "USDA FoodData Central" | "Open Food Facts" }
```

- `DAILY_VALUE = { addedSugar: 50, satFat: 20, sodium: 2300 }`.
- `dv = round(amount / DV × 100)`. `level` is "high" when dv ≥ 20, "low" when dv ≤ 5, else null. A null amount gives a
  null dv and level.
- `usdaNutrition(food)` and `offNutrition(product)` are pure mappers from the API records.
- `Product.nutrition?: Nutrition`. `lookup.ts` fills it in for looked-up products.
- `topHigh(n)` returns the nutrient with the highest dv among the High ones, for the card chip, or null.

### 4.2 Catalog nutrition (N8)

The product page for a catalog product with a barcode calls `lookupBarcode(p.barcode)` (already session-cached).
- **Found:** take `nutrition` only. Catalog ingredients and flags stay the hand-reviewed ones.
- **Loading:** the section shows "Nutrition loading…".
- **Not found or error:** "Nutrition not available".
- **No barcode:** no section.

Cards show the chip only once the nutrition is known, either from a lookup this session or for a looked-up product.
There are no extra requests for whole lists: *recommended default*, which respects the rate limit.

### 4.3 Product page and cards (N1, N4)

- **The Nutrition section** comes after the findings groups and before Ingredients:
  - its header: "Nutrition · per serving · 3 cookies (34 g)";
  - three rows: name, amount, "28% DV · High", and a slate bar filled to min(dv, 100)%;
  - a caption quoting the FDA 5/20 rule, linking FDA, and naming the data source (with "crowd-sourced, may contain
    errors" for OFF).
- **The hero** gets a chip for the top High nutrient ("High in added sugar").
- **Cards** get one slate chip ("High sugar") under the badge, next to any 🔥 line.
- **Colours:** slate `#1E293B` text on `#F1F5F9` with a `#CBD5E1` border. No red and no green. The level is written
  out ("High"), never colour alone.

### 4.4 Softer processed-meat rule (N6)

In `foodConcerns.ts`, the processed-meat concern's `severity` becomes:
- **"known"** when the product is processed meat. That's the "Processed meat: …" reasons and the USDA processed-meat
  categories.
- **"high"** when it only contains it. That's the "Contains processed meat: …" reasons: dishes, and matches found only
  in the ingredients.

The context text for the "contains" case adds: "The amount here is likely much smaller than IARC's 50 g daily
portion." Catalog pins change: #42 DiGiorno → high. #6, #36 and #38 stay known.

### 4.5 Real catalog barcodes (N7)

- **Research (plan time):** for each food catalog product (non-food is out of scope), search USDA by name and brand,
  and accept a record only when the brand matches, the product and flavour match, and the full ingredient list agrees
  with the catalog text.
  - The pack size may differ: a record of another size is accepted, and the catalog name is updated to the verified
    record's size.
  - The owner approves the table (product → USDA record, fdcId, barcode, or "no match → remove").
- **One migration** sets verified barcodes and nulls the rest for food products. `products.csv` is updated to match,
  and the demo picker keeps only real codes.
- **Non-food barcodes** (not in USDA) are left as they are and documented, since nutrition and hazard lookups don't
  apply to them.
- **A test** confirms no catalog barcode is unverified food, using a pinned `verified-barcodes.json` list.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| A nutrient missing from the record | "not listed"; it never counts as Low |
| No serving size | Section shows per-100 g values labelled "per 100 g"; no High/Low (the FDA rule is per serving) |
| Lookup error for a catalog product | "Nutrition not available"; the page is otherwise unaffected |
| %DV over 100 | Bar capped at 100%, the number shown as is |

## 6. Testing

- `nutrition.test.ts`:
  - USDA fixtures for Oreo (28% High sugar), Lay's (sugar not listed; sat fat 8%, sodium 7%, no High) and Coke Zero
    (all 0, Low).
  - An OFF fixture.
  - The 5/20 boundaries: 5 → low, 20 → high, 19.6 rounds to 20 → high (*recommended default*: classify on the rounded
    %, as the label shows it).
  - Missing serving size.
  - `topHigh`.
- `foodConcerns.test.ts`: DiGiorno → high; hot dogs, SPAM and sausage → known; "Breakfast Bowl … sausage" → high.
- `catalog-barcodes.test.ts`: every food catalog barcode is in `verified-barcodes.json` or null.
- **Browser:**
  - Oreo's page shows Nutrition "Added sugar 14 g · 28% DV · High" and the hero chip.
  - The snacks list shows a "High sugar" chip on Oreo after its page was opened.
  - Coke Zero shows Low ×3.
  - DiGiorno reads High concern.
  - No red or green inside the Nutrition section.

## 7. Out of scope

Calories, other nutrients, the camera (M6), the Home redesign, search (separate small fix), Baby Food category,
non-food barcodes.

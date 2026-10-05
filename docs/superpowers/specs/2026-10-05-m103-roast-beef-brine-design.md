# M10.3: Roast beef in a brine, ribs, meat sticks, and two old false flags (the last M10 rule fix): design spec

- **Date:** 2026-10-05
- **Status:** **approved by the owner 2026-10-05** (relayed by the PM chat; D4-D6 accepted as written, including meat sticks). Part of M10, built on the `data-ownership` branch after M10.2 (`ENGINE_REV` 3 → 4),
  merged to `main` with M10. **Reference code and tests are ready and checked** (assets below).
- **Decided with:** the owner (Minh Bui), relayed by the PM chat 2026-10-05: (1) **two old false flags** are fixed, "Franks Red
  Hot" is not franks and non-animal "meat" (coconut and the like) is not meat; (2) the **misses** of the M10.2 first pass;
  (3) **decision 032**: roast beef in an added brine or solution counts as processed meat (water plus salt, a stated "% solution",
  or a clean-label preservative such as cultured sugar and vinegar); plain cooked beef seasoned with salt and pepper does not;
  (4) **decision 031**: the final gate is **targeted**, not a whole new sample (section 6).

## 1. Why

The M10.2 first pass judged 1,106 products: **2 false flags** and **13 misses** (plus 5 "unsure" that were fine). Both false flags
are **old and live today**: "FRANKS RED HOT SAUCE" read as franks (a pizza, a stromboli, a dressing, Goldfish crackers) and
"coconut meat" backed a "jerky" name. Of the 13 misses, **9 are fixed here** (ribs whose label is only the coating or marinade,
celery-cured ribs filed under "Cooked & Prepared", Jack Link's meat sticks, deli roast beef in a brine, and roast beef inside
sliders and sandwiches), and **4 stay as logged gaps**. The live app's USDA lookups run the same engine, so **the fix helps
production too**, as soon as M10 merges.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | **"Franks Red Hot" is a hot sauce**, with or without its apostrophe, in a name or on a label. *(owner, 2026-10-05)* |
| D2 | **"Meat" is an animal's.** Coconut meat, nut meats, crab, lobster, shrimp, clam, fish and the like are not meat (fish and shellfish: IARC, M10.1 D7). A "jerky" or "sausage" name cannot flag a product whose only "meat" is one of them. *(owner)* |
| D3 | **Decision 032: roast beef in an added brine or solution is processed meat.** Water plus salt, a stated "% solution", a cure or preservative (nitrite, celery powder, lactate, diacetate), or a clean-label one (cultured sugar and vinegar). Plain cooked beef seasoned with salt and pepper is not. *(owner)* |
| D4 | **Meat sticks** ("Beef Original Sticks", "Slim Jim Meat Stick", "Turkey Stick") follow the owner's decision 029: processed when the label shows a cure or preservative (celery extract, nitrite, lactate). *(default; the owner may overturn. Without it, 6 gaps would be logged, over decision 030's limit of 5)* |
| D5 | **Roast beef inside another product reads "contains" (High), not "is" (Known)**: sliders, wraps, pinwheels, a ravioli filling, a salad topping. *(default)* |
| D6 | **Gravy and flavourings are not roast beef.** "Roast beef flavor", "roast beef type flavor", "roast beef topping" and a "beef base (oven roast beef, salt…)" are flavourings; "roast beef with gravy" is not brined beef, the water and salt are the gravy's. *(default)* |

## 3. Rules, one per cause

| Id | Cause | Rule |
|---|---|---|
| F1 | "FRANKS RED HOT SAUCE (AGED CAYENNE…)" on a label reads "Contains processed meat: FRANKS" | `franks?'?s? red ?hot` is removed from names and labels before the meat words are looked for. Real franks, hot dogs and "Beef Franks" still flag. |
| F2 | "Original Coconut Jerky": the label item "COCONUT MEAT" is read as meat and backs the "jerky" name | The generic word "meat" does not count after coconut, nut(s), walnut, pecan, crab, lobster, shrimp, clam, oyster, scallop, fish, shellfish, tuna or salmon. A bare "MEAT" item is still meat. |
| R1 | "Fully Cooked Spare Ribs", label "Coated with: potassium lactate, water, salt, sodium diacetate…" (no meat item), and "Ribs; TUMBLED WITH (… CELERY POWDER)" in "Cooked & Prepared" | "Cooked & Prepared" joins the cooked and frozen meat categories for meatballs, ribs, roast beef and meat sticks. A name that says ribs, meatballs, meat sticks or roast beef, with no plant, dairy, egg, flour or fish base on the label and no sauce, spread or seasoning name, counts as meat even when the label lists only its coating. The meat may be the first or second label item (the parser splits "ST. LOUIS" at the full stop). |
| R2 | Jack Link's "Beef Original Sticks": "CULTURED CELERY EXTRACT" | D4: `beef/pork/turkey/meat/snack … sticks` joins the names of rule C of M10.2 (meatballs, ribs, roast beef). Never in a sandwich by another name (slider, sub, hoagie, baguette, melt). |
| R3 | "Organic Diced Roast Beef": BEEF, WATER, SEA SALT, PEPPER; "Angus Seasoned Roast Beef": BEEF, WATER, VINEGAR, SALT, SODIUM PHOSPHATE | D3: a product named roast beef, in a meat or cooked-meat category, with beef on the label, no base, no gravy, and a brine (water and salt), a "solution", a cure or a preservative reads Known: "Processed meat (roast beef in a brine or solution; USDA category …)". "BEEF, SALT, BLACK PEPPER" and "Roast Beef with Gravy" stay unflagged. |
| R4 | Roast beef inside sliders, a baguette, wraps: "ROAST BEEF (CONTAINS UP TO A 20% SOLUTION OF BEEF BROTH, SEA SALT…)", "ROAST BEEF - WATER AND … PRODUCT: BEEF, BEEF BROTH, SALT, … POTASSIUM LACTATE" | D5, D6: a "roast beef" on the label whose own part (its parenthesis, or up to the next full stop or component header such as ", SEASONED GRAVY:") shows a brine, solution, cure or preservative reads "Contains processed meat: roast beef" (High). Plain "ROAST BEEF (BEEF, SALT, PEPPER)" inside a sandwich stays unflagged. |

## 4. Evidence (2026-10-05; scratch copy of the M10.2 engine; the Knight's 1,106-entry sample and the live `foods` table read through the connector)

- **The M10.2 sample (1,106 entries):** 12 verdicts change. The **2 false flags are gone** (Schnucks pizza, Wild Joy coconut jerky).
  **9 of the 13 misses are fixed**: Jack Link's ×2, Castle Wood and Organic Prairie roast beef, Bryan and Houston Livestock ribs,
  Meijer, Charlie's and Great Value roast beef sandwiches. One more reads Known (Schnucks hickory-smoked ribs, which Sonnet had
  called correct: it is a smoked rib, decision 029). **4 misses remain and are logged**: Haggen bacon-wrapped steaks (label lists
  only the cure), Hellers pulled pork (category "Bacon", acidity regulators only), Brookshire's jerky (the label says "BEST" for
  beef), Aunt Jemima sausage scramble (the word "Imitation" in the name hides the sausage). **The 5 clean-meat "unsure" stay unflagged
  by decision**: celery salt, dehydrated celery (twice), calcium lactate, and roast beef in gravy.
- **Live table, the 4,170 products that mention roast beef, franks, "… meat", meat sticks, or sit in "Cooked & Prepared":**
  **14 lose a wrong flag**, every one read: Goldfish Franks RedHot ×3, buffalo chicken stromboli, pizza and wrap, a Wish-Bone
  dressing, coconut jerky ×3, a fish salad, crab meat and a fish sausage. **118 gain a finding**: 67 "contains roast beef" (48 sandwiches
  and subs, the rest wraps, pinwheels, a ravioli filling, a salad), 28 meat sticks (24 of them Slim Jim: "sodium nitrite"), about 20
  smoked, cured or preserved ribs, 5 roast beef. No severity changes elsewhere. I read every flip that is not a sandwich one by one, and a sample of the 48 sandwiches (each names roast beef and carries the brine in the roast beef's own parenthesis).
- **First drafts failed in useful ways:** "roast beef" matched "ROAST BEEF FLAVOR", "VEGETARIAN ROAST BEEF TYPE FLAVOR" and a
  "BEEF BASE (OVEN ROAST BEEF…)" in soups and gravy mixes (D6); the open-ended label window ran from a roast beef into the gravy
  after it ("COATED WITH SEASONING [SALT…], SEASONED GRAVY: WATER…"); "Roast Beef Seasoning" and "Roast Beef Fully Cooked With
  Gravy" read Known; a wider sandwich-word list turned 99 existing ham, sausage and bacon sandwiches from Known to High (a good
  change, but out of scope: it is now limited to rule C of M10.2). Each is now a test or a guard.
- The 197 tests (existing, M10.1, M10.2) pass with the new block, M10.2's C6 edited for decision 032, plus the **6 new tests**
  (203): both files are in the assets. On a scratch copy of the Knight's branch the block applies cleanly: 215 of 217 pass
  (the two others need files my copy lacked).

## 5. Changes

- `src/lib/safety/foodConcerns.ts`: replace the processed-meat block with
  `docs/superpowers/specs/2026-10-05-m103-assets/processed-meat-rules.ts` below its dashed line. **Leave no header text in the
  file** (grep for "HOW TO APPLY").
- Tests: new `src/lib/safety/processedMeatBrine.test.ts` (6 tests); **replace** `processedMeatCure.test.ts` with the asset's
  (its test C6 changes: a roast beef in a brine is now processed, plain roast beef is not).
- `src/lib/foodsImport.ts`: `ENGINE_REV` **3 → 4**; update any test that pins 3.
- `scripts/audit-foods.mjs`: a **targeted** mode for the gate in section 6.
- Docs: `FIXES_AND_UPDATES.md`, `KNOWN_ISSUES.md` (the 4 logged misses above with product and barcode, plus the gaps in section 7).
  Decisions 031 and 032 are already in `PROJECT_HANDOFF.md` on `main`.

## 6. Final gate (decision 031: targeted, not a new sample)

1. `npm test` all green, `npm run build`, `npm run verify:sources`.
2. **Truncate `foods`** (Minh's OK; nothing in production reads the table yet), then Minh re-imports; rows carry `engine_rev` 4.
   Check the row count and size.
3. Re-check only: **(a)** every entry of the rev-3 sample (the 1,106 and the M10.1 sample, the Knight's batch files) whose verdict
   **changes** under rev 4 (the 12 above and any others the table shows); **(b)** the 2 false flags and the 9 fixed misses
   (and the 4 logged ones, unchanged); **(c)** a **random spot check of 50** unchanged entries from the sample. The Knight
   judges (a) and (b) itself against the full label; (c) goes through the Sonnet first pass with the M10.1 and M10.2 prompt text
   and the line *"A roast beef in an added brine or solution (water and salt, a stated solution, a preservative or cultured sugar
   and vinegar) is processed meat; plain cooked beef with salt and pepper, a flavour called roast beef, and roast beef in a gravy
   are not. 'Franks Red Hot' is a sauce. Coconut or crab 'meat' is not meat."*
4. **Pass: zero false flags and at most 5 logged misses** (decision 030) across (a) to (c), then Minh's 20 spot-check items. A false
   flag, or more than 5 confirmed misses: stop and tell the King.

## 7. Known gaps this does not fix (measured, left as they are)

- The 4 logged misses of section 4: bacon-wrapped steaks with a cure-only label; Hellers pulled pork; a label typo ("BEST" for
  beef); a long name where "Imitation" sits next to real sausage.
- Smoked pulled pork and chops, "Schmacon", deli turkey under "Poultry, Chicken & Turkey" (M10.2 section 7).
- A roast beef whose label says only "BEEF, WATER" (no salt) is not treated as brined; "roast beef" in a language other than
  English is not read.

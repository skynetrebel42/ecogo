# M10.1: Processed-meat rules (fix the gaps the M10 launch audit found): design spec

- **Date:** 2026-10-04
- **Status:** draft for the owner's approval. Part of M10: it is built on the `data-ownership` branch before the table is
  re-imported, and merges to `main` with M10. **Reference code and tests are ready and checked** (assets below).
- **Decided with:** the owner (Minh Bui), relayed by the PM chat 2026-10-03: (1) **fix the rules first, then re-gate**, no
  launch with known gaps; (2) **canned and deli chicken and turkey ARE processed meat**; (3) **deli roast beef in a salt or
  preservative solution (sodium lactate, diacetate) IS processed meat**.

## 1. Why

The M10 launch gate failed. The Knight reviewed 410 sampled products: **3 false flags** (a fresh "Pork Ham Bone In" read
Known; "RENDERED BACON FAT" and imitation "BACON BITS (SOY FLOUR…)" read as bacon) and **about 48 misses among 110**
"Nothing flagged" meat products (real ham, salami and sausage). The gaps are in the engine (`foodConcerns.ts`, `parse.ts`),
which today's live USDA lookups also use: **the fix improves the live app too**, as soon as it merges.

## 2. Decisions

| # | Decision |
|---|---|
| D1-D3 | The owner's three decisions above. D2 needs **no code change** (the engine's own WHO/IARC quote already says "canned meat"; poultry counts); the tests below pin it so it can't regress. D3 is rule A1. |
| D4 | **Rendered bacon fat alone is not bacon.** No official source calls it processed meat, and a flag needs one. About 140 canned beans, greens and gravies lose their "contains bacon" High. "BACON FAT AND COOKED BACON (CURED…)" still counts. *(default; the owner may overturn)* |
| D5 | Duck liver mousse, foie gras and goose pâté in USDA's cold-cut, sausage and canned-meat categories read Known **by category** (IARC: processed meat may include offal and by-products). *(default)* |
| D6 | **Injected or breaded fresh/frozen chicken** ("containing up to 15% of a solution…") stays "Nothing flagged": only deli, cold-cut, sausage, bacon and canned categories read as processed. D3 is about deli roast beef, not the poultry aisle. *(default)* |
| D7 | Fish is not meat (IARC): salmon "sausages", smoked-salmon "pastrami" and crab spreads stay "Nothing flagged". |

## 3. Rules, one per cause

| Id | Cause (from the audit) | Rule |
|---|---|---|
| A1 | The label lists only the brine, glaze or cure of a ham, roast beef or bacon (46 of the 58 products that now flip) | In a USDA **meat category** (sausage, bacon, salami, cold cuts, hot dog, canned meat, ham; not vegetarian, fish, cheese, bread, snacks) a product whose name has a meat noun and whose label has **no non-meat base** (plant protein, gluten, tofu, legumes, grains, dairy, eggs, fish; "hydrolyzed soy protein" is a seasoning, not a base) is the brine-only label of a meat product: it counts as backed. Not applied when the name says spread, dip, sauce, seasoning, glaze, bun, bread, cheese, or when the label has a "bacon/ham/sausage… flavor" item (a bacon seasoning filed under bacon). |
| A3 | "RENDERED BACON FAT", "BACON BITS (SOY FLOUR…)" | An item that is only bacon fat/grease/drippings is not meat; "bacon bits (soy/textured/vegetable/plant…)" is cut out of the label text before it is split. |
| B | "Pineapple Bacon Flavored Sausage": the flavour word makes the whole name "not meat" | A "…flavored" or "…-free" meat word still hides the product, **unless the label's first item is real meat**. The flavoured word never names the product itself. |
| C | "Pork Raised With **Vegetarian-Fed** Diet" | "Vegetarian" followed by fed, diet or raised no longer counts as meat-free. |
| D | Meats the engine didn't know | Label meat words add hog, duck, goose, boar, elk, moose, rabbit, pheasant, quail, ostrich, buffalo. Their **eggs** don't count (quail eggs in USDA's "Canned Meat"). |
| E | "NO NITRATES OR NITRITES ADDED*** PORK": the parser dropped the claim **and the pork** | A "no … added" claim glued to the first ingredient is cut off and the ingredient kept. "…ADDED EXCEPT THOSE IN CELERY" is still dropped whole, as before. |
| F | A fresh cut named "Ham" read Known | A name whose only meat word is "ham" is not processed when the label shows no curing, smoking, brine or solution, the name has no "dry-cured / country / honey / cooked / smoked …", USDA's category isn't a cold-cut one, and either USDA says unprepared/unprocessed or the label is one meat item. It returns **no finding at all** (not even "contains"). A basted ham ("Added Solution of Water…") still reads processed. |

## 4. Evidence (2026-10-04; scratch copy of `main` 08bef84 plus the Knight's 410-product sample; live `foods` table read through the connector)

- **Audit sample (410):** of the 110 "Nothing flagged" meat products, **58 now read flagged (a few more than the Knight's count of about 48 misses: duck, boar and roast beef are in the owner's definition; every one was read and is right) and 52 stay none, and all 52 are
  plant-based, fish, cheese, spread or bread items**; 13 flagged products gain the missing meat finding (bacon and ham with
  "CURED WITH WATER, SALT…" labels, High to Known); the **3 confirmed false flags are gone**.
- **The real table, 2,080 "Nothing flagged" products** with a meat word or in a meat category: 91 flip to flagged; every one
  was hand-read: cured ham, bacon and dried beef; deli roast beef; jerky of buffalo and elk; hog sausage patties; duck, boar and
  ostrich hot dogs; canned turkey and goose pâté. No plant-based, fish, cheese or flavour product flipped.
- **A random 2,500 flagged meat-related products:** 150 gain a Known finding (cured bacon, ham and dried beef with brine-only
  labels); 9 lose the finding (8 fresh ham cuts, 1 bean dish with bacon fat only).
- **Bacon-fat, bacon-bits and fresh-ham removals** across the 890 flagged rows that mention them: 141 fat-only, 9 imitation
  bits, 34 fresh pork ham cuts (every label is just "Pork"); none of them names real bacon, ham or sausage.
- **First drafts failed in useful ways** (they are why the rules above are narrow): dropping the whole-name "plant-based/veggie"
  check flagged plant-based bacon and sausage products; dropping the whole-name "flavored" check flagged bean-soup mixes,
  gravy mixes and bacon-flavored almonds; an unanchored fat rule removed "BACON FAT AND COOKED BACON (CURED…)"; the fresh-ham
  rule removed a dry-cured Iberico ham; the brine rule flagged a "BACON FLAVOR" seasoning filed under bacon. Each is now a test.
- The 166 existing tests pass unchanged; the **16 new tests** are in the assets.

## 5. Changes

- `src/lib/safety/foodConcerns.ts`: replace the processed-meat block with
  `docs/superpowers/specs/2026-10-04-m101-assets/processed-meat-rules.ts` (its header says which lines; the file's other
  parts and the sources/quotes are untouched).
- `src/lib/safety/parse.ts`: the claim prefix (rule E), next to `emit`:

```ts
/** "NO NITRATES OR NITRITES ADDED*** PORK": a claim glued to the first ingredient. Drop the claim, keep the ingredient (M10.1 E).
 *  "…ADDED EXCEPT THOSE IN CELERY" is a longer claim: it stays whole and is dropped as an absence, as before. */
const CLAIM_PREFIX = /^no\b[^,;.]*?\badded\b(?!\s+except\b)[\s*†‡:.-]*/i;

function emit(raw: string, out: string[]): void {
  const item = tidy(tidy(stripFiller(tidy(raw.replace(/[()[\]{}]/g, " ")))).replace(CLAIM_PREFIX, ""));
  if (!item || NEGATION.test(item)) return;
```

- New test file `src/lib/safety/processedMeatRules.test.ts` (copy of the asset).
- `src/lib/foodsImport.ts`: `ENGINE_REV` **1 → 2**, so every re-imported row says which engine scored it.
- Docs: `FIXES_AND_UPDATES.md` (what and why), `KNOWN_ISSUES.md` (strike the concern-level follow-ups this fixes, add the gaps in §7),
  PROJECT_HANDOFF (a row in the decision log for D4-D6).
- Built on branch `data-ownership` (the M10 worktree), because the loaded table must be re-scored by the re-import.

## 6. Re-gate (the launch gate repeats on a fresh sample)

1. Build and test: `npm test` all green (166 safety and lib tests plus the 16 new, plus M10's), `npm run build`.
2. Minh re-runs the import (`npm run import:usda -- <the zip>`, no `--dry-run`): rows are upserted by barcode, now scored with
   `engine_rev` 2. Check the row count and size again.
3. Redraw the audit sample with `scripts/audit-foods.mjs`, with the clean-meat draw **widened**: every "Nothing flagged"
   product in "Pepperoni, Salami & Cold Cuts", "Sausages, Hotdogs & Brats" (and its frozen variant), "Canned Meat", "Bacon,
   Sausages & Ribs" (and its frozen variant), every spelling of "Meat/Poultry/Other Animals Sausages … Prepared/Processed",
   "Sausages/Smallgoods", "Bacon", "Salami / Cured Meat", "Ham/Cold Meats", **plus** up to 150 random "Nothing flagged"
   products anywhere whose name has ham, bacon, sausage, salami, pepperoni, hot dog, jerky or bologna.
4. First pass on Sonnet subagents, as in the M10 plan, with this addition to the prompt: *"Processed meat includes canned
   and deli chicken and turkey, and deli roast beef in a salt or preservative solution (WHO/IARC: meat transformed through
   salting, curing, fermentation, smoking or other processes to enhance flavour or improve preservation). It does NOT
   include a fresh cut (for example 'Pork Ham Bone In' with the label 'Pork'), bacon FAT alone, imitation bacon bits, fish,
   or a product whose name only says 'flavored'."*
5. The Knight reviews every false and unsure, every 10th correct; Minh spot-checks 20 (the King relays). **The gate passes
   on zero confirmed false flags and zero confirmed misses**, in this sample and in Minh's 20; more than 5 in the first pass:
   stop and tell the King.

## 7. Known gaps this does not fix (measured, left as they are)

- A long name where a plant-based clause sits next to real meat reads "Nothing flagged" (the whole-name "plant-based/veggie"
  check stays): "Turkey Sausage, Cheddar & Veggie Omelet Minis", "Ham & Cheese Pockets… Uncured Ham And Plant-Based
  Mozzarella". Small; a separate rule needs its own audit.
- "Canned Chicken Breast" outside USDA's "Canned Meat" category (about 10 products) and roast beef outside the cold-cut
  categories read "Nothing flagged".
- A label typo such as "PORT" for pork can't be read as meat by a rule (the product above still reads flagged, through the
  brine rule).
- Cooked or injected fresh poultry (D6) and any other "salting" read broader than IARC's examples.

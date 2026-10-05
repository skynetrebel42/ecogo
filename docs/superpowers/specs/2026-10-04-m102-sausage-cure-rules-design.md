# M10.2: Sausage names, cured and preserved meat (fix the gaps the M10.1 re-gate found): design spec

- **Date:** 2026-10-04
- **Status:** **approved by the owner 2026-10-04** (relayed by the PM chat; D4-D6 defaults accepted as written). Part of M10, built on the `data-ownership` branch after M10.1 (`ENGINE_REV` 2 → 3),
  merged to `main` with M10. **Reference code and tests are ready and checked** (assets below).
- **Decided with:** the owner (Minh Bui), relayed by the PM chat 2026-10-04: (1) **sausage names** in USDA's sausage categories;
  (2) **meatballs and ribs** are processed meat when smoked, cured or preserved (**decision 029**); (3) **the gate changes**
  (**decision 030**): zero confirmed false flags (unchanged), **at most 5 confirmed misses**, each logged in `KNOWN_ISSUES.md`, and
  the sampler shows the **full label**. Plant-based items in these categories keep reading "Nothing flagged".

## 1. Why

The M10.1 re-gate stopped after its first 220 clean-meat products: **0 false flags, 47 misses** (Sonnet first pass, 38 more "unsure"
because the sampler cut labels at 600 characters). I read every one. **31 are real misses** (sausage patties and links under
USDA's abbreviations and typos, deli turkey and pork with a celery cure, ribs that are smoked or in a lactate solution, meatballs
with celery powder or lactate). **16 are not**: plain ground-meat meatballs (meat, salt, spices, phosphate), which decision 029 keeps
unflagged. Checking the live `foods` table then found a bigger gap the sample could not show: bacon and ham in USDA's generic
prepared-meat category whose label lists only the cure. The live app's USDA lookups run the same engine, so **the fix helps
production too**, as soon as M10 merges.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | **Sausage names.** In a USDA category with "sausage" in its name: link(s), patty/patties, banger(s), chipolata(s), the USDA abbreviations Saus, Ssg, Lk, Pty and the typos Sauage, Sausge count as sausage. Deli turkey filed under "Bacon, Sausages & Ribs" counts as processed meat. *(owner)* |
| D2 | **Meatballs and ribs (029).** Processed meat when **smoked**, **cured** (celery powder or juice, nitrite, nitrate) or **preserved** (sodium or potassium lactate, sodium diacetate): the same rule as the D3 roast beef of M10.1. Plain ground-meat meatballs (meat, salt, spices, phosphate only) stay unflagged. *(owner)* |
| D3 | **The gate (030).** Zero confirmed false flags and at most 5 confirmed misses, each logged in `KNOWN_ISSUES.md`; the sampler prints the full label. *(owner)* |
| D4 | **Smoked means the name says smoked.** "Natural smoke flavor" on a label is a flavouring, like "bacon flavor"; it does not make meat smoked. Phosphates and celery salt (a spice) are not cure signals. *(default; the owner may overturn)* |
| D5 | **USDA's generic prepared-meat category** ("Meat/Poultry/Other Animals - Prepared/Processed", both spellings) counts as a meat category for hams, bacon and sausage whose label lists only the brine or cure (rule G). It does **not** make plain cooked patties, wings or injected chicken processed (D6 of M10.1 stands). *(default)* |
| D6 | **Australian and New Zealand deli categories** ("Ham/Cold Meats", "Salami / Cured Meat", "Sausages/Smallgoods") are processed meat by definition, like "Pepperoni, Salami & Cold Cuts". *(default)* |

## 3. Rules, one per cause

| Id | Cause | Rule |
|---|---|---|
| S | "OC Sthrn Pork Ssg Patties", "Saus,Lk,Skin-On", "Pork Sausge Links", "Breakfast Links", "Chipolatas (Breakfast Bangers)" read "Nothing flagged": the name has no word the engine knows | In a sausage category the names of D1 count as sausage (reason "Processed meat: Sausage"), if the label shows meat or is only "see package". Burgers, plant-based and meat-free names never. "Pork/Beef/Chicken/Turkey/Breakfast Links" also count in the cooked and frozen meat categories ("Other Meats", "Other Frozen Meats", "Frozen Meat", generic prepared); "Jack Link's" is a brand. A sandwich or biscuit named for its sausage still reads High ("contains"). |
| C | Meatballs, ribs and deli turkey with a celery, lactate, nitrite or smoked signal read "Nothing flagged" | In the sausage, bacon, ham and cold-cut categories (and, for **meatballs, ribs and roast beef**, also the cooked and frozen meat categories) a label that starts with meat, or is only the brine of a meat, and has a cure or preservative item (celery powder or juice, nitrite, nitrate, sodium or potassium lactate, sodium diacetate), or a name that says "smoked", reads Known: reason "Processed meat (celery powder on the label; USDA category …)" or "(smoked; …)". Tried **after** the "contains" path, so a product that lists pepperoni among other things still reads High. "Rib meat" (chicken anatomy) and singular "rib" are not ribs here. |
| G | Bacon and ham whose label is only "CURED WITH: WATER, SALT, … SODIUM NITRITE" in the generic prepared-meat category read no meat finding at all | D5: that category joins the meat categories for the brine-only rule of M10.1 A1. |
| N | "Lunchbox Salamis" | `salamis?` is salami. |
| P | "Hellers Roast Beef", "Tegel Roast Shredded Chicken" in "Ham/Cold Meats" | D6: three more categories join the processed-meat-by-definition set. |

## 4. Evidence (2026-10-04; scratch copy of the M10.1 engine; live `foods` table at `engine_rev` 2 read through the connector)

- **Re-gate sample (996 entries, 25 batches):** 81 more products read flagged (78 clean-meat, 3 flagged products gain the missing
  meat finding). Of the 47 first-pass "false": **31 now flagged** (each read and right) and **16 stay unflagged**, all plain
  phosphate-only meatballs (decision 029). Of the 38 "unsure": 6 now flagged (lactate), the rest are plain meatballs and ribs.
- **Live table, 546 "Nothing flagged" rows in the meat categories:** 80 flip; every one hand-read (sausage patties and links,
  lactate and celery meatballs, smoked ribs, deli turkey, coppa, Hellers and Tegel). None lost.
- **Live table, flagged rows that lacked the meat finding:** 483 of 2,846 rows in the sausage, bacon and prepared-meat categories
  gain it: **about 430 bacon, ham and corned-beef products in the generic category** (every label "CURED WITH … SODIUM NITRITE" or
  celery powder) that showed only an additive badge, and about 50 sausages, coppas and meatballs. A spot check of about 50 of them: all real.
- **Generic and "Other" meat categories, 664 "Nothing flagged" rows with a meat word:** 11 flip (Jimmy Dean bacon pieces, Daily's
  and Jones hams, smoked ribs, roast beef with lactate, pork links); none lost, and none of the cooked chicken or beef patties
  flips. At least **574 products** change in total; the rest of the 431,302 rows cannot (the rules only fire in these categories).
- **First drafts failed in useful ways:** a category rule for USDA's sausage categories turned Jimmy Dean sandwiches and biscuits
  from High to Known (the name rule is why S is name-based); a cure rule ahead of the "contains" path turned an antipasto tray and
  pepperoni-topped meatballs from High to Known; "rib" matched "chicken breast with rib meat" and flagged injected fresh chicken
  (D6); "celery salt" flagged phosphate meatballs. Each is now a test.
- 181 tests (existing and M10.1) pass unchanged with the new block; the **16 new tests** are in the assets. On a scratch copy of
  the Knight's `data-ownership` branch the block applies cleanly: 209 of 211 pass (the two others need files my copy lacked).

## 5. Changes

- `src/lib/safety/foodConcerns.ts`: replace the processed-meat block with
  `docs/superpowers/specs/2026-10-04-m102-assets/processed-meat-rules.ts` (its header says which lines). **Also delete the six
  stray header comment lines the M10.1 paste left above the block** (they begin with `// IARC's examples" down to (not including)`,
  line 49 of the branch's file, and end with the dashed line): they are the tail of the asset's header, not code.
- New test file `src/lib/safety/processedMeatCure.test.ts` (copy of the asset).
- `src/lib/foodsImport.ts`: `ENGINE_REV` **2 → 3**; update any test that pins 2.
- `scripts/audit-foods.mjs`: print the **full label** (drop the 600-character cut); widen the clean-meat draw (section 6).
- Docs: `FIXES_AND_UPDATES.md`, `KNOWN_ISSUES.md` (the gaps in section 7, plus every confirmed miss of the next gate).
  Decisions 029 and 030 are already in `PROJECT_HANDOFF.md` on `main`.

## 6. Re-gate

1. `npm test` all green (the 181, M10's, the 16 new), `npm run build`, `npm run verify:sources` (foodConcerns.ts changed).
2. **Truncate `foods`** (Minh's OK; nothing in production reads the table yet, M10 is unmerged), then Minh re-imports
   (`npm run import:usda -- <the zip>`, no `--dry-run`): rows now carry `engine_rev` 3. Check row count and size.
3. Redraw the sample, widened: **every** "Nothing flagged" product in the sausage, bacon, ribs, hot dog, cold-cut, canned-meat,
   ham and Australian/New Zealand categories of M10.1 section 6, **plus** every one in "Meat/Poultry/Other Animals - Prepared/Processed"
   (both spellings), "Other Meats" and "Other Frozen Meats" whose name has ham, bacon, sausage, salami, pepperoni, hot dog, frank,
   jerky, bologna, links, ribs, meatballs or roast beef, **plus** up to 150 random "Nothing flagged" products anywhere with such a
   name. Full labels.
4. First pass on Sonnet subagents (batches of 40), with the M10.1 prompt addition and this one: *"Processed meat also includes
   sausage links, patties and breakfast sausage, and meatballs or ribs that are smoked, cured (celery powder or juice, nitrite,
   nitrate) or preserved (sodium or potassium lactate, sodium diacetate). It does NOT include plain ground-meat meatballs or ribs
   (meat, salt, spices, phosphate only), burger patties, 'smoke flavor' on its own, or chicken injected with a solution."*
5. The Knight reviews every false and unsure and every 10th correct; Minh spot-checks 20. **Pass: zero confirmed false flags and
   at most 5 confirmed misses** (decision 030), each logged in `KNOWN_ISSUES.md` with the product and barcode; more than 5
   confirmed, or any false flag: stop and tell the King.

## 7. Known gaps this does not fix (measured, left as they are)

- Smoked or cured meat that is not meatballs, ribs or roast beef and has no processed-meat word in its name: smoked pulled pork
  and chops, "Schmacon" beef bacon, Jack Link's beef sticks, "Bacon Wrapped" steaks whose label lists only the cure.
- Deli turkey filed under "Poultry, Chicken & Turkey" ("Deli Style Oil Browned Turkey Breast"): the category is mostly fresh
  and injected chicken (D6), so it stays unflagged.
- A restructured "rib shaped pork riblets patty" reads sausage (it is a patty by the owner's rule).
- The 16 plain meatballs above, by decision, and plain ribs in sauce; a name-wide plant-based word hiding real meat in
  a long name (M10.1 section 7).

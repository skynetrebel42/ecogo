# M16: Personal care products (soap, shampoo, lotion, sunscreen), decision 062

- **Date:** 2026-10-16
- **Status:** **Approved** by the owner 2026-10-16. Owner picks 2026-10-16 (decision 062, all recommended): personal care
  first; a neutral note for "fragrance"; FDA sunscreen status in this milestone; photo check only when not found.
- **Why:** owner backlog item 7. Minh's case: pick up a dollar-store soap, read its ingredients, spot known problems
  and "fragrance". Today a non-food scan says "add it on Open Food Facts".
- **Base:** research `docs/research/2026-10-02-ingredient-databases.md` ("Recommended for EcoGo" 2–3, "Don't use"),
  the food engine's rules (official findings only, verbatim source per flag, `verify:sources` incl. 061's
  `checkedByHand`), 058's "Check the label yourself". Data checked 2026-10-16: Open Beauty Facts has 5,375 US
  products, 2,481 with ingredients. Cleaners, EPA Safer Choice and sending to OBF are out of scope.

## 1. Changes

| # | Change |
|---|---|
| N1 | **Lookup:** a barcode not found in `foods` or Open Food Facts is looked up in Open Beauty Facts (`world.openbeautyfacts.org/api/v2/product/<code>`, read only, the same `X-User-Agent` as OFF, never the owner's email). A hit opens the product page with the source line "From Open Beauty Facts, crowd-sourced." and the small link "Have an Open Beauty Facts account? Edit there." (no EcoGo send buttons). A hit without ingredients says "No ingredient list on Open Beauty Facts." with "Check the label yourself" (N5). Order: foods → OFF → OBF |
| N2 | **Personal-care library** (`src/lib/safety/personalCare.ts`, same shape and rules as `library.ts`; every entry in `verify:sources`): FDA prohibited/restricted cosmetic ingredients (21 CFR part 700 subpart B); EU Regulation 1223/2009 Annex II bans and Annex III restrictions, only for ingredients plausibly on US labels (the builder lists them with the planner first); IARC classifications of cosmetic ingredients where IARC names that exact substance (e.g. formaldehyde, Group 1). Badge levels map as the food engine's (IARC 1/2A/2B, an EU ban → "high"). Matching uses INCI names plus listed aliases (e.g. "Aqua" = water); no guessing from partial words |
| N2a | (2026-10-16; Minh: 1, 2; planner: 3, 4) The N2 list is Knight X's candidate list A (21 CFR 700.11, .13, .14, .15, .18, .19) + B (EU Annex II entries it names). 1) **No Annex III** in M16: a limit EcoGo can't measure isn't a finding. 2) Zinc pyrithione and coal tar: "high" (EU ban) plus one sourced line "FDA allows it as a dandruff-shampoo drug ingredient" (21 CFR 358.710). 3) Hexachlorophene added with 21 CFR 250.250 (and Annex II 371). 4) Zirconium (700.16, aerosols only) skipped: a list can't show the product is an aerosol. Contaminants and impurities (dioxane, ethylene oxide, acrylamide, atranol) left out: not on labels |
| N2b | (Minh, 2026-10-16; replaces N2a's "no Annex III") **Limited, not banned:** Annex III ingredients from Knight X's list C appear in one grey row at the bottom of the result, closed by default: "Limited, not banned: N ingredients". Opened, each reads "The EU allows this in cosmetics up to a set limit. EcoGo can't see how much this product has." with its Annex III entry as the source (checked like N2). No badge change, no color, never "safe" or "unsafe". Hidden when N = 0 |
| N3 | **Fragrance allergens (no badge change):** named allergens from the EU must-label list (Regulation (EU) 2023/1545, Annex III entries) get an info row "Known skin allergen: EU law requires naming it on the label above a set level." with the EU source. They don't raise the product's level |
| N4 | **"Fragrance" note (Minh's wording, info only):** when the list has "fragrance", "parfum" or "aroma": "The label doesn't say what's in 'fragrance'. EU law requires naming listed fragrance allergens above set levels; US law doesn't." (sources: the EU regulation and FDA's cosmetics fragrance page; quotes checked) |
| N5 | **Sunscreen actives (FDA status):** a hand-entered list of the 17 actives in the research, each with FDA's own status as a label: "FDA: proposed as safe and effective" (zinc oxide, titanium dioxide); "FDA says more data are needed" (oxybenzone and the others the research lists); "Removed by FDA" (PABA, trolamine salicylate, with the date). Each status quoted from FDA and checked; the research's claims are re-verified at build, not copied. Info rows, no badge change except where N2 applies |
| N6 | **Not found anywhere, or checking by photo:** the not-found screen and "Check the label yourself" ask "What is it?" Food / Personal care; Personal care runs N2–N5 on the photo or typed list. Nothing is sent, no sign-in. The not-found screen's "add it on Open Food Facts" stays for food only |
| N7 | **Honest limits line** on every personal-care result: "EcoGo checks this list against FDA, EU and IARC findings only. Not finding a match doesn't mean a product is safe for you." |

## 2. Testing

- Node: INCI matching (aliases, case, punctuation, "Parfum (Fragrance)"), no partial-word matches, each N2–N5 entry
  maps to its level/info row; the lookup order (foods → OFF → OBF) with stubbed fetches.
- `verify:sources`: every new entry passes or is hand-checked and dated.
- A check script (new `check-care.mjs` if check-home would pass its budget): an OBF product with a banned/restricted
  ingredient, one with fragrance + an EU allergen, a sunscreen, an OBF hit without ingredients, a not-found barcode →
  Personal care photo check. OBF requests stubbed (CDP Fetch). All earlier gates.
- Live (Minh): one real soap or shampoo scan, and one photo check of a product that isn't found.

## 3. Out of scope

Cleaning products and EPA Safer Choice; sending to Open Beauty Facts; "irritant" or other unofficial labels; scores;
EWG or other advocacy databases (research "Don't use"); Prop 65 and CSCP (later, carefully worded).

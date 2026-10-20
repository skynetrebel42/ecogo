# 063: M16 accuracy fixes (from the 2026-10-19 live audit)

- **Date:** 2026-10-20
- **Status:** **Approved** by the owner 2026-10-20 (decision 063, "accept the set"); first job after the weekly reset.
- **Why:** ChatGPT's M16 live audit (`C:\Users\minhb\Downloads\EcoGo_M16_Live_Audit_2026-10-19.md`, advice only) found
  live text that overstates or misdates what the sources say. Facts first: these ship before new features.
- **Rule:** every changed sentence is re-checked against its source at build (verbatim quote in `personalCare.ts` /
  `learnSources.ts`, `verify:sources` exit 0). Where the source differs from the audit, the source wins; report it.
  `<…>` placeholders are filled from the source, never guessed. No server or DB change.

## 1. Changes

| # | Change |
|---|---|
| F1 | **Fragrance note** (N4): "The label doesn't say what's in 'fragrance'. EU law requires naming listed fragrance allergens above set levels. A 2022 US law (MoCRA) told FDA to set similar rules; <their status, quoted from FDA's MoCRA page>." Drop any "FDA can't require" / "US law doesn't" claim |
| F2 | **Removal orders** (PABA, trolamine salicylate): "FDA ordered its removal (September 10, 2026); the order takes effect <date FDA states>." If FDA gives no date, say only "FDA ordered its removal (September 10, 2026)" |
| F3 | **"More data needed" rows:** one line under the sunscreen rows (once per product, not per row), quoting FDA's sunscreen Q&A (Q9): that more data being needed is not a finding that the ingredient is unsafe |
| F4 | **Dandruff actives:** the "FDA allows it as a dandruff-shampoo drug ingredient" line shows next to the EU ban without expanding (zinc pyrithione, coal tar). Cite the CFR edition the builder can verify (eCFR, or the 2025 govinfo annual edition as a hand-checked fallback) |
| F5 | **Conditions:** hexachlorophene adds FDA's exclusion of products applied to mucous membranes; mercury's text states FDA's eye-area exception precisely (≤65 ppm, only when no other effective, safe preservative exists) and trace <1 ppm |
| F6 | **"Limited, not banned" fold** (N2b) entry text: "The EU limits how this can be used (amount, product type or pH). EcoGo can't check that from a label." (replaces "…up to a set limit. EcoGo can't see how much this product has.") |
| F7 | **No-match wording** on personal-care results: "No matches in EcoGo's checked list." (replaces "Nothing flagged by FDA, EU or IARC"); keep the N7 limits line |
| F8 | **Food-only text on personal-care pages:** remove "More from USDA FoodData Central" (and any other USDA/food line) from personal-care results. Home's "What are you eating?" becomes "What are you checking?" |
| F9 | **Search fallback:** when search finds nothing, the suggestions include personal-care examples (e.g. "shampoo", "sunscreen") and the line "Or scan its barcode". Search itself still covers the catalog + EcoGo's food copy only (OBF search is out of scope) |
| F10 | **Glycidyl esters (seed-oils Learn article):** verify whether EU maximum levels now sit in Regulation (EU) 2023/915 as amended (the R5 report names 2026/1825); if verified, cite the current regulation and keep "since 2018" only if still true. Unverifiable → report to the planner, change nothing |

| F11 | (planner, 2026-10-20; ChatGPT UI audit `EcoGo_UI_Audit_Partial_2026-10-20.md`) **Profile contribution labels** reach ≥ 4.5:1 contrast (today 12 px #6B7280 on #F3F4F6 = 4.39:1): darken the label or lighten the tile |
| F12 | **Suggest a place fields** get a visible boundary ≥ 3:1 against their card (today ~1.2:1) |
| F13 | **Personal-care page Back and Save** grow from 40 × 40 to at least 44 × 44 px tap areas (the size every other control already uses) |

## 2. Testing

- Node: F2's placeholder logic is data, not code; tests cover F7/F8 strings per category and F6's text.
- `verify:sources` exit 0 with every new/changed quote passing or hand-checked and dated.
- check-care: F1, F3, F4 (visible without expanding), F6, F7, F8 on stubbed OBF products; check-home: F8 Home line and
  F9 fallback. All seven gates within budget (split, never raise).
- Live (planner): bundle grep for the new lines and absence of the old ones; Minh retests a lotion barcode.

## 3. Out of scope

Searching Open Beauty Facts by name; new ingredients; Annex III changes beyond F6's sentence; the 375 px UI check (separate).

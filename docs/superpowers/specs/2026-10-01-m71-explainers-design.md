# M7.1: Three more explainers (seed oils, pesticides, ultra-processed foods): design spec

- **Date:** 2026-10-01
- **Status:** draft, awaiting the owner's review
- **Asked for by:** the owner, 2026-10-01: "hidden risk addition: seed oils, pesticides, processed foods, talk about the
  risks that come with them". They chose **"Official findings, plainly"** and **"Own follow-up"** (after M7).
- **Builds on:** M7 (`Explainer.tsx`, `EXPLAINERS`, Home's "Hidden risks, explained" list). **M7 must be built first.**

## 1. Why

People hear loud claims about these three topics. EcoGo's job is to say what the official bodies actually found, name
the real documented concern, say clearly what is popular but not supported, and be honest about what a barcode scan
can't tell you.

**Done for M7.1:** three new explainer cards on Home, each with plain text and verbatim, linked, dated sources. The
badge and the safety engine don't change.

## 2. Decisions

| # | Decision |
|---|---|
| E1 | Three explainers added to `EXPLAINERS` (M7): **seed oils**, **pesticides**, **ultra-processed foods**. Home lists all five; the order is the two M7 ones first, then these three *(recommended default)* |
| E2 | **No badge or engine change.** None of the three gives EcoGo an official, label-readable finding to flag (§3), so the badge stays as is. Each explainer says so |
| E3 | Wording rule: state each body's finding with its name and year; where bodies disagree, say so and say why (hazard vs risk, as in M7's badge-levels explainer) |
| E4 | Only the sources in §3. Each quote was checked verbatim on its page on 2026-10-01; the plan re-checks them |

## 3. Sources (verified verbatim on 2026-10-01)

### Seed oils

| Body | Finding (quote) | URL |
|---|---|---|
| AHA (American Heart Association News, Aug 20 2024) | "The American Heart Association supports the inclusion of omega-6 fatty acids as part of a healthy diet." | https://www.heart.org/en/news/2024/08/20/theres-no-reason-to-avoid-seed-oils-and-plenty-of-reasons-to-eat-them |
| AHA (same) | "Polyunsaturated fats help the body reduce bad cholesterol, lowering the risk for heart disease and stroke." | same |
| AHA (same, quoting Stanford's Christopher Gardner) | "But to flip that and suggest this means omega-6 fats are pro-inflammatory is wrong." | same |
| EFSA (May 3 2016) | "There is sufficient evidence that glycidol is genotoxic and carcinogenic" | https://www.efsa.europa.eu/en/press/news/160503a |
| EFSA (same) | "The highest levels of GE, as well as 3-MCPD and 2-MCPD (including esters) were found in palm oils and palm fats" | same |
| EU, Regulation (EU) 2018/290 | "Glycidyl fatty acid esters are food contaminants found at highest levels in refined vegetable oils and fats." (sets maximum levels from 2018) | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32018R0290 |

Notes: the AHA page blocks scripted downloads (HTTP 403); it was read in a browser. The article carries a banner saying
it is over two years old; the AHA position it states (omega-6 supported, replace saturated fat) is the same today.

### Pesticides

| Body | Finding (quote) | URL |
|---|---|---|
| IARC (2015, Monographs vol. 112) | glyphosate: "probably carcinogenic to humans" (Group 2A) | https://www.iarc.who.int/featured-news/media-centre-iarc-news-glyphosate/ |
| EPA | "glyphosate is not likely to be carcinogenic to humans" (2017 assessment) | https://www.epa.gov/ingredients-used-pesticide-products/glyphosate |
| EPA (same page) | "The Ninth Circuit vacated the human health portion of EPA's ID" (June 2022); EPA says its finding still stands | same |
| EFSA (Jul 6 2023) | "EFSA did not identify any critical areas of concern" in its glyphosate peer review | https://www.efsa.europa.eu/en/news/glyphosate-no-critical-areas-concern-data-gaps-identified |
| FDA (FY 2023 residue report) | residues "generally in compliance with EPA pesticide tolerances"; "97.2%" of domestic samples compliant | https://www.fda.gov/food/hfp-constituent-updates/fda-releases-fy-2023-pesticide-residue-monitoring-report |

### Ultra-processed foods

| Body | Finding (quote) | URL |
|---|---|---|
| FDA | "Researchers have found links between the consumption of highly processed foods (commonly called ultra-processed foods, or UPFs) and a range of negative health outcomes, including cardiovascular disease, obesity and certain cancers." | https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/ultra-processed-foods |
| FDA (same) | "On July 24, 2025, the FDA and USDA issued a Request for Information …" toward "a uniform definition of UPFs" | same |
| HHS (Aug 10 2026) | "HHS and USDA submitted for final review the federal government's first proposed definition of UPFs." (not yet published) | https://www.hhs.gov/press-room/hhs-announces-ultra-processed-foods-gras-reforms.html |

Note: the HHS page blocks scripted downloads; it was read in a browser.

## 4. Draft text (plain English; the plan may tighten wording but not add claims)

### 4.1 "Seed oils: what the evidence says"
- **Teaser:** "No health authority calls them harmful. The real issue is a refining contaminant."
- Seed oils (canola, corn, soy, sunflower and others) are mostly polyunsaturated fat, including omega-6.
- The American Heart Association supports omega-6 as part of a healthy diet: polyunsaturated fats lower bad
  cholesterol and the risk of heart disease and stroke. The popular claim that they cause inflammation isn't supported.
- **The documented concern:** refining oils at high heat can create contaminants (glycidyl esters, 3-MCPD). EFSA found
  glycidol genotoxic and carcinogenic. Levels are highest in **palm oil** (not a seed oil), and the EU has set legal
  maximum levels since 2018.
- **What EcoGo can do:** contaminant levels aren't on a label, so EcoGo doesn't flag oils.

### 4.2 "Pesticides: what a label can't tell you"
- **Teaser:** "Residues aren't on labels, so no scan can see them. Here's what regulators found."
- Pesticide residues aren't listed on ingredient labels, so EcoGo can't check them for any product.
- In the US, EPA sets legal limits and FDA tests food: in fiscal year 2023, 97.2% of domestic samples were within them.
- **Glyphosate (Roundup):** IARC (2015) classified it "probably carcinogenic" (Group 2A). EPA says "not likely to be
  carcinogenic to humans" (a court vacated part of that review in 2022; EPA says the finding stands), and EFSA (2023)
  found no critical areas of concern. They disagree partly because IARC rates how strong the evidence of a hazard is,
  while EPA and EFSA judge the risk at real-world exposure. (Links to "What the badge levels mean".)

### 4.3 "Ultra-processed foods: no official line yet"
- **Teaser:** "Strong research links, but no official US definition yet."
- The FDA says researchers have found links between ultra-processed foods and heart disease, obesity and some cancers.
- There's no official US definition yet. The FDA and USDA asked for input in July 2025, and in August 2026 HHS sent the
  first proposed definition for final review; it hasn't been published.
- **What EcoGo can do:** without an official definition, EcoGo doesn't label foods "ultra-processed". It does flag what
  has official backing: processed meat (IARC Group 1), additives with official findings, and high sugar, saturated fat
  and salt by the FDA's 5/20 rule.

## 5. Design

- `Explainer.tsx`: `ExplainerId` gains `"seed-oils" | "pesticides" | "ultra-processed"`; `EXPLAINERS` gains three
  entries; `Body` gains three cases. Sources are `Cite` constants in the same file (they are explainer-only, not
  engine sources). No new files.
- Home needs no change (it lists `Object.keys(EXPLAINERS)`).
- When the official UPF definition is published, revisit §4.3 (and whether EcoGo can apply it): log it in
  `KNOWN_ISSUES.md`.

## 6. Testing

- Re-run the verbatim check on all §3 quotes (`fetch` + text match; the AHA and HHS pages by hand in a browser).
- Headless check (extend M7's `check-home.mjs`): Home lists five explainer cards; each of the three new ones opens with
  "Sources" and "Source checked"; no console errors.
- `npm test` and `npm run build` green. Docs: roadmap entry in `KNOWN_ISSUES.md`.

## 7. Out of scope

Flagging seed oils, pesticides or UPFs on the badge (no official, label-readable finding); organic labels; the EWG
"Dirty Dozen" (an advocacy list, not an official body); per-product pesticide data.

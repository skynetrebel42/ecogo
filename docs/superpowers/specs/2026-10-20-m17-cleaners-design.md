# M17: Cleaning products — EPA Safer Choice match + California pointer (decision 065)

- **Date:** 2026-10-20
- **Status:** **Approved shape** by the owner 2026-10-20 (decision 065: Safer Choice match + CA pointer); details below
  are the planner's draft — the builder's first reply names anything unclear before code. Built after 063.
- **Why:** owner backlog item 7, second step (M16 did personal care). Minh's case: detergent, dish soap. Research:
  `docs/research/2026-10-02-ingredient-databases.md` ("Recommended" 1) and ChatGPT's
  `C:\Users\minhb\Downloads\EcoGo_Cleaners_Research_2026-10-19.md` (advice only; every claim re-verified at build).
- **Rule:** a match is a fact from EPA's list; no match is **no claim** ("not on the Safer Choice list" is never a
  finding). No EPA logo or certification mark. No server change.

## 1. Changes

| # | Change |
|---|---|
| S1 | **Data:** a script (`npm run import:saferchoice`) downloads EPA's Safer Choice dataset (Envirofacts `t_safer_choice_and_design_for_the_environment`, JSON), keeps program "Safer Choice" rows with a UPC (Design for the Environment kept separate and out of M17), normalizes each UPC to the app's barcode forms (handle numbers that lost leading zeros; 8–14 digits; no fuzzy matching), and writes a small static file in the repo (company, product name, UPCs, retrieval date). The owner runs it; the builder commits the first snapshot. Report counts (rows, distinct UPCs) against the research's 824 pairs / 1,636 UPCs |
| S2 | **Match:** every scanned barcode is also checked against the snapshot. A match adds a card "EPA Safer Choice certified" with the product name and company from EPA, EPA's line "EPA certification does not constitute endorsement of this product." (quoted from the 2024 Standard, checked), the snapshot date, and a link to EPA's Safer Choice product search. If no database has the product, the match alone opens a minimal page with that card |
| S3 | **California pointer:** on a Safer Choice match whose product falls in California's Cleaning Product Right to Know Act scope (general cleaning, air care, polish/floor care, automotive appearance care), and in the not-found screen's new "What is it?" choice **Cleaning product**: "California requires the maker to list all intentionally added ingredients online." Quote the statute (Health & Safety Code §108954.5) from official text; if it can't be verified verbatim, S3 goes back to the planner, S1–S2 ship |
| S4 | **Not found → Cleaning product:** shows S3's line, a one-line explainer of Safer Choice, and "Check the maker's website for the full ingredient list." No ingredient library for cleaners in M17 |

| S1a | (planner, 2026-10-20; ChatGPT's updated research) Match only rows whose `company_in_good_standing` is true (null is not true): ~794 product pairs. Report the count |
| S3a | (planner) California verification was only partial in the research (official pages 403'd). Quote S3 from the official leginfo text: start at `https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB258` (or the current Health & Safety Code §108954.5 page), open it by hand in the built-in browser, date it `checkedByHand`. Mirror copies don't count. Can't open it → S3 waits, S1–S2 ship |

## 2. Testing

- Node: UPC normalization (leading zeros, 11/12/13/14-digit forms, the app's existing barcode variants), exact-match
  only, a non-match produces no card and no text.
- check-care (or a new check-cleaners if over budget): a matched barcode found elsewhere, a matched barcode found
  nowhere (minimal page), a non-match (nothing), not-found → Cleaning product. EPA requests are never made by the app.
- `verify:sources`: the EPA endorsement line and the California statute quote.
- Live: Minh scans one Safer Choice product (e.g. from EPA's product search) and one that isn't listed.

## 3. Out of scope

Open Products Facts lookup; an ingredient library for cleaners; Design for the Environment; EPA logos; Prop 65 and
CSCP; refreshing the snapshot automatically (the owner reruns S1).

# Hidden risks a label can't show (decision 064, R5)

- **Date:** 2026-10-20
- **Status:** **Approved shape** by the owner 2026-10-20 (decision 064: a Learn article + 2 info rows); details are the
  planner's draft. Built after M17.
- **Why:** R5 research (`C:\Users\minhb\Downloads\EcoGo_R5_Hidden_Risk_Research_2026-10-18.md`, ChatGPT, advice only):
  glycidyl esters, benzene in drinks, aflatoxins and celery-powder nitrite all have official statements, but none can be
  read from an ingredient list (contamination is per batch). So: education and context, **no new flags or badge changes**.
- **Rule:** every quote re-verified at build (`learnSources.ts`, `verify:sources`); the report's quotes are hypotheses.

## 1. Changes

| # | Change |
|---|---|
| H1 | **Learn article "Risks a label can't show"** with sourced paragraphs: glycidyl esters (EFSA 2016; EU maximum levels, current regulation per 063 F10), benzene formation in drinks (FDA Q&A: forms at very low levels from benzoate + ascorbic/erythorbic acid, heat/light; FDA's survey found almost all samples below 5 ppb and implicated products were reformulated — dated as historical), aflatoxins (FDA mycotoxins page: mold on peanuts, corn, tree nuts; FDA monitoring/action levels), celery-powder curing (USDA: celery powder's nitrates become nitrites; FSIS "uncured … except for those naturally occurring in celery powder"; IARC 2A only under endogenous-nitrosation conditions). Closing line: "EcoGo can't measure these from a label." |
| H2 | **Benzene info row** (grey, no badge change) on products whose list has a benzoate (sodium/potassium benzoate, benzoic acid) **and** ascorbic or erythorbic acid: "These two can form small amounts of benzene under heat or light (FDA). Not measured in this product." Links to H1 |
| H3 | **Celery-powder curing row** on meats whose list has celery powder/juice/concentrate: context only, worded from USDA/FSIS. First reconcile with decision 029 (celery curing already counts as evidence in some processed-meat rules): if 029's rule already flags the product, H3 adds context to that flag instead of a second row. The builder sends the reconciliation to the planner before coding H3 |

## 2. Testing

- Node: H2 needs both ingredients (one alone → no row); H3 never duplicates a 029 flag; no badge level changes
  anywhere (run the 51-product check and compare levels before/after).
- `verify:sources` exit 0 for every H1–H3 quote. check-home: the article opens with its cards; H2/H3 rows on stubbed
  products.

## 3. Out of scope

Contaminant flags or scores; brand- or batch-specific claims; aflatoxin rows on peanut/corn products (education only).

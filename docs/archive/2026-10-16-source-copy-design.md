# SOURCE-01 + COPY-01 (decision 061): stricter source check, seed-oil fat mix

- **Date:** 2026-10-16
- **Status:** **Approved** by the owner 2026-10-16 (decision 061, both picked from options, recommended)
- **Why:** outside audit (KNOWN_ISSUES "Outside audits"). SOURCE-01: `npm run verify:sources` exits 0 even when nothing
  could be verified (offline, every page "unverifiable"), and Learn articles' citations aren't checked at all. COPY-01:
  the seed-oils Learn article says canola, corn, soy and sunflower oil "are mostly polyunsaturated fat"; USDA's data
  shows canola and high-oleic sunflower are mostly monounsaturated.
- **Rule:** nothing the app shows may be invented; every claim needs a verbatim official source.

## 1. Changes

| # | Change |
|---|---|
| S1 | **Fail on gaps:** `verify-sources.mjs` exits 1 when 0 sources pass, and when any source is "unverifiable" without a `checkedByHand: "YYYY-MM-DD"` date on its entry. Its summary lists every unverifiable source with its URL. The builder opens each such page by hand (built-in browser), confirms the quote, and only then adds the date. `application/json` answers count as text (for USDA FDC API URLs) |
| S2 | **Learn citations checked:** a new list (one entry per sourced Learn claim: article id, URL, verbatim quote) that `verify:sources` checks like the library. Every Learn article claim that names a source (AHA, EFSA, IARC, EPA, FDA, USDA…) gets an entry; a claim with no source found is reported to the planner, not shipped. `npm test` checks every Learn article id has at least one entry |
| S2a | (planner) **One list, cards flagged:** the Learn citations list is also the source of the Sources cards; each entry has `card: true/false`. Every entry is checked; only flagged ones show as cards. Today's cards stay as they are, plus **one** "USDA FoodData Central" card for C1 (the five oils are check-only entries). "How EcoGo checks" is exempt from the at-least-one-entry test: it describes EcoGo itself (M12 D2) |
| C2 | (Minh, 2026-10-16) Ultra-processed article: "it hasn't been published" is dropped (an absence can't be quoted and goes stale); the line reads "In August 2026 HHS sent the first proposed definition for final review." |
| C1 | **Seed-oil first line** (Minh's wording): "Seed oils are mostly unsaturated fat, but the mix varies. In USDA's data, soybean and corn oil are more than half polyunsaturated fat (including omega‑6); canola oil is mostly monounsaturated; sunflower oil can be either, depending on the type." Source: USDA FoodData Central, SR Legacy, g per 100 g (checked 2026-10-16): soybean 171411 (PUFA 57.7, MUFA 22.8), corn 171029 (PUFA 54.7, MUFA 27.6), canola 172336 (MUFA 63.3, PUFA 28.1), sunflower linoleic 171025 (PUFA 65.7), sunflower high oleic 172338 (MUFA 83.7, PUFA 3.8). Entered in S2's list (API URL with DEMO_KEY, or `checkedByHand`) |

## 2. Testing

- Node: S1's exit rule (0 pass → 1; unverifiable without a date → 1; with a date → 0; all pass → 0) on a stubbed fetch.
- `npm run verify:sources` passes online with every entry pass or dated; fails with the network off.
- check-home: the seed-oils article shows C1's line. All six gates.

## 3. Out of scope

New Learn articles; changing any badge or flag; claim-by-claim review of the safety library beyond S1's dates.

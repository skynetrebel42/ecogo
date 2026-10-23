# 075: Audit fixes (ChatGPT audit, 16 findings confirmed in code by Scout)

- **Date:** 2026-10-24 · **Status:** approved (Minh: "Yes: start 075 audit fixes") · Decision 075 · Priority list #5.
- **Evidence:** `KNOWN_ISSUES.md` "ChatGPT audit, 2026-10-23" and Scout's note (file + line for each finding):
  `C:\Users\minhb\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_d41bce91-a648-4050-95e2-cab737496cc6\research-audit-chatgpt.md`.
- **Accepted, no change:** S1, S2, S4. Already resolved: S5 (rule text). B2 = K-22: fix only if it falls out of A1/P1.

## 1. Parts (one commit each; High first, then stop and report before Medium)
| # | Finding | Fix |
|---|---|---|
| H1 | **P1** a closed check still uploads a pending hard photo to cloud help | An abort reaches `readPhoto`: closing the check (or turning cloud help off) before the phone read finishes means no cloud call. Test: close → no request to `ocr-cloud`. (planner) Node test of `readPhoto` only; no check-ocr browser check (it stays at 130 of 180 s): "still wanted" is asked when the phone's read ends, and unmount ends it too. (planner) No re-check of the switch before the upload: it is hidden while a photo is read, so it can't change mid-read |
| H2 | **B1** regex lookbehind loads at startup (Safari < 16.4 can't parse it) | Rewrite the 5 lookbehinds without lookbehind, same matches (existing tests + new ones); a test that fails if `(?<` appears in `src/` |
| H3 | **C1** unsourced "1,4-dioxane (trace)" on Tide PODS | Remove it from `products.csv` and from the live `products` row id 2 (a live DB change: a migration file with the exact UPDATE, Minh's yes in your chat, then `apply_migration`). Nothing else in that row changes |
| M1 | **S3** body size checked only by header | `place-submit`, `ocr-cloud`, `off-submit`: stop reading past the limit even without Content-Length (deploy each changed function with Minh's yes, server first). (planner, option A) Past the limit the rest is read and dropped, never kept: stopping mid-upload left Supabase's relay without a reply (live probe ran to the wall-clock limit); Supabase's own size cap ends a longer upload |
| M2 | **B3** a failed search shows "No results" | Show the existing "Couldn't search right now" text when the search failed |
| M3 | **A1** Explainer over the check isn't inert; focus not returned | Same pattern as Home (inert behind, focus back to the opener) |
| M4 | **P2** Privacy doesn't say Open Food Facts gets an anonymous app id | Wording → planner (Minh's batch); build after |
| L1–L4 | **C2** Oreo "28% … added sugar" with no Oreo source · **P3** Turnstile script before Send · **A2** 3.79:1 contrast (ScanTab.tsx:254) · **F1** Map code at startup | Only if cheap: C2 → remove the unsourced figure (wording → planner); P3 → load on Send; A2 → a colour that passes 4.5:1; F1 → lazy-load the Map tab |

## 2. Done
npm test + build + all seven gates (within budget) + verify:sources if a safety/learn file changed; each fix has a test
that fails on the old build; one fresh-context review; Log line; push with Minh's yes in your chat; live: the Tide row
no longer lists 1,4-dioxane, the bundle has no `(?<`.

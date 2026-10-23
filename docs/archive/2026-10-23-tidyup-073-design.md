# 073: Tidy-up: split check-home, gates close their browser

- **Date:** 2026-10-23 · **Status:** approved (Minh: "Yes, start the tidy-up builder (check-home split + gates closing
  Edge)") · Priority list #3, before 068 (which changes the Scan screen check-home covers).
- **Why:** check-home takes 323 s of its 420 s budget, and the next milestones add checks to it. Gates leave headless
  Edge running on Windows; after many runs a port collides and a gate attaches to an old browser with stale state
  (false "welcome is honest" failures, KNOWN_ISSUES).
- **No app changes.** Only files under `docs/superpowers/plans/2026-10-01-m7-assets/` (gates) and the docs that list them.

## 1. Parts
| # | Part |
|---|---|
| T1 | **Split check-home** at a natural seam (e.g. Home + Learn + Privacy vs. search + Scan + add flow) into two gate files, each well under its budget (aim ≤ 60 %). Every existing assertion kept: the total count before = after (89). Same run pattern as the other gates. |
| T2 | **Every gate closes its browser:** `Browser.close` over CDP in each gate's `finally`, with a process-tree kill as the fallback, so no `ecogo-` headless Edge survives a run. A short check at the end of each gate (or one shared helper, if it is smaller than repeating it) proves no leftover browser for that profile. |
| T3 | **Docs:** CLAUDE.md Commands (if a file name changes), the gate list and numbers in `.claude/handoff-knight.md` (via a note to the planner), KNOWN_ISSUES entry closed. |

## 2. Done
All gates green twice in a row with nothing else running; the two check-home halves' times and counts reported; no
headless Edge left after a full run (`Get-CimInstance Win32_Process` shows none with `--user-data-dir=…\Temp\ecogo-`).
Out of scope: the shared set-up rewrite (tidy-up A), Figma CSV trim (B), any app change.

# 070: Cloud help for hard labels (opt-in, OCR.space)

- **Date:** 2026-10-23 · **Status:** approved (decision 070; scope and wording approved by Minh in 066's batch, 2026-10-22).
- **Why:** some labels beat the phone's reader (crinkled bags, stickers, sideways print). Minh: cloud help only on a free
  tier, off until each person turns it on, can be turned off any time; never photograph anything private.
- **Source of truth for the words:** `side-session-notes\local_d41bce91-…\headsman-iv-r8-wording.md` §5 (Minh: "as
  drafted"). OCR.space quotes there were checked 2026-10-22; re-check them on ocr.space before shipping.

## 1. Parts
| # | Part | Type |
|---|---|---|
| C1 | **Edge Function `ocr-cloud`**: receives one label photo (JPEG ≤ 1 MB) and returns text only. Forwards to OCR.space's free API with the key from the secret `OCRSPACE_API_KEY` (set by Minh in Supabase; never in code, git or chat). Stores nothing, logs no image or text. Rejects anything over 1 MB, non-images, and calls without an anonymous-session JWT (verify_jwt on, same sign-in the app already uses at the first Send). OCR.space limit or error → a "busy" answer the app understands | Server |
| C2 | **The switch** "Cloud help for hard labels" on the photo step of Check ingredients and the Open Food Facts send, off by default, remembered on this device only; the explanation under it as approved | Feature |
| C3 | **When it's used:** only with the switch on, only for a photo the phone reader found hard to read (the existing hard-to-read result). The phone reads first; the cloud text replaces the box only if it reads better (more words that match known names); either way R4's chips and "Keep as read" work on it; nothing counts until the person accepts it, as today. Busy → "Cloud help is busy today. We read the photo on your phone instead." | Feature |
| C4 | **Privacy paragraph** for cloud help, as approved, added to Profile → Privacy | UI |

## 2. Testing
- Node tests: the function's handler with a stubbed fetch (size limit, non-image, missing JWT, busy, text-only answer,
  key never echoed); the "reads better" choice; the switch default.
- check-ocr: switch off (default) → no request leaves the page (existing assert holds); switch on + a hard photo → one
  request, only to EcoGo's own `ocr-cloud` (stubbed), never to ocr.space from the browser; busy → the busy line and the
  phone's text. Each new check red on the old build first. All six gates within budget.
- Live: Minh turns it on, photographs a hard label (the Shu Shu bag), sees better text or the busy line; turns it off.

## 3. Out of scope
Paid tiers; other providers; sending photos that read fine; storing photos or results; per-person quotas (OCR.space's
500/day shared limit is the cap: known limit, KNOWN_ISSUES at ship).

## 4. Notes
- CLAUDE.md "browser's only Supabase calls" gains "invoke `ocr-cloud` (opt-in)" at close-out (planner).
- Deploy order: the function and its secret first (each live step with Minh's yes), then the app.
- C1 access (planner, 2026-10-23, Headsman VI's option B): Check ingredients has no sign-in, so `ocr-cloud` accepts the
  app's public key (verify_jwt on) and a session JWT when one exists; no human check, no new wording. Cheap guards: only
  EcoGo's site Origin, image types only, ≤ 1 MB. Abuse worst case = "busy today" until OCR.space's daily reset.
- Builder's calls (accepted): any failure → the busy line; "reads better" = more words matching EcoGo/USDA names, ties
  keep the phone's text; cloud text goes through trim, checkboxes, chips, "Keep as read"; "Add another photo" uses it
  for hard photos too; canvas re-encode to JPEG < 1 MB.

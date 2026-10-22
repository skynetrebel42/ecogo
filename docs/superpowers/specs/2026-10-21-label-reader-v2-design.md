# 066: Label reader v2 (Minh's design)

- **Date:** 2026-10-21 · **Status:** approved; §5 answered (Q2 after R1) · Built after 064, by one fresh Headsman.
- **Why:** Minh's perfume test (KNOWN_ISSUES OCR-01/02/03): on a clear, curved, condensed label the reader glued and
  misread line-end words, so EcoGo missed three EU allergens (benzyl salicylate, hydroxycitronellal, limonene), kept
  "CAUTION: FLAMMABLE…" as ingredients, and said "not clear" on sharp photos. Much food and most non-food isn't in any
  database, so reading labels well is foundational ("almost more important than the barcode", Minh).
- **Minh's design (2026-10-21):** clean the photo up, read it with a stronger reader, and help with every word it isn't
  sure of: the person **taps one of up to 3 suggestions, types it, or retakes the photo**. Free, usable resources first.
- **Rules:** nothing invented: a suggestion is a real ingredient name from a list, and nothing counts until the person
  accepts it (the check reads the confirmed text, as today). Everything runs on the phone; no photo leaves it unless
  Minh opts in (§5 Q3). The safety engine's whole-name matching (062) stays: a fix happens in the text the person
  confirms, never by loosening the matcher.

## 1. Parts
| # | Part | Type |
|---|---|---|
| R1 | **Measured test first** (throwaway spike): the same real label photos (Minh's perfume, the 4 check-ocr fixtures, any soap/lotion photos Minh sends) through (a) today's Tesseract, (b) Tesseract after R2's clean-up, (c) PaddleOCR in the browser (official `@paddleocr/paddleocr-js`, PP-OCR on ONNX Runtime Web; or `ppu-paddle-ocr`). Per reader: words right vs a typed answer key, flagged ingredients found, seconds per photo on a phone-sized CPU, download size, licence. Report the table to the planner; the planner picks by the numbers unless size or speed is a trade-off Minh would notice (then Minh decides) | Test |
| R2 | **Clean-up before reading:** grayscale, contrast stretch, upscale small text; straighten if cheap. Canvas only, no new library unless R1 shows it pays | Feature |
| R3 | **The stronger reader** (R1's winner), self-hosted like Tesseract today (`scripts/copy-ocr.mjs` pattern: no CDN or outside call at run time), loaded only when a photo is read. Tesseract stays as the fallback if the new one fails to load | Foundation |
| R4 | **Help for unsure words:** each underlined word opens a small sheet: up to 3 suggested names (closest by spelling from the ingredient list), a "Type it" field, and "Retake photo". Also offer a split where an item is two known names run together ("…INDANOPYRA BENZYL SALICYLATE" → add a comma). Lists: EcoGo's own library names (always), plus free lists whose licence allows it (Open Food Facts ingredients taxonomy, ODbL with attribution; EU CosIng INCI names, licence to confirm). Lazy-loaded; size reported | Feature |
| R5 | **Warning text isn't ingredients** (OCR-02): add personal-care/cleaner stop words to the label trim (caution, warning, directions, avoid contact, keep out of reach, for external use, flammable) | Debug |
| R6 | **No false "not clear"** (OCR-03): find which check fired on the sharp perfume photos (blur check 049 or the hard-to-read hint G4) and why (curved, condensed, small text); fix the cause; the hint never blocks | Debug |
| R7 | **Moved out to 070 (Minh, 2026-10-22: "ship 066 without cloud help; cloud help becomes its own small step right after"); kept here for 070's spec.** **Cloud help, opt-in** (Q3): only on a free tier; off until the person turns it on, with a plain warning (where the photo goes, what that service's own terms say it may keep or use, "only photograph the label, never anything private") and a way to turn it off any time; the Privacy section says it too. Its key lives in a new Edge Function, never in the browser (CLAUDE.md); a deploy needs Minh's yes. Suggestions it returns follow R4's rules (real names, nothing counts until accepted). R1 also measures one free cloud option. Built last | Feature, Server |
| R9 | **Take another photo** (Minh, 2026-10-21, after planner research: no ingredient app does it; `research-curved-labels` note): for a curved or cut-off label, "Add another photo" reads each photo with the same reader and joins the text at the longest overlap of words; no overlap → the new text is added after and the person edits. Reuses R4's sheet for unsure words; the text box stays the final say. Plain JS, no image stitching, no new library. Built after R1's results, after R4 | Feature |
| R8 | **Privacy warning on photos that leave the phone** (Q1): the Open Food Facts send's photo step adds "never photograph anything private" next to its existing "public there" line; and the Privacy section (App.tsx ~535) brought up to date: it also names Open Beauty Facts (barcode lookups since M16) and Photon (Suggest a place address search) (planner, 2026-10-22); wording to the planner | UI |

## 2. Testing
- R1's table in the builder's report (real output). Node tests: suggestion ranking (the perfume misreads "UIHONENE" →
  limonene, "HYDROXYCITRONELLASS" → hydroxycitronellal in the top 3), the split, stop words, R6's threshold.
- check-ocr: a curved-label fixture (§5 Q1) reads with the allergens found after accepting suggestions; the reader and
  lists load from EcoGo's own site only; no request leaves the page. All six browser gates + `npm test` + build within budget (split, never raise).
- Live: Minh repeats test 1A–1C on his checklist with v2.

## 3. Out of scope
A native app; paid services (a keyed free tier only for R7, behind its own Edge Function); loosening whole-name
matching; auto-accepting suggestions; reading nutrition panels; a Privacy settings page (Future features).

## 4. Builder notes
Start from `src/lib/ocr.ts` (readLabel, labelLines, trimToIngredients, unsureWords, hardToRead) and `src/lib/photo.ts`
(isBlurry, sharpness). R1 is a spike: it reports before any of R2–R6 is built, and its code isn't kept.
R1 results (2026-10-22, report in the planner's notes folder): (planner) R2 clean-up dropped for Tesseract (no gain,
2x slower) and skipped for a Paddle reader; `ppu-paddle-ocr` out (fails curved and angled photos); R6's cause is the
hard-to-read hint G4, not the blur check; the cloud column moves to R7 (no key needed before then). R5/R6 start now;
R3's reader: PP-OCRv6 tiny (Minh, Q2, 2026-10-22). R3 (planner, 2026-10-22): model files committed with a SHA-256
check (deploys never depend on Baidu's server), Apache-2.0 notices shipped beside them; ONNX Runtime's wasm shipped
pre-gzipped and unpacked in the browser (Tesseract's pattern), so the ~13 MB holds whether or not Pages compresses
.wasm; word-level "unsure" from per-letter confidences (own decode of the recognizer output if the SDK exposes it,
else a pinned-version patch guarded by a test), not from known-word lists. R3 done (7b13caa).
R4 lists (planner, 2026-10-22): EcoGo's own names + USDA FoodData Central words (CC0; "list FoodData Central as the
source"), generated once by a script from `foods` and committed, lazy-loaded. Open Food Facts / Open Beauty Facts
taxonomies skipped (no licence on the files themselves), EU CosIng skipped (no download; third-party content).
Tap target and the sheet's words (Minh, 2026-10-22): **a row under the box** ("Check N words:" chips, "Add a comma?"
chips, up to 8 then "+N more"), sheet words as drafted: "Did you mean", "Or type it", "Use", "Retake photo", "Keep as
read"; source line "Suggested names come from EcoGo's lists and USDA FoodData Central."
Wording batch (Minh, 2026-10-22; drafts in the builder's `headsman-iv-r8-wording.md`): R8 send-box line "Photograph
only the label, never anything private."; Privacy updates (Open Beauty Facts, Photon) as drafted; fonts self-hosted
(@fontsource-variable/plus-jakarta-sans@5.3.0, OFL-1.1, Minh's yes); R9 button "Add another photo", hint in Minh's
words "Curvy label? Cut off? Add more pics.", join notes as drafted, more than one extra photo allowed ("Joined N
photos…"); R7 switch, explanation, busy line and Privacy paragraph as drafted.
R4 screen done (dd2d5d5). R9 in the Open Food Facts send (planner, 2026-10-22): the first ingredients photo is the one
sent; extra photos only help read the text and stay on the phone. Headsman IV handed over at 670k tokens after R4;
Headsman V finishes R9 → R8 → review → push from a worktree cut from IV's branch.
R9 details (planner, 2026-10-22): no-overlap note "Added the new photo's text at the end. Check it." (Minh's approved
note, "second" → "new" so it holds for any photo); extra photos get the same blur check; G4 never empties the box for
an extra photo; text joins into the box's current text; line checkboxes hide after a join; button + hint under the
chips in photo mode; in the OFF send, Crop hides once a photo is joined (re-reading would drop the joined text).
R5 done (6c53e65). R6 (planner, 2026-10-22): the hard-to-read hint (G4) stops counting unsure words that are close
to a known ingredient name (they get R4's sheet instead), so a sharp curved label keeps its text in the box; blurry,
glare and cut-off photos still get the hint. Built as R4's matcher's first slice (EcoGo's library names); no new
wording; the hint never blocks (048) and the box stays the final say (047).

## 5. Questions for Minh
- **Q1 🎨** May your perfume label photo (and soap/lotion photos you send) become test pictures in the public repo?
  They show only the label. If no, the builder uses the existing fixtures plus a typed answer key.
  **Answer (Minh, 2026-10-21): yes** (each photo cropped to the label and checked for anything personal before it's
  committed); plus warn people about privacy wherever a photo can leave the phone, with a choice (R7, R8).
- **Q2 🎨** A stronger reader is a one-time download the phone then keeps. What's the most you'd accept the first time
  you take a photo? Options: about 10 MB / about 20 MB / whatever R1 shows is needed.
  **Answer (Minh, 2026-10-21): decide after R1 with real sizes** (today's reader is ~7 MB on first photo).
  **Then (Minh, 2026-10-22): option A, PaddleOCR PP-OCRv6 tiny, ~13 MB once, today's speed** (over v6 small, ~33 MB,
  ~47 s a photo: "making users wait so long would annoy people", suggestions are the buffer). v6 small → Future features.
- **Q3 🎨** Cloud AI help (photos leave the phone): never / only if free and each person opts in / decide after R1.
  **Answer (Minh, 2026-10-21): only on free credits, and each person opts in** (R7). Provider (Minh, 2026-10-21):
  **OCR.space** free API (over Gemini free tier, which may use free-tier data to improve Google's products, and Azure
  Vision F0, which asks for a card). R1 downloads: yes (Minh, 2026-10-21).

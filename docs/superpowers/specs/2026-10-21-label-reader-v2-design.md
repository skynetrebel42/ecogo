# 066: Label reader v2 (Minh's design)

- **Date:** 2026-10-21 · **Status:** draft, waiting on Minh's answers to §5 · Built after 064, by one fresh Headsman.
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

## 2. Testing
- R1's table in the builder's report (real output). Node tests: suggestion ranking (the perfume misreads "UIHONENE" →
  limonene, "HYDROXYCITRONELLASS" → hydroxycitronellal in the top 3), the split, stop words, R6's threshold.
- check-ocr: a curved-label fixture (§5 Q1) reads with the allergens found after accepting suggestions; the reader and
  lists load from EcoGo's own site only; no request leaves the page. All seven gates within budget (split, never raise).
- Live: Minh repeats test 1A–1C on his checklist with v2.

## 3. Out of scope
A native app; paid or keyed services; loosening whole-name matching; auto-accepting suggestions; reading nutrition panels.

## 4. Builder notes
Start from `src/lib/ocr.ts` (readLabel, labelLines, trimToIngredients, unsureWords, hardToRead) and `src/lib/photo.ts`
(isBlurry, sharpness). R1 is a spike: it reports before any of R2–R6 is built, and its code isn't kept.

## 5. Questions for Minh
- **Q1 🎨** May your perfume label photo (and soap/lotion photos you send) become test pictures in the public repo?
  They show only the label. If no, the builder uses the existing fixtures plus a typed answer key.
- **Q2 🎨** A stronger reader is a one-time download the phone then keeps. What's the most you'd accept the first time
  you take a photo? Options: about 10 MB / about 20 MB / whatever R1 shows is needed.
- **Q3 🎨** Cloud AI help (photos leave the phone): never / only if free and each person opts in / decide after R1.

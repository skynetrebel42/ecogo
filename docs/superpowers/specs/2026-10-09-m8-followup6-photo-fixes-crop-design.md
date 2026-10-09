# M8 follow-up 6: no false "blurry", no junk text, a clear "Type it", optional crop

- **Date:** 2026-10-09
- **Status:** **Approved** by the owner 2026-10-09 (decision 052; built after follow-up 4 and **before** follow-up 5)
- **Why:** Minh's first real submission (Celia's Red Lentils, 0094922021397, row 17, live on world.openfoodfacts.org
  with "Red lentils" typed by him): a clear photo, taken at night, kept getting "This photo looks blurry"; after "Use it
  anyway" the reader's junk (243 underlined words) went straight into the text box, because 049 H2 skips 048 G4's
  hard-to-read notice after "Use it anyway". The bag has no ingredients panel, and "Skip the photo, type the
  ingredients" was easy to miss. He also wants to crop photos. Junk text on the real OFF is the risk this closes.
- **Base:** M8 and follow-ups 1–4 (`docs/archive/2026-10-02-m8-add-product-design.md` and the follow-up specs).

## 1. Changes

| # | Change |
|---|---|
| K1 | **No false "blurry".** The builder measures the 049 H2 score on the photos EcoGo sent for 0094922021397 (public on OFF: images 1–3), Minh's earlier sharp and blurry photos (scratchpad, never committed) and the fixtures, then fixes the score so the lentil photos pass and the blurry ones still fail (e.g. normalise by each tile's contrast, or a lower threshold). Numbers and the proposal go to the planner before committing |
| K2 | **Never prefill junk.** When the kept text's unsure share is ≥ 25 % (048 G4), whether or not the notice was shown, the check step's text box starts **empty** with "We couldn't read this label well. Type the ingredients below." and a "Show what we read" link that puts the read text in the box. The line list doesn't show in that case. Replaces 049 H2's "G4 doesn't show again" (the notice still isn't shown twice; the box just starts empty) |
| K3 | **"No ingredients list? Type it"** as a visible secondary button on the ingredients photo step (replacing the easy-to-miss skip link), going straight to an empty check box. Placeholder stays "e.g. …" |
| K4 | **Optional crop.** A "Crop" button on each photo's thumbnail: on the check step for the ingredients photo (crop → read again), and on the Send screen for the front and nutrition photos. Crop screen: the photo with a draggable rectangle (corner handles with ≥ 44 px touch targets), Done / Cancel; the result goes through `preparePhoto` again, so OFF's minimum size (640 × 160) still applies, with the usual message. No new dependency unless the hand-made version gets unwieldy; any install needs Minh's OK (name, size, licence) |
| K5 | The line list never renders as an empty card (seen in Minh's screenshot) |

## 2. Testing

- Node: the revised sharpness score (lentil-like low-light sample passes; blurred samples fail); K2's rule (share ≥ 25 % →
  empty box + raw text kept for "Show what we read"); crop maths (rectangle → source pixels, minimum size).
- check-ocr/check-home: a junk read → empty box, the notice text, "Show what we read" fills it; "No ingredients list?
  Type it" → empty check box; Crop on a fixture → smaller photo, re-read; no empty line-list card. All earlier gates.
- Live (Minh, real OFF): only on a real product of his; or a no-barcode check (nothing is sent) for the reading parts.

## 3. Out of scope

Rotating photos; automatic cropping; perspective correction.

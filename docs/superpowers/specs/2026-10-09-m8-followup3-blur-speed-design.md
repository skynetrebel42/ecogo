# M8 follow-up 3: "Sent" sooner, blur check on every photo, numbered tips

- **Date:** 2026-10-09
- **Status:** **Approved** by the owner 2026-10-09 (decision 049, picked from options)
- **Why:** Minh's third phone test (barcode 2026100800055, test server): "Sent" (row 15) but after ~43 s; the function
  log shows 33 s inside `off-submit`, waiting on OFF's test server to take 3 photos one by one (048 G1). A blurry
  ingredients photo full of other text and a blurry nutrition photo got no warning: 048 G4 judges only the reader's
  confidence in the kept words, and nothing judges the nutrition or front photo.
- **Base:** M8 and follow-ups 1–2 as shipped (`docs/archive/2026-10-02-m8-add-product-design.md`,
  `docs/archive/2026-10-08-m8-followup-label-trim-design.md`, `docs/archive/2026-10-08-m8-followup2-photo-quality-design.md`).

## 1. Changes

| # | Change |
|---|---|
| H1 | **"Sent" sooner.** `off-submit`: GET (D10) → product text → the **ingredients** photo (or, when OFF already had text, the first photo) awaited as today; then it answers `{ ok: true, failedPhotos, pendingPhotos: [...] }` and uploads the remaining photos **one at a time in the background** (`EdgeRuntime.waitUntil`), appending any failure to the row's `error`. The Sent screen adds "Your other photos are still uploading to Open Food Facts." when `pendingPhotos` isn't empty. G2's partial-success rule holds for the awaited part. Background failures are logged only (owner accepted) |
| H2 | **Blur check on all 3 photos, on the phone.** After `preparePhoto`, a pure sharpness score (variance of a Laplacian over a ≤ 512 px grayscale copy, averaged over the sharpest 4 of 16 tiles so a flat background doesn't drag a sharp label down; canvas, no new dependency). Below **1500** (measured: Minh's sharp phone label 8416, his blurry photos 693–708, the soft curved-bag fixture 3266): "This photo looks blurry." + **Retake photo** (primary) / **Use it anyway**. For the ingredients photo it runs **before** reading, so a retake costs no reading time; after "Use it anyway" there, 048 G4's hard-to-read notice doesn't show again for that photo |
| H3 | **Numbered tips**, a compact row above Take photo on the ingredients and nutrition steps and inside the G4/H2 notices: "1 Lay it flat · 2 Close & sharp · 3 Only the ingredients · 4 No glare" (nutrition step: "3 Only the nutrition table"). Replaces 048 G3's four sentences |
| H4 | **Threshold from real photos.** The builder measures the H2 score on the clear fixtures, the curved-bag fixture, Minh's blurry photos (he supplies them; personal, never committed) and a synthetic blur of a clear fixture, reports the numbers, and sets the threshold with the planner. It also reports why Minh's blurry ingredients photo stayed under 048 G4's 25 % |

## 2. Testing

- Node: the sharpness score on a sharp and a blurred synthetic image (pure function over pixel data); the H1 reply
  shape (`pendingPhotos`), and that a background failure ends up in `error`.
- check-ocr/check-home: a blurred fixture → "This photo looks blurry", Use it anyway → reading starts; a sharp fixture →
  no notice; numbered tips on both photo steps; Sent screen with a stubbed `pendingPhotos`.
- Live (Minh's browser, test server, a fresh made-up barcode): Send time noted (target under 20 s on the test server);
  the row ends `sent` after the background photos finish; a deliberately blurry photo gets the notice.
- All earlier gates (npm test 292, check-home 47, check-map 36, check-saved 18, check-ocr 23).

## 3. Out of scope

A crop box; automatic retries; smaller photos; a status page for background uploads.

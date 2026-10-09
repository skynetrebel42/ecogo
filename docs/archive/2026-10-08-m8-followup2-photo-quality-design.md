# M8 follow-up 2: one-by-one photo uploads, honest partial success, photo tips, retake hint, shorter line list

- **Date:** 2026-10-08
- **Status:** **Done**, live 2026-10-09 (origin/main 91389f1); approved by the owner 2026-10-08 (decision 048, picked from options)
- **Why:** Minh's second phone test (blue Takis bag, test server, barcode 2026100800048): both Sends showed "Open Food
  Facts didn't answer" after 18 s and ~7 s. `contributions` rows 13–14: OFF took the text and the front and
  ingredients photos, but `product_image_upload.pl` answered **500 for the nutrition photo** both times; the earlier
  one-by-one uploads (row 12, same day) all worked. Reading a curved, shiny bag gave a long, messy line list.
- **Base:** M8 and its first follow-up as shipped (`docs/archive/2026-10-02-m8-add-product-design.md`,
  `docs/archive/2026-10-08-m8-followup-label-trim-design.md`). This replaces 047 F4's parallel uploads.

## 1. Changes

| # | Change |
|---|---|
| G1 | **Photos upload one at a time again** (047 F4's `Promise.all` reverted; OFF's test server returns 500 on concurrent uploads to one product). Keep the "Sending photos… this can take up to 30 seconds" text. "This picture has already been sent" counts as success |
| G2 | **Partial success is success.** Once OFF has taken the product text (or, if it already had text, at least one photo), the row is `sent`, with failed photos noted in `error`, and the reply is `{ ok: true, failedPhotos: ["nutrition", …] }`. The Sent screen then adds: "The nutrition photo didn't go through. You can add it later on the Open Food Facts website." (link: today's `offEditUrl`). Only when OFF took nothing is it "Not sent" |
| G3 | **Photo tips** on the ingredients photo step, above Take photo, one line each: "Flatten the bag." / "Fill the photo with just the ingredients." / "Avoid glare: tilt away from lights." / "Hold still." |
| G4 | **Retake hint, never a block.** If at least 25 % (tuned from 30 % on the fixtures: clear labels 0 %, curved shiny bag 29 %) of the words in the kept text are unsure (or the kept text is empty), the check step opens with a notice: "This photo is hard to read." + the G3 tips + **Retake photo** (primary) and **Use it anyway** (shows the normal check). The builder reports the share on the fixtures and on a rendered "curved bag" fixture, and may tune the 30 % with the planner |
| G5 | **Shorter line list.** Only lines inside the trimmed range are listed; the rest collapse behind "Show N more lines we left out" (a button; opens them, ticks unchanged). With no start/stop word found, all lines show as today |
| G6 | **Unsure words counted on the kept text only.** The note under the box says "N words underlined: check them." instead of listing every word (today it listed words from left-out lines, phone numbers included) |

## 2. Testing

- Node: `off.ts`/`index.ts` result rule (text taken + nutrition 500 → `ok`, `failedPhotos: ["nutrition"]`; nothing
  taken → `off-down`; "already been sent" → success); the G4 share on kept words only; G6 count.
- check-ocr: full-label fixture → only kept lines listed, "Show N more lines" opens the rest; a messy fixture → the G4
  notice, Use it anyway → check step. check-home: G3 tips shown; Sent screen with a stubbed `failedPhotos`.
- Live (Minh's browser, test server, a fresh made-up barcode): one Send with 3 photos → "Sent", time noted.
- All earlier gates (npm test 286, check-home 45, check-map 36, check-saved 18, check-ocr 17).

## 3. Out of scope

A crop box; reading other languages; automatic retries of failed photos.

# M8 follow-up: keep only the ingredients from a label photo + faster Send: design spec

- **Date:** 2026-10-08
- **Status:** **Approved** by the owner 2026-10-08 (decision 047, picked from options; no mockup: one screen gains a line list)
- **Why:** Minh's phone test of M8 (2026-10-08): reading was mostly right, but the ingredients photo also picks up other
  package text, and Send took 15–25 s. EcoGo goes live on the real Open Food Facts only after this ships (047), so stray
  package text isn't published.
- **Base:** M8 as shipped (`docs/archive/2026-10-02-m8-add-product-design.md`); everything there still holds.

## 1. Decisions (047)

| # | Decision |
|---|---|
| F1 | **Auto-trim, shown before the person checks it.** From the text read, keep from just after the first "Ingredients"/"Ingredient" (with or without ":") up to, not including, the first stop phrase: "Contains", "May contain", "Allergen(s)", "Allergy", "Distributed by", "Manufactured by/for", "Produced by", "Packed by", "Nutrition Facts", "Best before", "Best by", "Keep refrigerated", "Store in", "Net wt". Case-insensitive, whole words. No start word → from the beginning; no stop phrase → to the end. Never touches typed text |
| F2 | **Tap lines to keep or drop.** Step 3 (and the no-barcode photo check) shows the lines read from the photo as a list, each with a checkbox, label = the line's text. Lines inside the F1 range start ticked (boundary lines show only their kept part), lines outside start unticked. The text box below = the ticked lines, through `cleanIngredients`. A note above the list: "We kept the part from "Ingredients" to "Contains". Tick or untick lines, or edit the text below." (words match what was found; with no start/stop word: "Untick any line that isn't an ingredient.") |
| F3 | **The text box stays the final say.** The first keystroke in the box hides the line list ("You're editing the text directly"), so the two can't disagree. What is sent is exactly the box, as in M8 D11; nothing is changed after Send |
| F4 | **Faster Send:** `off-submit` keeps GET (D10) → product write, then uploads the photos **in parallel** (`Promise.all`), each result recorded as today. The Send button reads "Sending photos… this can take up to 30 seconds" while it waits |
| F5 | **Go-live order:** ship F1–F4 → Minh repeats the phone test (same steps, a made-up barcode, test server) → Minh swaps `OFF_USER`, `OFF_PASSWORD`, `OFF_BASE` to the .org account → first real product, the planner confirms it on world.openfoodfacts.org |

## 2. Units

| Unit | Change |
|---|---|
| `src/lib/ocr.ts` | pure `trimToIngredients(text): { start: number; end: number; startWord?: string; stopWord?: string }`; `readLabel` also returns `lines: string[]` (from `blocks`, already requested) |
| `IngredientEditor` (`IngredientCheck.tsx`) | optional `lines` prop → the F2 list + note; hides on first keystroke (F3). Typed checks (no photo) are unchanged |
| `supabase/functions/off-submit/index.ts` | F4 parallel uploads; redeploy via MCP with Minh's OK |
| `AddProductFlow.tsx` | F4 button text |

## 3. Testing

- **Node:** `trimToIngredients`: junk before "INGREDIENTS:", stop at "CONTAINS: MILK", "May contain" mid-text, no start
  word, no stop word, "ingredient" inside another word not matched, stop word before the start word ignored.
- **check-ocr (extended):** a rendered fixture label with a brand line above and "Distributed by …" below: the brand and
  distributor lines start unticked, the text box excludes them; unticking a kept line removes it; typing hides the list.
- **check-home:** Send button shows the new waiting text while a stubbed send is pending. All earlier gates pass
  (baseline: npm test 275, check-home 44, check-map 36, check-saved 18, check-ocr 12).
- **Live (Minh's browser, test server):** one send with 3 photos; report the time (target: clearly under 15 s).

## 4. Out of scope

A crop box (considered, not chosen: an extra step for everyone); reading other languages; changing text after Send.

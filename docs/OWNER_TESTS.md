# Tests for Minh (live site)

Open https://skynetrebel42.github.io/ecogo/ in a **fresh tab** first (an old tab keeps the old version).
Tick a box when done; tell the planner anything that looks wrong (a screenshot helps).

## Demo / next-chapter review (Thu 2026-10-22)
- [ ] Use the live app for 15 minutes like a new user. Write down what you love, hate and wish it did; tell Daedalus.
      This picks the next chapter of the build.

## Photo tests (no barcode: Scan → "Check ingredients", or a barcode that isn't found)
- [x] Perfume label (2026-10-21): found OCR-01/02/03, queued as decision 066.
- [ ] **Soap or shampoo label:** "What is it?" → Personal care → Take a photo of the ingredients. Check the words read
      match the label; fix any underlined ones; note if it says "not clear" on a sharp photo.
- [ ] **Lotion label:** same as above. Expect the fragrance note ("…A 2022 US law (MoCRA) requires FDA to make rules for
      labeling fragrance allergens.") if the list has fragrance/parfum.
- [ ] **A flat food label** (box, not a curved bag): Food → Take a photo. Compare with how the perfume went.
- [ ] **Perfume again, typed:** Type it, enter the list correctly. Expect "No matches in EcoGo's checked list." plus
      allergen notes (benzyl salicylate, limonene, hydroxycitronellal, vanillin…).

## Barcode tests
- [ ] **Lotion, soap or shampoo barcode:** if found, the page has no "More from USDA" section and bigger Back/Save
      buttons; no-match products say "No matches in EcoGo's checked list."
- [ ] **Sunscreen barcode** (when you have one): FDA status rows, and FDA's "more data needed…" line once.
- [ ] **Safer Choice cleaner** (e.g. Seventh Generation dish liquid, 732913451302): green "EPA Safer Choice certified"
      card, EPA's "not an endorsement" line, the California line.
- [ ] **Any other cleaner** not on EPA's list: no Safer Choice text at all.
- [ ] **Unknown cleaner barcode:** not found → "What is it?" → Cleaning product shows the California line and EPA's
      Safer Choice explainer.

## Screens
- [ ] Home says "What are you checking?".
- [ ] Search for nonsense (e.g. "zzzz"): suggestions include shampoo / sunscreen and "Or scan its barcode".
- [ ] Profile: the contribution labels are easy to read.
- [ ] Map → Suggest a place: each field has a visible border.

## Older, still open
- [ ] Follow-up 5: send new photos for a product already on Open Food Facts (a real product of yours).

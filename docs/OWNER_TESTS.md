# Minh's test checklist

**How it works:** the number is the category, the letter is one small test inside it. Each test says what to do and
what you should see. Tell Daedalus "done 1A" for one test, or "done section 1" for the whole category, plus anything
that looked wrong (a screenshot helps). A reminder comes every evening at 8 pm while anything is open.
Start every session by opening https://skynetrebel42.github.io/ecogo/ in a **fresh tab** (an old tab keeps the old version).

## Questions waiting on you (answer in chat; not tests)
- [x] ❓ 064 wording (2026-10-21): FDA's own words with a small "*FDA" note; the rest as drafted.
- [ ] ❓ Does the EcoGo Build Board show what you need? Leave a comment on it.

## 1 · Camera: reading ingredient labels (Scan → "Check ingredients")
- [x] Perfume label (2026-10-21): found three photo-reading bugs → Label reader v2 (066).
- [x] **1A** (2026-10-22: hair mousse, curved gold label → "hard to read" and junk text on the old reader; goes into 066 as a test photo; personal care has no "add to database" yet) Soap or shampoo: pick Personal care → Take a photo of the ingredients (flat, good light). See: the words
      match the label; any wrong word is underlined. Note it if you get "not clear" on a sharp photo.
- [x] **1B** (2026-10-22: a fragrance product showed the MoCRA note; the Equate lotion lists no fragrance, so no note, correct) Lotion: same steps. See: if it lists fragrance/parfum, a note naming the 2022 US law (MoCRA).
- [x] **1C** (2026-10-22, Minh: granola photo read, nothing flagged) A flat food box: pick Food → Take a photo. See: fewer mistakes than the curved perfume bottle.
- [x] **1D** (2026-10-22: Burberry box, 9 allergen notes on the old reader; 066 should catch the 5 it misread) Perfume again, typed: pick Type it, enter the list by hand. See: "No matches in EcoGo's checked list."
      plus allergen notes (benzyl salicylate, limonene…).

## 2 · Camera: scanning barcodes
- [x] **2A** (2026-10-22, Minh: Pantene not found, so the not-found → Personal care path was tested; a found product's page is still untested) Lotion, soap or shampoo barcode, **if EcoGo finds it** (not "We couldn't find this barcode"). See: no "More from USDA" section; bigger Back and Save buttons.
- [x] **2B** (2026-10-22, Minh: Coppertone not found (same as 2A); its label check works) Sunscreen barcode, **if EcoGo finds it** (when you have one). See: FDA status rows and FDA's "more data needed…" line once.
- [ ] **2C** (2026-10-22: Equate hand soap isn't on EPA's barcode list, so no card, which is correct; try Seventh Generation) Seventh Generation dish liquid (732913451302) or another Safer Choice cleaner. See: a green "EPA Safer
      Choice certified" card, EPA's "not an endorsement" line, the California line.
- [x] **2D** (2026-10-22: disinfectant spray, no Safer Choice text; the "Cleaning product" dead end goes to 068) Any cleaner not on EPA's list. See: no Safer Choice text at all.
- [x] **2E** (2026-10-22, Minh: OdoBan → Cleaning product → California line shown) A cleaner EcoGo doesn't know. See: not found → "What is it?" → Cleaning product shows the California line.
- [ ] **2F** (when you find one) A soda or juice drink listing sodium (or potassium) benzoate and ascorbic acid. See: a grey "Benzene can
      form" note with a small "*FDA"; tap "Read: Risks a label can't show". Bonus: uncured hot dogs or bacon with
      celery powder show a celery sentence inside the processed-meat warning.

## 3 · Sending to Open Food Facts (your own real products only)
- [x] **3A** (2026-10-22, Minh: done with his products (photos show the add flow; "Sent" not pictured)) A product already on Open Food Facts: add new photos → Send. See: "Sent" and the progress bar.
- [x] **3B** (2026-10-22, Minh: Shu Shu Bakery through the add flow ("Sent" not pictured)) A product not on Open Food Facts yet: three photos → Send. See: "Sent"; it appears on OFF later.

## 4 · Screens
- [x] **4A** (2026-10-22) Home. See: "What are you checking?" at the top.
- [x] **4B** (2026-10-22) Search "zzzz". See: suggestions include shampoo and sunscreen, and "Or scan its barcode".
- [x] **4C** (2026-10-22) Profile. See: the contribution labels are easy to read.
- [x] **4D** (2026-10-22) Map → Suggest a place. See: every field has a visible border.
- [x] **4E** (2026-10-22: info good; wants bubbles, bullets and source buttons, see playtest notes) Home → the 7th Learn tile "Risks a label can't show" (full width). See: five short sections and source cards.

## 7 · Cloud help (070, live 2026-10-23)
- [ ] **7A** Check ingredients → Take a photo → turn on "Cloud help for hard labels" → photograph a hard label (the Shu Shu
      bag). See: better text than before (or "Cloud help is busy today"). Then turn it off again.

## 6 · New label reader (066, live 2026-10-22)
- [ ] **6A** A curved or shiny label (your mousse, a perfume box): Check ingredients → Personal care → Take a photo.
      See: unsure words as buttons under the box ("Check N words"); tap one → "Did you mean" with real names; pick one.
- [ ] **6B** A label cut off at the edge: after the first photo, tap "Add another photo" and photograph the rest.
      See: "Joined 2 photos. Check where they meet." (or the text added at the end) and nothing you typed lost.
- [ ] **6C** Add a product → the photo step. See: "Photograph only the label, never anything private."
- [ ] **6D** Profile → Privacy. See: Open Beauty Facts named in the lookup line and a new Photon (address search) paragraph.

## 5 · Demo day (planned Thu 2026-10-22)
- [x] **5A** (2026-10-22, notes sent) Use the app for 15 minutes like a new user. Note what you love, hate and wish it did.
- [x] **5B** (2026-10-22: playtest notes → Chapter 6, decision 067) Tell Daedalus your notes; they pick Chapter 6.
- [ ] **5C** Look again at the decisions made on autopilot (points & levels first): keep or change each.

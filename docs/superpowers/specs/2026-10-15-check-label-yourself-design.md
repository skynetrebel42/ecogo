# Check the label yourself (decision 058)

- **Date:** 2026-10-15
- **Status:** **Approved** by the owner 2026-10-15 (decision 058); built after M8.1
- **Why:** Minh often scans products that USDA doesn't have and whose Open Food Facts data is wrong or partial. The
  account-free ingredient check (M8 D2, `IngredientCheck`) already gives a verdict from a label photo, but it only opens
  from the Scan drawer, so nothing on a product page points to it.
- **Base:** M8 `IngredientCheck` (photo → read → edit → result, nothing sent), follow-up 5 photos mode (051, J2/J2a/J2b),
  055 send rules. Nothing new on the server.

## 1. Changes

| # | Change |
|---|---|
| L1 | **Entry:** on every crowd-sourced OFF product (where "Send new photos" shows), a line under the ingredient list (or under "No ingredient list available."): "Doesn't match your package?" with a secondary button **"Check the label yourself"**. It opens `IngredientCheck` for that product: its header names the product, the result says it is from the photo, not from Open Food Facts. Nothing is sent, no sign-in. Not on USDA or catalog products |
| L2 | **Optional send:** after the result, a secondary button **"Also send these photos to Open Food Facts"** opens follow-up 5's photos mode for that barcode with the ingredients photo already in place (front and nutrition optional, as J2); everything else as J2 (notice, consent, limits, 055 rules). Shown only when the check used a photo (not for typed text) |
| L3 | The product page's own verdict does not change from a self-check; closing the check returns to the product as it was |

## 2. Testing

- check-home: an OFF product shows the line and opens the check with the product's name; a USDA product shows neither;
  a photo check offers L2, a typed check doesn't; L2 opens photos mode with the ingredients photo filled. Requests
  intercepted, nothing reaches Supabase or OFF. All earlier gates.
- Live (Minh): one self-check on a real OFF product with a wrong list; L2 only if he wants to send.

## 3. Out of scope

Saving self-check results; showing them on the product page; USDA/catalog products; sending typed text to OFF.

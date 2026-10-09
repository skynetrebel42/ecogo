# M8 follow-up 5: add missing ingredients and send new photos for existing Open Food Facts products

- **Date:** 2026-10-09
- **Status:** **Approved** by the owner 2026-10-09 (decision 051, picked from options; built right after follow-up 4)
- **Why:** Minh has products that are on Open Food Facts but with missing or wrong details. Today EcoGo only offers
  "Update ingredients / nutrition info on Open Food Facts" (M11), which needs an OFF account. M8's `off-submit` already
  fills text where OFF has none and never overwrites existing text (M8 D10), so people without an OFF account can help
  through the same flow.
- **Base:** M8 and follow-ups 1–4 (`docs/archive/2026-10-02-m8-add-product-design.md` and the follow-up specs). Every
  M8 rule holds: anonymous sign-in + Turnstile at the first Send, 10 a day per person / 200 overall (these count too),
  public notice + consent, blur check, label trim, progress bar, partial success.

## 1. Changes

| # | Change |
|---|---|
| J1 | **"Add the ingredients"** on a crowd-sourced OFF product whose ingredients are empty: in the product's Ingredients section, under "No ingredient list available.", a primary button opens the add flow for that barcode (same steps; the front and nutrition photos optional, the ingredients text required). The server already writes the text only when OFF has none (D10) and the name only when OFF has none |
| J2 | **"Send new photos"** on every crowd-sourced OFF product (where M11's Update info buttons show), as a secondary button next to them: the add flow in a *photos* mode with front, ingredients and nutrition photos (each optional, at least one; blur check and tips as usual), **no ingredients text step**, then Send with the usual notice and consent. Intro line: "Photos of the current label help Open Food Facts fix wrong or missing details. EcoGo never changes the text itself." Sent screen: "Sent to Open Food Facts. Volunteers use new photos to update the details, so it can take a while." |
| J3 | **Server:** `off-submit` accepts an empty `ingredients` field only in photos mode (a `mode=photos` form field) **and** only when OFF already has the product; otherwise `invalid`. In photos mode it never writes text or name, only uploads photos (one at a time, the first awaited, the rest in the background as H1). Rows log `photos only` in `error` as today. Redeploy with Minh's OK |
| J4 | Not for USDA or catalog products (they aren't crowd-sourced; nothing to send). M11's Update info buttons stay as they are, for people with an OFF account |

## 2. Testing

- Node: J3 rules (photos mode + existing product + no text → uploads only; photos mode + unknown product → `invalid`;
  normal mode + empty text → `invalid` as today; photos mode never calls the product write).
- check-home: an OFF product with no ingredients shows "Add the ingredients" and opens the flow with that barcode; an
  OFF product shows "Send new photos" and its flow has no text step; a USDA product shows neither. Requests intercepted
  (CDP Fetch), nothing reaches Supabase or OFF. All earlier gates.
- Live (Minh, real OFF, on one of his products with missing or wrong info): one J1 or J2 send; the planner confirms the
  photos (and text, for J1) on world.openfoodfacts.org.

## 3. Out of scope

Editing or overwriting OFF text from EcoGo; choosing which photo OFF displays; reporting wrong info without photos.

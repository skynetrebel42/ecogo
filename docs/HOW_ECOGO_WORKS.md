# How EcoGo works (plain English)

For Minh. Reading this costs nothing. Ask a chat to add a line when something new ships.

## What it is
A phone website. You scan a barcode, and EcoGo shows which ingredients are worth knowing about. Every warning
links to a real quote from a trusted source. Nothing is made up.

## The five tabs
- **Home**: greeting, a Scan button, search, recently viewed products, and "Learn" tiles that explain things.
- **Map**: free food spots, farmers markets, and community gardens near a ZIP code (from OpenStreetMap and LA County).
- **Scan**: opens the camera and reads barcodes. The photo never leaves your phone.
- **Saved**: your favorite products and lists, kept on this phone only.
- **Profile**: text size, high contrast, and what data the app keeps (very little).

## What happens when you scan
1. The camera reads the barcode, right on your phone.
2. EcoGo looks the product up in **its own copy of the US government's food list** (about 430,000 products, stored in Supabase).
3. If the product isn't there, it checks **Open Food Facts** (a public, Wikipedia-style food database), then
   **Open Beauty Facts** (the same for soap, shampoo and lotion; EcoGo only reads it).
4. The **rulebook** (the "safety engine") reads the ingredient list and flags anything with a sourced concern.
5. If no one has the product, you can **add it**: take photos, the phone reads the label, and EcoGo sends it to Open Food Facts.

## The parts behind the scenes
| Part | Plain meaning |
|---|---|
| **GitHub** | Where the code is saved, with full history. Like Google Docs version history for code. |
| **GitHub Pages** | The free host that puts the website online. |
| **Supabase** | The online database (a giant spreadsheet) plus small server helpers. |
| **Edge Function** | A small helper that runs on Supabase's server instead of your phone. `off-submit` sends new products to Open Food Facts. |
| **Tests** (`npm test`) | Automatic checks that the rulebook still gives the right answers. |
| **Build** (`npm run build`) | Packages the code into the website. If it fails, nothing ships. |

## How we build (the team)
- **Planner chat**: talks to you, writes the **spec** (the description of what to build), and records your decisions.
- **Builder chat**: writes the code to match the spec, runs the tests, and reports back.
- **You**: pick options and approve the push.

## Words you'll see
- **Milestone (M8, M13…)**: one feature-sized chunk of work. Numbers like 055 or 057 are smaller tasks inside one.
- **Spec**: the written plan for a milestone: what it does and how it should look.
- **Commit**: saving a snapshot of the work, with a note about what changed. Safe.
- **Push**: sending commits to GitHub's `main`. **This makes it live on the website.** Read before you approve it.
- **Branch / worktree**: a side copy where the builder works without touching the live version.
- **Merge**: folding a side copy back into `main`.
- **Deploy**: putting a new version online. It happens automatically after a push.
- **Bug batch**: a bundle of small fixes shipped together.

## What's done and what's next
- **Done**: scanning, sourced warnings, the government food copy (M10), Learn tiles, Map near me, Saved lists,
  and adding a product to Open Food Facts (M8, plus its follow-ups).
- **Next, M8.1**: "Suggest a place" and "Report a problem" forms on the Map. The owner reads the reports in Supabase.

## Log (one line per shipped thing, plain words)
- 2026-10-15: Sending a new product handles edge cases: no double-sends, a "not sure it arrived" message, and rejected photos explained.
- 2026-10-15: Search results show a barcode line so look-alike products can be told apart. "Recently viewed" was renamed.
- 2026-10-16: Profile shows "Your contributions": how many products Open Food Facts took from you and how many map fixes EcoGo approved, with five small milestones. Private, on this device only.
- 2026-10-16: The source check now fails unless every quote is confirmed (pages it can't read are checked by hand and dated), Learn pages' claims are checked too, and the seed-oils page gives each oil's real fat mix from USDA's data.
- 2026-10-16: Personal care (M16): soap, shampoo, lotion and sunscreen barcodes are found in Open Beauty Facts and checked against FDA bans, EU bans and IARC findings. EU fragrance allergens, "fragrance" and FDA's sunscreen status show as info rows, and EU-limited ingredients sit in one folded "Limited, not banned" row. An unknown product can be checked as personal care from a photo or typed list.
- 2026-10-18: New welcome screen with the detective mascot and lens logo: "Scan. Learn. Decide.", food and personal care, Start scanning / Look around first as before. The link preview card shows the same art.
- 2026-10-20: Personal-care wording fixed to match the sources (063): the fragrance note names the 2022 US law (MoCRA), PABA and trolamine salicylate say "FDA ordered its removal", FDA's "more data needed isn't a finding of unsafe" line shows under sunscreen rows, the dandruff line sits next to the EU ban, hexachlorophene and mercury state FDA's exact conditions, and no USDA/food lines appear on personal-care pages. Home asks "What are you checking?", an empty search suggests shampoo and sunscreen, the seed-oils page cites the EU's current contaminants law, and a few labels, form borders and buttons got easier to see and tap.
- 2026-10-20: Cleaning products (M17): EcoGo keeps its own copy of EPA's Safer Choice list (799 products, 1,839 barcodes, companies in good standing only). A scanned barcode on the list shows "EPA Safer Choice certified" with EPA's product name and company, EPA's own "does not constitute endorsement" line, the list date and a link to EPA's search, even when no other database has the product. Products not on the list get no line at all. Cleaners covered by California's law also say the maker must post its ingredients online (with exceptions), and the not-found screen has a "Cleaning product" choice that explains the label and points to the maker's website. The app never contacts EPA; the owner refreshes the list with `npm run import:saferchoice`.
- 2026-10-21: Risks a label can't show (064): a 7th Learn page explains four risks no ingredient list can show (oil-refining contaminants, benzene forming in some drinks, mold toxins in peanuts and corn, nitrite from celery powder in "uncured" meats), each in the FDA's, USDA's, EFSA's, EU's or IARC's own words. Drinks that list both a benzoate and vitamin C acid get a grey "Benzene can form" note, and a processed-meat finding whose label lists celery powder or juice now explains it. Both link to the page. No badge, level or count changed anywhere.
- 2026-10-22: Label reader v2 (066): ingredient photos are read by a stronger reader (PaddleOCR, about 13 MB once, still on the phone, from EcoGo's own site; the old reader stays as a backup). Each word it isn't sure of shows as a chip under the box with up to 3 real ingredient names (from EcoGo's lists and USDA FoodData Central), "Or type it", "Keep as read" or "Retake photo"; nothing changes until the person picks. It offers a comma where two names ran together, drops warning text ("Caution: flammable…") from the list, and no longer says "hard to read" on sharp curved labels. "Add another photo" joins a second photo of a curved or cut-off label where the two overlap (or adds it at the end); only the first photo is ever sent to Open Food Facts. The send box says "Photograph only the label, never anything private.", Privacy now names Open Beauty Facts and Photon, and the app's font comes from EcoGo's own site instead of Google.
- 2026-10-23: Cloud help for hard labels (070): a switch on the ingredient photo step (Check ingredients and the Open Food Facts send), off until the person turns it on and remembered on this phone only. When it's on and the phone finds a photo hard to read, that one photo (shrunk, with no location or time data) goes through EcoGo's own server to OCR.space's free reader, which says it deletes it after processing. Its text replaces the phone's only if more of its words are real ingredient names, and the person checks it with the same chips and "Keep as read". If OCR.space's shared 500-a-day limit is used up, the app says "Cloud help is busy today" and keeps the phone's reading. The screens and Privacy say what is sent while the switch is on; the OCR.space key lives only in Supabase's secrets.
- 2026-10-23: Tidy-up (073), nothing in the app changed: the long Home check is now two (Home and Learn, ~105 s; Scan and adding a product, ~190 s), and every automated check closes its hidden browser when it ends.
- 2026-10-23: Scan screen (068): a "Barcode · Ingredients" switch at the bottom of the camera opens the ingredient check (the camera stops while it's open), and "No barcode?" now reads "Check ingredients". Under "Type it", a Paste button puts text copied from Photos into the box (the phone only shares the clipboard when you tap it). "Cleaning product" on the not-found screen is no longer a dead end: it opens the same label check, which for now looks only for IARC cancer findings and says so; official cleaner lists come with 072.
- 2026-10-28: Audit fixes (075): closing a check now really stops a hard photo going to cloud help; older iPhones (before iOS 16.4) can open the app; the Tide PODS sample no longer lists an unsourced "1,4-dioxane"; "no added formaldehyde" or "free from (…)" on a label no longer raises a warning for what it says is absent; a failed search says "Couldn't search right now."; the "Nothing flagged" article inside the check closes with Back or Escape and returns you to its link; faded text on the Scan screen is easier to read; the human check loads only when you press Send; the Map's code loads when you open the Map, so the app starts lighter. EcoGo's three server functions refuse oversized uploads without keeping them.

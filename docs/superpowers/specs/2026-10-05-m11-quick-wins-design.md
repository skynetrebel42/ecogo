# M11: Quick wins (food icons, "Update info", expandable Profile rows, text size and high contrast): design spec

- **Date:** 2026-10-05
- **Status:** draft for the owner's approval. Front end only: no new data, no database change, no new dependency. One milestone,
  four small parts built **in this order, one commit each** (work in progress: one part at a time).
- **From:** the owner's app review, item 1 (`docs/superpowers/ideas/2026-10-05-owner-app-review.md`); order of work is decision 033.
  **Reference code and tests are ready and checked** (assets below).

## 1. What the owner asked for

1. **Food icons:** an emoji per product category instead of the shopping bag on every product.
2. **"Update info" buttons** in the Nutrition and Ingredients sections, replacing the single "Looks wrong?" link, and a friendly
   banner on crowd-sourced data. (Points wording waits for item 6.)
3. **Profile rows that expand:** Your data, Where results come from, Privacy as tappable rows.
4. **Accessibility:** text size and high-contrast settings, kept on the device. (Languages are a later, separate item.)

## 2. Decisions (all defaults; the owner may overturn)

| # | Decision |
|---|---|
| D1 | **The icon is a picture of the shelf, not a claim.** It comes from the product's category (catalog, then USDA, then the most specific Open Food Facts tag), and an unknown category keeps the cart 🛒. It is decorative (hidden from screen readers). The hero also prints the USDA category in small text, so the icon has a word next to it. |
| D2 | **"Update info" only where an update can show up:** on crowd-sourced (Open Food Facts) products. USDA products get no button: USDA's data is the maker's own, and EcoGo's copy changes only when the table is re-imported, so a button would promise a fix that never appears. Correcting USDA-sourced products belongs to M8 (add or correct a product). |
| D3 | **Update info opens Open Food Facts** (`offEditUrl`) in a new tab; the user signs in there with their own account. EcoGo writes nothing anywhere; fixes show after a reload (as today). |
| D4 | **Text size has three steps:** Normal, Large (115%), Larger (130%). It scales **text**, not the layout. The browser's own text-size setting also keeps working (the root size was a fixed 16px that ignored it; it becomes 100%). |
| D5 | **High contrast is a switch.** Its first value follows the phone's "more contrast" setting (`prefers-contrast: more`); once the user chooses, their choice wins. |
| D6 | **The "Display" settings sit in Profile, always visible** (not in an accordion row), above the three expandable rows, so they are easy to find. |
| D7 | **Accordion rows are independent and closed by default;** open state is not remembered. |

## 3. The four parts

### 3.1 Food icons (build first)
- New `src/lib/foodIcon.ts` (asset): `foodIcon(product)`, `iconForCategory(text)`, an ordered table of 40 patterns. The catalog's
  own icons move into it from `verdict.tsx`; `categoryIcon` is deleted and its one use in `App.tsx` (ProductCard) becomes
  `foodIcon(product)`.
- Product page: the hero's 80 px tile shows the emoji (`text-4xl`, `aria-hidden`) instead of `ShoppingBag`; the alternatives list
  does the same (`text-xl`). The hero's small category label shows `product.category || product.source?.foodCategory`.
- Tests (asset): common categories → expected icons; **at least 99.9% of the 430,127 USDA products get an icon other than the
  cart** (fixture `usda-categories.json`: all 351 real categories with their counts); catalog first, then USDA, then OFF tags
  from the last (most specific) to the first, skipping generic tags such as "plant-based foods and beverages".

### 3.2 "Update info" and the crowd-sourced banner
- **Banner** (crowd-sourced products only; the USDA source box is unchanged): "Shown from Open Food Facts, crowd-sourced. Help
  verify it." then "Anyone can edit this data, so it may contain errors. Fixes you make there show here after you reload EcoGo."
  and the links "View on Open Food Facts" and "Data © Open Food Facts contributors, ODbL." Same amber box. The old "Looks wrong?
  Fix it on Open Food Facts" block is removed.
- **Buttons:** in the Nutrition card and the Ingredients card, in the header row, right side: an outline button "Update info"
  with an external-link icon, 44 px tall, opening `offEditUrl(product.barcode)` in a new tab (`rel="noreferrer"`), with
  `aria-label="Update nutrition info on Open Food Facts"` and `"Update ingredients on Open Food Facts"`. Under it, one line of
  10 px text: "Opens Open Food Facts. Sign in there to correct the values or add a photo of the label." `NutritionPanel` gets an
  optional prop `updateUrl`; the button shows in its "ready" and "none" states, not while loading.
- Tests: a pure helper `updateInfoUrl(product): string | null` (null unless crowd-sourced) in `lookup.ts`, tested for OFF,
  USDA and catalog products.

### 3.3 Expandable Profile rows
- A small `Accordion` in `App.tsx` (or its own file): a full-width button row, 56 px minimum, title plus a one-line summary while
  closed ("3 recent products, on this device"; "USDA, Open Food Facts, IARC and more"; "What leaves your phone"), a chevron that
  turns, `aria-expanded` and `aria-controls`, the panel `role="region"`. The "Clear" button stays inside Your data. Content is
  today's text, unchanged.
- No new logic to test beyond rendering; verified in the browser (section 6).

### 3.4 Text size and high contrast
- **Settings module** (asset `settings.ts`, same pattern as `recent.ts`): `loadSettings`, `saveSettings`, `applySettings`;
  stored under `ecogo.settings.v1`; the choice is two attributes on `<html>`, `data-text-size` and `data-contrast`. `main.tsx`
  applies them **before the first render**, so there is no flash. Storage that is missing, blocked or full never breaks the app.
- **CSS** (asset `theme-additions.css`, instructions in its header): `--font-size: 100%`; font-size tokens `--text-xs … --text-2xl`
  and three new ones (`--text-nano`, `--text-micro`, `--text-mini`, replacing the 42 `text-[9px]`, `[10px]`, `[10.5px]`, `[11px]`
  uses; the one `[26px]` becomes a `calc`) all multiplied by `--text-scale`; the high-contrast block (text tokens 7:1, borders 3:1; solid white instead of
  translucent white on the product hero; the hero gradient becomes its darkest stop through `data-hero` and `--hero-solid`;
  grey utility text darkened). `VERDICT_STYLE` gets a `solid` colour (its gradient's first stop) for that.
- **The Display card** in Profile: a three-button "Text size" group (`role="radiogroup"`, 44 px buttons, the chosen one filled)
  and a "High contrast" switch (`role="switch"`), each with a one-line explanation. A live sample line ("The quick brown fox")
  is not needed: the page itself changes at once.
- **Existing low-contrast text, fixed for everyone:** the six `text-gray-400` (2.5:1) informational texts in the product page
  become `text-gray-500` (4.8:1).
- Tests (assets): the settings module (defaults, corrupt storage, the phone's "more contrast", unknown values); the palette:
  **normal text reaches AA (4.5:1), high contrast reaches AAA (7:1), borders 3:1**, and the CSS text scales match the settings
  module, read from `theme.css` itself.

## 4. Evidence (2026-10-05; scratch copy of `main` f397e7e; the live `foods` table read through the connector)

- **Icons:** the 351 real USDA categories, 430,127 products: 99.97% get a real icon (5 products plus 124 with no category keep the
  cart). The first draft mapped "Snack, Energy & Granola Bars" to a drink, "Other Grains & Seeds" to a snack, "Non Alcoholic
  Beverages" to wine, and "Pasta & Pizza Sauces" to a pizza; each is now a rule order or a test.
- **Contrast today:** muted text 4.51:1 on the page background (passes AA barely); `text-gray-400` 2.5:1 (fails); the hero's
  `text-white/60` 2.85:1 at the light end of the "nothing flagged" gradient (fails). High contrast reaches 9.6:1 for muted text.
- **Text scaling works:** I built the app with the CSS and class changes (clean build) and opened it at phone width: `text-xs`
  went from 12 px to 15.6 px at "Larger", the heading from 20 to 26 px, and the Home screen stayed inside 375 px (no sideways
  scroll, nav and cards intact).
- 12 new tests pass on a scratch copy of `main`.

## 5. Changes (files)

`src/lib/foodIcon.ts` + test + `src/lib/fixtures/usda-categories.json` (assets); `src/lib/settings.ts` + test, `themeContrast.test.ts`
(assets); `src/styles/theme.css` (asset instructions); `src/main.tsx` (apply settings first); `src/lib/lookup.ts` (`updateInfoUrl`);
`src/app/App.tsx` (ProductCard icon, Profile Display card and accordion); `src/app/components/ProductDetailScreen.tsx` (hero emoji,
banner, buttons, `data-hero`, gray-400 → 500), `NutritionPanel.tsx` (`updateUrl`), `verdict.tsx` (`solid`, drop `categoryIcon`); the
mechanical `text-[Npx]` renames in `src/app`. Docs: `FIXES_AND_UPDATES.md`, `ARCHITECTURE.md` (Profile and settings rows),
`PROJECT_HANDOFF.md` (one line when it ships). No change to the safety engine, `foods`, or any Supabase object.

## 6. Verification (the owner wants proof, so screenshots)

`npm test` green, `npm run build`, then in the browser pane at phone width (375 px): (a) Home and a search result list with
varied icons; (b) a USDA product page (emoji, category label, no Update info buttons) and an Open Food Facts product page (banner,
both buttons; pick a barcode that is not in USDA); (c) Profile with the rows closed, one open, and the Display card; (d) the
product page at "Larger" and at high contrast, checking no sideways scroll (`scrollWidth <= clientWidth`) and no clipped
buttons; (e) reload with a saved setting to see it persist and not flash. Add the screenshots to the report to the King.

## 7. Not in this batch

Languages; a per-section "Update info" for USDA products (M8); points wording on the banner (item 6); a light/dark theme; moving
every text size to rem beyond the renames above; Home redesign (item 2, mockup first).

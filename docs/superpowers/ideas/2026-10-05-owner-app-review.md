# Owner app review — backlog (2026-10-05)

Minh walked through the live app (M9 + audit batch) and wrote these notes. Triaged by the King chat; the owner chose the
order below. Each item becomes a spec (Lord Chancellor) before any build. Facts first still applies: nothing the app
shows may be invented, every finding needs a source.

**Order after M10:** 1 Quick-wins batch → 2 Home redesign → 3 Map near me → 4 Collections → 5 M8 add-a-product
(spec approved) → 6 Points & levels → 7 Non-food products. Unscheduled: OFF scores, produce, mercury marker, languages.

## 1. Quick-wins batch (one small milestone, no new data)
- **Food icons:** an emoji per category instead of the bag/box for every product (🥤 drinks, 💧 water, 🍪 snacks…);
  map USDA categories and OFF tags to the existing `categoryIcon`.
- **"Update info" buttons** in the Nutrition and Ingredients sections (replacing the single "Looks wrong?" link), plus a
  friendly banner on crowd-sourced data ("Shown from Open Food Facts, crowd-sourced. Help verify it."). Points wording
  waits for item 6.
- **Profile rows that expand:** Your data / Where results come from / Privacy as tappable rows that open (accordion).
- **Accessibility:** text size and high-contrast settings (kept on the device). Languages are a later, separate item.

## 2. Home redesign (mockup first, like M7)
- Too much text on Home. Replace the explainer rows with **big coloured category buttons for learning** (one per topic),
  each opening the explainer pages.

## 3. Map "near me"
- ZIP code entry or precise location, and **radius chips 5 / 10 / 15 / 20 mi**; list sorted by distance.
- ZIP → location needs a ZIP centroid table (US Census ZCTA, free).
- **Food pantries:** include pantries, e.g. campus pantries such as Cerritos College's Falcon's Nest. OSM coverage is
  thin: either add them to OSM (in-app "Fix it on OSM") so the next snapshot picks them up, or use a directory such as
  211 LA or LA Regional Food Bank's locator — check its licence first.

## 4. Collections (Saved)
- **Instagram-style:** bookmark a product, then sort bookmarks into your own lists, with preset lists offered (Breakfast,
  Lunch, Dinner, Dessert, Snacks; or nutrition groups inspired by food-exchange lists: protein, fibre, etc.), later
  non-food lists (laundry detergent, toothbrushes…).
- Prerequisite: favorites are session-only today ("kept until you close EcoGo"); keep them on the device first; accounts
  later (item 6).

## 5. M8 add-a-product — already specced (`docs/superpowers/specs/2026-10-02-m8-add-product-design.md`)
- Add **"Suggest a place"** for the Map (decision 039): same sign-in and bot check, an owner review queue, a source link
  required; needs a spec addendum when M8 comes up.
- Includes the **"type or upload the ingredients" box** for products without a barcode. Owner setup needed: OFF
  accounts, Turnstile, Supabase anonymous sign-in.

## 6. Points & levels
- Points for scans, first scans of new products, scanning ingredient lists, adding or updating product data, verifying
  facts. Needs accounts + database writes (security work, anti-gaming). **Design risk:** points must reward accurate
  contributions, not fast ones (facts first).

## 7. Non-food products (detergent, dish soap, bar soap, shampoo…)
- Owner's use case: pick up a product (e.g. a dollar-store soap), read its ingredients, spot irritants, unknown
  chemicals, "fragrance". Today a non-food scan says "add it on Open Food Facts" and lands on the OFF login.
- Needs a new **sourced** ingredient library (EU CosIng, the EU's 26 fragrance allergens, EPA Safer Choice — see
  `docs/research/2026-10-02-ingredient-databases.md`), lookups via Open Beauty Facts / Open Products Facts, and the
  ingredient-upload box from M8 extended to non-food.

## Unscheduled ideas
- **Open Food Facts scores:** show OFF's Nutri-Score, NOVA and Green-Score where OFF has them, labelled as OFF's
  (was deferred from M2).
- **Produce:** look up whole produce by its **PLU sticker code** (reliable; photo identification is a guess and clashes
  with "nothing invented"); origins, flavour, picking tips and carbon footprint from sourced datasets. Ethics scores
  are hard to source honestly — later, if ever.
- **Mercury in fish** ("don't eat tuna every day"): a sourced marker like 🔥 acrylamide, from the FDA/EPA fish advice.
- **Languages:** full translation of the UI and the sourced findings; big, needs care.

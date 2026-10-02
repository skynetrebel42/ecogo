# M7.4: Trust cleanup (remove the last invented content and stale promises): design spec

- **Date:** 2026-10-02
- **Status:** **built 2026-10-02** (`1462e8b`…`d7fcac4`) by the build chat (debugger 1); plan:
  `docs/superpowers/plans/2026-10-02-m74-trust-cleanup.md`. One review ruling: the D5 "see the Nutrition section"
  pointer shows only when the page has that section (plan, Rulings).
- **Decided with:** the owner (Minh Bui), 2026-10-02, after the architecture review: **remove prices from the UI**
  (the database keeps its price rows) and **hide the Map tab** (keep its code for the real map).

## 1. Why

EcoGo's pitch is "official findings, with sources, nothing invented". Six things still break it:

| # | Where | What is wrong |
|---|---|---|
| a | `ProductDetailScreen.tsx:267-270` | "Ingredient profiles researched with AI and verified against IARC, EU and FDA sources." No AI is used (decision: rename until real). |
| b | `App.tsx:408` (Saved › Lists) | Three hardcoded lists ("Weekly Groceries 6 items") and a dead **New** button. |
| c | `App.tsx:526` | Favorites start with fake ids `[3,5]` (K-16). |
| d | cards, product page, search sort | Every catalog price, store chip, "best price" and the Price Comparison section is invented (K-30). |
| e | Map tab | Invented Chicago places with (555) phone numbers and star ratings (K-5/K-6/K-23). |
| f | `ProductDetailScreen.tsx:155` | **Share** button does nothing (K-21). |

Two smaller untruths ride along: "This doesn't rate nutrition (coming next)" (`ProductDetailScreen.tsx:33,38`; the
Nutrition section shipped in M5) and the banner "Offline — showing cached data" (`App.tsx:608`; it is the built-in
catalog, K-11).

**Done for M7.4:** nothing the app shows is invented, and nothing promises a feature that does not exist.

## 2. Decisions

| # | Decision |
|---|---|
| P1 | Prices come out of the **UI only**: cards, product hero, store chips, Price Comparison, alternatives' "from $", and the search **Price** sort. `product_prices`, `catalog.ts` and the CSV are untouched (a real price source may return). *(owner)* |
| M1 | The Map tab is **hidden**: removed from the bottom nav and from the tab render; `MapTab.tsx` stays in the repo, unimported, so Leaflet leaves the bundle. *(owner)* |
| D1 | Bottom nav becomes four tabs: **Home, Scan (still the raised green circle), Saved, Profile**. Screenshot it; if it looks off the owner picks another order. *(recommended default)* |
| D2 | Saved loses the **Lists** tab; it has **Favorites** and **Scanned** only. *(recommended default)* |
| D3 | Favorites start empty. A looked-up product (USDA or Open Food Facts, negative id) joins `lookedUp` when opened, not only when scanned, so bookmarking it shows in Favorites (KNOWN_ISSUES Home follow-up). *(recommended default)* |
| D4 | **Share** button removed from the product page until Share really works (the next spec: links). *(recommended default)* |
| D5 | Wording: footer → "Findings are matched against official sources (IARC, EU, FDA, EFSA, WHO), linked on each finding. Classifications describe potential hazards; this is not medical advice." · `none`/cooked small print drops "(coming next)" → "This badge doesn't rate nutrition; see the Nutrition section." · `non-food` small print → "EcoGo checks food and drinks only for now." · offline banner → "Offline — showing the built-in catalog". *(recommended default)* |
| D6 | Search keeps one order, "fewest concerns". The sort row becomes the text "Sorted by fewest concerns" plus the "N found" count. The alternatives' last tie-break, `bestPrice`, becomes `name.localeCompare` (also removes the `Infinity − Infinity` NaN in KNOWN_ISSUES). *(recommended default)* |

## 3. Change list

- `ProductDetailScreen.tsx`: remove the hero price, the store chips, the `stores` array, `best`, the Price Comparison
  block, the alternatives' price line, the Share button, and the `DollarSign`, `Star`, `Share2` and `bestPrice` imports
  if nothing else uses them; apply D5 wording.
- `App.tsx`: remove the price block in `ProductCard`; search sort state and Price button (D6); `Lists` tab and its
  fake data, and the `Plus` import; `savedIds` seed `[]`; Map import, tab entry and render; the now-dead `RESOURCES`,
  `rowToResource`, `Resource`/`ResourceType`/`CAT` and icons only they used; `resources` state; offline wording;
  `openProduct` adds a negative-id product to `lookedUp`. There is no linter or type check, so **grep each removed
  name** for remaining uses before deleting it.
- Leave alone: `catalog.ts` (still reads `resources`, harmless; the real map replaces it), the realtime channel, the
  database, `MapTab.tsx`, `productImporter.ts`.

## 4. Testing

- `npm test` stays 156/156, plus one tiny guard, `src/lib/honesty.test.ts`: reads `src/app/**/*.tsx` and fails if
  any contains "researched with AI", "Weekly Groceries", "Price Comparison", "best price", "(coming next)",
  "coming later" or "cached data".
- `check-home.mjs` extended (headless Edge, vite preview): no `$` on Home, search results or an Oreo product page;
  no "Price Comparison", "Share", "AI" text; bottom nav has no "Map"; Saved shows only Favorites and Scanned, with
  Favorites empty on a fresh profile; opening a USDA search result then bookmarking it lists it in Favorites; all 24
  earlier checks pass.
- Screenshots (phone width) of Home nav, a product page, search results and Saved, for the owner.

## 5. Out of scope

Persisting favorites and working Share links (next spec: hash routes), real prices, the real map (Los Angeles,
OpenStreetMap), accounts, any safety-engine or library change, database migrations, bundle splitting.

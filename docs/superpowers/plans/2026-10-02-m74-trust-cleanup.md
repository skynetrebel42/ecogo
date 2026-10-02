# M7.4 trust cleanup: build plan

- **Spec:** `docs/superpowers/specs/2026-10-02-m74-trust-cleanup-design.md` (decisions P1, M1, D1–D6).
- **Builder:** debugger 1 (build chat), on `main`, 2026-10-02. Short plan written by the build chat (the spec says so).
- **Rules:** grep every removed name first (no linter or type check); commit by path; `npm test` + `npm run build`
  green after each commit; ask the owner before pushing.

## Commits (one per change group)

1. **Prices out of the UI (P1, D6).** `App.tsx`: `ProductCard` price block, search sort state and Price button → the
   text "Sorted by fewest concerns" + "N found", `bestPrice` import. `ProductDetailScreen.tsx`: hero price, store chips,
   `stores`, `best`, Price Comparison, alternatives' "from $", `bestPrice` tie-break → `name.localeCompare`, the
   `DollarSign`/`Star`/`bestPrice` imports. `productImporter.ts`, `catalog.ts`, the CSV and the DB stay.
2. **Map tab hidden (M1, D1).** `App.tsx`: `MapTab` import, `"map"` tab, nav entry and render; `RESOURCES`,
   `rowToResource`, `Resource`, `ResourceType`, `CAT`, the `resources` state and the icons only `CAT` used
   (`Map`, `Package`, `Shirt`, `Bike`, `Building2`, `Utensils`; `Wifi` stays for the status bar). `MapTab.tsx` stays,
   unimported.
3. **Saved: no invented lists or favorites (D2, D3).** `SavedTab` loses Lists (and `Plus`); `savedIds` starts `[]`;
   `openProduct` adds a looked-up product (id < 0) to `lookedUp`, so Scan's own `setLookedUp` goes.
4. **Honest wording, no dead Share (D4, D5) + `src/lib/honesty.test.ts`.** Test first (red on all seven phrases), then
   Share button + `Share2` import out, the four D5 texts, the file header comment.
5. **`check-home.mjs` extended** (spec §4): nav has no Map; Saved has only Favorites + Scanned and Favorites is empty on
   a fresh profile; no `$` on Home, search results or the Oreo page; no Price Comparison, Share or AI there; a USDA
   search result, opened and bookmarked, is listed in Favorites; the 24 earlier checks still pass.
6. **Docs:** PROJECT_HANDOFF (decision 025, what's real/fake), KNOWN_ISSUES (K-11, K-16, K-21, K-30, map items, Home
   follow-up, NaN sort, roadmap 13), ARCHITECTURE (feature inventory, data map, file map), SYNOPSIS, README, spec
   Status line.

## Checks

- `npm test` 157/157 (156 + the honesty guard); `npm run build` green; the bundle no longer contains Leaflet.
- `check-home.mjs` against `npm run build` + `npx vite preview --port 4317 --strictPort`.
- Phone-width (390 px) screenshots for the owner: Home + nav, a product page, search results, Saved.
- One final reviewer (opus, effort medium), then ask before pushing.

# EcoGo! — Known issues, baseline and roadmap

> Verified 2026-09-23. Every item below was either **reproduced in the running app (▶)** or found by a code
> reader and then **independently confirmed by an adversarial verifier (✔)**. Items marked **(live?)**
> depend on the Supabase project's real state, which this audit could not inspect. Line numbers refer to the
> unmodified Figma export. Architecture context: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Baseline (before any change)

| Check | Result |
|---|---|
| `npm install` | Already done (Sep 18); `node_modules` consistent with `package-lock.json`. Node 24.21.0 / npm 11.19.0 |
| `npm run build` | ✅ passes in about 17 s. One 780 KB JS chunk (220 KB gzip) triggers Vite's >500 KB warning; CSS 126 KB |
| Typecheck | No script and no TypeScript installed. A throwaway strict `tsc` run (outside the repo) finds **6 errors**, all minor: missing `@types/react-dom`, `Array.at` needs lib ES2022, 3 implicit `any` in `ProductDetailScreen.tsx:690/736/831`. Non-strict: 1 |
| Lint / tests | None exist |
| `npm run dev` | ✅ Serves at `http://localhost:5173` (5174 in the audit's offline config) |
| Runtime, offline (Supabase stubbed) | ✅ All 5 tabs render. Banner "Offline — showing cached data". Console: `[productImporter] Successfully loaded 51 product(s). 0 row(s) skipped.` The realtime websocket retries forever (expected offline). No React errors |
| Runtime, live Supabase | ⛔ **Not run.** It would hit the production DB, and on an empty table the app writes seed data from the browser. Needs the owner's go-ahead |
| Env vars | None used. URL and anon key are hardcoded in `utils/supabase/info.tsx` |

## 2. Prioritized bug list

### Critical: functional

| ID | Issue | Where | Evidence / failure |
|---|---|---|---|
| **K-01** ✔ | **Live DB load corrupts every product.** The browser seeds `commons_products` with the camelCase CSV `Product` objects, then reads them back through the snake_case `rowToProduct` (`amazon_price`, `health_score`, `ethical_score`…). Result: no store prices ("$9999.00 best price"), every score 50, grade C, no images. If the edge-function seed is what's in the DB instead, only 7 products exist, none with barcodes, so 44 products vanish and every scan is "not found". **The app only looks right when Supabase is unreachable.** | `App.tsx:65-84`, `1046-1063`, realtime `1081-1082` | Only `id/name/barcode/ingredients/keywords` survive the round trip (live?) |

### High

| ID | Issue | Where | Evidence / failure |
|---|---|---|---|
| **K-02** ▶✔ | **Ingredient matcher produces false HIGH-risk labels.** `alias.includes(key.split(" ")[0])` is a reverse-substring test, the 2-letter alias `"mi"` exists, and the first match wins. A replay over all 51 products gives **70 false HIGH labels on 31 products** (Seventh Generation shows "Sodium Nitrite"; milk/vitamin D3 and Tylenol "acetaMInophen" show Methylisothiazolinone). | `ProductDetailScreen.tsx:344`, `:61` | The app's core "Shop Healthier" claim is wrong for most products |
| **K-03** ▶✔ | **Ingredient parser splits chemical names.** "1,4-dioxane (trace)" becomes "1" + "4-dioxane"; "1" then matches **Blue 1 food dye** (seen live on Tide PODS). Parentheticals are stripped, so "pepperoni (… sodium nitrite)" hides nitrite, and `;` is not a separator. | `ProductDetailScreen.tsx:331-343` | ▶ Tide PODS detail |
| **K-04** ✔ | **Scan history very likely never saved.** `SERVER` = `/functions/v1/server/make-server-504b3bba`, but the Hono routes have no `basePath` and Supabase passes the slug in the path, so it 404s under either deploy name. No `Authorization`/`apikey` header is sent either (401 under the default `verify_jwt`). All errors are swallowed to `console.warn`. | `src/lib/supabase.ts:10`, `scanService.ts:134,145` | ▶ POST attempted on every scan; no UI feedback (live?) |
| **K-05** ✔ | **Map "My Location" empties the map for anyone more than 50 mi from downtown Chicago** (the radius filter applies whenever a location is known, and all 18 resources are in the Loop). There is no way to undo it. The owner is in California. | `MapTab.tsx:401-404` | Tap My Location → "0 resources" |
| **K-06** ✔ | **Map ignores the database.** It iterates its own 18 hardcoded `BASE_RESOURCES` and overlays only name/hours/phone/description **by id**. DB adds, deletes, address/type/coordinate changes never show, and a new DB resource (next id 13) overwrites the text of unrelated static pin 13. | `MapTab.tsx:389-393` | Undermines any CRUD or realtime demo |

### Medium

| ID | Issue | Where |
|---|---|---|
| ~~**K-07**~~ ✅ | **Fixed in `c9a7fde`.** `react`/`react-dom` were only optional peerDependencies, installed solely because unused packages peer-required them, so pruning unused deps would have dropped `react-dom`. Both are now regular `dependencies` (18.3.1). | `package.json` |
| **K-08** ▶✔ | "Healthier Alternatives" ignores category (potato chips → laundry detergent, cleaner, milk), and the rows can't be clicked. | `ProductDetailScreen.tsx:678-681`, `859` |
| **K-09** ▶✔ | Two different numbers are presented as "the score": lists show `safetyScore` (the health dimension) as `%`, detail shows `overallScore` (Tide 38% vs 35/100; Lay's 62% vs 54/100). The letter grade comes from **ethics only**, so 15/51 products show a grade that contradicts their overall score. | `App.tsx:78,491`; `scoring.ts` grade thresholds; `ProductDetailScreen.tsx:745` |
| **K-10** ✔ | A DB resource whose `type` isn't one of the 6 `CAT` keys crashes HomeTab (`cat.bg` of undefined), and with **no error boundary** the whole app goes blank. | `App.tsx:63,659-664`; `main.tsx` |
| **K-11** ✔ | The status banner says "Live" even when the seed write failed or RLS silently returned zero rows. "Offline — showing *cached* data" is inaccurate: it's bundled data, not a cache. | `App.tsx:1055-1064` |
| **K-12** ✔ | A scan waits on geolocation. The 4 s `timeout` doesn't cover the permission prompt, so the scanner can hang in "scanning". There is no try/finally, so any throw also leaves it stuck. | `ScanTab.tsx:107`; `scanService.ts:86,111` |
| **K-13** ✔ | The unknown-barcode screen always says "We've saved it for review", even when the POST failed. The `error` scan state is declared and never set. | `ScanTab.tsx:174,210` |
| **K-14** ✔ | The "Why Recommended?" modal is positioned inside the scrolling Home container, so for lower sections it opens off-screen. (Verifier-found; not runtime-checked.) | `App.tsx:543` |
| **K-15** ▶✔ | Today's Deals cards open unrelated products (the Seventh Gen. deal opens KIND bars), and "See all" searches the literal word "deals" → "No results". | `App.tsx:626-650` |
| **K-16** ▶✔ | Favorites and Scanned live only in React state, pre-seeded with fake ids `[3,5]`/`[2,6]`, and are lost on reload. Profile's "34 products scanned" and other stats are hardcoded and contradict the app's state. | `App.tsx:1024-1025`, `906` |
| **K-17** ✔ | Once the DB key is non-empty, edits to `products.csv` never reach users, contrary to the comment "To add or edit a product, update the CSV". | `App.tsx:56-59`, `1048-1063` |

### Low

| ID | Issue | Where |
|---|---|---|
| K-18 ✔ | Hardcoded explanation text contradicts the data: Diet Coke "No phosphoric acid" (it has it), Lay's "17% of daily sodium" (170 mg ≈ 7%), Oscar Mayer cites turkey (not in its list), an "Affordability score" that doesn't exist. | `ProductDetailScreen.tsx:98,241,261,285` |
| K-19 ▶✔ | Opening any sub-screen unmounts the active tab: Back from a search result lands on Home, and Saved resets to Favorites. | `App.tsx:1139,1174` |
| K-20 ✔ | Search: a leading space matches every product, brand is not searched, and short keywords over-match ("steak" contains "tea"). | `App.tsx:686-690` |
| K-21 ▶✔ | Dead controls: Sign In, all 5 Profile settings rows, Lists "New", Share, Map "Call", home Refresh (sticks on "Locating…" without geolocation). | `App.tsx:240,521,882,967`; `ProductDetailScreen.tsx:714`; `MapTab.tsx:260` |
| K-22 ✔ | Leaving the Scan tab mid-scan still yanks you into product detail about 3 s later, and a late placeholder POST can show a false "Scan saved at" on a later scan. | `ScanTab.tsx:114-124` |
| K-23 ✔ | Map details: the hours parser misreads "12–6pm" and "dawn–dusk"; open/closed uses the viewer's timezone and goes stale; "Smart Score" sort equals rating sort; the list shows 10 with no "more"; zoom-out and OSM attribution are covered by the sheet. | `MapTab.tsx:125-148,276-283,399-410,523-554` |
| K-24 ✔ | Importer edge cases: rows sharing an id merge silently; `'1'` and `'01'` become duplicate ids; quoted newlines drop the row; an empty FB condition gives `''`; the required `overall_score` column is ignored (5 rows differ); `flaggedIngredients` is always `[]`; 27/51 barcodes fail the UPC-A check digit (matters only for a real scanner). | `productImporter.ts:158,372,496,509,575,642` |
| K-25 ✔ | Floating-point rounding makes 58.5 → 58 (id 41 only). | `scoring.ts:68` |
| K-26 ✔ | Realtime handles UPDATE only (INSERT/DELETE and partners ignored, no subscribe-status check). The browser seed of a *missing* key is an INSERT, so other open clients never see it. An open product detail goes stale after an update. | `App.tsx:1074-1087` |
| K-27 ▶ | Icon-only buttons (back, save, share, search-QR, etc.) have no accessible names. | `ProductDetailScreen.tsx:707-714`, `App.tsx` |
| K-28 ▶ | The fixed 390×844 phone frame clips on narrow or short viewports (not responsive). | `App.tsx:1098-1100` |

### Maintainability (not bugs; fix opportunistically)

- About 150 lines of dead code in `App.tsx` (`CityMap`, `ScoreRing`, `ScoreBar` at 116–180; legacy `MapTab` at 748–834), unused imports (`SERVER`, several icons), dead `scanService` read helpers, and dead `scoring.ts` exports.
- Seed data is duplicated in **four divergent shapes**: `App.tsx` RESOURCES/DEFAULT_PARTNERS, server `DEFAULT_*` (7 snake_case products, no barcodes), `MapTab.tsx` BASE_RESOURCES (lat/lng, 18 items, 12 types vs 6), and the CSV (51 products).
- **53 of 59 runtime dependencies are unused.** 14 are imported nowhere (MUI, Emotion, react-router, motion, react-dnd, react-slick, canvas-confetti, masonry, popper, date-fns…); 39 are imported only by the 48 shadcn `ui/` files, and nothing imports those. Fix K-07 before pruning.
- pnpm leftovers (`pnpm-workspace.yaml` with a Linux-only `supportedArchitectures`, the package.json `pnpm` block) are ignored by npm and would break a pnpm install on Windows. Also: `globals.css` is empty, `default_shadcn_theme.css` is unreferenced, the `figma:asset` resolver points at a missing `src/assets`, and DM Mono is loaded but not wired to `font-mono`.
- **No stable product identity.** Depending on runtime state, the catalog is the CSV (ids 1–51), a browser-seeded DB copy (same ids), or the server seed (ids 1–7, different fields). Favorites, scanned ids, hardcoded explanations and scan events are all keyed by id, so they can silently point at different or missing products.
- There is no git repo and no `.gitignore`.
- The CSV row ids are coupled to the hardcoded explanations in `ProductDetailScreen.tsx` (ids 1–7).
- About 115 KB of inline data literals plus the raw CSV ship in the single eager chunk. Google Fonts loads via a render-blocking CSS `@import`.

### Future production: security and privacy (do **not** deploy publicly before these)

| ID | Issue | Where |
|---|---|---|
| S-01 ✔ | Every edge-function write route is **unauthenticated** and uses the **service-role** client (bypasses RLS). `POST /commons/seed` overwrites the whole catalog, and `GET /commons/seed` writes. The anon key is public in the bundle, so `verify_jwt` is no barrier. **Critical if the function is deployed and reachable.** | `index.tsx:56-157,170-189`; `kv_store.tsx:15-18` |
| S-02 ✔ | Second write path: the browser upserts `kv_store_504b3bba` with the anon key (works only if RLS is off or permissive). Securing the function alone won't close it. | `App.tsx:1055` |
| S-03 ✔ | Full-precision GPS is attached to every scan and served back unauthenticated (`GET /scan-history`, `/placeholders`). Worse, once scan saving works, the **unfiltered realtime subscription** (all UPDATEs on the KV table) would push each rewritten `scan_history` row, raw coordinates included, to every open browser. | `scanService.ts:181`; `index.tsx:162-167,219-239`; `App.tsx:1074-1080` |
| S-04 ✔ | CORS `*`; no body validation (the raw body is spread into records); a `'__proto__'` barcode pollutes the placeholder grouping; read-modify-write of whole arrays loses concurrent writes; `Math.max` ids go NaN; a bad `:id` still returns `{ok:true}`; no error handling; `scan_history` is one ever-growing row; Hono is unpinned. | `index.tsx` passim |
| S-05 | The RLS state and realtime publication are unknown, and there are no migrations in the repo. The previous session's security patch (`requireAuth`/`requireAdmin`, `ALLOWED_ORIGINS`, RLS migration, anonymous auth) is **absent** from this code. | — |

## 3. Roadmap: the next 5 changes by value

These are ordered by value per effort and consistent with "Path A: keep building the prototype". Each is small and behavior-preserving outside its target.

0. ✅ **Safety net: done 2026-09-23.** Git repo on `main`: `63eef63` is the untouched Figma baseline (restore with `git checkout 63eef63 -- <file>`), `e9aa5a8` adds the docs, and `c9a7fde` moves react/react-dom into `dependencies` (K-07).
1. ✅ **Backend: resolved 2026-09-23 by starting fresh.** The Figma project `ipcbqjrceyqleuaufier` is in a Supabase account the owner can't access, and it held only prototype data, so it is **retired**. The new project is **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free plan) in the owner's org. It is empty: no tables, no functions, no advisor warnings. **The code still points at the old project** (`utils/supabase/info.tsx`), so the app runs in offline mode until step 2 switches it over.
2. **Fix K-01: make "live" mode show the real catalog.** Pick the CSV `Product` shape as canonical, make the product mapper pass camelCase rows through (or stop mapping products), and retire the server's 7-row `DEFAULT_PRODUCTS`. Then fix the `SERVER` path and send the anon key header (K-04) so scan history actually persists. Together these make the capstone's "frontend ↔ backend ↔ realtime" demo real instead of accidental.
3. **Make ingredient analysis trustworthy (K-02, K-03).** Use whole-token alias matching, drop the 2-letter aliases, stop splitting inside names like `1,4-`, handle `;` and parenthetical sub-ingredients, and leave behind one assert-based check that no product gets a false HIGH label. This is the app's headline feature.
4. **Quick UX batch (each is a few lines).** Filter alternatives by category and make them clickable (K-08); show one consistent score in lists and detail (K-09); don't let the radius filter empty the map outside Chicago (K-05); guard `CAT[type]` and add a root error boundary (K-10); make the banner honest (K-11); fix "See all"/deals (K-15).
5. **Persist favorites and scanned items** (localStorage for now, K-16), so the Saved tab survives a reload. Move to real tables when the schema is redesigned.

**Later, in this order:** delete dead code and prune deps; extract `App.tsx` pieces (`useCatalog`, Home, Saved, Profile) one commit at a time. Then the **normalized schema**, which is an explicit requirement in the owner's own capstone brief (`src/imports/pasted_text/project-guidelines.md`), so it is planned, not speculative. Then security (S-01…S-05), then final docs.

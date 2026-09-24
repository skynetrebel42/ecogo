# EcoGo! — Known issues, baseline and roadmap

> Verified 2026-09-23. Every item below was either **reproduced in the running app (▶)** or found by a code
> reader and then **independently confirmed by an adversarial verifier (✔)**. Items marked **(live?)**
> depend on the Supabase project's real state, which this audit could not inspect. Line numbers refer to the
> unmodified Figma export. Architecture context: [ARCHITECTURE.md](ARCHITECTURE.md).
>
> **Update, step 2 (2026-09-23):** the app now runs on normalized tables in the owner's own Supabase project.
> **K-01 and K-04 are fixed; S-01, S-02, S-03 and S-05 are resolved,** all verified in the live app. Fixed items are
> struck through below and kept for history.

## 1. Baseline (before any change)

| Check | Result |
|---|---|
| `npm install` | Already done (Sep 18); `node_modules` consistent with `package-lock.json`. Node 24.21.0 / npm 11.19.0 |
| `npm run build` | ✅ passes in about 17 s. One 780 KB JS chunk (220 KB gzip) triggers Vite's >500 KB warning; CSS 126 KB |
| Typecheck | No script and no TypeScript installed. A throwaway strict `tsc` run (outside the repo) finds **6 errors**, all minor: missing `@types/react-dom`, `Array.at` needs lib ES2022, 3 implicit `any` in `ProductDetailScreen.tsx:690/736/831`. Non-strict: 1 |
| Lint / tests | None exist |
| `npm run dev` | ✅ Serves at `http://localhost:5173` (5174 in the audit's offline config) |
| Runtime, offline (Supabase stubbed) | ✅ All 5 tabs render. Banner "Offline — showing cached data". Console: `[productImporter] Successfully loaded 51 product(s). 0 row(s) skipped.` The realtime websocket retries forever (expected offline). No React errors |
| Runtime, live Supabase | ⛔ Not run against the Figma project (inaccessible). **After step 2:** ✅ verified live against `ecogo`. The banner shows "Live data"; all 51 products are identical to the CSV version; a scan row was saved; realtime updated a price in about 3 s; no console errors |
| Env vars | Originally none (hardcoded in `utils/supabase/info.tsx`). **After step 2:** `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` |
| After step 2 | Build ✅ (777 KB JS, slightly smaller); strict typecheck still the same 6 pre-existing errors, none from new code |

## 2. Prioritized bug list

### Critical: functional

| ID | Issue | Where | Evidence / failure |
|---|---|---|---|
| ~~**K-01**~~ ✅ | **Fixed in `6e64e7d` (step 2).** Products now come from normalized tables through `src/lib/catalog.ts`, which builds the exact `Product` shape; it is verified deep-equal to the CSV catalog for all 51 products. *Original issue:* **Live DB load corrupts every product.** The browser seeds `commons_products` with the camelCase CSV `Product` objects, then reads them back through the snake_case `rowToProduct` (`amazon_price`, `health_score`, `ethical_score`…). Result: no store prices ("$9999.00 best price"), every score 50, grade C, no images. If the edge-function seed is what's in the DB instead, only 7 products exist, none with barcodes, so 44 products vanish and every scan is "not found". **The app only looks right when Supabase is unreachable.** | `App.tsx:65-84`, `1046-1063`, realtime `1081-1082` | Only `id/name/barcode/ingredients/keywords` survive the round trip (live?) |

### High

| ID | Issue | Where | Evidence / failure |
|---|---|---|---|
| **K-02** ▶✔ | **Ingredient matcher produces false HIGH-risk labels.** `alias.includes(key.split(" ")[0])` is a reverse-substring test, the 2-letter alias `"mi"` exists, and the first match wins. A replay over all 51 products gives **70 false HIGH labels on 31 products** (Seventh Generation shows "Sodium Nitrite"; milk/vitamin D3 and Tylenol "acetaMInophen" show Methylisothiazolinone). | `ProductDetailScreen.tsx:344`, `:61` | The app's core "Shop Healthier" claim is wrong for most products |
| **K-03** ▶✔ | **Ingredient parser splits chemical names.** "1,4-dioxane (trace)" becomes "1" + "4-dioxane"; "1" then matches **Blue 1 food dye** (seen live on Tide PODS). Parentheticals are stripped, so "pepperoni (… sodium nitrite)" hides nitrite, and `;` is not a separator. | `ProductDetailScreen.tsx:331-343` | ▶ Tide PODS detail |
| ~~**K-04**~~ ✅ | **Fixed in `6e64e7d` (step 2).** Scans now `INSERT` straight into `scan_events` (verified: row saved). The edge function is gone. *Original issue:* **Scan history very likely never saved.** `SERVER` = `/functions/v1/server/make-server-504b3bba`, but the Hono routes have no `basePath` and Supabase passes the slug in the path, so it 404s under either deploy name. No `Authorization`/`apikey` header is sent either (401 under the default `verify_jwt`). All errors are swallowed to `console.warn`. | `src/lib/supabase.ts:10`, `scanService.ts:134,145` | ▶ POST attempted on every scan; no UI feedback (live?) |
| **K-05** ✔ | **Map "My Location" empties the map for anyone more than 50 mi from downtown Chicago** (the radius filter applies whenever a location is known, and all 18 resources are in the Loop). There is no way to undo it. The owner is in California. | `MapTab.tsx:401-404` | Tap My Location → "0 resources" |
| **K-06** ✔ | **Map ignores the database.** It iterates its own 18 hardcoded `BASE_RESOURCES` and overlays only name/hours/phone/description **by id**. DB adds, deletes, address/type/coordinate changes never show, and a new DB resource (next id 13) overwrites the text of unrelated static pin 13. | `MapTab.tsx:389-393` | Undermines any CRUD or realtime demo |

### Medium

| ID | Issue | Where |
|---|---|---|
| ~~**K-07**~~ ✅ | **Fixed in `c9a7fde`.** `react`/`react-dom` were only optional peerDependencies, installed solely because unused packages peer-required them, so pruning unused deps would have dropped `react-dom`. Both are now regular `dependencies` (18.3.1). | `package.json` |
| **K-08** ▶✔ | "Healthier Alternatives" ignores category (potato chips → laundry detergent, cleaner, milk), and the rows can't be clicked. | `ProductDetailScreen.tsx:678-681`, `859` |
| **K-09** ▶✔ | Two different numbers are presented as "the score": lists show `safetyScore` (the health dimension) as `%`, detail shows `overallScore` (Tide 38% vs 35/100; Lay's 62% vs 54/100). The letter grade comes from **ethics only**, so 15/51 products show a grade that contradicts their overall score. | `App.tsx:78,491`; `scoring.ts` grade thresholds; `ProductDetailScreen.tsx:745` |
| **K-10** ✔ | A DB resource whose `type` isn't one of the 6 `CAT` keys crashes HomeTab (`cat.bg` of undefined), and with **no error boundary** the whole app goes blank. Still latent after step 2: the `resources` table allows the Map's 12 types, and Home shows the first 5 by id (currently all within App's 6). | `App.tsx` `rowToResource`, `HomeTab`; `main.tsx` |
| **K-11** ✔ | *Partly fixed in step 2:* "Live" now appears only when catalog rows actually arrive (an empty result counts as offline). **Remaining:** "Offline — showing *cached* data" is inaccurate, because it's bundled data, not a cache. | `App.tsx` offline banner |
| **K-12** ✔ | A scan waits on geolocation. The 4 s `timeout` doesn't cover the permission prompt, so the scanner can hang in "scanning". There is no try/finally, so any throw also leaves it stuck. | `ScanTab.tsx:107`; `scanService.ts:86,111` |
| **K-13** ✔ | The unknown-barcode screen always says "We've saved it for review", even when the insert failed. The `error` scan state is declared and never set. | `ScanTab.tsx:174,210` |
| **K-14** ✔ | The "Why Recommended?" modal is positioned inside the scrolling Home container, so for lower sections it opens off-screen. (Verifier-found; not runtime-checked.) | `App.tsx:543` |
| **K-15** ▶✔ | Today's Deals cards open unrelated products (the Seventh Gen. deal opens KIND bars), and "See all" searches the literal word "deals" → "No results". | `App.tsx:626-650` |
| **K-16** ▶✔ | Favorites and Scanned live only in React state, pre-seeded with fake ids `[3,5]`/`[2,6]`, and are lost on reload. Profile's "34 products scanned" and other stats are hardcoded and contradict the app's state. | `App.tsx:1024-1025`, `906` |
| **K-17** ✔ | *Reframed by step 2 (now by design):* the database is the source of truth, and `products.csv` is only the offline fallback and seed source. Editing the CSV changes offline mode but **not** the live catalog. Change products in the Supabase dashboard or with a new migration, and keep the CSV in sync if the offline view matters. | `src/lib/catalog.ts`, `App.tsx` `PRODUCTS` |

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
| K-26 ✔ | *Mostly fixed in step 2:* realtime now re-fetches on INSERT/UPDATE/DELETE of products, prices and resources. **Remaining:** an open product detail keeps its snapshot until reopened; no subscribe-status check; overlapping re-fetches could resolve out of order (harmless at this scale). | `App.tsx` realtime effect |
| K-27 ▶ | Icon-only buttons (back, save, share, search-QR, etc.) have no accessible names. | `ProductDetailScreen.tsx:707-714`, `App.tsx` |
| K-28 ▶ | The fixed 390×844 phone frame clips on narrow or short viewports (not responsive). | `App.tsx:1098-1100` |

### Maintainability (not bugs; fix opportunistically)

- About 150 lines of dead code in `App.tsx` (`CityMap`, `ScoreRing`, `ScoreBar` at 86–150; legacy `MapTab` at 718–806), several unused icon imports, and dead `scoring.ts` exports. (The dead `scanService` read helpers and the unused `SERVER` import were removed in step 2.)
- Fallback data still lives in code next to the database: `App.tsx` RESOURCES (12, x/y), `MapTab.tsx` BASE_RESOURCES (18, lat/lng, drawn on the map), and the CSV (51 products). The DB now holds the canonical copy of all of it (step 2 retired the server's `DEFAULT_*` and `DEFAULT_PARTNERS`). Making the map read DB coordinates (K-06) would retire BASE_RESOURCES.
- **53 of 59 runtime dependencies are unused.** 14 are imported nowhere (MUI, Emotion, react-router, motion, react-dnd, react-slick, canvas-confetti, masonry, popper, date-fns…); 39 are imported only by the 48 shadcn `ui/` files, and nothing imports those. K-07 is fixed, so pruning is now safe.
- pnpm leftovers (`pnpm-workspace.yaml` with a Linux-only `supportedArchitectures`, the package.json `pnpm` block) are ignored by npm and would break a pnpm install on Windows. Also: `globals.css` is empty, `default_shadcn_theme.css` is unreferenced, the `figma:asset` resolver points at a missing `src/assets`, and DM Mono is loaded but not wired to `font-mono`.
- ~~No stable product identity~~ *(resolved in step 2: the DB and the CSV share ids 1–51, and the incompatible 7-row server seed is gone).*
- ~~No git repo / `.gitignore`~~ *(resolved in step 0).*
- Product ids are coupled to the hardcoded explanations in `ProductDetailScreen.tsx` (ids 1–7), so don't renumber products.
- About 115 KB of inline data literals plus the raw CSV ship in the single eager chunk. Google Fonts loads via a render-blocking CSS `@import`.

### Future production: security and privacy (do **not** deploy publicly before these)

| ID | Issue | Where |
|---|---|---|
| ~~S-01~~ ✅ | **Resolved in step 2:** the unauthenticated, service-role edge function was deleted and is not deployed to the new project. *Was:* every edge-function write route unauthenticated, including a public catalog reset. | (deleted) |
| ~~S-02~~ ✅ | **Resolved in step 2:** browsers can no longer write the catalog. They have `SELECT` only, and `UPDATE`/`DELETE` were verified to return `42501`. *Was:* the browser upserted the KV table with the anon key. | `supabase/migrations/…_catalog_schema.sql` |
| ~~S-03~~ ✅ | **Resolved in step 2:** coordinates are rounded to 3 decimals (~100 m) before sending; clients can only `INSERT` scans and can't read them (verified `42501`); `scan_events` is not in the realtime publication. *Was:* full-precision GPS served back publicly. | `scanService.ts`; migration |
| S-04 | *Mostly moot:* the edge-function problems (CORS `*`, spread bodies, prototype pollution, read-modify-write) left with the function. **Remaining:** anyone holding the public key can insert unlimited `scan_events` rows (they're shape-checked by column grants and `CHECK`s, but not rate-limited). Add rate limiting or auth before a public launch. | migration `scan_events` |
| ~~S-05~~ ✅ | **Resolved in step 2:** RLS is on for every table, the grants are explicit, the realtime publication is known, and migrations live in the repo. The security advisor is clean. (The previous session's sandbox patch was never used; the new design supersedes it.) | `supabase/migrations/` |
| S-06 | No user accounts yet: favorites and scans are anonymous. Adding Supabase Auth (anonymous sign-in or email) is the prerequisite for per-user favorites/history and for tightening the scan insert policy. | — |

## 3. Roadmap

Re-prioritized 2026-09-23 around the **owner's goals** (PROJECT_HANDOFF.md → "Owner goals"). Prototype **done** means:
**(1)** scan a real product with a phone camera → product page, and **(2)** a trustworthy safety score. Free tier only;
food and drinks first. Each step is small and verified in the running app before moving on.

0. ✅ **Safety net: done 2026-09-23.** Git repo on `main`: `63eef63` is the untouched Figma baseline (restore with `git checkout 63eef63 -- <file>`), `e9aa5a8` adds the docs, and `c9a7fde` moves react/react-dom into `dependencies` (K-07).
1. ✅ **Backend: resolved 2026-09-23 by starting fresh.** The Figma project `ipcbqjrceyqleuaufier` is in a Supabase account the owner can't access, and it held only prototype data, so it is **retired**. The new project is **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free plan) in the owner's org.
2. ✅ **Normalized database + live mode: done 2026-09-23** (`ed97a90`, `6e64e7d`). Five tables (categories, products, product_prices, resources, scan_events) with constraints, timestamps, RLS, explicit grants and realtime. The app reads them through `src/lib/catalog.ts` and saves scans to `scan_events`. Fixes K-01 and K-04, and resolves S-01/S-02/S-03/S-05. All of it was verified in the live app.
3. **Trustworthy safety analysis (done-criterion 2).** Fix the ingredient parser and matcher (K-02, K-03): whole-word
   matching, no 2-letter aliases, don't split names like `1,4-dioxane`, handle `;` and sub-ingredients in parentheses.
   Then **compute the safety score from the ingredients** with transparent rules, so any product with an ingredient
   list can be scored. Show one consistent score in lists and detail (K-09). Rename the "AI Evaluation Summary" /
   "SmartScore™" labels (no AI claims). Leave behind one committed check that no product gets a false high-risk label.
   *Open design point for this step:* how the computed safety score relates to the curated products' hand-entered
   environment/ethics/transparency scores.
4. **Open Food Facts lookup.** Any barcode not in the 51 featured products is fetched from Open Food Facts (free,
   no key, food) and scored by the same engine; not-found barcodes still go to the review queue. This is testable before
   the camera exists, using the demo barcode picker.
5. **Deploy + public repo.** Create a public GitHub repo and free hosting (e.g. Vercel/Netlify). This gives the HTTPS a
   phone needs to open the camera, so step 6 can be tested on a real phone.
6. **Real camera scanning + mobile layout (done-criterion 1).** Use a JS barcode library that works on iPhone Safari,
   Android and webcams, keeping the demo picker as a fallback. Make the app full-screen on phones, with the frame on
   desktop only (K-28). Drop location from scans (decision 014) and fix the scan-flow bugs found along the way (K-12, K-13, K-22).

**Later (after "done"):**
- Map: follow the user's location, with Los Angeles as the default, and real nearby places from OpenStreetMap. This also
  fixes K-05 and K-06, and retires the fictional Chicago data. Switching only the center would leave today's 18
  Chicago pins off-screen, so it's one step.
- Persist favorites (K-16); search improvements (K-20); a quick UX batch (K-08, K-10, K-11, K-15).
- Delete dead code and prune unused deps; extract `App.tsx` pieces one commit at a time.
- Before going public: accounts (S-06), scan rate limiting (S-04), final docs.

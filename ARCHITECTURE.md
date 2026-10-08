# EcoGo! — Architecture (verified)

> **Verified 2026-09-23.** The original audit read every non-shadcn source file, ran the build and a typecheck, and
> clicked through the app offline. After step 2 (normalized database) the app was re-verified **live** against the
> owner's Supabase project. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for bugs and [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)
> for status and decisions.

## 1. What the app does today

EcoGo! is a **single-screen phone mock-up** (a fixed 390×844 frame centred on a desktop page) built by
Figma Make. After a one-time welcome screen (first visit on this device) it has five tabs (Home, Map, Scan, Saved, Profile;
the Map came back with real places in M9):

| Tab | Reality |
|---|---|
| **Home** | Real content only (M7): a time-based greeting, a Scan card, product search, "Recently scanned" (last 10 products opened, on this device, `lib/recent.ts`; shown only when it has products) and "Learn" (M12): six coloured tiles, two per row, that open the explainer pages and "How EcoGo checks a product" (`Explainer.tsx`). |
| **Map** | "Map near me" (M13, layout A): a ZIP box (looked up in a table inside the app, `lib/nearMe.ts`, never sent) and My location (asked only on tap, never stored or sent), radius chips 5/10/15/20 mi, the map with the search circle, then the list nearest first with distances ("N places within R mi of 90017"); before a ZIP, all of LA County A–Z. Places: an OpenStreetMap snapshot in `resources` (183, OSM data as of 2026-10-07: free food incl. community fridges, farmers markets, named community gardens; students-only pantries left out) plus LA County Public Health's free-food sites (static file, 191 after a 100 m dedup against OSM; marked * with their May 2023 age). Credited and dated, no ratings or open/closed. Cards: hours in plain words, Call / Website / Directions (Google Maps, the place's position only), "Fix it on OSM", "Report a problem" (an OSM note; County sites by email to the owner); "Missing a place? Add it on OpenStreetMap" under the list. No connection → "Places need a connection", never fake places. |
| **Scan** | **Camera.** The Scan tab opens the back camera and reads EAN/UPC barcodes on the device (`CameraScanner`, `lib/barcodeReader.ts`: native BarcodeDetector or bundled ZXing WebAssembly; a code counts after two identical reads). Typing a barcode or a demo barcode does the same. The barcode is matched against the catalog, then looked up in **USDA FoodData Central** and then **Open Food Facts** (`lib/lookup.ts`). Frames never leave the device; scans are **not saved** (M3), and scanning never asks for location. |
| **Saved** | Favorites (React state only, start empty, lost on reload, K-16; a looked-up product shows here however it was opened) and Scanned (the same recent list as Home, kept on this device). The static "Lists" tab is gone (M7.4). |
| **Profile** | Only true things (M7.2): a Display card (M11: text size Normal/Large/Larger and a High contrast switch, kept on this device, `lib/settings.ts`), then three rows that expand (closed by default): your data on this device (Recently scanned count with Clear; a favorites note), where results come from, what leaves the phone (privacy); and the source-code link. No account, name or stats. |

The product catalog is **51 products in the Supabase `products` table**, seeded from `src/data/products.csv`. The
CSV is still bundled and shown until the database answers, or instead of it when Supabase is unreachable (offline
fallback). The product detail screen shows an **ingredient safety verdict** computed by the safety engine
(`src/lib/safety`, M1): the ingredient list is parsed and matched whole-word against a 17-entry library in which every
entry cites an official source (IARC, EU, FDA) with a verbatim quote. Flagged ingredients are listed with their sources
and highlighted in the full ingredient text. The page also shows same-category alternatives with fewer concerns. No
prices are shown anywhere (they were invented, K-30; the data stays in the database, M7.4). There are no AI or
"SmartScore™" claims; the old hand-written score text was deleted.

## 2. Stack and tooling

| Item | Value |
|---|---|
| Runtime | Node 24.21.0, npm 11.19.0 (`package-lock.json`) |
| Frontend | React 18.3.1, Vite 6.3.5, Tailwind 4.1.12 via `@tailwindcss/vite`, lucide-react. 10 runtime dependencies (M0 removed 53 unused ones and the shadcn/ui kit; tw-animate-css went in the 2026-10-02 cleanup; M8 added tesseract.js 7 and its English data, self-hosted) |
| Map | leaflet 1.9.4 + leaflet.markercluster 1.5.3 (used directly, no react-leaflet). Back in the bundle with the Map (M9) |
| Backend | Supabase project **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free plan): Postgres + PostgREST + Realtime, reached from the browser with `@supabase/supabase-js` 2.116.0. One Edge Function since M8: `off-submit` (sends added products to Open Food Facts, writes `contributions`); the M7.5 `usda-relay` is retired (decision 034). Auth: anonymous sign-ins with Turnstile CAPTCHA, only at an add-product Send. |
| Config | `.env` (committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public by design). No key is needed to run or build the app. The owner's gitignored `.env.local` holds `SUPABASE_SERVICE_ROLE_KEY`, only for loading the USDA copy (`npm run import:usda`); no chat reads it. |
| Barcode / camera | **None** |
| Types / lint / tests | Tests: Node's built-in `node --test` with native TypeScript type stripping (no test framework). No TypeScript package, tsconfig or ESLint |
| Scripts | `npm run dev` (vite), `npm run build` (vite build), `npm test` (everything under `src/lib/**` and `supabase/functions/**`: safety engine, 51-product check, lookup client, M8 units), `predev`/`prebuild` run `scripts/copy-ocr.mjs` (label reader into `public/tesseract/`, not committed), `npm run verify:sources` (re-fetches every library source and checks its quote; needs internet) |

## 3. System diagram

```
                       Browser (React SPA, one phone-frame page)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ main.tsx → App.tsx (state, navigation, Home/Search/Saved/Profile inline)     │
 │   ├─ loadData() ── lib/catalog.ts ──┐        (MapTab.tsx: hidden, M7.4)      │
 │   ├─ ScanTab.tsx ─ lib/lookup.ts (our `foods` table → Open Food Facts)       │
 │   └─ ProductDetailScreen.tsx           │   lib/safety/* (concern level)      │
 │ productImporter.ts ◄─ products.csv (bundled) ─► initial / offline catalog    │
 └──────────┬─────────────────────────────┬──┼──────────────────────────────────┘
            │ (1) SELECT products,        │  │ (3) no writes: scans aren't saved (M3)
            │     categories,             │  │
            │     resources               │  │
            │ (2) No realtime since the 2026-10-02 audit: one load per visit
            │     → App re-runs loadData()│  │
            ▼                             ▼  ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Supabase "ecogo"  (publishable key; access = explicit GRANTs + RLS)          │
 │   categories 1─* products 1─* product_prices      resources                  │
 │                     └─* scan_events (no longer written; service role only)   │
 └──────────────────────────────────────────────────────────────────────────────┘
```

## 4. File map and edit policy

| Path | Lines | Role | Policy |
|---|---:|---|---|
| `src/app/App.tsx` | 599 | Shell: all state, navigation, Home/Search/Saved/Profile, catalog load (once per visit) | SAFE TO EDIT (carefully; see §5) |
| `src/app/components/ProductDetailScreen.tsx` | 280 | Product page: concern badge, findings grouped by origin (ingredients / the food itself / formed when cooked) with sources, nutrition, highlighted ingredient list, alternatives (no prices since M7.4) | SAFE TO EDIT |
| `src/app/components/verdict.tsx` | 63 | Concern-level look (one darkening hue, filled-circle icons, no green; `solid` = the gradient's darkest stop for high contrast), `safeAnalyze` (never throws), headline text, 🔥 marker; shared by the product page and lists | SAFE TO EDIT |
| `src/lib/foodIcon.ts` | 89 | Pure: `foodIcon(product)` = one emoji from the category (catalog, then USDA, then the most specific Open Food Facts tag; else 🛒), an ordered table of patterns tuned on all 351 USDA categories (99.9%+ of products get an icon); decorative only; tested by `foodIcon.test.ts` | SAFE TO EDIT (rule order matters; keep the coverage test green) |
| `src/lib/settings.ts` | 47 | Text size and high contrast (M11): `loadSettings`/`saveSettings` around `localStorage["ecogo.settings.v1"]` that never throw, first high-contrast value from `prefers-contrast: more`, `applySettings` sets `data-text-size`/`data-contrast` on `<html>` (`main.tsx` runs it before the first render); `theme.css` reads them; tested by `settings.test.ts` and `themeContrast.test.ts` (AA/AAA ratios read from `theme.css`) | SAFE TO EDIT |
| `src/lib/safety/*` | 568 + tests | Safety engine: verified library, parser, analyzer; tested by `npm test` | SAFE TO EDIT (library changes must pass `npm run verify:sources` and `npm test`) |
| `src/lib/safety/foodConcerns.ts` | 164 | Food-level concerns with sources: processed meat (IARC Group 1, raises the level) and the acrylamide marker (EU 2017/2158 food types, never sets a level) | SAFE TO EDIT (source changes must pass `npm run verify:sources`) |
| `src/lib/safety/assess.ts` | 24 | Concern level = strongest of the additive check and food-level concerns; non-food stays non-food | SAFE TO EDIT |
| `src/lib/safety/fixtures/expected-flags.json` | — | Hand-reviewed flags per product id; `catalog.test.ts` checks every product in `products.csv` against it | Review, never loosen |
| `src/app/components/MapTab.tsx` | 389 | The Map (M9, layout A in M13): ZIP box, My location, radius chips, Leaflet + clusters with the search circle (zooms to fit), the list nearest first or a place card with Back, three type chips, D10/D12 OSM links, credits for OSM and the County | SAFE TO EDIT |
| `src/lib/osmPlaces.ts` | 190 | Pure: OSM element → `resources` row (`toPlace`; `food_sharing` is free food, `studentsOnly` pantries are skipped), hours in plain words (`formatHours`, unknown patterns kept as written), address, LA box and `milesFromLaBox`, sorting, OSM / edit / note / directions links; tested by `osmPlaces.test.ts` | SAFE TO EDIT |
| `src/lib/nearMe.ts` | 74 | Pure, "Map near me" (M13): `zipPoint` (the ZIP table), `withinMiles` (nearest first, with miles), `RADII`; the County sites: `titleCase` (acronyms kept), `countyPlaces` (negative ids, 100 m dedup against OSM free food, hidden list), `countyReportMailto` and `REPORT_EMAIL` (the owner's address, D12); tested by `nearMe.test.ts` | SAFE TO EDIT (`REPORT_EMAIL` only ever the owner's address) |
| `src/lib/data/zcta-la.json` | — | The ZIP table: 477 Census 2026 ZCTA internal points within 20 mi of LA County (13 KB), built by `scripts/build-zcta-la.mjs` from the Census Gazetteer file (public domain) | Rebuild, don't hand-edit |
| `src/lib/data/county-food-sites.json`, `county-hidden.json` | — | LA County Public Health's "Charitable Food Distribution Sites" (220, as the County publishes them, layer last edited 2024-04-23; from 211LA food resources, May 2023; decision 041), fetched by `scripts/fetch-county-food-sites.mjs`; the owner's hidden list of checked, closed sites (starts empty, D13) | Refetch, don't hand-edit the sites; the owner edits the hidden list |
| `scripts/fetch-osm-places.mjs` | 59 | Hand-run snapshot: Overpass query (LA County boundary; food banks, food sharing, farmers markets, community gardens) or a saved response (`--save` keeps one) → migration SQL replacing every `resources` row | SAFE TO EDIT (the output is a new migration; never edit an applied one) |
| `src/app/components/ScanTab.tsx` | 219 | Camera scanner, type-a-barcode, catalog → lookup, not-found (Add this product) and error states; drawer's "No barcode? Check ingredients" | SAFE TO EDIT |
| `src/app/components/AddProductFlow.tsx` | 214 | M8: add a not-found product to Open Food Facts, one step per screen (photos, read + check ingredients, Send) | SAFE TO EDIT |
| `src/app/components/IngredientCheck.tsx` | 158 | M8: no-barcode check (nothing saved or sent); exports `IngredientEditor` (check box + live badge) and `PhotoButtons` | SAFE TO EDIT |
| `src/lib/catalog.ts` | 103 | **Database read layer**: `loadCatalog()` plus the row → `Product` mapper | SAFE TO EDIT |
| `src/lib/productImporter.ts` | 76 | `parseProductsCSV(text)` → `Product[]` (first row per id; no price fields since the 2026-10-02 cleanup) and `splitCSVLine`; defines the canonical `Product` and `ProductSource` types. App.tsx feeds it the bundled CSV (`?raw`); tests and `scripts/apply-verified-barcodes.mjs` read the file directly | SAFE TO EDIT (keep it import-free so Node tests can load it) |
| `src/lib/lookup.ts` | 143 | Barcode lookup outside the catalog: EcoGo's `foods` table (USDA Branded Foods copy) first, then Open Food Facts live; pure mappers plus a session-cached `lookupBarcode()` that attaches nutrition; `knownNutrition()` reads nutrition already fetched this session | SAFE TO EDIT |
| `src/lib/foods.ts` | 70 | The `foods` table's row shape, row → `Product`, the search query builder and the `FoodsSource` interface the app reads it through (adapters: `foodsDb.ts` for Supabase, `foodsFake.ts` for tests) | SAFE TO EDIT |
| `src/lib/foodsImport.ts` + `scripts/import-usda.mjs` | 101 + 83 | The owner's loader: USDA's Branded Foods JSON zip → one row per barcode, scored by the app's own engine (`ENGINE_REV`), older snapshots removed in batches | EDIT WITH CAUTION (writes the live table) |
| `src/app/components/useAlternatives.ts` | — | Alternatives: other products in the same USDA category with a strictly better badge, from `alternatives_for` | SAFE TO EDIT |
| `src/lib/scanner.ts` | 38 | Pure scan logic: grocery formats, `normalizeScanned` (digits; UPC-E → UPC-A), `confirmReads` (two identical reads in a row) | SAFE TO EDIT |
| `src/lib/recent.ts` | 49 | "Recently scanned": `addRecent` (newest first, no duplicates, 10 max), `resolveRecent` (catalog ids re-read, looked-up snapshots kept), `parseRecent`, and `loadRecent`/`saveRecent` around `localStorage["ecogo.recent.v1"]` that never throw | SAFE TO EDIT |
| `src/app/components/Explainer.tsx` | — | Home's Learn pages (6: "Nothing flagged" isn't "healthy", badge levels, seed oils, pesticides, ultra-processed foods, How EcoGo checks a product): `EXPLAINERS` (title, short tile `label`, `tile` colour at 7:1+ with white text, `Icon`, sources; Home's tiles read it, in its order), `ExplainerId`, plain text over official sources only (each with its verbatim quote and "Source checked" date; the M7.1 sources are `Cite` constants in the file). "How EcoGo checks" describes the app, so it has no Sources section; `themeContrast.test.ts` checks the tile colours | SAFE TO EDIT (text must match its sources word for word) |
| `src/lib/barcodeReader.ts` | 25 | `createDetector()`: the native BarcodeDetector when it reads all four grocery formats, else the `barcode-detector` ponyfill with ZXing's `.wasm` bundled by Vite (no CDN) | SAFE TO EDIT |
| `src/app/components/CameraScanner.tsx` | 151 | Live back-camera screen: detect loop, torch, denied/unsupported/paused states, drawer for typing; stops the camera on ✕, unmount and page hide | SAFE TO EDIT |
| `src/lib/nutrition.ts` | 111 | Added sugar, saturated fat and sodium per serving as FDA %DV with FDA's 5/20 rule, from `foods` rows (per 100 g) and OFF `nutriments`; pure | SAFE TO EDIT |
| `src/app/components/NutritionPanel.tsx` | 85 | Nutrition section, `useNutrition` (catalog foods look up nutrition once per session by their verified barcode) and the slate "High …" chip | SAFE TO EDIT |
| `src/data/verified-barcodes.json` | — | Source of truth for catalog food barcodes: each USDA record's barcode, fdcId, name and full label (owner-approved 2026-10-01), plus the removed ones | Review; change only with a USDA match, then rerun the applier and add a migration |
| `scripts/apply-verified-barcodes.mjs` | 58 | Applies `verified-barcodes.json` to `products.csv` and prints the matching SQL migration | SAFE TO EDIT |
| `src/lib/fixtures/{usda,off}/*.json` | — | Recorded real API responses (trimmed) for `lookup.test.ts` | Re-record, don't hand-edit |
| `src/lib/supabase.ts` | 8 | Browser client from `.env` | SAFE TO EDIT |
| `src/lib/ocr.ts`, `photo.ts` | 58, 27 | M8: read a label on the phone (Tesseract.js, lazy, self-hosted); prepare photos (≤ 2000 px JPEG, OFF minimum) | SAFE TO EDIT |
| `src/lib/contribute.ts`, `turnstile.ts` | 58, 43 | M8: anonymous sign-in at the first Send (Turnstile token) and invoking `off-submit`; the client is passed in for tests | EDIT WITH CAUTION (the browser's only Supabase writes) |
| `supabase/functions/off-submit/` | 105 + 51 | M8 Edge Function: verify caller, limits (10/ID, 200/day), log, call OFF (`off.ts` pure, node-tested). Deployed via the Supabase MCP, verify_jwt off (checks the JWT itself) | EDIT WITH CAUTION (redeploy after edits; secrets OFF_*) |
| `src/data/products.csv` | 113 | Seed source and offline fallback (112 rows → 51 products) | SAFE TO EDIT (DB won't change; see K-17) |
| `supabase/migrations/*.sql` | — | Schema and seed; file names match the project's migration history | **Add new migrations; never edit applied ones** |
| `.env` | 6 | Public Supabase URL + publishable key | SAFE TO EDIT (no secrets) |
| `vite.config.ts` | 7 | React + Tailwind plugins | EDIT WITH CAUTION |
| `src/styles/*.css` | — | Tailwind entry, theme tokens, Google Fonts | EDIT WITH CAUTION |
| `scripts/verify-sources.mjs` | — | Library source check (`npm run verify:sources`) | SAFE TO EDIT |
| `.github/workflows/deploy.yml` | — | On every push to `main`: `npm ci`, `npm test`, build (with the public `VITE_TURNSTILE_SITE_KEY` repository variable), deploy `dist/` to GitHub Pages | EDIT WITH CAUTION (every push publishes) |
| `.github/workflows/keep-alive.yml` | — | Mondays: reads one `foods` row so the free Supabase project isn't paused for inactivity (a workaround: GitHub stops scheduled workflows after 60 idle days) | SAFE TO EDIT |
| `ATTRIBUTIONS.md` | — | Figma template leftover | Leave alone |

Removed in step 2: `utils/supabase/info.tsx` (key for the retired Figma project) and `supabase/functions/server/*`
(the key-value edge function). Removed in M0 (`764271c`): the shadcn `ui/` kit (48 files), `figma/`, `guidelines/`,
`pnpm-workspace.yaml`, `default_shadcn_theme.css`, `globals.css`. All remain available in the baseline commit `9ccf3ce`.
Removed 2026-10-02 (cleanup): `src/imports/pasted_text/project-guidelines.md` (the Figma Make prompt, unreferenced;
its "capstone" wording was template text), the empty `postcss.config.mjs`, and `src/styles/fonts.css` +
`tailwind.css` (merged into `index.css`).

## 5. `App.tsx` responsibility map

*Line numbers below predate M0 (1130 lines, now 976): the DEAD sections are gone, `ProductCard` shows the verdict dot,
and search sorts by fewest concerns (the price sort went in M7.4). Order of sections is unchanged; M7.4 removed the
Map tab, the resource data and Saved › Lists.*

```
App.tsx (1130)
├── 1–15      imports (several icons unused)
├── 17–29     types: AppState welcome|onboarding|main · Tab home|map|scan|saved|profile
│             · SubScreen search-results|product-detail|null · ResourceType (6)
├── 31–55     CAT config (6 resource types) · RESOURCES fallback (12, x/y pixel coords)
├── 57–59     PRODUCTS = CSV_PRODUCTS (initial state + offline fallback)
├── 61–64     rowToResource (DB row → Resource)
├── 67–84     ONBOARDING slides · DEALS (fake) · score helpers (bestPrice 9999 sentinel)
├── 86–150    CityMap SVG, ScoreRing, ScoreBar ─────────────── DEAD
├── 152–254   StatusBar (fake 9:41) · WelcomeScreen (Sign In has no onClick) · OnboardingScreen
├── 256–439   RECOMMENDATIONS (15 hardcoded places) · cards · WhyModal · sections
├── 440–467   ProductCard (shows safetyScore %; detail shows overallScore)
├── 468–651   HomeTab: greeting, search, static location pill, deals, nearby resources
├── 652–715   SearchResultsScreen (keywords/name/category; sort health/price/ethics)
├── 716–807   aliases → ProductDetailScreen / ScanTab · inline legacy MapTab ─── DEAD (718–806)
├── 809–870   SavedTab (favorites · scanned · static lists)
├── 871–952   ProfileTab (fully static)
├── 953–985   BottomNav
└── 987–1130  App(): state (savedIds [3,5], scannedIds [2,6] fake seeds) · loadData()
              (loadCatalog → setProducts/setResources → dbStatus live|offline) · realtime
              channel "catalog-realtime" (re-fetch on any change) · openProduct/openSearch/
              toggleSave · render tree
```

Extraction candidates: `hooks/useCatalog` (the `loadData` + realtime effect), `HomeTab`, `SavedTab`, `ProfileTab`,
and the `RECOMMENDATIONS` data. Deleting the dead code at 86–150 and 718–806 is the zero-risk first cut.

## 6. Supabase map

**Project:** `ecogo`, ref `gippyavmxxzqxjkuahpt`, owned by the owner's org. Dashboard:
`https://supabase.com/dashboard/project/gippyavmxxzqxjkuahpt`. The Figma Make project `ipcbqjrceyqleuaufier`
is retired and inaccessible (decision 008).

### Schema (ERD)

The `foods` table (M10, EcoGo's USDA Branded Foods copy) stands alone, joined to nothing: see the Data map (§7) and
`supabase/migrations/20261003002926_foods_usda_copy.sql`.

```mermaid
erDiagram
    categories ||--o{ products : "has"
    products ||--o{ product_prices : "sold at"
    products |o--o{ scan_events : "scanned as"
    categories {
        int id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }
    products {
        int id PK
        text barcode UK
        text name
        text brand
        int category_id FK
        text description
        text ingredients
        text image_url
        text_array keywords
        smallint health_score "0-100"
        smallint environment_score "0-100"
        smallint ethics_score "0-100"
        smallint transparency_score "0-100"
        timestamptz created_at
        timestamptz updated_at
    }
    product_prices {
        int product_id PK,FK
        text store PK "amazon | walmart | facebook"
        numeric price
        numeric rating "0-5, null for facebook"
        text condition "facebook only"
        timestamptz created_at
        timestamptz updated_at
    }
    resources {
        int id PK
        text name
        text type "food-bank, farmers-market, community-garden"
        text address
        text hours "plain words or as written in OSM"
        text phone
        float latitude
        float longitude
        text osm_type "node, way, relation"
        bigint osm_id "unique with osm_type"
        text website
        date as_of "snapshot date"
        timestamptz created_at
        timestamptz updated_at
    }
    scan_events {
        bigint id PK
        text barcode
        int product_id FK "null = unknown barcode"
        text store
        numeric price
        numeric latitude "3 decimals"
        numeric longitude "3 decimals"
        timestamptz scanned_at
    }
```

**Why these tables:**
- **Categories** are shared by many products (one-to-many).
- **Prices** vary per store, so they live in their own table keyed by (product, store) rather than as columns.
- **The four legacy score columns** (`health_score` … `transparency_score`) stay in the DB and the CSV but nothing reads them since M1; the ingredient verdict is computed at render.
- **An unknown barcode** is simply a scan with `product_id is null`. That's the review queue; no extra flag is needed.
- **Every table** has constraints (`CHECK`, `UNIQUE`, `FK`) and `created_at`/`updated_at` (a trigger maintains `updated_at`).

### Access model (grants decide which tables, RLS decides which rows)

| Table | Browser (`anon` / `authenticated`) | `service_role` / dashboard |
|---|---|---|
| categories, products, product_prices, resources | `SELECT` only (policy "Catalog is publicly readable") | full CRUD |
| scan_events | **nothing**: the insert grant and policy were revoked in M3 (`stop_saving_scans`) | full CRUD |

Verified live on 2026-09-23 with the publishable key. Reading `scan_events`, updating `products` and deleting
`product_prices` all return `42501 permission denied`. The Supabase security advisor reports no issues.

### Realtime

`products`, `product_prices` and `resources` are in the `supabase_realtime` publication. The app no longer subscribes (2026-10-02 audit): the
catalog is read-only for visitors, so it is loaded once per visit; a catalog change shows after a reload. `scan_events` is deliberately **not** published, since it holds locations. Verified live:
a price changed in SQL showed up in the open app within about 3 s, without a reload.

### Migrations

`supabase/migrations/20260923221344_catalog_schema.sql` (schema, RLS, grants, realtime) and
`20260923221533_seed_catalog.sql` (13 categories, 51 products, 112 prices, 18 resources, generated from the CSV
importer's output). To recreate the database in another project, apply them in order, for example with the Supabase
CLI (`supabase link` then `supabase db push`) or by pasting them into the SQL editor.

## 7. Data map

| Data | Source of truth | Read path | Write path | Fallback | Realtime | Survives reload? |
|---|---|---|---|---|---|---|
| Products (+ category) | `products`, `categories` tables (`product_prices` holds the invented prices, K-30: no longer read) | `loadCatalog()` → `rowToProduct` (same shape as the CSV importer; verified identical for all 51) | Dashboard / SQL (service role) | Bundled CSV (initial render, or when Supabase fails or returns no rows) | — (loaded once per visit) | yes |
| Map places (M9, refreshed M13) | `resources` table: an OpenStreetMap snapshot (183 rows, OSM data as of 2026-10-07; migration `20261007174008_m13_osm_refresh.sql`) | `loadCatalog()` → `places` state → `MapTab` | migrations generated by `scripts/fetch-osm-places.mjs` | **none** (no connection → "Places need a connection") | — (loaded once per visit) | yes |
| County free-food sites (M13) | `src/lib/data/county-food-sites.json` (static, in the bundle) minus `county-hidden.json` | `countyPlaces(places)` in `MapTab`, only once the OSM places loaded | `scripts/fetch-county-food-sites.mjs` (by hand) | not shown without OSM places | — | in the app bundle |
| ZIP table (M13) | `src/lib/data/zcta-la.json` (static, in the bundle) | `zipPoint` in `MapTab` | `scripts/build-zcta-la.mjs` (by hand, from the Census file) | "EcoGo doesn't have that ZIP…" | — | in the app bundle |
| Typed ZIP (M13) | the Map's ZIP box | React state only | never stored, sent or put in the URL (checked by `check-map.mjs`) | — | — | no |
| Scan events | `scan_events` table | nobody (service role only) | **no longer written (M3)**; kept for history, anonymous insert revoked | — | not published | yes (server side) |
| Looked-up products | EcoGo's `foods` table (a read-only copy of USDA Branded Foods, snapshot-dated, loaded by the owner) or live Open Food Facts (crowd-sourced); the browser never writes | `lookupBarcode()` (session cache) | — | error state with Try again | — | no (session list in App state) |
| Data: the `foods` table (M10) | 430,127 USDA Branded Foods products (2026-04-30 release), one row per barcode, `verdict`/`flags` from the app's engine at import (`engine_rev`); public read only; functions `search_foods` (whole-word, at most 1,000 matches, shortest names first) and `alternatives_for` (same category, better badge) | `foodsDb.ts`, `useAlternatives.ts` | — | lookups fall back to Open Food Facts | — | yes (Postgres) |
| Recently scanned (Home, Saved › Scanned) | `localStorage["ecogo.recent.v1"]` on this device | — | `openProduct` (every product opened) | — | — | **yes** (this browser only) |
| Favorites | React state, starts empty (M7.4; was a fake `[3,5]` seed) | — | bookmark toggle | — | — | **no** |
| User location | Browser Geolocation, only when the user taps My location on the Map | — | never stored or sent | LA centre | — | no |
| Scores | Replaced by the ingredient verdict (M1) | — | — | — | — | — |
| Ingredient KB | `src/lib/safety/library.ts` (verified, sourced) | `assessProduct` (additives + food-level concerns) over the product at render | code + `verify:sources` | "Not enough data" verdict | — | yes |
| Explanations / "AI" text | Replaced by the ingredient verdict (M1) | — | — | — | — | — |
| Partners | none (the Figma seed copy was removed; no screen uses partners) | — | — | — | — | n/a |
| Recommendations, deals, profile | `App.tsx` constants | — | — | — | — | yes (static) |

## 8. Feature inventory

Status legend: **working** means verified in the running app; **partial**; **placeholder** means the UI exists but is
static or a no-op; **broken**.

| Feature | Entry | Status | Notes |
|---|---|---|---|
| Welcome (first visit) | `WelcomeScreen` | **working** | One screen (M7.3): "Know what's in your food", Start scanning (opens Scan) / Look around first (Home); shown once per device via `localStorage["ecogo.welcomed.v1"]` (blocked storage just shows it again) |
| Bottom-tab navigation | `BottomNav` | working | Home, Scan (raised green circle), Saved, Profile; Map hidden (M7.4) |
| Home: greeting, Scan card, search, recently scanned | `HomeTab`, `lib/recent.ts` | **working** | Real content only (M7); recently scanned kept on this device, newest first, with Clear |
| Home: Learn tiles and explainers | `HomeTab` + `Explainer.tsx` | **working** | Six tiles (M12, decision 035), each named by its page's full title: "Nothing flagged" isn't "healthy" (FDA 5/20 rule); what the badge levels mean (WHO/IARC, acrylamide); seed oils (AHA, EFSA, EU); pesticides (FDA, IARC, EPA, EFSA; links to badge levels); ultra-processed foods (FDA, HHS); How EcoGo checks a product (the app's three steps, no sources). Verbatim sources with dates; none changes the badge |
| Product search | `HomeTab` → `SearchResultsScreen` | partial | Works; brand not searched; Back loses results |
| Today's Deals, Nearby resources | — | **removed (M7)** | Invented content; Home shows only real things. The resource data and `rowToResource` went in M7.4 (K-10 moot) |
| Catalog load from Supabase | `App.loadData` → `catalog.ts` | **working** | Verified live; identical to the CSV catalog |
| Live/offline banner | `App` render | working | "Live" only when rows arrive; offline: "Offline — showing the built-in catalog" (M7.4, K-11) |
| Realtime updates | — | **removed** (2026-10-02 audit) | The catalog is read-only for visitors; one load per visit |
| Concern badge (4 levels) | `verdict.tsx` + `lib/safety/assess.ts` | **working** | Nothing flagged (grey ○) → Some concern ◔ → High concern ◑ → Known carcinogen ●, one darkening hue, no green; readable in greyscale. Verified 2026-09-30: Diet Coke/Doritos some, Lay's nothing flagged, Tide "food only". `npm test` pins all 51 |
| Processed meat | `lib/safety/foodConcerns.ts` | **working** | IARC Group 1: products that are processed meat read "Known carcinogen" (Oscar Mayer, SPAM, Jimmy Dean); products that only contain it read "High concern" (DiGiorno: "Contains processed meat: Pepperoni"; also bacon baked beans, sausage bowls), while a USDA processed-meat category or a use word ("Sandwich Style", "Pizza Topping") keeps deli meat Known; a name match needs meat in the ingredients, so hot dog buns and plant-based "sausage" don't match; meat-free versions and look-alike words excluded |
| Acrylamide marker | `lib/safety/foodConcerns.ts` | **working** | 🔥 "forms when cooked" on EU 2017/2158 food types (Lay's, Oreo, Nature Valley, Pringles, Special K, Wonder, Goldfish), with IARC/EFSA/EU/FDA sources; never changes the level |
| Nutrition (FDA %DV) | `NutritionPanel` + `lib/nutrition.ts` | **working** | Added sugar, sat fat, sodium per serving, High ≥ 20% / Low ≤ 5% (FDA), amounts in FDA label increments so they match the printed label, "not listed" when missing; catalog foods by verified barcode, looked-up products from USDA/OFF; one "High …" chip on cards once known this session (lists never fetch). Verified 2026-10-01: Oreo 28% added sugar High, DiGiorno sat fat 25% + sodium 33% High, Coke Zero Low ×3 |
| Flagged ingredients + sources | `ProductDetailScreen` | **working** | Each flag expands to regulator context and source links with a "Source checked" date; flagged phrases highlighted in the ingredient text |
| Verdict in lists + sort | `ProductCard`, `SearchResultsScreen` | **working** | Category icon, level icon + short label, 🔥 line when acrylamide matches; one order, "Sorted by fewest concerns" (the price sort went in M7.4) |
| Price comparison, store chips, "best price" | — | **removed (M7.4)** | The prices were invented (K-30); `product_prices` and the CSV keep them for a real source later |
| Alternatives with fewer concerns | `ProductDetailScreen` | **working** | Same category, strictly better verdict, then fewer flags, then name; tappable (page resets to top); hidden for products without concerns |
| Save / bookmark | `toggleSave` | partial | Works in-session for catalog and looked-up products; starts empty; not persisted |
| Share | — | **removed (M7.4)** | Did nothing (K-21); returns with links |
| Map | `MapTab` + `lib/osmPlaces.ts` + `lib/nearMe.ts` | **working** (M9; near me in M13) | ZIP or location, radius, nearest first; 183 OSM places (data as of 2026-10-07) + 191 LA County sites, each labelled with source and date; verified by `docs/superpowers/plans/2026-10-01-m7-assets/check-map.mjs` (36 checks, incl. "the ZIP is never sent") |
| Scan: demo barcode → product | `ScanTab` + `lookup.sameBarcode` | working | In the camera's drawer: 10 USDA-verified catalog codes plus USDA, Open Food Facts and not-found demos |
| Scan: lookup of non-catalog barcodes | `ScanTab` + `lookup.ts` | **working** | EcoGo's `foods` table first (snapshot date on the product page), then Open Food Facts; session cache; checked by `check-home.mjs` (USDA's API is never called) |
| Scan: camera/decoder | `CameraScanner` + `lib/barcodeReader.ts` + `lib/scanner.ts` | **working** | On-device EAN/UPC reading (native or ZXing WebAssembly); two identical reads; UPC-E expanded; camera stops on ✕/leave/hide. Verified 2026-10-01 with a fake camera (Oreo in ~1 s); the owner's phone check is pending |
| Scan: record scan event | — | **removed (M3)** | Scans aren't saved (decision 017); no location prompt |
| Scan: barcode not found anywhere | `ScanTab` | working | Honest "We couldn't find this barcode yet" screen |
| Scan history / stats / review queue UI | — | placeholder | Data is in `scan_events`; no screen (dashboard only) |
| Saved › Favorites / Scanned | `SavedTab` | partial | Favorites in memory, start empty (K-16); Scanned = the recent list on this device |
| Saved › Lists | — | **removed (M7.4)** | Three hardcoded lists and a dead New button |
| Profile | `ProfileTab` | **working** | Display card (text size, high contrast; M11), then expandable rows: Your data (recent count + Clear), where results come from, privacy; source-code link; no invented content (M7.2) |
| Partners | — | placeholder | no table, no screen |

## 9. External services

| Service | Used by | Notes |
|---|---|---|
| Supabase (PostgREST) | `catalog.ts`, `foodsDb.ts` (read only) | see §6 |
| GitHub Pages + Actions | `.github/workflows/deploy.yml` | Hosts https://skynetrebel42.github.io/ecogo/ |
| USDA FoodData Central (the Branded Foods download file) | `scripts/import-usda.mjs`, run by the owner | Public download, no key; loaded into the `foods` table about twice a year. The app never calls USDA's API (M10) |
| Open Food Facts (`world.openfoodfacts.org/api/v3`) | `lookup.ts` | No key; crowd-sourced, labelled as such; ODbL credit on product pages; `X-User-Agent: EcoGo/0.1 (personal project)` |
| tile.openstreetmap.org | MapTab | public tiles, `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (no `{s}` subdomains); © OpenStreetMap contributors credit always visible (M9) |
| Overpass API | `scripts/fetch-osm-places.mjs` | snapshot time only (by hand); the app never calls it |
| US Census Bureau Gazetteer (ZCTA) | `scripts/build-zcta-la.mjs` | build time only (by hand, public domain); the app never calls it |
| LA County ArcGIS (Food_Distribution_chp layer) | `scripts/fetch-county-food-sites.mjs` | build time only (by hand; County open-data terms, decision 041); the app never calls it |
| openstreetmap.org editor and notes | MapTab "Missing a place?" (`/edit#map=18/<map centre>`) and "Report a problem" (`/note/new#map=19/<place>`) links | opened by the user in a new tab; EcoGo sends nothing |
| Google Maps | MapTab "Directions" link | opens `google.com/maps/dir/?api=1&destination=<lat>,<lng>`: the place's position only |
| images.unsplash.com | Home recommendations | hotlinked photo ids |
| fonts.googleapis.com | `src/styles/index.css` | Plus Jakarta Sans (DM Mono dropped 2026-10-02: it was never wired to `font-mono`) |
| Product/barcode APIs (Open Food Facts etc.) | — | USDA FoodData Central + Open Food Facts lookups (M2); M10 moves USDA to our own table |

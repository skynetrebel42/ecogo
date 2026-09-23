# EcoGo! — Architecture (verified)

> **Verified 2026-09-23** by reading every non-shadcn source file, running the build and a typecheck,
> and clicking through the app with Supabase stubbed out (offline). **Not verified:** anything about the
> live Supabase project (database contents, RLS, whether the edge function is deployed). See
> [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for bugs and [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) for status and decisions.

## 1. What the app does today

EcoGo! is a **single-screen phone mock-up** (a fixed 390×844 frame centred on a desktop page) built by
Figma Make. After a welcome screen and a 3-slide onboarding it has five tabs:

| Tab | Reality |
|---|---|
| **Home** | Hardcoded "Alex", 15 hardcoded Chicago recommendations with a SmartScore filter, 3 fake deals, a product search box, and the first 5 community resources. |
| **Map** | A real Leaflet/OpenStreetMap map of **18 hardcoded Chicago resources** (`MapTab.tsx` `BASE_RESOURCES`). The database only overrides name, hours, phone and description by id. |
| **Scan** | **Simulated.** You pick one of 16 demo barcodes and tap Scan. There is no camera and no decoder. The barcode is matched against the in-memory product list, and the app POSTs a scan event (with GPS) to the edge function. |
| **Saved** | Favorites and Scanned lists, in React state only (lost on reload). "Lists" is static. |
| **Profile** | Entirely static (Alex Johnson, fake stats and badges). The settings rows do nothing. |

The product catalog is **51 products from `src/data/products.csv`**, bundled into the JS at build time. The
product detail screen shows a weighted score from the CSV's hand-entered dimension scores, an ingredient
explorer backed by a 29-entry hand-written knowledge base, static store prices and "healthier alternatives".
**Nothing is AI:** the "AI Evaluation Summary" and "SmartScore™" text is hardcoded for product ids 1–7, and
every other product gets a template.

**Important:** the app currently only displays correctly **when Supabase is unreachable** (offline
fallback). When the database answers, `rowToProduct` wipes all prices and scores (bug **K-01** in
KNOWN_ISSUES.md).

## 2. Stack and tooling (verified from `package.json` / `node_modules`)

| Item | Value |
|---|---|
| Runtime used for this audit | Node 24.21.0, npm 11.19.0 (`package-lock.json` exists, so npm is the de facto package manager; `pnpm-workspace.yaml` is a Figma leftover) |
| Frontend | React 18.3.1 (only an *optional peer* dependency, installed indirectly), Vite 6.3.5, Tailwind 4.1.12 via `@tailwindcss/vite`, shadcn/ui (48 files), lucide-react |
| Map | leaflet 1.9.4 + leaflet.markercluster 1.5.3 (used directly, no react-leaflet) |
| Backend | Supabase: `@supabase/supabase-js` 2.116.0 in the browser; the edge function is Hono (`npm:hono`, unpinned) on Deno with `jsr:@supabase/supabase-js@2.49.8` |
| Barcode / camera | **None** |
| Types / lint / tests | **None**: no TypeScript package, no tsconfig, no ESLint, no test runner |
| Scripts | `npm run dev` (vite), `npm run build` (vite build). No typecheck, lint or test scripts. |

## 3. System diagram

```
                       Browser (React SPA, one phone-frame page)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ main.tsx → App.tsx (state, navigation, Home/Search/Saved/Profile inline)     │
 │              ├─ MapTab.tsx ─────────── Leaflet ──────► tile.openstreetmap.org│
 │              ├─ ScanTab.tsx ─ scanService.ts ─┐                              │
 │              └─ ProductDetailScreen.tsx       │                              │
 │ productImporter.ts ◄─ products.csv (?raw, bundled) ─► PRODUCTS (initial state)│
 └────────┬──────────────────────────────┬──────────┼───────────────────────────┘
          │ (1) supabase-js, anon key    │ (2) WS   │ (3) fetch, NO auth header
          │ SELECT + browser-side UPSERT │ realtime │ POST /commons/scan-history
          ▼                              ▼          ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Supabase project  ipcbqjrceyqleuaufier                                      │
 │   PostgREST ──► table kv_store_504b3bba (key TEXT PK, value JSONB)           │
 │   Realtime  ──► postgres_changes UPDATE on kv_store_504b3bba                 │
 │   Edge Function (Hono) "make-server-504b3bba/*" routes ─► kv_store.tsx       │
 │                 └─ SERVICE-ROLE client (bypasses RLS), no auth on any route  │
 └──────────────────────────────────────────────────────────────────────────────┘
 Path (3) very likely never succeeds: the URL has an extra "/server/" segment and no
 Authorization header is sent (bug K-03). Path (1) is the only real DB traffic.
```

## 4. File map and edit policy

| Path | Lines | Role | Policy |
|---|---:|---|---|
| `src/app/App.tsx` | 1188 | Shell: all state, navigation, Home/Search/Saved/Profile, DB load/seed/realtime, about 200 lines of dead code | SAFE TO EDIT (carefully; see §5) |
| `src/app/components/ProductDetailScreen.tsx` | 886 | Product detail, 29-entry ingredient KB, hardcoded explanations for ids 1–7 | SAFE TO EDIT |
| `src/app/components/MapTab.tsx` | 593 | Leaflet map, 18 static resources, filters, bottom sheet | SAFE TO EDIT |
| `src/app/components/ScanTab.tsx` | 392 | Simulated scanner UI, 16 demo barcodes | SAFE TO EDIT |
| `src/lib/productImporter.ts` | 692 | CSV → `Product[]` at module load; defines the canonical `Product` type | SAFE TO EDIT |
| `src/lib/scanService.ts` | 242 | Geolocation, barcode lookup, edge-function client | SAFE TO EDIT |
| `src/lib/scoring.ts` | 148 | Weights 30/25/25/20, grade-from-ethics | SAFE TO EDIT |
| `src/lib/supabase.ts` | 10 | Browser client + `SERVER` URL | SAFE TO EDIT |
| `src/data/products.csv` | 113 | The real catalog (112 rows → 51 products, one row per product×store) | SAFE TO EDIT |
| `supabase/functions/server/index.tsx` | 241 | Hono edge function, 16 routes | SAFE TO EDIT (redeploy needed) |
| `supabase/functions/server/kv_store.tsx` | 86 | KV helpers, service role | **DO NOT EDIT** (header says autogenerated) |
| `utils/supabase/info.tsx` | 3 | `projectId` + public anon key | **DO NOT EDIT** (autogenerated; Figma rewrites it) |
| `src/app/components/ui/*` (48 files) | 5110 | shadcn/ui boilerplate | GENERATED BUT EDITABLE WITH CAUTION (mostly unused, see KNOWN_ISSUES) |
| `src/app/components/figma/ImageWithFallback.tsx` | 27 | Figma helper | GENERATED, EDIT WITH CAUTION |
| `vite.config.ts` | 38 | Figma asset resolver, `@` alias; comments say the React and Tailwind plugins are required for Make | EDIT WITH CAUTION |
| `src/styles/*.css`, `default_shadcn_theme.css` | — | Tailwind entry, theme tokens, Google Fonts | EDIT WITH CAUTION |
| `src/imports/pasted_text/project-guidelines.md` | 425 | The owner's own Figma Make prompt (capstone goals) | Reference only |
| `guidelines/Guidelines.md`, `ATTRIBUTIONS.md`, `pnpm-workspace.yaml`, `postcss.config.mjs` | — | Figma template leftovers | Leave alone |

About 4,500 lines of custom code, including the backend (the handoff estimate was 4,147). The line counts for App.tsx, scanService.ts and productImporter.ts match the handoff exactly.

## 5. `App.tsx` responsibility map

```
App.tsx (1188)
├── 1–14      imports (SERVER and several icons unused)
├── 16–28     types: AppState welcome|onboarding|main · Tab home|map|scan|saved|profile
│             · SubScreen search-results|product-detail|null · ResourceType (6)
├── 30–54     CAT config (6 resource types) · RESOURCES fallback (12, x/y pixel coords)
├── 56–59     PRODUCTS = CSV_PRODUCTS (51, camelCase)
├── 62–85     rowToResource · rowToProduct  ◄── snake_case mapper, mismatched with CSV shape (K-01)
├── 87–94     DEFAULT_PARTNERS (seeded to DB, never displayed)
├── 97–114    ONBOARDING slides · DEALS (fake) · score helpers (bestPrice 9999 sentinel)
├── 116–180   CityMap SVG, ScoreRing, ScoreBar ─────────────── DEAD
├── 182–284   StatusBar (fake 9:41) · WelcomeScreen (Sign In has no onClick) · OnboardingScreen
├── 286–468   RECOMMENDATIONS (15 hardcoded places) · cards · WhyModal · sections
├── 470–496   ProductCard (shows safetyScore %; detail shows overallScore)
├── 498–679   HomeTab: greeting, search, geolocation pill (coords unused), deals, nearby resources
├── 682–743   SearchResultsScreen (keywords/name/category; sort health/price/ethics)
├── 745–837   aliases → ProductDetailScreen / ScanTab · inline legacy MapTab ─── DEAD (748–834)
├── 839–899   SavedTab (favorites · scanned · static lists)
├── 901–981   ProfileTab (fully static)
├── 983–1014  BottomNav
└── 1017–1188 App(): state (savedIds [3,5], scannedIds [2,6] fake seeds) · loadData()
              (anon SELECT → browser UPSERT seed → rowTo* mapping → dbStatus) · realtime
              channel (UPDATE only) · openProduct/openSearch/toggleSave · render tree
```

Extraction candidates, once behavior is pinned down: `hooks/useCatalog` (lines 1029–1087), `HomeTab`,
`SavedTab`, `ProfileTab`, and the `RECOMMENDATIONS` data. Deleting the dead code at 116–180 and 748–834
is the zero-risk first cut.

## 6. Supabase map

- **Project ref:** `ipcbqjrceyqleuaufier` (from `utils/supabase/info.tsx`). The embedded key is a genuine
  `role: anon` JWT issued 2026-07-06, one day before the ZIP export, so no service-role secret is in the
  frontend. **Ownership is not provable from code.** If the owner can open
  `https://supabase.com/dashboard/project/ipcbqjrceyqleuaufier`, they own it.
- **Env files:** none. Nothing reads `import.meta.env`; the URL and key are hardcoded in `info.tsx`.
- **Table:** `kv_store_504b3bba (key TEXT PRIMARY KEY, value JSONB NOT NULL)` (schema comment in
  `kv_store.tsx`). There are no migrations in the repo. The RLS state is **unknown**.
- **Keys:** `commons_resources`, `commons_products`, `commons_partners` (written by the browser and the edge
  function), and `scan_history` (edge function only).
- **Realtime:** channel `commons-realtime`, `postgres_changes` **UPDATE only**, and only the resources and
  products keys are handled. INSERT/DELETE, partners and subscribe status are ignored. Whether the table is
  in the `supabase_realtime` publication is unknown.

### Edge function endpoint inventory (`supabase/functions/server/index.tsx`)

Every route is prefixed `/make-server-504b3bba`, has **no auth and no validation**, and writes by
read-modify-write of one whole JSON array.

| Method + path | KV key | Behavior | Frontend caller |
|---|---|---|---|
| GET `/health` | — | `{status:"ok"}` | none |
| GET `/commons/seed` | all 3 commons | **Writes** (overwrites all 3) if resources is empty | none |
| POST `/commons/seed` | all 3 commons | Always overwrites with the server `DEFAULT_*` | none |
| GET/POST/PUT/DELETE `/commons/resources[/:id]` | commons_resources | CRUD; bad `:id` → `{ok:true}` anyway | none |
| GET/POST/PUT/DELETE `/commons/products[/:id]` | commons_products | CRUD (server seed: 7 snake_case rows, **no barcodes**) | none |
| GET/POST/PUT/DELETE `/commons/partners[/:id]` | commons_partners | CRUD; POST returns `{ok:true}` | none |
| GET `/commons/scan-history` | scan_history | All scans **including raw lat/lng** | helper exists, never imported |
| POST `/commons/scan-history` | scan_history | Append; id = max+1 | **ScanTab → scanService (the only live caller)** |
| GET `/commons/scan-history/stats` | scan_history | Aggregates | helper exists, never imported |
| GET `/commons/scan-history/placeholders` | scan_history | Unknown barcodes plus raw coordinates | helper exists, never imported |

The frontend calls `https://<ref>.supabase.co/functions/v1/server/make-server-504b3bba/...`. Supabase passes
the full path, including the function slug, to the handler, and the Hono app has no `basePath`. So under
either plausible deploy name the routes should 404, and no `Authorization` header is sent either. **Treat the
edge function as effectively unused until this is checked live.**

## 7. Data map

| Data | Source of truth today | Read path | Write path | Fallback | Realtime | Survives reload? |
|---|---|---|---|---|---|---|
| Products | `products.csv` (bundled) | `PRODUCTS` initial state; replaced by kv `commons_products` via `rowToProduct` if the DB answers | Browser UPSERT seeds kv when the key is missing/empty (camelCase shape) | CSV when the SELECT throws | UPDATE on `commons_products` → `rowToProduct` | CSV yes; DB edits only if live |
| Resources (Home list) | `App.tsx RESOURCES` (12, x/y) | kv `commons_resources` via `rowToResource` | Browser UPSERT seed | `RESOURCES` | UPDATE handled | same |
| Resources (Map) | `MapTab.tsx BASE_RESOURCES` (18, lat/lng) | Merges name/hours/phone/description from the App list **by id** | none | static | via App prop | static |
| Partners | `DEFAULT_PARTNERS` (App + server copies) | **never read** | Browser seed / server CRUD | — | ignored | n/a |
| Scan history | edge function kv `scan_history` | nothing reads it | ScanTab POST (likely failing) | — | none | n/a |
| Scanned ids (Saved › Scanned) | React state, seeded `[2,6]` | — | `onScanResult` | — | — | **no** |
| Favorites | React state, seeded `[3,5]` | — | bookmark toggle | — | — | **no** |
| User location | Browser Geolocation (Home pill, Map "My Location", Scan) | — | sent in the scan POST at full precision | "Chicago, IL (default)" / Chicago centre | — | no |
| Scores | CSV dimension columns (hand-entered) → `scoring.ts` weighted sum; grade = ethics only | — | — | 50 per dimension if missing | — | yes |
| Ingredient KB | `ProductDetailScreen.tsx` (29 entries) | parsed from `product.ingredients` at render | — | "No detailed data" | — | yes |
| Explanations / "AI" text | `ProductDetailScreen.tsx` (ids 1–7), template otherwise | — | — | template | — | yes |
| Recommendations, deals, profile | `App.tsx` constants | — | — | — | — | yes (static) |

## 8. Feature inventory

Status legend: **working** means the code path is complete and ran in the offline test; **partial**; **placeholder**
means the UI exists but is static or a no-op; **broken**; **unknown** means it depends on live Supabase.

| Feature | Entry | Status | Notes |
|---|---|---|---|
| Welcome → onboarding → guest | `WelcomeScreen`, `OnboardingScreen` | partial | "Sign In" has no handler; onboarding re-runs on every reload |
| Bottom-tab navigation | `BottomNav` | working | |
| Home recommendations + SmartScore filter + "Why?" modal | `HomeTab` | placeholder | 15 hardcoded Chicago places |
| Home location pill | `HomeTab` | placeholder | Label only; coords unused; Refresh can stick on "Locating…" |
| Product search | `HomeTab` → `SearchResultsScreen` | partial | Works; brand not searched; Back loses results |
| Today's Deals | `HomeTab` | placeholder | Cards open unrelated products; "See all" → "No results for deals" |
| Nearby resources | `HomeTab` | partial | Crashes Home if a DB resource has an unknown type |
| Catalog load from Supabase | `App.loadData` | **broken** when live | Wipes prices and scores (K-01); only offline looks right |
| Live/offline banner | `App` render | partial | "Live" shows even when the seed failed or RLS returned nothing |
| Realtime updates | `App` effect | unknown | UPDATE only |
| Product detail: score ring + breakdown | `ProductDetailScreen` | partial | List shows `safetyScore`, detail shows `overallScore` (e.g. Tide 38% vs 35/100) |
| Grade badge | `ProductDetailScreen` | partial | Grade comes from ethics only; 15/51 products contradict their overall score |
| "AI Evaluation Summary", "Why this score?" | `ProductDetailScreen` | placeholder | Hardcoded text, ids 1–7 only |
| Ingredient explorer + deep dive | `ProductDetailScreen` | partial | Many false HIGH-risk matches (K-04) |
| Price comparison | `ProductDetailScreen` | partial | Static CSV prices; distance and availability hardcoded; no links |
| Healthier alternatives | `ProductDetailScreen` | partial | Ignores category (chips → laundry detergent); rows not clickable |
| Save / bookmark | `toggleSave` | partial | Works in-session; not persisted |
| Share | `ProductDetailScreen` | placeholder | no-op |
| Map: tiles, clusters, categories, detail sheet, list | `MapTab` | working | Static Chicago data |
| Map: "My Location" + radius | `MapTab` | partial | Empties the map for anyone more than 50 mi from downtown Chicago, with no way back |
| Map: open/closed badge | `MapTab` | partial | Hours parser edge cases; viewer's local timezone |
| Map: Call, directions, search | `MapTab` | placeholder | no-op / absent |
| Map reflects DB resources | `MapTab` | partial | Only 4 text fields by id; DB adds/deletes/coords ignored |
| Scan: demo barcode → product | `ScanTab` + `scanService` | working (simulated) | 14 real UPCs plus 2 unknown |
| Scan: camera/decoder | — | placeholder | none |
| Scan: record scan event | `scanService.recordProductScan` | likely broken (unverified live) | Wrong path, no auth, errors swallowed |
| Scan: unknown barcode "saved for review" | `ScanTab` | partial | Always says "saved", even when the POST failed |
| Scan history / stats / review queue UI | — | placeholder | Helpers exist, never used |
| Saved › Favorites / Scanned | `SavedTab` | partial | In-memory, fake seeds |
| Saved › Lists | `SavedTab` | placeholder | static |
| Profile, impact stats, badges, settings | `ProfileTab` | placeholder | static; settings rows no-op |
| Partners | — | placeholder | seeded, never shown |
| Edge-function CRUD / seed / health | `index.tsx` | unknown | No frontend caller |

## 9. External services

| Service | Used by | Notes |
|---|---|---|
| Supabase (PostgREST, Realtime, Edge Functions) | App.tsx, scanService | see §6 |
| tile.openstreetmap.org | MapTab | public tiles via the deprecated `{s}` subdomains; attribution hidden by UI |
| images.unsplash.com | Home recommendations | hotlinked photo ids |
| fonts.googleapis.com | `fonts.css` | Plus Jakarta Sans, DM Mono |
| Product/barcode APIs (Open Food Facts etc.) | — | **none**; offline-only |

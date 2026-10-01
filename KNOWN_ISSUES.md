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
| ~~**K-01**~~ ✅ | **Fixed in `aa8206e` (step 2).** Products now come from normalized tables through `src/lib/catalog.ts`, which builds the exact `Product` shape; it is verified deep-equal to the CSV catalog for all 51 products. *Original issue:* **Live DB load corrupts every product.** The browser seeds `commons_products` with the camelCase CSV `Product` objects, then reads them back through the snake_case `rowToProduct` (`amazon_price`, `health_score`, `ethical_score`…). Result: no store prices ("$9999.00 best price"), every score 50, grade C, no images. If the edge-function seed is what's in the DB instead, only 7 products exist, none with barcodes, so 44 products vanish and every scan is "not found". **The app only looks right when Supabase is unreachable.** | `App.tsx:65-84`, `1046-1063`, realtime `1081-1082` | Only `id/name/barcode/ingredients/keywords` survive the round trip (live?) |

### High

| ID | Issue | Where | Evidence / failure |
|---|---|---|---|
| ~~**K-02**~~ ✅ | **Fixed in M1 (safety engine, `74e5d52`).** Whole-word matching against a sourced library (no alias under 3 characters); `npm test` checks all 51 products against hand-reviewed flags. *Original issue:* **Ingredient matcher produces false HIGH-risk labels.** `alias.includes(key.split(" ")[0])` is a reverse-substring test, the 2-letter alias `"mi"` exists, and the first match wins. A replay over all 51 products gives **70 false HIGH labels on 31 products** (Seventh Generation shows "Sodium Nitrite"; milk/vitamin D3 and Tylenol "acetaMInophen" show Methylisothiazolinone). | `ProductDetailScreen.tsx:344`, `:61` | The app's core "Shop Healthier" claim is wrong for most products |
| ~~**K-03**~~ ✅ | **Fixed in M1 (safety engine, `74e5d52`).** The parser keeps "1,4-dioxane" whole, splits on `;`, and reads sub-ingredients inside parentheses (nitrite in pepperoni is now flagged). *Original issue:* **Ingredient parser splits chemical names.** "1,4-dioxane (trace)" becomes "1" + "4-dioxane"; "1" then matches **Blue 1 food dye** (seen live on Tide PODS). Parentheticals are stripped, so "pepperoni (… sodium nitrite)" hides nitrite, and `;` is not a separator. | `ProductDetailScreen.tsx:331-343` | ▶ Tide PODS detail |
| ~~**K-04**~~ ✅ | **Fixed in `aa8206e` (step 2).** Scans now `INSERT` straight into `scan_events` (verified: row saved). The edge function is gone. *Original issue:* **Scan history very likely never saved.** `SERVER` = `/functions/v1/server/make-server-504b3bba`, but the Hono routes have no `basePath` and Supabase passes the slug in the path, so it 404s under either deploy name. No `Authorization`/`apikey` header is sent either (401 under the default `verify_jwt`). All errors are swallowed to `console.warn`. | `src/lib/supabase.ts:10`, `scanService.ts:134,145` | ▶ POST attempted on every scan; no UI feedback (live?) |
| **K-05** ✔ | **Map "My Location" empties the map for anyone more than 50 mi from downtown Chicago** (the radius filter applies whenever a location is known, and all 18 resources are in the Loop). There is no way to undo it. The owner is in California. | `MapTab.tsx:401-404` | Tap My Location → "0 resources" |
| **K-06** ✔ | **Map ignores the database.** It iterates its own 18 hardcoded `BASE_RESOURCES` and overlays only name/hours/phone/description **by id**. DB adds, deletes, address/type/coordinate changes never show, and a new DB resource (next id 13) overwrites the text of unrelated static pin 13. | `MapTab.tsx:389-393` | Undermines any CRUD or realtime demo |

### Medium

| ID | Issue | Where |
|---|---|---|
| ~~**K-07**~~ ✅ | **Fixed in `fe0027b`.** `react`/`react-dom` were only optional peerDependencies, installed solely because unused packages peer-required them, so pruning unused deps would have dropped `react-dom`. Both are now regular `dependencies` (18.3.1). | `package.json` |
| ~~**K-08**~~ ✅ | **Fixed in M1 (safety engine, `74e5d52`).** "Alternatives with fewer concerns" are same-category, strictly better verdicts, and tappable. *Original issue:* "Healthier Alternatives" ignores category (potato chips → laundry detergent, cleaner, milk), and the rows can't be clicked. | `ProductDetailScreen.tsx:678-681`, `859` |
| ~~**K-09**~~ ✅ | **Fixed in M1 (safety engine, `74e5d52`).** Lists and the product page show the same ingredient verdict; the score, percentage and letter grade are gone. *Original issue:* Two different numbers are presented as "the score": lists show `safetyScore` (the health dimension) as `%`, detail shows `overallScore` (Tide 38% vs 35/100; Lay's 62% vs 54/100). The letter grade comes from **ethics only**, so 15/51 products show a grade that contradicts their overall score. | `App.tsx:78,491`; `scoring.ts` grade thresholds; `ProductDetailScreen.tsx:745` |
| **K-10** ✔ | A DB resource whose `type` isn't one of the 6 `CAT` keys crashes HomeTab (`cat.bg` of undefined), and with **no error boundary** the whole app goes blank. Still latent after step 2: the `resources` table allows the Map's 12 types, and Home shows the first 5 by id (currently all within App's 6). | `App.tsx` `rowToResource`, `HomeTab`; `main.tsx` |
| **K-11** ✔ | *Partly fixed in step 2:* "Live" now appears only when catalog rows actually arrive (an empty result counts as offline). **Remaining:** "Offline — showing *cached* data" is inaccurate, because it's bundled data, not a cache. | `App.tsx` offline banner |
| ~~**K-12**~~ ✅ | **Moot since M3: scans no longer request location.** *Original issue:* A scan waits on geolocation. The 4 s `timeout` doesn't cover the permission prompt, so the scanner can hang in "scanning". There is no try/finally, so any throw also leaves it stuck. | `ScanTab.tsx:107`; `scanService.ts:86,111` |
| ~~**K-13**~~ ✅ | **Fixed in M2 (`b99eb13`).** The not-found screen now says "We couldn't find this barcode yet" (no review-queue claim), and the `error` state is used for unreachable lookups. *Original issue:* The unknown-barcode screen always says "We've saved it for review", even when the insert failed. The `error` scan state is declared and never set. | `ScanTab.tsx` |
| **K-14** ✔ | The "Why Recommended?" modal is positioned inside the scrolling Home container, so for lower sections it opens off-screen. (Verifier-found; not runtime-checked.) | `App.tsx:543` |
| **K-15** ▶✔ | Today's Deals cards open unrelated products (the Seventh Gen. deal opens KIND bars), and "See all" searches the literal word "deals" → "No results". | `App.tsx:626-650` |
| **K-16** ▶✔ | Favorites and Scanned live only in React state, pre-seeded with fake ids `[3,5]`/`[2,6]`, and are lost on reload. Profile's "34 products scanned" and other stats are hardcoded and contradict the app's state. | `App.tsx:1024-1025`, `906` |
| **K-17** ✔ | *Reframed by step 2 (now by design):* the database is the source of truth, and `products.csv` is only the offline fallback and seed source. Editing the CSV changes offline mode but **not** the live catalog. Change products in the Supabase dashboard or with a new migration, and keep the CSV in sync if the offline view matters. | `src/lib/catalog.ts`, `App.tsx` `PRODUCTS` |
| ~~K-29~~ ✅ | **Resolved for food products in M5.** 31 food products carry the barcode, name and full ingredient label of a matched USDA FoodData Central record (same brand, product and flavour), listed in `src/data/verified-barcodes.json` (the source of truth, applied by `scripts/apply-verified-barcodes.mjs`, pinned by `verified-barcodes.test.ts`, migration `real_catalog_barcodes`). 3 with no reliable match lost their barcode: #3 KIND Bars Variety Pack, #4 Gatorade 12-pack, #44 Ben & Jerry's (still searchable). **Non-food barcodes** (cleaning, personal care, baby care including Gerber Puffs, medicine, pet food) are still the Figma export's and unverified; nutrition and hazard lookups don't apply to them. | `src/data/verified-barcodes.json`, products.csv, DB |

### Low

| ID | Issue | Where |
|---|---|---|
| ~~K-18~~ ✅ | **Moot: hand-written explanations were deleted (M1, `74e5d52`).** *Original issue:* Hardcoded explanation text contradicts the data: Diet Coke "No phosphoric acid" (it has it), Lay's "17% of daily sodium" (170 mg ≈ 7%), Oscar Mayer cites turkey (not in its list), an "Affordability score" that doesn't exist. | `ProductDetailScreen.tsx:98,241,261,285` |
| K-19 ▶✔ | Opening any sub-screen unmounts the active tab: Back from a search result lands on Home, and Saved resets to Favorites. | `App.tsx:1139,1174` |
| K-20 ✔ | Search: a leading space matches every product, brand is not searched, and short keywords over-match ("steak" contains "tea"). | `App.tsx:686-690` |
| K-21 ▶✔ | Dead controls: Sign In, all 5 Profile settings rows, Lists "New", Share, Map "Call". (The home location Refresh was removed in M3.) | `App.tsx:240,521,882,967`; `ProductDetailScreen.tsx:714`; `MapTab.tsx:260` |
| K-22 ✔ | Leaving the Scan tab mid-scan still yanks you into product detail about 3 s later, (The false "Scan saved at" part is moot: scans aren't saved since M3.) | `ScanTab.tsx:114-124` |
| K-23 ✔ | Map details: the hours parser misreads "12–6pm" and "dawn–dusk"; open/closed uses the viewer's timezone and goes stale; "Smart Score" sort equals rating sort; the list shows 10 with no "more"; zoom-out and OSM attribution are covered by the sheet. | `MapTab.tsx:125-148,276-283,399-410,523-554` |
| K-24 ✔ | Importer edge cases: rows sharing an id merge silently; `'1'` and `'01'` become duplicate ids; quoted newlines drop the row; an empty FB condition gives `''`; 27/51 barcodes fail the UPC-A check digit (matters only for a real scanner). | `productImporter.ts:158,372,496,509,575,642` |
| ~~K-25~~ ✅ | **Moot: `scoring.ts` was deleted (the score is no longer computed).** *Original issue:* Floating-point rounding makes 58.5 → 58 (id 41 only). | (deleted) |
| K-26 ✔ | *Mostly fixed in step 2:* realtime now re-fetches on INSERT/UPDATE/DELETE of products, prices and resources. **Remaining:** an open product detail keeps its snapshot until reopened; no subscribe-status check; overlapping re-fetches could resolve out of order (harmless at this scale). | `App.tsx` realtime effect |
| K-27 ▶ | Icon-only buttons (back, save, share, search-QR, etc.) have no accessible names. | `ProductDetailScreen.tsx:707-714`, `App.tsx` |
| ~~K-28~~ ✅ | **Resolved in M6:** below 500 px wide the app fills the screen (no phone frame or fake status bar, safe-area insets); desktop keeps the frame. A phone first loaded in landscape still gets the frame (M6 follow-up). | `App.tsx` (`IS_PHONE`) |
| K-30 | Catalog prices and store ratings (Amazon, Walmart, FB Marketplace) are still Figma-invented. | products.csv, DB `product_prices` |

### Maintainability (not bugs; fix opportunistically)

- ~~Dead code in `App.tsx`~~ Resolved by the M0 cleanup (`764271c`).
- Fallback data still lives in code next to the database: `App.tsx` RESOURCES (12, x/y), `MapTab.tsx` BASE_RESOURCES (18, lat/lng, drawn on the map), and the CSV (51 products). The DB now holds the canonical copy of all of it (step 2 retired the server's `DEFAULT_*` and `DEFAULT_PARTNERS`). Making the map read DB coordinates (K-06) would retire BASE_RESOURCES.
- ~~53 of 59 runtime dependencies unused; pnpm leftovers, empty/unreferenced CSS, dead `figma:asset` resolver~~ Resolved by the M0 cleanup (`764271c`): 7 runtime dependencies remain. Still open: DM Mono is loaded but not wired to `font-mono`.
- ~~No stable product identity~~ *(resolved in step 2: the DB and the CSV share ids 1–51, and the incompatible 7-row server seed is gone).*
- ~~No git repo / `.gitignore`~~ *(resolved in step 0).*
- ~~Product ids are coupled to hardcoded explanations~~ *(resolved in M1: the explanations were deleted; `src/lib/safety/fixtures/expected-flags.json` is keyed by id, so regenerate it if products are renumbered).*
- About 115 KB of inline data literals plus the raw CSV ship in the single eager chunk. Google Fonts loads via a render-blocking CSS `@import`.

### Safety engine follow-ups (from the M1 final review, deferred)

- **Library coverage:** partially hydrogenated oils (FDA 2015 GRAS revocation), propylparaben E216 (EU deleted it), and BVO's E-number E443 appear to qualify. Add each only with a verified official quote (`npm run verify:sources`).
- `verify-sources` reports HTTP 404/410 as "unverifiable", so a dead source link passes; the hand checks of IARC/EUR-Lex quotes aren't recorded per source.
- A flag's `matchedText` is the normalized item, not the exact label span, so the highlight and "Listed as" break on newlines, double spaces and "parent (x) rest" joins. Newlines aren't separators yet, which matters for camera text (M4).
- Zero-width spaces and soft hyphens aren't stripped; `Red&nbsp;40` splits on the `;`.
- The alternatives sort computes `Infinity − Infinity = NaN` when two alternatives have no price (unstable order).

### Deploy follow-ups (from the M3 final review, deferred)

- Every Actions run warns that the Node 20 runtime is deprecated for checkout@v4, setup-node@v4 and the Pages actions. Bump each action to its current major before GitHub removes Node 20, or deploys stop.
- Workflow hardening: move `pages: write` and `id-token: write` from workflow level to the `deploy` job (the build job runs `npm ci` install scripts), and use `cancel-in-progress: false` as GitHub's Pages starter does.
- The secret check (`test -n`) accepts a whitespace-only secret. The app then trims it to empty and silently uses `DEMO_KEY`. Strip whitespace in the check.
- Public docs name the owner's university ("the UCI email stays private", and in the M3 plan). They reveal the affiliation, not the address; reword to "personal email" if that's unwanted.
- `.superpowers/` is ignored only through a nested `.gitignore`; add it to the root `.gitignore` so a new scratch folder can't be committed.
- The README's "30 lookups an hour" for `DEMO_KEY` is loose: the limit is per IP (30 requests an hour, 50 a day), and one lookup can use 2 requests.
- The OpenStreetMap attribution is hidden behind the map sheet (K-23), which matters more now the site is public. `index.html` has `noindex, nofollow`: decide whether the showcase should be findable.

### Lookup follow-ups (from the M2 final review, deferred)

- A 200 response with an unparseable body reads as "not found" instead of an error (`lookup.ts` `fetchUsda`/`fetchOff`).
- Letters in a typed barcode are silently stripped and check digits aren't validated, so a typo becomes a different code.
- USDA 429/403 (rate limit, bad key) show "check your connection"; under `DEMO_KEY` Open Food Facts silently takes over.
- Switching tabs mid-lookup still pops the product page when the lookup finishes.
- ~~A scan can sit on "Looking up…" while the location prompt is unanswered~~ (moot since M3: no location request).

### Concern-level follow-ups (from the M4 final review, deferred)

- "Veggie", "vegan" and the like in a product name skip the ingredient scan, so "Sausage & Veggie Breakfast Bowl" with
  pork sausage reads Nothing flagged (`foodConcerns.ts`, the `NOT_MEAT.test(p.name)` early return).
- Flavouring-style ingredients such as "bacon seasoning" or "smoked meat flavor" still read Known (`NOT_MEAT` only knows
  `<meat>-flavor` and `<meat>-free`).
- Acrylamide marker edges (marker only): Cream of Wheat gets 🔥 (EU (d) excludes porridge); "Honey Bunches of Oats" and
  "Oatmeal Squares" lose it (the `PORRIDGE` regex); USDA "Coffee Ice Cream" gets it (the coffee name fallback); catalog
  fries filed under "Frozen" wouldn't get it (none today).
- The "Alternatives with fewer concerns" header icon is green (`text-green-600`), against decision L2.
- The product-page footer says "verified against IARC, EU and FDA sources"; WHO is now a source body too.

### Nutrition and barcode follow-ups (from the M5 final review, deferred)

- The renamed pack sizes no longer match the invented catalog prices (K-30): "Diet Coke 12 fl oz Can" carries the
  12-pack price, Monster a 4-pack price, Nature Valley "(2-bar pouch)" the 12ct price, the SPAM 4-pack a single-can
  price, Stouffer's Family Size 40oz the 12oz price. #17 Planters' description lists macadamias the real label doesn't.
- Open Food Facts: a nutrient given only per 100 g (alongside a serving size), or salt without sodium, reads "not
  listed" though it could be derived (`offNutrition`).
- An Open Food Facts result found while USDA was unreachable keeps its nutrition in `knownNutrition` for the session.
- Catalog barcodes that USDA stores as 14 digits (Coca-Cola, DiGiorno) cost 2 USDA requests on first open.
- The per-100 g header reads "per · 100 g", and liquids are labelled g.
- The M5 spec §3 names Lay's `028400421584` (the verified code is `028400199148`) and §6 names
  `catalog-barcodes.test.ts` (it's `verified-barcodes.test.ts`).

### Camera follow-ups (from the M6 final review, deferred)

- A `.wasm` load failure is silent: the camera keeps showing "Point at a barcode" and never reads (the ponyfill loads
  it on the first detect, and per-frame detect errors are swallowed). Typing a barcode still works.
- ✔ Fixed 2026-10-01: hiding the page while the camera was still starting left a dead view (the start-up code set
  "live" over "Camera paused."). It now stops after `video.play()` if it was paused meanwhile.
- ✔ **Fixed and confirmed by the owner 2026-10-01: iPhone and PC (ZXing path) "camera shows, never reads"** (Android's built-in reader worked).
  Root-cause hypothesis, reproduced in Node: without a size, Safari and desktop Chrome capture ~640×480, and ZXing
  can't read a slightly blurred barcode at ~2 px per bar (it reads it at 1920×1080). Fix shipped: ask for 1920×1080
  (`CAMERA_CONSTRAINTS`) plus continuous autofocus where supported. Open the site with `?debug` to see the real camera
  size, frames read, and any reader error. If it still fails, next: decode only the framing-box crop, then a sharper
  focus hint.
- A phone first loaded in landscape gets the 390×844 desktop frame (`IS_PHONE` is `max-width: 499px`, decided once at
  load).

### Hidden-risk candidates (each needs an official source before it's flagged)

- Glycidyl esters, benzene and aflatoxins (process contaminants left out of M4).
- Uncured meats cured with celery juice or powder still contain nitrite (e.g. Oscar Mayer Uncured Beef Franks, now on
  its real label): verify an official source before flagging.

### Future production: security and privacy (do **not** deploy publicly before these)

| ID | Issue | Where |
|---|---|---|
| ~~S-01~~ ✅ | **Resolved in step 2:** the unauthenticated, service-role edge function was deleted and is not deployed to the new project. *Was:* every edge-function write route unauthenticated, including a public catalog reset. | (deleted) |
| ~~S-02~~ ✅ | **Resolved in step 2:** browsers can no longer write the catalog. They have `SELECT` only, and `UPDATE`/`DELETE` were verified to return `42501`. *Was:* the browser upserted the KV table with the anon key. | `supabase/migrations/…_catalog_schema.sql` |
| ~~S-03~~ ✅ | **Resolved in step 2:** coordinates are rounded to 3 decimals (~100 m) before sending; clients can only `INSERT` scans and can't read them (verified `42501`); `scan_events` is not in the realtime publication. *Was:* full-precision GPS served back publicly. | `scanService.ts`; migration |
| ~~S-04~~ ✅ | **Resolved in M3:** scans are no longer saved, and the anonymous insert grant and policy on `scan_events` are revoked (migration `20260929230347_stop_saving_scans`). *Was:* anyone holding the public key could insert unlimited `scan_events` rows. | migration `stop_saving_scans` |
| ~~S-05~~ ✅ | **Resolved in step 2:** RLS is on for every table, the grants are explicit, the realtime publication is known, and migrations live in the repo. The security advisor is clean. (The previous session's sandbox patch was never used; the new design supersedes it.) | `supabase/migrations/` |
| S-06 | **Not needed for launch:** the app writes nothing. Revisit with per-user favorites/history (Supabase Auth, anonymous sign-in or email). | — |

## 3. Roadmap

Re-prioritized 2026-09-23 around the **owner's goals** (PROJECT_HANDOFF.md → "Owner goals"). Prototype **done** means:
**(1)** scan a real product with a phone camera → product page, and **(2)** a trustworthy safety score. Free tier only;
food and drinks first. Each step is small and verified in the running app before moving on.

0. ✅ **Safety net: done 2026-09-23.** Git repo on `main`: `9ccf3ce` is the untouched Figma baseline (restore with `git checkout 9ccf3ce -- <file>`), `f3aa31d` adds the docs, and `fe0027b` moves react/react-dom into `dependencies` (K-07).
1. ✅ **Backend: resolved 2026-09-23 by starting fresh.** The Figma project `ipcbqjrceyqleuaufier` is in a Supabase account the owner can't access, and it held only prototype data, so it is **retired**. The new project is **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free plan) in the owner's org.
2. ✅ **Normalized database + live mode: done 2026-09-23** (`3f33bb6`, `aa8206e`). Five tables (categories, products, product_prices, resources, scan_events) with constraints, timestamps, RLS, explicit grants and realtime. The app reads them through `src/lib/catalog.ts` and saves scans to `scan_events`. Fixes K-01 and K-04, and resolves S-01/S-02/S-03/S-05. All of it was verified in the live app.
3. ✅ **Trustworthy safety analysis: done 2026-09-25** (`764271c`…`74e5d52`, plus the label/docs commit). M0 cleanup,
   then the safety engine (`src/lib/safety`): a parser that keeps chemical names whole and reads sub-ingredients, whole-word
   matching against a 17-entry library where every entry cites an official source (IARC, EU, FDA) with a verbatim quote,
   and a verdict (high / some / none / no data / food only) computed from the ingredients. The product page shows the
   flagged ingredients with their sources, lists show the same verdict, and "SmartScore™"/AI labels are gone. `npm test`
   checks all 51 products against hand-reviewed flags; `npm run verify:sources` re-checks the quotes. Fixes K-02, K-03,
   K-08, K-09; K-18 moot. Design: `docs/superpowers/specs/2026-09-24-safety-engine-design.md`.
4. ✅ **Product lookup (USDA first, Open Food Facts fallback): done 2026-09-28** (`e50e12e`…`b99eb13`, plus the docs
   commit). Any barcode not in the 51 featured products is looked up in USDA FoodData Central (manufacturer label data),
   then Open Food Facts (crowd-sourced, labelled), and gets the same ingredient check; Open Food Facts additive codes
   (`en:e951`) are checked too. Every looked-up product page says where its data came from. The not-found screen is
   honest (K-13), unreachable sources show "Couldn't reach…" with Try again, and the Doritos/Oreo barcodes that opened
   other products were replaced. Design: `docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md`.
5. ✅ **Deploy + public repo: done 2026-09-29.** Live at https://skynetrebel42.github.io/ecogo/, repo
   github.com/skynetrebel42/ecogo, deployed by `.github/workflows/deploy.yml` (tests, build, GitHub Pages) on every push
   to `main`. The history uses the owner's GitHub no-reply email. Scans are no longer saved (S-04). This gives the HTTPS
   a phone needs to open the camera, so step 6 can be tested on a real phone.
6. ✅ **M4 concern levels: done 2026-09-30** (`639de14`…`103c615`, plus the docs commits). One badge that darkens with
   the official finding: Nothing flagged → Some concern → High concern → Known carcinogen, always word + filled circle +
   shade, and no green. Processed meat reads Known carcinogen (IARC Group 1, also inside other foods). Fried and baked
   starchy foods get a 🔥 "forms when cooked" acrylamide marker that never changes the level. Design:
   `docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md`.
7. ✅ **M5 nutrition + verified barcodes: done 2026-10-01** (`61418f6`…`ad7f633`, plus the docs commits). Product pages show added sugar, saturated
   fat and sodium as FDA %DV per serving with FDA's 5/20 High/Low rule (layout B + C: a Nutrition section, one "High …"
   chip on list cards; slate, never part of the concern badge). Products that only contain processed meat read High
   concern. 31 food catalog products carry USDA-verified barcodes and their real labels; 3 lost theirs (K-29). Design:
   `docs/superpowers/specs/2026-10-01-m5-nutrition-barcodes-design.md`.
8. ✅ **M6 camera scanning + phone layout: done 2026-10-01** (`74850b7`…`8e01eeb`, plus the docs commit). The Scan tab opens the back camera and reads
   grocery barcodes on the device (the browser's BarcodeDetector where it reads EAN/UPC, else ZXing WebAssembly bundled
   with the site, no CDN); a code counts after two identical reads, and UPC-E is expanded to UPC-A. Typing a barcode and
   the demo list sit in a drawer; denied/no-camera states keep them open. Phones get the app full-screen (safe areas),
   desktop keeps the frame (K-28). No catalog product carries an invented barcode: non-food codes were removed too.
   Done-criterion 1 is met once the owner's phone check passes. Design: `docs/superpowers/specs/2026-10-01-m6-camera-mobile-design.md`.

**Next:** M7 Home redesign (spec `specs/2026-10-01-m7-home-redesign-design.md`), then **M7.1** explainers on seed oils,
pesticides and ultra-processed foods (official findings stated plainly; sources to research first), then accounts and
the real map.

**✔ Search fixed 2026-10-01:** whole-word matching (`src/lib/search.ts`: every typed word must be a whole word, plurals either way, of the name, brand, category or keywords; "ice cream" now finds only Ben & Jerry's) plus a "More from USDA FoodData Central" list of up to 10 real products (`searchUsda`, one request per search text per session).

**✔ "Looks wrong? Fix it on Open Food Facts" 2026-10-01 (owner idea, option A):** Open Food Facts product pages link to OFF's edit form, and the not-found screen to its add form, barcode filled in. Users edit with their own OFF account; OFF's AI (Robotoff) suggests nutrition values from label photos. **Later (option B, after accounts):** an in-app form + label photo sent through a small server function under a registered EcoGo app account, with rate limits and spam protection. Never store user-typed values in EcoGo itself (facts first).

**Later (after "done"):**
- Map: follow the user's location, with Los Angeles as the default, and real nearby places from OpenStreetMap. This also
  fixes K-05 and K-06, and retires the fictional Chicago data. Switching only the center would leave today's 18
  Chicago pins off-screen, so it's one step.
- Persist favorites (K-16); search improvements (K-20); a quick UX batch (K-10, K-11, K-15).
- Extract `App.tsx` pieces one commit at a time (dead code and unused deps were removed in M0).
- Nutri-Score/NOVA and Baby Food category (deferred from M2; the acrylamide note shipped in M4; verified sources in
  `specs/2026-09-28-m2-open-food-facts-design.md`).
- Before going public: ~~scan rate limiting (S-04)~~ done by removing scan saving; ~~set `VITE_FDC_API_KEY` on the
  host~~ done (repository secret); ~~put the public repo URL in Open Food Facts' `X-User-Agent`~~ done. Still open:
  Nutri-Score permission (if that feature returns), final docs.

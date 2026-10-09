# EcoGo! — Project handoff (verified state)

> **Read this first.** Updated 2026-09-23 after a read-only audit of the Figma Make export (`EcoGo!.zip`,
> exported 2026-07-07; identical to this folder apart from `package-lock.json`/`node_modules`).
> Details: [ARCHITECTURE.md](ARCHITECTURE.md) (structure, Supabase map, data map, feature inventory) and
> [KNOWN_ISSUES.md](KNOWN_ISSUES.md) (baseline, bug list, roadmap).
> The project is a git repo (`main`). Commit `9ccf3ce` is the untouched Figma export. Roadmap steps 0–2 are done:
> the safety net, a new owner-controlled Supabase project, and a normalized database with the app switched over to it.

## Where things stand

- **Context:** a **personal project** (confirmed by the owner 2026-09-23). It is not a course deliverable, despite the
  capstone wording in the pasted Figma Make prompt. Prioritize what makes the app useful, not demo value.
- **Provenance of the planning docs:** the original "PROJECT HANDOFF" that started this work was **written by ChatGPT**
  from the owner's brainstorming, and the owner has not reviewed its contents. `src/imports/pasted_text/project-guidelines.md`
  (the Figma Make prompt; deleted 2026-10-02 as unreferenced, still in git history) appears to be the same kind of AI-written prompt. Treat both as **unverified hypotheses, not
  owner requirements.** Its "previous session security fixes" were never in the code (ChatGPT's private sandbox copy).
  The owner's actual goals are still to be captured (see open questions).

- **Phase:** **prototype done 2026-10-01** (camera scans confirmed by the owner on Android, iPhone and PC). M7–M7.3
  made Home, Profile and the welcome honest; **M7.4 trust cleanup (2026-10-02): nothing the app shows is invented.**
  **M7.5 (2026-10-02): the USDA key left the public JavaScript.** M9 (2026-10-02): a real Los Angeles map.
  **M10 data ownership (2026-10-05): EcoGo keeps its own copy of USDA Branded Foods** (430,127 products in the `foods`
  table, scored by the app's own engine, rev 4 after the M10.1-M10.3 processed-meat rules), so lookups no longer call
  USDA and the relay is retired (decision 034). **M11 quick wins (2026-10-06):** a food icon per category, "Update info"
  on crowd-sourced products, expandable Profile rows, and text size and high contrast kept on this device.
  **M12 (2026-10-06):** Home's explainer rows became six "Learn" tiles, and "How EcoGo checks a product" became a page.
  **M13 (2026-10-07):** "Map near me": a ZIP or My location, a radius, the nearest places first; OSM refreshed (183 places,
  community fridges in) plus 191 LA County free-food sites, marked and dated; "Report a problem" and "Missing a place?" links.
  **M14 (2026-10-07):** Collections: the bookmark saves at once and opens a sheet to add the product to lists (Breakfast,
  Lunch, Dinner, Dessert, Snacks suggested, or your own); Saved shows lists as folders (rename, delete, remove, Undo);
  everything kept on this device.
  **M8 (2026-10-08):** Add a product: from the not-found screen, three photos, the ingredients read on the phone
  (self-hosted Tesseract.js) and checked by the person, then sent to Open Food Facts through the `off-submit` Edge
  Function (anonymous sign-in + Turnstile at the first Send, 10 a day per person, 200 overall, never overwrites OFF
  text); "No barcode? Check ingredients" in the Scan drawer (nothing saved or sent). Still on OFF's **test** server
  until the owner switches `OFF_BASE`. See the KNOWN_ISSUES.md roadmap for what comes next.
- **Runs locally:** yes. `npm install` → `npm run dev` → http://localhost:5173. It talks to the owner's live Supabase project.
- **What's real:** a live catalog of 51 products in Postgres (31 food products with USDA-verified barcodes and labels),
  EcoGo's own copy of USDA FoodData Central (Branded Foods, snapshot-dated) and live Open Food Facts for any other
  barcode, with search and alternatives from the same copy, on-device camera scanning, a concern level
  (strongest official finding: additives, processed meat; acrylamide marker) from the safety engine (`src/lib/safety`,
  sourced library, `npm test` over all 51 products), FDA %DV nutrition, sourced explainers, the catalog loaded once per visit
  (scans are not saved), Recently scanned on this device, saved products and lists on this device (M14), and a log of
  each person's Open Food Facts submissions (`contributions`: anonymous ID, barcode, time, result; M8).
- **What's still invented, but not shown (M7.4):** catalog prices and store ratings (`product_prices`, the CSV; K-30)
  and the Map's Chicago places (`resources`, `MapTab.tsx`; the Map tab is hidden until M9).
- **Backend:** Supabase project **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free). There are 5 normalized tables
  with RLS and explicit grants, and the schema lives in `supabase/migrations/`. The browser only reads the catalog
  and writes nothing (scan inserts revoked in M3). Since M10 the `foods` table (read-only to the public, loaded by the
  owner's `npm run import:usda`) holds the USDA copy, with two read functions, `search_foods` and `alternatives_for`;
  no Edge Function is left (decision 034). The old Figma project is retired (decision 008).
- **Security:** browsers can't write anything (catalog read-only; scan inserts revoked in M3), and the security advisor's
  only notice is the expected "RLS on, no policy" for `scan_events`. Accounts (S-06) aren't needed while nothing is written.

## Owner goals (captured 2026-09-23, from the owner directly)

These override anything in the AI-written planning docs.

| Topic | Owner's answer |
|---|---|
| Purpose | Personal project to **showcase build skills**, with the intent to grow it into a **public app**. A viable, running prototype is enough for now |
| Core value | **Product safety** and **barcode scanning**. Everything else (prices, map, lists, profile) comes later |
| Prototype "done" means | **1) Scan a real product with a phone camera → product page. 2) A trustworthy safety score** (no false alarms) · *Status 2026-10-01: **both met** (2 by M1–M5; 1 by M6 + the HD-capture fix, confirmed by the owner on Android, iPhone and PC)* |
| Scan devices | All: iPhone, Android and laptop webcam, so use a JS scanning library (Safari has no built-in barcode reader) |
| Product data | Curated 51 stay as featured; any other barcode is looked up in **USDA FoodData Central** (official manufacturer label data), then **Open Food Facts** (crowd-sourced, labelled) |
| Safety score | **Computed from ingredients** with transparent rules, the same engine for curated and Open Food Facts products |
| Product types first | **Food & drinks** |
| Delivery | **Deployed website** (free hosting, HTTPS) and a **public GitHub repo** |
| Layout | **Real mobile web app**: full-screen on phones, phone frame only on desktop |
| Accounts | Not yet |
| Budget | **Free tier only** (so no paid APIs and no LLM calls) |
| Timeline | No deadline; quality over speed |
| Design | Keep the Figma style; free to improve UX |
| "AI" wording | **Rename until it's real** (e.g. "Safety Summary", no "AI"/"SmartScore™" claims) |
| Scans | **Save scans without location** (drop GPS from scans) |
| Map (later) | Follow the user's location; **Los Angeles** as the default; real nearby places from **OpenStreetMap** |

## ChatGPT handoff claims, checked against the code

| Claim in the ChatGPT-written handoff | Verdict |
|---|---|
| React 18 / TS / Vite 6 / Tailwind 4 / shadcn | ✅ True. TypeScript is written but never type-checked (no `typescript`, no tsconfig) |
| `kv_store.tsx`, `info.tsx` marked autogenerated | ✅ True (`/* AUTOGENERATED FILE - DO NOT EDIT CONTENTS */`) |
| App.tsx ≈1,188, scanService ≈242, productImporter ≈692 lines | ✅ Exact |
| ≈4,147 custom lines, ≈40 shadcn files | ≈ About 4,500 custom lines including the backend; **48** shadcn files (5,110 lines, none imported by the app) |
| React → Edge Function → Postgres | ⚠️ Partly. The *main* path is **React → PostgREST directly** (anon key). Only the scan POST targets the edge function, and it very likely fails |
| Edge function at `supabase/functions/server/index.tsx`, Hono on Deno | ✅ True |
| Single KV table `kv_store_504b3bba` (key TEXT, value JSONB) | ✅ True. Keys: `commons_resources`, `commons_products`, `commons_partners`, `scan_history` |
| Edge write routes have no auth; service role bypasses RLS | ✅ True |
| App.tsx upserts directly with the browser client | ✅ True (`App.tsx:1055`, seed-on-empty) |
| `/commons/seed` publicly resets data | ✅ True, and worse: even **GET** `/commons/seed` writes |
| Scan history stores GPS | ✅ True (full precision, served back unauthenticated) |
| `requireAuth`/`requireAdmin`, `app_metadata.role` | ❌ **Absent** |
| `ALLOWED_ORIGINS` CORS allowlist | ❌ **Absent** (`origin: "*"`) |
| `supabase/migrations/20260713_kv_store_rls.sql` | ❌ **Absent** (no migrations folder at all) |
| Anonymous auth / `getAccessToken()` | ❌ **Absent** |
| Frontend has bundled fallback data | ✅ True: the CSV catalog, plus `RESOURCES`/`DEFAULT_PARTNERS` in App.tsx and 18 static map resources in MapTab.tsx |
| Realtime subscriptions exist | ✅ True, but UPDATE only, for 2 keys |
| productImporter calls external product/barcode APIs | ❌ False. It is offline-only and parses the bundled CSV |
| "AI-powered ethical rating" (index.html) | ❌ False. The text is hardcoded (ids 1–7) or templated |

## Decision log

Decisions 001–005 came from the ChatGPT-written handoff, **not from the owner**. They're kept because they are
sensible defaults, but they're unconfirmed. Decisions 006+ were made in this repo with the owner.

| # | Decision | Reason | Status |
|---|---|---|---|
| 001 | Keep the Figma-generated architecture for now *(ChatGPT)* | Preserve working prototype behavior while it's understood | Active default, unconfirmed |
| 002 | Don't normalize the KV database yet *(ChatGPT)* | The coupling and live DB contents were unknown at the time | **Superseded by 009** (owner chose option A) |
| 003 | Security hardening is required before any public deploy *(ChatGPT)* | S-01 to S-05 are resolved (S-04 by removing scan saving, M3); S-06 (auth) isn't needed while the app writes nothing | Done for launch (M3) |
| 004 | Don't split App.tsx until behavior is pinned *(ChatGPT)* | Responsibility map now exists (ARCHITECTURE.md §5); start with the ~150 lines of dead code | Active default, unconfirmed |
| 005 | Documentation follows stabilization *(ChatGPT)* | These are working docs, not final docs | Active default, unconfirmed |
| 006 | The CSV `Product` (camelCase) shape is the canonical frontend product shape | It is the only shape the whole UI consumes | **Done**: `catalog.ts` maps DB rows into it |
| 007 | Put a restore point in place before the first code change | The handoff prioritizes not destroying working behavior | **Done**: baseline commit `9ccf3ce` |
| 008 | Start fresh with an owner-controlled Supabase project | The Figma project `ipcbqjrceyqleuaufier` lives in an account the owner can't access, and it held only prototype data | **Done**: `ecogo` = `gippyavmxxzqxjkuahpt` (us-west-1, free) |
| 009 | Normalized tables now (owner chose option A) instead of recreating the KV table | Real constraints, relations and realtime per table are easier to grow than one JSON blob; the new DB was empty, so there was nothing to migrate | **Done** 2026-09-23: 5 tables, RLS, grants, realtime (`3f33bb6`) |
| 010 | Browser talks to Supabase directly (PostgREST + RLS); the edge function was deleted | It was KV-based, unauthenticated and unreachable; RLS plus column grants give the same guarantees with less code | **Done**. Add an edge function only when server-side logic is needed (e.g. calling an external product API with a secret key) |
| 011 | Overall score and grade are computed, never stored; unknown barcode = `product_id is null` | Avoids derived data drifting out of sync | **Done**; superseded 2026-09-28: the score was replaced by the M1 ingredient verdict and `scoring.ts` deleted |
| 012 | The DB is the source of truth for the catalog; the CSV is the seed source and offline fallback | One writer; the offline demo still works | **Done**. CSV edits don't reach the live DB (K-17) |
| 013 | Scan locations are rounded to 3 decimals (~100 m), and scans are insert-only for clients | Privacy (earlier audit S-03) | **Superseded by 014** |
| 014 | Scans are saved **without** location (owner goal) | Location isn't needed for the core scan → safety flow | **Done** (superseded by 017) |
| 015 | Prototype "done" = real camera scan → product page with a trustworthy, ingredient-computed safety score; free tier only | Owner goals 2026-09-23 | **Met** 2026-10-01 |
| 016 | USDA FoodData Central is the primary lookup, Open Food Facts a labelled fallback | Owner wants a diverse lineup from a trustworthy US source; OFF is crowd-sourced and worldwide | **Done** (M2) |
| 017 | Scans are not saved at all; anonymous insert revoked | Nothing read them, and a public insert grant invites spam (S-04). Re-add with accounts when scans power a feature | **Done** (M3) |
| 018 | GitHub Pages via GitHub Actions; history uses the owner's GitHub no-reply email | Free HTTPS, one account; the UCI email stays private | **Done** (M3) |
| 019 | One darkening concern badge, no green; level = strongest official finding (additives + food itself); acrylamide is a marker only | Owner, 2026-09-30: "Nothing flagged" isn't "healthy"; avoid flagging the whole bread aisle | **Done** (M4) |
| 020 | Nutrition: FDA %DV per serving for added sugar, sat fat, sodium; High ≥ 20%, Low ≤ 5% (FDA's rule); separate from the concern badge | Owner, 2026-10-01 (mockup layout B + C) | **Done** (M5) |
| 021 | Catalog food products use USDA-verified barcodes and their real labels; unverifiable codes removed | Owner, 2026-10-01: trust first; Figma text was invented | **Done** (M5) |
| 022 | Camera scanning on-device with barcode-detector (native or ZXing WebAssembly, bundled .wasm, no CDN); a code counts after two identical reads | Owner, 2026-10-01 | **Done** (M6) |
| 023 | Home shows only real content; recent products kept on the device (localStorage, last 10), no account | Owner, 2026-10-01 | **Done** (M7) |
| 024 | No invented content outside the Map: Profile and the welcome say only what EcoGo does today | Owner, 2026-10-01 | **Done** (M7.2, M7.3) |
| 025 | Nothing the app shows is invented or promises a missing feature: prices out of the UI (the data stays), Map tab hidden until it has real places (M9), Saved › Lists and Share removed, favorites start empty, "AI" wording gone | Owner, 2026-10-02 (architecture review) | **Done** (M7.4) |
| 026 | The USDA key leaves the public JavaScript: the `usda-relay` Edge Function relays the app's two USDA searches with the key as the Supabase secret `FDC_API_KEY`; the browser never sends a key, and `DEMO_KEY` is gone. All visitors share USDA's quota for the relay (plan for 1,000 requests an hour) until M10 | USDA deactivates keys found public; owner, 2026-10-02 (via the PM chat), shared-quota trade-off accepted | **Done** (M7.5). Superseded by 034 |
| 027 | Map: Los Angeles County food places (food banks, farmers markets, named community gardens) from an OpenStreetMap snapshot in `resources`, labelled community-edited and dated; no ratings, no open/closed; location only on tap, never stored or sent | Owner, 2026-10-02 (planning chat; real map first, food places only) | **Done** (M9) |
| 028 | Processed-meat rules (M10.1): canned and deli chicken/turkey and deli roast beef in a salt or preservative solution are processed meat (WHO/IARC); rendered bacon fat alone is not bacon; foie gras and duck/goose mousse in cold-cut, sausage and canned categories read Known; injected or breaded fresh chicken stays "Nothing flagged"; fish is not meat. Rules are fixed before the data launches, then the launch audit repeats | Owner, 2026-10-03/04 (via the PM chat), after the M10 launch audit found 3 false flags and about 48 misses among 410 sampled products. Spec: `docs/superpowers/specs/2026-10-04-m101-processed-meat-rules-design.md` | Approved 2026-10-04; built with M10 |
| 029 | Meatballs and ribs are processed meat when smoked (the name says so), cured (celery powder or juice, nitrite, nitrate) or preserved (sodium or potassium lactate, sodium diacetate), the same rule as deli roast beef (028); plain ground-meat meatballs (meat, salt, spices, phosphate only) stay unflagged. In USDA's sausage categories, link, patty, banger and chipolata names, the abbreviations Saus, Ssg, Lk, Pty and typos such as Sauage count as sausage. Deli turkey filed under "Bacon, Sausages & Ribs" counts as processed | Owner, 2026-10-04 (via the PM chat), after the M10.1 re-gate stopped at 47 first-pass misses; spec `docs/superpowers/specs/2026-10-04-m102-sausage-cure-rules-design.md` | Approved 2026-10-04; built with M10 |
| 030 | The data-launch audit gate: zero confirmed false flags and at most 5 confirmed misses, each logged in `KNOWN_ISSUES.md`; the sampler prints the full label | Owner, 2026-10-04 (via the PM chat): a rule-by-rule hunt for every last miss never ends, and a wrong flag is the worse error | Active |
| 031 | The final data-launch gate after M10.3 is targeted: it re-checks only the entries of the earlier samples whose verdict changes under the new engine revision, the known false flags and misses, and a random spot check of 50 unchanged entries; pass = zero false flags and at most 5 logged misses (030), then Minh's 20 | Owner, 2026-10-05 (via the PM chat): the rule fixes are small and measured, a whole new sample would repeat what the first passes already showed | Active |
| 032 | Roast beef in an added brine or solution counts as processed meat: water plus salt, a stated "% solution", or a clean-label preservative such as cultured sugar and vinegar (decision 028 named sodium lactate and diacetate); plain cooked beef seasoned with salt and pepper does not. Spec `docs/superpowers/specs/2026-10-05-m103-roast-beef-brine-design.md` | Owner, 2026-10-05 (via the PM chat), after the M10.2 first pass found deli roast beef and roast beef inside sandwiches reading "Nothing flagged" | Approved 2026-10-05; built with M10 |
| 033 | Order of work after M10, one item at a time (work in progress at most one): 1 quick-wins batch (food icons, "Update info" buttons and crowd-sourced banner, expandable Profile rows, text size and high contrast), 2 Home redesign (mockup first), 3 Map near me (ZIP and radius, food pantries), 4 Collections (Saved), 5 M8 add-a-product, 6 points and levels, 7 non-food products. Unscheduled: Open Food Facts scores, produce, mercury marker, languages | Owner, 2026-10-05, after reviewing the live app; the triaged backlog is `docs/superpowers/ideas/2026-10-05-owner-app-review.md` | Active; item 1 = M11, **live 2026-10-07** (`docs/archive/2026-10-05-m11-quick-wins-design.md`); item 2 = M12 (035); item 3 = M13 (038); item 4 = M14 (043), live 2026-10-07 |
| 034 | USDA label data lives in EcoGo's own database: a read-only copy of USDA Branded Foods (one row per barcode, snapshot-dated) replaces live USDA calls; Open Food Facts stays a live, labelled fallback; the usda-relay Edge Function and its secret are retired | Owner, 2026-10-02: alternatives for any product, faster and more reliable scans, search beyond the catalog, safe at public scale | **Done** (M10). Supersedes the live-USDA part of 016 and decision 026. (Planned as 028; renumbered because 028-033 were taken first) |
| 035 | Home redesign (item 2 of 033) is layout A, the tile grid: the five explainer rows and the "How EcoGo checks a product" box become six big coloured tiles under "Learn", two per row, short labels, each opening its page; "How EcoGo checks" becomes a page. Spec `docs/archive/2026-10-06-m12-home-tiles-design.md` | Owner, 2026-10-06, picked from three mockups (A tile grid, B big buttons, C swipe row) | **Done** (M12, live 2026-10-07) |
| 036 | Map near me (item 3 of 033) gets food pantries from OpenStreetMap (adding `amenity=food_sharing`, community fridges) **plus** LA County Public Health's "Charitable Food Distribution Sites" (220, County open-data licence, updated 2024-04), labelled with source and date and a call-ahead note. Not used: 211 LA (terms forbid copying), LA Regional Food Bank locator (all rights reserved), County "Food Assistance" (2020, from 211), City "Public Food Access Sites" (no licence). Campus pantries such as Cerritos College's Falcon's Nest go into OSM by the owner | Owner, 2026-10-06, after the planner's licence check | Decided; spec after M12 is built (WIP ≤ 1 ahead) |
| 037 | Map near me finds a ZIP with a table built into the app: US Census 2026 Gazetteer ZCTA internal points (public domain), the ~480 ZCTAs within 20 mi of LA County; radius chips 5/10/15/20 mi; a ZIP not in the table says so | Owner, 2026-10-06 | Decided; spec after M12 is built |
| 038 | Map near me (M13) is layout A: ZIP box and My location on top, radius chips, the map with the search circle, the list below, nearest first. Spec `docs/archive/2026-10-07-m13-map-near-me-design.md` (with 036, 037) | Owner, 2026-10-07, picked from three mockups (A map on top, B list first, C full map with a pull-up list; the planner had recommended B) | **Done** (M13, live 2026-10-07) |
| 039 | Missing food places: in M13, a "Missing a place? Add it on OpenStreetMap" link (spec D10; the next snapshot picks places up). Later, **in-app "Suggest a place"** with an owner review queue, built with M8's sign-in and bot check (each suggestion needs a link to the place's own page; nothing is shown before review). Not chosen for now: suggest-by-email, a campus basic-needs sweep with a "For students" label | Owner, 2026-10-07, after the Falcon's Nest example (students-only centre + a monthly public distribution) | M13 part: building; suggestions: M8.1 (045) |
| 040 | The LA County "Charitable Food Distribution Sites" layer is **not used** for now: its own source note says the data came from 211LA Food Resources (May 2023), and 036 rejected 211 LA. M13 ships with OSM free food only; the owner asks LA County Public Health / 211LA for permission and the ~192 sites come back in a later milestone only with a yes in writing. Amends 036 | Owner, 2026-10-07, after Knight II read the layer's `copyrightText` during the M13 build | **Superseded by 041** the same day |
| 041 | The LA County layer **is used** in M13 after all, relying on the County's open-data licence (it publishes the facts under terms that allow republishing; 211LA's site terms bind its own users). Credit "LA County Public Health, from 211LA food resources (May 2023), updated April 2024"; County cards and the list footer say "Listed in 2023; may have changed. Check before you go." No permission email. If LA County or 211LA object, the file is deleted and the app redeployed | Owner, 2026-10-07, after the planner laid out the risks (legal risk low; the real risk is stale listings) | Active; M13 part 2 |
| 042 | Stale-data handling for Map places (M13 spec D11-D13): County rows get an asterisk footnote ("County listing from May 2023, last updated April 2024. Search the name or call 211 …"); every card gets "Report a problem": OSM places open an anonymous OSM note at the place, County places a pre-filled email to a dedicated EcoGo address the owner creates (button hidden until it exists); the owner keeps a checked "hidden County sites" list in the repo. Replaced by in-app reports when M8 lands (039) | Owner, 2026-10-07 | Active; M13 part 3; owner to create the email |
| 043 | Collections (item 4 of 033) = M14, layout A, the save sheet: one tap on the bookmark saves, a sheet offers lists (optional); Saved › Favorites shows lists as folders. Kept on this device only. Presets (Breakfast, Lunch, Dinner, Dessert, Snacks) are suggested chips, never empty folders; food-exchange groups wait for a source; lists can be renamed, deleted, items removed; the filled bookmark unsaves everywhere with Undo. Spec `docs/superpowers/specs/2026-10-07-m14-collections-design.md` | Owner, 2026-10-07, picked from three mockups (A save sheet, B list chips, C pick a list on every save; the planner recommended A) | **Done** (M14, live 2026-10-07; spec `docs/archive/2026-10-07-m14-collections-design.md`) |
| 044 | M8's "Check ingredients without a barcode" is reached from the Scan drawer (and the not-found screen's "Add this product" flow) only; **no Home entry**. Amends M8 spec D13 (its Home card) | Owner, 2026-10-07, at the M8 spec refresh (the planner recommended it: one less entry point; Home keeps Scan, search, recents, Learn) | **Done** (M8, live 2026-10-08) |
| 045 | In-app "Suggest a place" (039) and "Report a problem" (042) become **M8.1**, right after M8, reusing its anonymous sign-in, Turnstile and server function; own spec after M8 ships | Owner, 2026-10-07, at the M8 spec refresh (recommended over building them inside M8) | Active; M8.1 is next |
| 046 | The Supabase advisor WARN `auth_allow_anonymous_sign_ins` on `contributions` is **accepted**: anonymous users can read only their own rows (barcode, time, result), as M8 spec D7 designed for points and levels later | Owner, 2026-10-08, during the M8 E2E (Knight IV offered lock-down instead; the planner recommended accepting) | Active |
| 047 | M8 follow-up before going live on the real Open Food Facts: auto-trim the label text to "Ingredients" … first stop phrase, show the lines with checkboxes (the text box stays the final say; nothing changes after Send), upload photos in parallel with an honest "up to 30 seconds" wait text; then Minh repeats the phone test and swaps to the .org account. Spec `docs/superpowers/specs/2026-10-08-m8-followup-label-trim-design.md` | Owner, 2026-10-08, after his phone test (text mostly right but extra package text; Send 15–25 s); picked over auto-trim only and a crop box, and over going live first | **Done** (live 2026-10-08, 2d2136a; spec `docs/archive/2026-10-08-m8-followup-label-trim-design.md`); its parallel uploads reverted by 048 |
| 048 | M8 follow-up 2 after Minh's Takis-bag phone test (both Sends "Not sent": OFF's test server answered 500 to the parallel nutrition upload): photos upload one at a time again (047's speed-up reverted), partial success shows "Sent" + which photo didn't go through, 4 photo tips on the ingredients step, a "hard to read" retake hint that never blocks, only kept lines listed (the rest behind "Show N more lines"), unsure words counted on the kept text. Spec `docs/superpowers/specs/2026-10-08-m8-followup2-photo-quality-design.md` | Owner, 2026-10-08, picked the recommended options (retake suggested, not required; hide left-out lines; 4 short tips); the upload revert and partial-success wording are the planner's bug fixes | **Done** (live 2026-10-09, 91389f1; spec `docs/archive/2026-10-08-m8-followup2-photo-quality-design.md`) |
| 049 | M8 follow-up 3 after Minh's third phone test (Send 43 s, 33 s of it OFF's test server taking 3 photos one by one; a blurry ingredients photo and a blurry nutrition photo got no warning): "Sent" as soon as OFF has the text and ingredients photo, other photos finish in the background ("still uploading" line); an on-phone sharpness check on all 3 photos ("This photo looks blurry", Retake or Use it anyway); tips as a numbered row "1 Lay it flat · 2 Close & sharp · 3 Only the ingredients · 4 No glare". Spec `docs/superpowers/specs/2026-10-09-m8-followup3-blur-speed-design.md` | Owner, 2026-10-09, picked the recommended options (over waiting for the real OFF or smaller photos; all 3 photos over ingredients only; the planner's tip wording from his idea) | **Done** (live 2026-10-09, 56069ac; spec `docs/archive/2026-10-09-m8-followup3-blur-speed-design.md`); Minh's phone test passed (Send 10 s, blur notice, 3 photos on OFF) |
| 050 | M8 follow-up 4: a true progress bar on Send: the photo upload's real percent (via an upload that reports progress), then "Open Food Facts is saving it…"; "Checking you're human…" only while the robot check runs; accessible and reduced-motion safe. No server change. Spec `docs/superpowers/specs/2026-10-09-m8-followup4-send-progress-design.md` | Owner, 2026-10-09, after the follow-up 3 phone test; picked over a step bar and a moving bar with seconds | Active; next build (the switch to the real OFF doesn't wait for it) |
| 051 | M8 follow-up 5: people without an OFF account can help fix existing OFF products: "Add the ingredients" when OFF has none (same add flow; the server fills text only where OFF has none, D10) and "Send new photos" (photos only, no text) on every crowd-sourced OFF product; EcoGo never overwrites OFF text. Spec `docs/superpowers/specs/2026-10-09-m8-followup5-fix-off-products-design.md` | Owner, 2026-10-09, who has products on OFF with missing or wrong details; picked over "add missing only" and keeping Update info only; built right after follow-up 4, before M8.1 | Active; after follow-up 6 (052) |
| 052 | M8 follow-up 6 after Minh's first real submission (Celia's Red Lentils, 0094922021397, live on OFF): fix the false "blurry" on clear low-light photos, never prefill unreadable junk (empty box + "Show what we read"), a visible "No ingredients list? Type it" button, an optional Crop on each photo (the ingredients photo is read again), no empty line-list card. Built before follow-up 5 because junk text could reach the real OFF. Spec `docs/superpowers/specs/2026-10-09-m8-followup6-photo-fixes-crop-design.md` | Owner, 2026-10-09; crop placement picked from options (on the thumbnails, optional, over a preview after every photo or ingredients only); order picked (photo fixes first) | Active; after follow-up 4 |

## Open questions only the owner can answer

1. ~~Supabase access / live DB contents / RLS / edge function~~: moot after decision 008.
2. ~~Step-2 database shape~~: normalized (decision 009).
3. ~~Custom API layer for a course~~: moot. This is a personal project (clarified 2026-09-23).
4. ~~The owner's own goals~~: captured 2026-09-23 (see "Owner goals" above).
5. **Figma re-sync:** will you regenerate from Figma Make again? A re-sync would overwrite local edits.

## How to run

Live site: https://skynetrebel42.github.io/ecogo/ (rebuilt by GitHub Actions on every push to `main`; the build needs no
USDA key since M7.5). Repo: https://github.com/skynetrebel42/ecogo.

```bash
npm install
npm run dev      # http://localhost:5173 — reads the live "ecogo" Supabase project
npm run build    # production bundle in dist/
```

The Supabase URL and publishable key come from `.env` (committed; public by design). The app never writes the
catalog or anything else (scans aren't saved since M3). If Supabase is unreachable, the app falls back to the bundled CSV and shows
"Offline". To point at a different Supabase project, apply `supabase/migrations/` there in order and override
the two variables in a gitignored `.env.local`.

Barcode lookup needs no key: the app reads EcoGo's copy of USDA Branded Foods from the `foods` table (M10). To load or
refresh it (the owner's job, about twice a year and after any safety-library change; bump `ENGINE_REV`): download USDA's
Branded Foods JSON zip, put `SUPABASE_SERVICE_ROLE_KEY` in the worktree's gitignored `.env.local`, empty the table first
(a reload over a full table doubles its size until vacuum), then `npm.cmd run import:usda -- <the zip>`. No chat ever
reads or types that key.

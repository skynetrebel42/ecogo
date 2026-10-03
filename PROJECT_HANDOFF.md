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
  **M7.5 (2026-10-02): the USDA key left the public JavaScript** (the `usda-relay` Edge Function holds it). Next, in the
  PM chat's order: M9 real map (Los Angeles, OpenStreetMap), M10 data ownership (EcoGo's own copy of USDA Branded
  Foods, which retires the relay), then M8 add-a-product. See the KNOWN_ISSUES.md roadmap.
- **Runs locally:** yes. `npm install` → `npm run dev` → http://localhost:5173. It talks to the owner's live Supabase project.
- **What's real:** a live catalog of 51 products in Postgres (31 food products with USDA-verified barcodes and labels),
  USDA FoodData Central and Open Food Facts lookup for any other barcode, on-device camera scanning, a concern level
  (strongest official finding: additives, processed meat; acrylamide marker) from the safety engine (`src/lib/safety`,
  sourced library, `npm test` over all 51 products), FDA %DV nutrition, sourced explainers, the catalog loaded once per visit
  (scans are not saved), Recently scanned on this device, in-memory favorites (start empty).
- **What's still invented, but not shown (M7.4):** catalog prices and store ratings (`product_prices`, the CSV; K-30)
  and the Map's Chicago places (`resources`, `MapTab.tsx`; the Map tab is hidden until M9).
- **Backend:** Supabase project **`ecogo`** (`gippyavmxxzqxjkuahpt`, us-west-1, free). There are 5 normalized tables
  with RLS and explicit grants, and the schema lives in `supabase/migrations/`. The browser only reads the catalog
  and writes nothing (scan inserts revoked in M3). One Edge Function since M7.5, `usda-relay`, holds the USDA key as
  the Supabase secret `FDC_API_KEY` (decision 026). The old Figma project is retired (decision 008).
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
| 026 | The USDA key leaves the public JavaScript: the `usda-relay` Edge Function relays the app's two USDA searches with the key as the Supabase secret `FDC_API_KEY`; the browser never sends a key, and `DEMO_KEY` is gone. All visitors share USDA's quota for the relay (plan for 1,000 requests an hour) until M10 | USDA deactivates keys found public; owner, 2026-10-02 (via the PM chat), shared-quota trade-off accepted | **Done** (M7.5) |
| 027 | Map: Los Angeles County food places (food banks, farmers markets, named community gardens) from an OpenStreetMap snapshot in `resources`, labelled community-edited and dated; no ratings, no open/closed; location only on tap, never stored or sent | Owner, 2026-10-02 (planning chat; real map first, food places only) | **Done** (M9) |

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

Barcode lookup needs no key (M7.5): the app calls the `usda-relay` Edge Function, which accepts the live site and
`localhost`. The USDA key is the Supabase secret `FDC_API_KEY` (Dashboard → Edge Functions → Secrets), set by the owner;
no chat ever reads or types it. Redeploy the function with `verify_jwt` off after changing its code.

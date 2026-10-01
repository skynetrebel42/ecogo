# EcoGo! — Session synopsis (2026-09-23)

A one-page summary of the audit session. Details live in [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md),
[ARCHITECTURE.md](ARCHITECTURE.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## 1. Where things stood before

- The project was a **Figma Make export** (`EcoGo!.zip`, exported 2026-07-07). It had been unzipped into
  `Downloads\EcoGo!` and `npm install`ed on Sep 18.
- There was no git repo, no documentation beyond Figma's two-line README, and no type checking, linting or tests.
- An earlier handoff described the architecture and said security fixes had been drafted in a sandbox.
  **None of it had been checked against the actual files.**
- Open questions: Does it build? What's real and what's placeholder? How is Supabase wired in?
  Are the security fixes in the code?

## 2. What was done

| Step | Outcome |
|---|---|
| Confirmed the source | `Downloads\EcoGo!` is byte-identical to the ZIP (plus `package-lock.json`/`node_modules`) |
| Full code audit | 7 parallel readers (one per subsystem), each checked by an independent verifier trying to disprove its findings, plus a cross-file integrator. That was 15 agents in total, and every non-boilerplate file was read in full |
| Build | `npm run build` ✅ passes (one 780 KB JS bundle, which trips Vite's size warning) |
| Typecheck | Run with a temporary config outside the repo: 6 minor strict-mode errors, effectively clean |
| Ran the app | Every tab was clicked through in a browser **with Supabase stubbed out**, so the live database got no traffic. 9 bugs were reproduced on screen |
| Live database check | **Blocked by the permission system** (production read). Not retried, so the live DB state is still unknown |
| Documentation | Wrote `PROJECT_HANDOFF.md`, `ARCHITECTURE.md`, `KNOWN_ISSUES.md` and this file |
| Code changes | **None.** A diff against the ZIP shows only the new `.md` files |

## 3. What the audit found (assumed → actual)

| Earlier assumption | Reality |
|---|---|
| React → Edge Function → Postgres | The browser talks **directly** to the database with the public key. The edge function is effectively unused: its URL doesn't match its routes and no auth header is sent |
| Security patch drafted | **Absent.** Every write route is unauthenticated, and the browser writes to the DB too |
| Live data with an offline fallback | **Backwards.** Live mode wipes every price and score; the catalog only looks right offline (bug K-01) |
| "AI-powered ethical rating" | Hand-written text for products 1–7 and a template for the other 44 |
| Barcode scanner | Simulated: you pick one of 16 demo barcodes |
| Product importer calls external APIs | Offline only; it parses the bundled `products.csv` (51 products) |
| Ingredient safety checker | Produces 70 false "High Risk" labels across 31 of the 51 products (K-02/K-03) |
| Map of community resources | 18 hardcoded Chicago entries. It ignores the DB, and "My Location" empties it outside Chicago |
| About 40 UI files | 48 shadcn files, none of them used; 53 of 59 dependencies are unused |

**Still true from the earlier handoff:** one KV table (`kv_store_504b3bba`), a Hono edge function using the
service-role key, public seed routes, GPS stored with scans, CORS `*`, and the line counts.

## 4. What to do next to continue the build

**Step 0: safety net ✅ done.** The git repo is on `main`, with `9ccf3ce` as the untouched Figma baseline, then the
docs, then react/react-dom moved into `dependencies`. The build is verified after the change.

**Step 1: backend ✅ resolved by starting fresh.** The Figma database was in an account you can't access, so it's
retired. Your own project is **`ecogo`** (`gippyavmxxzqxjkuahpt`, US West, free plan).

**Step 2: normalized database + live mode ✅ done.** There are 5 tables (categories, products, product_prices,
resources, scan_events) with constraints, timestamps, row-level security and realtime. The schema is in
`supabase/migrations/`. The app reads the catalog from them, which fixes the price-and-score wipe (K-01), and scans
now save (K-04). The old unsecured backend is gone. Verified live: all 51 products match the CSV exactly, a scan row
was saved, browsers can't edit the catalog or read scans, and a price changed in the database updated the open app
in about 3 s.

**Your goals (captured 2026-09-23):** a showcase of your skills, heading toward a public app; product safety and
barcode scanning first; free tier only; no deadline. The prototype is **done** when you can scan a real food product
with your phone's camera and get a trustworthy safety score. The full answers are in PROJECT_HANDOFF.md → "Owner goals".

**Step 3: trustworthy safety analysis. ✅ Done 2026-09-25** (`764271c`…`74e5d52`). A sourced 17-ingredient library
(IARC, EU, FDA; every entry has a verbatim quote), a parser that reads sub-ingredients, and a verdict computed from the
ingredients. The product page shows flagged ingredients with their sources; lists show the same verdict; no AI labels.
`npm test` checks all 51 products.

**Step 4: product lookup. ✅ Done 2026-09-28.** Barcodes outside the 51 featured products are looked up in USDA
FoodData Central (manufacturer label data), then Open Food Facts (crowd-sourced, labelled), and get the same ingredient
check. Every looked-up page says where its data came from.

**Step 5: deploy + public GitHub repo. ✅ Done 2026-09-29.** Live at https://skynetrebel42.github.io/ecogo/ (GitHub
Pages, rebuilt by GitHub Actions on every push), repo github.com/skynetrebel42/ecogo. Scans are no longer saved.

**Step 6: concern levels. ✅ Done 2026-09-30.** Every product shows one badge that darkens with the strongest official
finding: Nothing flagged (grey), Some concern, High concern, Known carcinogen. No green, because "nothing flagged" isn't
"healthy". Processed meat reads Known carcinogen (IARC Group 1). Fried and baked starchy foods get a 🔥 "forms when
cooked" acrylamide marker with sources, which never changes the badge.

**Step 7: nutrition + real catalog barcodes. ✅ Done 2026-10-01.** Product pages show added sugar, saturated fat and
sodium as the FDA's % Daily Value per serving, marked High (20% or more) or Low (5% or less) by the FDA's own rule; list
cards show one "High sugar"-style chip. Products that only contain processed meat (DiGiorno) now read High concern
instead of Known carcinogen. 31 catalog foods carry their real USDA barcode and label; 3 unverifiable codes were removed.

**Step 8: real camera scanning + mobile layout.** Phone-camera scanning on iPhone, Android and laptop; full-screen on
phones. (Scans are no longer saved at all since M3.)

**Later:** a map that follows the user's location (Los Angeles as the default, real places from OpenStreetMap),
persistent favorites, cleanup; accounts only if a feature needs per-user data.

## 5. How to start the next session

Open Claude Code in `C:\Users\minhb\Downloads\EcoGo!` and say something like:

> Read PROJECT_HANDOFF.md, ARCHITECTURE.md and KNOWN_ISSUES.md (steps 0–7 are done; the live site is
> https://skynetrebel42.github.io/ecogo/; my Supabase project is
> `ecogo` / `gippyavmxxzqxjkuahpt`; my goals are in PROJECT_HANDOFF.md → "Owner goals").
> Do roadmap step 8 (M6): real camera scanning and the mobile
> layout. Every push to main publishes the site, so ask before pushing. Keep each
> change small, commit each one, verify it in the running app, and keep `npm test` green.

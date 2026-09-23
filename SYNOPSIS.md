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

**Step 0: safety net ✅ done.** The git repo is on `main`, with `63eef63` as the untouched Figma baseline, then the
docs, then react/react-dom moved into `dependencies`. The build is verified after the change.

**Step 1: backend ✅ resolved by starting fresh.** The Figma database was in an account you can't access, so it's
retired. Your own project is **`ecogo`** (`gippyavmxxzqxjkuahpt`, US West, free plan).

**Step 2: normalized database + live mode ✅ done.** There are 5 tables (categories, products, product_prices,
resources, scan_events) with constraints, timestamps, row-level security and realtime. The schema is in
`supabase/migrations/`. The app reads the catalog from them, which fixes the price-and-score wipe (K-01), and scans
now save (K-04). The old unsecured backend is gone. Verified live: all 51 products match the CSV exactly, a scan row
was saved, browsers can't edit the catalog or read scans, and a price changed in the database updated the open app
in about 3 s.

**Step 3: make ingredient analysis trustworthy (K-02, K-03).** Match whole words instead of substrings,
don't split names like "1,4-dioxane", and add one small automated check that no product gets a false high-risk label.

**Step 4: quick UX batch.** Filter alternatives by category and make them clickable; show one consistent
score in lists and detail; stop the map emptying outside Chicago; add a crash guard and error boundary; make
the Live/Offline banner honest; fix "See all" deals.

**Step 5: persist favorites and scanned items** (localStorage for now).

**Later, in this order:**
- Delete dead code and unused dependencies.
- Make the map read coordinates from the database, so adding a resource puts a pin on the map. That's a great live demo.
- Split `App.tsx` one piece per commit.
- Add sign-in plus favorites/reviews tables.
- Rate-limit scans, then write the final documentation.

## 5. How to start the next session

Open Claude Code in `C:\Users\minhb\Downloads\EcoGo!` and say something like:

> Read PROJECT_HANDOFF.md, ARCHITECTURE.md and KNOWN_ISSUES.md (steps 0–2 are done; the repo is on `main`; my
> Supabase project is `ecogo` / `gippyavmxxzqxjkuahpt`). Do step 3: fix the ingredient matcher and parser
> (K-02, K-03) and leave one small check that no product gets a false high-risk label. Keep each change small,
> commit each one, and verify it in the running app.

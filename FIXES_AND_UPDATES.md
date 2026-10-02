# EcoGo! — Fixes and updates

Every fix or small update that isn't its own milestone spec goes here, **newest first**. Milestones (M1–M6) have
their own specs and plans in `docs/superpowers/`; open issues and the roadmap live in `KNOWN_ISSUES.md`.

Each entry says **what was wrong** (or asked for), **why** (root cause or reason), **what changed**, **how it was
checked**, and the **commit**.

| Date | Fix / update | Commit |
|---|---|---|
| 2026-10-02 | Over-engineering cleanup (ponytail audit): importer 608 → 76 lines, price plumbing, unused files, tokens, a dependency | `5ea0ce8`…`4843e2b` |
| 2026-10-02 | Product page header fits its content (empty band where the price was) | `06ab0d7` |
| 2026-10-02 | `recent.ts` cleanup: unused `barcode`/`at` fields, `now` parameter and `RECENT_KEY` export removed | `f9ed15a` |
| 2026-10-02 | `check-home.mjs`: fresh Edge profile every run (flaky first-visit check) | `ba8cc10` |
| 2026-10-01 | `check-home.mjs` exits when done (it waited for its 120 s timeout) | `25ac748` |
| 2026-10-01 | Open Food Facts "Looks wrong? Fix it" and "Add it" links | `39ff6e3` |
| 2026-10-01 | Search: whole-word matching + "More from USDA" results | `9d32c29` |
| 2026-10-01 | Camera: HD capture for iPhone/PC, start-up race, `?debug` readout | `8cb7bec` |

---

## 2026-10-02 — Over-engineering cleanup from a ponytail audit (`5ea0ce8`…`4843e2b`)

- **Asked:** the PM chat relayed a whole-repo over-engineering audit, and the owner approved a no-behaviour-change
  cleanup before M7.5: about −1,060 lines and one dependency fewer. Leaflet, leaflet.markercluster and `MapTab.tsx`
  stay for M9.
- **Why:** code nothing reads. The Figma export's CSV importer logged diagnostics no one looked at, the price code
  outlived the prices on screen (M7.4), and the Figma template left unused theme tokens, an animation library, an
  unused font, an empty PostCSS config and its build prompt.
- **Changed (one commit each):**
  - `5ea0ce8` price plumbing: `bestPrice`, the `amazon`/`walmart`/`facebook` fields on `Product`, `product_prices`
    in `catalog.ts`'s select and mapping, and `product_prices` in the realtime loop. The DB rows stay; `resources`
    stays in the loop for M9. `ProductSource` (asked for too) was **kept**: it describes a looked-up product's source
    and is used by `lookup.ts` and the product page.
  - `ca38c21` `productImporter.ts` 608 → 76 lines: split quoted lines (`splitCSVLine`, exported), first row per id,
    build `Product`. The validation reports, warnings and `IMPORT_DIAGNOSTICS` are gone.
  - `854ce20` `scripts/apply-verified-barcodes.mjs` imports `splitCSVLine` instead of its own copy.
  - `3b5db9e` deleted `src/imports/pasted_text/project-guidelines.md` (the Figma Make prompt, unreferenced).
  - `3cfc31b` `theme.css`: the unused `--sidebar-*`, `--chart-*`, `--popover*`, `--accent*`, `--destructive*`,
    `--input-background` and `--switch-background` tokens and their `@theme` mappings.
  - `935cbaf` deleted `postcss.config.mjs` (`export default {}`; no parent folder has a PostCSS config).
  - `b2b5a6f` removed the `tw-animate-css` dependency and its `@import`.
  - `e73ca51` DM Mono out of the Google Fonts URL; `fonts.css` and `tailwind.css` merged into `index.css`.
  - `4843e2b` `App.tsx` imports `Product` directly (no `CsvProduct` alias).
- **Checked:** every name grepped before deleting it. `npm test` 157/157 and `npm run build` green after each commit.
  The parsed CSV catalog (51 products) is byte-for-byte identical before and after the importer changes; the barcode
  script's SQL output is identical and `products.csv` unchanged. A declaration-level diff of the built CSS shows only
  the removed tokens, tw-animate-css's own properties, a `.paused` rule Tailwind generated from a state string (never a
  class), and the font URL. `check-home.mjs` 32/32 against `vite preview`. Net −1,066 lines (54 added, 1,120
  removed); JS 572 → 565 KB, CSS 37.4 → 35.1 KB.

---

## 2026-10-02 — Product page header fits its content (`06ab0d7`)

- **Asked:** after M7.4 took the price and store chips out of the product page's coloured header, its fixed 268 px
  minimum height left an empty band. The owner asked to fix it before pushing.
- **Changed:** the header's `minHeight: 268` is gone, so it takes its content's height (`ProductDetailScreen.tsx`).
- **Checked:** `npm test` 157/157, `npm run build`, `check-home.mjs` 32/32 against `vite preview`; a 390 px
  screenshot of Diet Coke shows the header ending just below the name and badge.

---

## 2026-10-02 — `recent.ts` cleanup from a code review (`f9ed15a`)

- **Asked:** a code review found code that does nothing. Each "Recently scanned" entry saved a `barcode` and a time
  (`at`) that nothing reads, `addRecent` took a `now` time only to store it, `RECENT_KEY` was exported but never
  imported, and `greeting` had a default parameter no caller uses.
- **Why:** the list's order already is the recency, and products are looked up by id, so the extra fields were dead
  weight to read past before accounts add syncing.
- **Changed:** `RecentEntry` is `{ id, product? }` and `addRecent(list, p)` has no `now`. `parseRecent` no longer
  requires `barcode`/`at`, so lists saved by older versions still load (extra fields are ignored); the one-use snapshot
  check is inlined. `RECENT_KEY` is no longer exported; `greeting()` reads the hour inside. `App.tsx` calls updated.
  No behaviour change.
- **Checked:** `npm test` 156/156 (the parse test keeps an old-format `{ id, barcode, at }` entry and now also
  round-trips a new-format list); `npm run build` green; `check-home.mjs` against `npm run build` +
  `vite preview --port 4317`: 24/24 on the first run.

---

## 2026-10-02 — `check-home.mjs`: fresh Edge profile every run (`ba8cc10`)

- **Wrong:** the first run of the M7.2/M7.3 check failed "first visit shows How EcoGo checks a product" (23/24); the
  next runs passed.
- **Root cause:** the script names Edge's profile folder only by a random port (9600–9689), and 19 old folders existed,
  so about 1 run in 5 reused one. Edge is killed right after the last check (Clear), possibly before it writes local
  storage to disk, so a reused profile could still hold an old "Recently scanned" list: not a first visit.
- **Changed:** the script deletes its profile folder before starting Edge. Found while running the M7.2/M7.3 plan's
  Task 3; not in the plan.
- **Checked:** against `npm run build` + `vite preview --port 4317`: 24/24 on three runs in a row.

---

## 2026-10-01 — `check-home.mjs` exits when done (`25ac748`)

- **Wrong:** M7's headless check (`docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs`) printed
  "12/12 checks passed", then sat for two minutes and printed "TIMEOUT", exiting with code 1 although every check
  passed.
- **Root cause:** the DevTools WebSocket stayed open after the checks, so Node kept running until the script's 120 s
  safety timer killed it.
- **Changed:** the script calls `process.exit` at the end (0 when every check passed, 1 otherwise). Found while building
  M7 and extending the check for M7.1; not in either spec.
- **Checked:** against `npm run build` + `vite preview --port 4317`: 17/17 checks passed, exit code 0, no wait.

---

## 2026-10-01 — Open Food Facts "Looks wrong? Fix it" and "Add it" links (`39ff6e3`)

- **Asked for (owner):** Open Food Facts data is crowd-sourced and can be wrong; let users correct it, ideally with a
  photo of the label.
- **Decision:** option A now. EcoGo links to Open Food Facts' own forms, where users sign in with their own OFF account.
  OFF's AI (Robotoff) suggests nutrition values from label photos, and its community checks them. EcoGo never writes to
  OFF and never stores user-typed values (facts first). Option B, an in-app form and photo sent through a registered
  EcoGo app account, waits for accounts and spam protection.
- **Changed:**
  - Pages whose data came from OFF show "Looks wrong? Fix it on Open Food Facts", linking to OFF's edit form with the
    barcode filled in.
  - The not-found screen links to OFF's add form ("Add it to Open Food Facts (barcode filled in)").
  - USDA and catalog pages show no link, because their data isn't from OFF.
  - `offEditUrl` / `offAddUrl` live in `src/lib/lookup.ts`.
- **Checked:** both OFF URLs open the right form live, with the barcode prefilled. A unit test pins the URLs. A
  headless browser check passed 3/3: the OFF product shows the link, the USDA product doesn't, and the not-found
  screen shows the add link.

## 2026-10-01 — Search: whole-word matching + "More from USDA" results (`9d32c29`)

- **Wrong (owner):** searching "ice cream" showed orange juice, iced tea, sliced cheese, butter, bread and dog food.
- **Root cause:** the search matched any keyword containing the query's first word ("ju-**ice**", "**ice**d",
  "sl-**ice**d", "r-**ice**"), and the keyword "cream" matched butter.
- **Changed:**
  - `src/lib/search.ts`: every typed word must appear as a whole word (plurals either way) in the name, brand,
    category or keywords.
  - Below our results, a "More from USDA FoodData Central" list of up to 10 real products (`searchUsda`, one request
    per search text per session). Each opens with its source line and nutrition.
- **Checked:**
  - Unit tests: "ice cream" → only Ben & Jerry's; plurals, brands, blank input; the USDA search mapper and its
    cache, on a recorded response.
  - Headless browser check 5/5.

## 2026-10-01 — Camera: HD capture for iPhone/PC, start-up race, `?debug` readout (`8cb7bec`)

- **Wrong (owner's phone test after M6):** Android scanned perfectly; on iPhone and PC the camera showed but never
  read a barcode.
- **Root cause:**
  - Android uses its built-in barcode reader, while iPhone and PC use ZXing (WebAssembly).
  - Without a requested size, Safari and desktop Chrome capture about 640×480.
  - Reproduced in Node: ZXing misses a slightly blurred barcode at about 2 px per bar, but reads it at 1920×1080.
    Changing ZXing's own settings made no difference.
- **Changed:**
  - The camera asks for 1920×1080 (`CAMERA_CONSTRAINTS`, the camera picks its nearest size), plus continuous
    autofocus where supported.
  - **The race:** start-up no longer overwrites "Camera paused." when the phone is locked mid-start.
  - Opening the site with `?debug` shows the real camera size, frames read and any reader error.
- **Checked:**
  - Unit test on the constraints. The headless camera checks went from 1/3 to 4/4 runs passing 12/12, and 12/12 on
    the live site.
  - **The owner confirmed scanning on Android, iPhone and PC.** This met prototype criterion 1, so the prototype is
    done.

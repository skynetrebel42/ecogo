# EcoGo! — Fixes and updates

Every fix or small update that isn't its own milestone spec goes here, **newest first**. Milestones (M1–M6) have
their own specs and plans in `docs/superpowers/`; open issues and the roadmap live in `KNOWN_ISSUES.md`.

Each entry says **what was wrong** (or asked for), **why** (root cause or reason), **what changed**, **how it was
checked**, and the **commit**.

| Date | Fix / update | Commit |
|---|---|---|
| 2026-10-05 | M10.3 roast beef in a brine, ribs, meat sticks; "Franks Red Hot" and coconut "meat" false flags; targeted audit | `e890a2c` |
| 2026-10-04 | M10.2 sausage names, cured and preserved meat (the M10.1 re-gate's misses); full labels in the audit | `a958a32` |
| 2026-10-04 | M10.1 processed-meat rules (the M10 launch audit's misses and false flags) | `4e8509b` |
| 2026-10-03 | M10 plan deviations: importer batched delete, search/alternatives timing, audit sampler | `a56af25`, `15d2935`, `17b2542` |
| 2026-10-02 | Map: a failed My location after a success drops the old position | `5340bbb` |
| 2026-10-02 | Audit batch: no realtime, no `?debug`, shared comparators/constants, duplicate files out | `39a06ca`…`d23d2de` |
| 2026-10-02 | Over-engineering cleanup (ponytail audit): importer 608 → 76 lines, price plumbing, unused files, tokens, a dependency | `5ea0ce8`…`4843e2b` |
| 2026-10-02 | Product page header fits its content (empty band where the price was) | `06ab0d7` |
| 2026-10-02 | `recent.ts` cleanup: unused `barcode`/`at` fields, `now` parameter and `RECENT_KEY` export removed | `f9ed15a` |
| 2026-10-02 | `check-home.mjs`: fresh Edge profile every run (flaky first-visit check) | `ba8cc10` |
| 2026-10-01 | `check-home.mjs` exits when done (it waited for its 120 s timeout) | `25ac748` |
| 2026-10-01 | Open Food Facts "Looks wrong? Fix it" and "Add it" links | `39ff6e3` |
| 2026-10-01 | Search: whole-word matching + "More from USDA" results | `9d32c29` |
| 2026-10-01 | Camera: HD capture for iPhone/PC, start-up race, `?debug` readout | `8cb7bec` |

---

## 2026-10-05 — M10.3 roast beef in a brine, ribs, meat sticks, two old false flags (`e890a2c`)

- **Wrong:** the M10.2 first pass (1,106 products) found 2 false flags, both live on `main` since before M10: "FRANKS RED HOT
  SAUCE" read as franks (a buffalo chicken pizza), and "COCONUT MEAT" backed a "Coconut Jerky" name (Known). It also found 13
  misses: ribs whose label lists only the coating or marinade, celery-cured ribs under "Cooked & Prepared", Jack Link's meat
  sticks with cultured celery, roast beef in a brine, and brined roast beef inside sliders and sandwiches.
- **Why:** "franks" was only skipped before an apostrophe; any item with the word "meat" counted as meat; the cure rule of
  M10.2 needed a meat item first on the label and didn't know meat sticks, "Cooked & Prepared" or roast beef in a brine.
  Spec: `docs/superpowers/specs/2026-10-05-m103-roast-beef-brine-design.md` (decisions 031 and 032, defaults D4-D6).
- **Changed:** the processed-meat block of `foodConcerns.ts` (rules F1, F2, R1-R4), new `processedMeatBrine.test.ts`,
  `processedMeatCure.test.ts` replaced (C6 follows decision 032), `ENGINE_REV` 3 → 4. `audit-foods.mjs --recheck` re-scores
  the earlier samples for the targeted gate (decision 031) and adds the M10.3 prompt line. 4 misses stay, logged in
  `KNOWN_ISSUES.md`.
- **Checked:** `npm test` 217/217 (the new tests failed 6/22 before the code); `npm run build` green; `verify:sources` 16 pass,
  0 fail, 16 unverifiable (as in M10.2); recheck of the 1,615 M10.1 and M10.2 sample rows against the stored rev-3 scores:
  15 change, each read against its full label (the spec's 12, plus 3 Slim Jim sticks with nitrite going High → Known).

---

## 2026-10-04 — M10.2 sausage names, cured and preserved meat (`a958a32`)

- **Wrong:** the M10.1 re-gate stopped after 220 clean-meat products: 0 false flags, 47 misses. 31 were real: sausage
  patties and links under USDA's abbreviations and typos ("Saus,Pty", "Ssg", "Sausge", "Breakfast Links"), deli turkey
  under "Bacon, Sausages & Ribs", smoked ribs and celery- or lactate-preserved meatballs. The live table also showed about
  430 bacon and ham products in USDA's generic prepared-meat category with an additive badge but no meat finding.
- **Why:** the brine-only rule (M10.1 A1) needs a meat word in the name and didn't count the generic category; no rule
  covered cured or preserved meatballs and ribs. Spec: `docs/superpowers/specs/2026-10-04-m102-sausage-cure-rules-design.md`
  (owner decisions 029 and 030, defaults D4-D6).
- **Changed:** the processed-meat block of `foodConcerns.ts` (rules S, C, G, N, P), new `processedMeatCure.test.ts`,
  `ENGINE_REV` 2 → 3. Also removed six lines of the M10.1 asset's header that the M10.1 paste left in `foodConcerns.ts`
  as comments (the splice matched the header's own mention of its start line). `audit-foods.mjs` prints full labels
  (a 600-character cut made about 30 first-pass answers "unsure"), widens the clean-meat draw and adds the M10.2 prompt
  paragraph.
- **Checked:** `npm test` 211/211 (the 16 new failed 11/16 before the code); `npm run build` green; `verify:sources`
  16 pass, 0 fail, 16 unverifiable (EUR-Lex now bot-gates its 7 pages; the other 9 as before); sampler dry-run on the
  rev-2 table: 1,197 entries in 30 batches.

---

## 2026-10-04 — M10.1 processed-meat rules (`4e8509b`)

- **Wrong:** the M10 launch audit (410 products) found 3 false flags (a fresh "Pork Ham Bone In" read Known; "RENDERED
  BACON FAT" and imitation "BACON BITS (SOY FLOUR…)" read as bacon) and about 48 misses among 110 "Nothing flagged" meat
  products (real ham, salami, sausage).
- **Why:** labels that list only a ham's brine or cure gave no meat item; a "…flavored" word hid the whole product;
  "vegetarian-fed" read as meat-free; hog, duck, boar, elk and others weren't known meats; a "no nitrates… added" claim
  glued to the first ingredient was dropped with the pork. Spec: `docs/superpowers/specs/2026-10-04-m101-processed-meat-rules-design.md`
  (owner decisions D1-D3, defaults D4-D7).
- **Changed:** the processed-meat block of `foodConcerns.ts` (rules A1, A3, B, C, D, F), the claim prefix in `parse.ts`
  (rule E), new `processedMeatRules.test.ts`, `ENGINE_REV` 1 → 2 so re-imported rows say which engine scored them.
  The live app's USDA lookups use the same engine. The gaps left on purpose are in `KNOWN_ISSUES.md`.
- **Checked:** `npm test` 195/195 (the asset has 15 new tests, not the 16 the spec says); `npm run build` green;
  `verify:sources` 23 pass, 0 fail, 9 unverifiable (unchanged). The re-gate on a re-imported table is pending.

---

## 2026-10-03 — M10 plan deviations found on the real 430k-row table (`a56af25`, `15d2935`, `17b2542`)

- **Importer** (`a56af25`): one `DELETE` of older snapshots hit the free tier's statement timeout on the first real
  import. Now `deleteOlderSnapshots` removes 500 at a time, with a snapshot index (migration in `15d2935`).
- **Search and alternatives** (`15d2935`): `search_foods` took ~7.5 s (a `set search_path` SQL function can't be inlined,
  so it ran on a generic plan with `ts_rank`), over the anon role's 3 s limit. Now plpgsql `EXECUTE`, at most 1,000
  matches ordered shortest name first; alternatives get a partial index on `(category, verdict_rank, flags, name)`.
  Four migrations, each approved by the owner.
- **Audit sampler** (`17b2542`): filtered counts and offset reads timed out (empty error). `audit-foods.mjs` now pages
  along the primary key and samples in memory.
- **Checked:** the import finished (430,127 rows); search and alternatives answer under the anon timeout cold; the sampler
  drew the M10 audit sample.

---

## 2026-10-02 — Map: a failed My location after a success drops the old position (`5340bbb`)

- **Wrong:** after a successful My location, a second try that failed (permission denied, timeout) showed "Location is
  off. Showing Los Angeles." while the list stayed "Nearest first" from the old position, with the blue dot still drawn.
- **Root cause:** the geolocation error callback set the note and flew to LA but never cleared `userLoc`
  (`MapTab.tsx`). Found by the M9 final review (Minor).
- **Changed:** the error callback clears the old position (`setUserLoc(null)`), so the list is A–Z again.
- **Checked:** `check-map.mjs` gained "a failed My location after a success drops the old position": it failed before
  the fix and passes after (20/20); `check-home.mjs` 32/32; `npm test` 174/174.

---

## 2026-10-02 — Audit batch after M9 (`39a06ca`…`d23d2de`)

- **Asked:** the PM chat's no-behaviour-change audit batch (owner decision: after M9), plus three items from its
  review of M9.
- **Why:** code nothing needs or that says the same thing twice.
- **Changed (one commit each):** `39a06ca` no realtime channel or `loadData` callback (the catalog is read-only for
  visitors; one load per visit) · `5a1e9f8` the `?debug` camera readout removed · `5539cb6` one `fewestConcerns`
  comparator in `verdict.tsx` for the search sort and the alternatives (the alternatives keep their name tie-break) ·
  `fd6401a` one constant for the known/high/some small print · `44c7895` `analyze.ts` exports the level order, used by
  `assess.ts` · `1c85845` `lookup.ts` reuses `nutrition.ts`'s `record()` · `50cb462` the plans' two copies of
  `verified-barcodes.json` deleted (`src/data` is the source of truth) · `0e6b143` `formatAsOf` uses
  `Intl.DateTimeFormat` (UTC) · `91ce319` one `toLa()` · `d23d2de` `locationOff` boolean.
- **Checked:** every name grepped first; `npm test` 174/174 and `npm run build` after each commit; `check-home.mjs`
  32/32 and `check-map.mjs` 20/20 against `vite preview`. The one visible difference: a catalog change made while
  the app is open now shows after a reload instead of within seconds.

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

# EcoGo! — Fixes and updates

Every fix or small update that isn't its own milestone spec goes here, **newest first**. Milestones (M1–M6) have
their own specs and plans in `docs/superpowers/`; open issues and the roadmap live in `KNOWN_ISSUES.md`.

Each entry says **what was wrong** (or asked for), **why** (root cause or reason), **what changed**, **how it was
checked**, and the **commit**.

| Date | Fix / update | Commit |
|---|---|---|
| 2026-10-01 | `check-home.mjs` exits when done (it waited for its 120 s timeout) | `25ac748` |
| 2026-10-01 | Open Food Facts "Looks wrong? Fix it" and "Add it" links | `39ff6e3` |
| 2026-10-01 | Search: whole-word matching + "More from USDA" results | `9d32c29` |
| 2026-10-01 | Camera: HD capture for iPhone/PC, start-up race, `?debug` readout | `8cb7bec` |

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

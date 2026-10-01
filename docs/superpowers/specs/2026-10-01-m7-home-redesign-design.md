# M7: Home redesign (scan first, recently scanned, explainers; no fake content): design spec

- **Date:** 2026-10-01
- **Status:** draft, awaiting the owner's review
- **Designed with:** the owner (Minh Bui), 2026-10-01, through multiple-choice questions and the clickable mockup
  https://claude.ai/artifact/VVjduE8kRSBkUKimwFzEUf. They chose **layout A** ("Scan first"; its first-visit state is
  the second artboard).
- **Builds on:** M4 badge (`verdict.tsx`), M5 nutrition chips (`NutritionPanel.tsx`, `knownNutrition`), M6 scanning,
  the search fix (`search.ts`, `9d32c29`).

## 1. Why

Home is the first screen people see, and almost all of it is still Figma filler:
- the greeting "Good morning, Alex 👋" (an invented name);
- a "Chicago, IL (demo places)" location pill;
- 15 invented places with made-up "Rating" scores and "Why recommended?" texts;
- 3 fake deals;
- fictional community resources.

The owner noticed the scores and deals weren't real. The new Home does the app's real job: scan or search, get back
to what you looked at, and learn the two things people most often misread about EcoGo's results.

**Done for M7:**
- Home shows only real things: a time-based greeting, Scan, search, recently scanned (real badges and chips) and two
  sourced explainers.
- Nothing invented remains on Home.
- The Saved tab's "Scanned" list uses the same recent-products store, replacing its fake seed of ids `[2, 6]`.

## 2. Decisions (owner, 2026-10-01, unless marked *recommended default*)

| # | Decision |
|---|---|
| H1 | Layout A (mockup "A · Scan first"), top to bottom: greeting → **Scan a product** card → search → **Recently scanned** row → **Hidden risks, explained** cards → bottom nav |
| H2 | Greeting: time-based ("Good morning / afternoon / evening"), no name until accounts exist; subtitle "What are you eating?" |
| H3 | **Remove**: invented recommendations (`RECOMMENDATIONS`, `RecommendationCard`, `WhyModal`, `RecommendationSection`, `DEFAULT_SCORE_THRESHOLD`, `scoreColor`), `DEALS`, the location pill, and Home's community-resources section. The Map tab keeps its demo resources until the real-map milestone |
| H4 | Explainer cards (2): **"'Nothing flagged' isn't 'healthy'"** and **"What the badge levels mean"**. Each opens a short page with its official sources |
| H5 | **Recently scanned** = the last 10 products opened from Scan or a lookup, **saved on this device** (browser storage; no account; nothing sent anywhere), kept between visits, with a "Clear" action |
| H6 | First visit (nothing scanned yet): "How EcoGo checks a product" (3 steps) shows where the recent row goes *(from mockup)* |
| H7 | Saved › Scanned reads the same store (replaces the in-memory `scannedIds`, seeded with fake ids `[2, 6]`) *(recommended default)* |

## 3. Facts the explainers rest on (already verified in earlier specs; reused verbatim)

- **FDA 5/20 rule** (M5 spec §3): "5% DV or less of a nutrient per serving is considered low. 20% DV or more of a
  nutrient per serving is considered high." `FDA_RULE` in `src/lib/nutrition.ts`.
- **IARC: classification describes evidence, not risk** (M4 spec §3, IARC Q&A vol. 114): "this does NOT mean that
  they are all equally dangerous", and "The IARC classifications describe the strength of the scientific evidence about
  an agent being a cause of cancer, rather than assessing the level of risk." The second sentence is on the same page;
  the plan re-checks it by hand (the page is a PDF).
- **Badge mapping** (M4 `deriveSeverity`, M5):

  | Badge | Official basis |
  |---|---|
  | ○ Nothing flagged | None |
  | ◔ Some concern | IARC 2B, or an EU warning label |
  | ◑ High concern | IARC 2A, a ban in the EU/US, or "contains processed meat" |
  | ● Known carcinogen | IARC Group 1 |

## 4. Design

### 4.1 Recent products (`src/lib/recent.ts`, new, pure + a thin storage wrapper)

- `RecentEntry = { id: number; barcode: string; product?: Product; at: number }`.
  - Catalog products (positive id) store only `id`/`barcode`, and are re-resolved from the current catalog on read,
    so the data stays fresh.
  - Looked-up products (negative id) store the full `Product` snapshot, so they reopen without a request.
- `addRecent(list, product, now)` puts the product first, removes any earlier entry with the same id, and caps the
  list at 10. It's pure and tested.
- `resolveRecent(list, catalog)` returns a `Product[]`. A catalog id no longer in the catalog is dropped. Pure and
  tested.
- `loadRecent()` / `saveRecent()` read and write `localStorage["ecogo.recent.v1"]` inside `try/catch`. If the
  storage is missing, full, blocked or the JSON is corrupt, the list is empty and nothing crashes. A malformed entry
  is skipped.
- `App.tsx` holds `recent` in state: it loads on start and saves on change. Opening a product from **Scan** or from a
  USDA/OFF search result adds it. Opening a catalog product from search also adds it *(recommended default: "looked
  at" counts)*.

### 4.2 Home (`HomeTab` in `App.tsx`, rewritten)

- **The greeting** comes from `new Date().getHours()`: under 12 "Good morning", under 18 "Good afternoon", otherwise
  "Good evening". The subtitle is "What are you eating?".
- **The Scan card** is a large `<button>` that switches to the Scan tab (`onGoScan`), with the existing scan icon.
  It reads "Scan a product · Point your camera at the barcode".
- **Search** is the existing input; Enter opens search results (behaviour unchanged).
- **Recently scanned:**
  - a horizontal row of compact cards (name, badge icon + short label, and a "High …" nutrition chip when known),
    each opening the product;
  - "See all" goes to Saved › Scanned, and "Clear" (with an `aria-label`) empties the list.
  - Empty: the "How EcoGo checks a product" card (3 steps, mockup text).
- **Hidden risks, explained:** two cards, each opening an explainer screen (§4.3).
- **Removed:** everything in H3.

### 4.3 Explainer screens (`src/app/components/Explainer.tsx`, new)

A sub-screen with a back button, a title, short plain-English text, and a "Sources" list (body, finding, link,
"Source checked" date).
- **"'Nothing flagged' isn't 'healthy'":**
  - The badge checks for hazards with an official finding (additives, processed meat). It doesn't rate nutrition.
  - Look at the Nutrition section: by FDA's rule, 20% DV or more per serving is high. Example: Oreo is "Nothing
    flagged" but 28% DV added sugar.
  - Source: FDA (`FDA_RULE`).
- **"What the badge levels mean":** the four levels with the table in §3, plus "🔥 Forms when cooked" (acrylamide;
  never changes the badge).
  - The key line: levels describe **how strong the evidence is**, not how much harm one serving does.
  - Sources: the IARC Q&A quotes (§3), and the processed-meat and acrylamide sources already in `foodConcerns.ts`
    (reused, not copied).

### 4.4 Saved › Scanned (H7)

`SavedTab` takes `recent: Product[]` instead of `scannedIds` + `products`. Favorites are unchanged (still in memory,
K-16).

## 5. Error handling

| Situation | Behaviour |
|---|---|
| `localStorage` blocked, full or corrupt | Empty recent list; app works; nothing logged to the user |
| Catalog product removed since it was saved | Dropped from the list on read |
| Looked-up product snapshot from an older app version (missing fields) | Entry skipped if it lacks `id`, `name` or `barcode` |
| Many scans | Capped at 10, newest first |

## 6. Testing

- `recent.test.ts`:
  - `addRecent` puts the product first, removes duplicates and caps at 10;
  - `resolveRecent` re-resolves catalog ids, keeps snapshots and drops missing ones;
  - parsing corrupt JSON or malformed entries gives an empty or filtered list.
- **Browser (headless Edge, as for M6):**
  - Home has no "Alex", "Chicago", "Rating", "Why recommended" or deals text.
  - The greeting matches the time.
  - The Scan card opens the camera.
  - Opening Oreo (search) and Coke Zero (typed barcode) shows them first in Recently scanned, newest first, with
    badges.
  - A reload keeps them, and "Clear" empties them.
  - The first visit shows "How EcoGo checks a product".
  - Both explainers open with their sources.
  - Saved › Scanned shows the same list.
  - No console errors.
- Add an entry to `FIXES_AND_UPDATES.md`? No: M7 is a milestone with this spec. Update the roadmap in
  `KNOWN_ISSUES.md`.

## 7. Out of scope

Accounts and synced history, favorites persistence (K-16), the real map (Los Angeles, OpenStreetMap), the Profile tab's
fake content (next candidate), more explainers (processed meat and acrylamide cards were offered; the owner picked the
two above).

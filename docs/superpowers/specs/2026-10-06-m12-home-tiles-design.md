# M12: Home redesign, "Learn" tiles (layout A): design spec

- **Date:** 2026-10-06
- **Status:** **awaiting the owner's approval.** Front end only: no new data, no database change, no new dependency, no new
  claim. One milestone, one commit (plus the check-script update). **Build after M11 is pushed**, on a fresh worktree branch
  from `main` (it uses M11's text-size tokens and `themeContrast.test.ts`).
- **From:** the owner's app review, item 2 (`docs/superpowers/ideas/2026-10-05-owner-app-review.md`); order is decision 033;
  the layout is decision 035 (the owner picked A from three mockups: A tile grid, B big buttons, C swipe row).

## 1. What the owner asked for

"Too much text on Home; replace the explainer rows with big coloured category buttons for learning, one per topic, each
opening the explainer pages."

## 2. Decisions (defaults; the owner may overturn)

| # | Decision |
|---|---|
| D1 | **Six tiles, two per row, under the heading "Learn".** The five explainers plus "How EcoGo checks". Every tile is always shown, whether or not anything was scanned. |
| D2 | **"How EcoGo checks a product" becomes a page.** Its three steps move word for word from Home's empty-state box (`HOW_STEPS` in `App.tsx`) into the explainer pages. The box is removed, so a first visit shows Scan, search and the tiles. The page describes EcoGo itself, so it has no Sources section. |
| D3 | **Short labels on the tiles; the pages keep their full titles.** Not a health score · Badge levels · Seed oils · Pesticides · Ultra-processed · How EcoGo checks. Each tile's accessible name is the page's full title. |
| D4 | **Colours: no red or pink** (those mean "concern" on the badge). One colour per topic, white text, **every colour at least 7:1 against white**, so the tiles already pass M11's high-contrast level and need no special case. |
| D5 | **Order:** the mockup's (the two badge explainers first, as today, "How EcoGo checks" last). |

| Tile | Page (full title) | Colour | Contrast with white | Icon (lucide) |
|---|---|---|---|---|
| Not a health score | "Nothing flagged" isn't "healthy" | `#0E5E4A` teal | 7.72:1 | `Apple` |
| Badge levels | What the badge levels mean | `#14538F` blue | 7.88:1 | `Gauge` |
| Seed oils | Seed oils: what the evidence says | `#7A480A` brown | 7.61:1 | `Droplet` |
| Pesticides | Pesticides: what a label can't tell you | `#33600F` green | 7.44:1 | `Sprout` |
| Ultra-processed | Ultra-processed foods: no official line yet | `#4A42A6` purple | 8.01:1 | `Factory` |
| How EcoGo checks | How EcoGo checks a product | `#4F4E4A` grey | 8.33:1 | `ListChecks` |

## 3. Design

- **Home (`HomeTab` in `App.tsx`):** greeting, Scan card, search, "Recently scanned" (only when it has products, as today),
  then `<h2>Learn</h2>` and a `grid grid-cols-2 gap-2.5` of six `<button>`s. Each tile: `min-h-[88px] rounded-2xl p-3.5
  text-left text-white flex flex-col justify-between gap-2 shadow-sm`, background from its colour, icon 24 px
  (`aria-hidden`), label `text-sm font-extrabold leading-tight break-words hyphens-auto`, `aria-label` = the page's full
  title, a visible focus ring (`focus-visible:ring-2 ring-offset-2 ring-primary`). The teaser lines and the empty-state box go.
- **Pages (`Explainer.tsx`):** `ExplainerId` gains `"how-it-works"`. `EXPLAINERS` entries drop `teaser` (now unused) and gain
  `label`, `tile` (the hex colour) and `Icon`; Home reads them from there, so the tile list has one home. `HOW_STEPS` moves
  here and the `how-it-works` body renders it as the same numbered list Home showed. When a page has no sources, the
  "Sources" heading and list are not rendered.
- Text size and high contrast (M11) need nothing extra: the label scales with `--text-scale` and the tile grows taller; the
  colours already meet 7:1.

## 4. Evidence (2026-10-06)

- **Contrast:** the six colours, computed with the WCAG formula against `#FFFFFF`: 7.44–8.33:1 (table above). The first
  candidates (the mockup's lighter shades) measured 6.20–6.93:1, which passes AA but not M11's 7:1, so each was darkened one step.
- **Icons:** all six exist in the installed `lucide-react` 0.487.0 (checked in `node_modules`).
- **What reads Home's text:** `check-home.mjs` (`docs/superpowers/plans/2026-10-01-m7-assets/`) checks "How EcoGo checks a
  product" on the first visit and after Clear, clicks explainers by their visible title, and counts five cards under "Hidden
  risks, explained". Each of those checks changes (section 5). No unit test reads Home's text. `verify:sources` does not
  read `EXPLAINERS`, and no quoted source text changes.

## 5. Changes (files)

- `src/app/components/Explainer.tsx`: the `how-it-works` id, `label`/`tile`/`Icon` fields, `teaser` removed, `HOW_STEPS`
  and its body, Sources hidden when empty, header comment ("Home's Learn pages").
- `src/app/App.tsx`: `HomeTab` tile grid; `HOW_STEPS` and the empty-state box removed.
- `src/lib/themeContrast.test.ts` (from M11): add this test (red before the change, green after):

  ```ts
  test("Learn tiles: six different colours, white text reaches 7:1", () => {
    const src = readFileSync(new URL("../app/components/Explainer.tsx", import.meta.url), "utf8");
    const tiles = [...src.matchAll(/tile: "(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
    assert.equal(tiles.length, 6);
    assert.equal(new Set(tiles).size, 6);
    for (const t of tiles) assert.ok(ratio(hex(t), [255, 255, 255]) >= 7, `${t}: ${ratio(hex(t), [255, 255, 255]).toFixed(2)}`);
  });
  ```
- `check-home.mjs`: first visit and after Clear, expect `Learn` and no "Recently scanned" (instead of "How EcoGo checks a
  product"). Explainers are clicked by `aria-label` = full title (`__btn` already matches `aria-label` exactly). The "5
  explainer cards" check becomes "6 Learn tiles, in order", read from the `aria-label`s under the `Learn` heading. New check:
  "How EcoGo checks" opens a page with its three steps and no "Sources". Report the new total.
- Docs: `ARCHITECTURE.md` (Home row, Explainer row, the explainers feature row), `FIXES_AND_UPDATES.md` not needed (milestone),
  `PROJECT_HANDOFF.md` one line when it ships.

## 6. Verification (screenshots in the report)

`npm test` green and `npm run build`. Then in the browser pane at 375 px: (a) Home on a first visit (no recent) and with recent
products; (b) every tile opens the right page, and Back returns to Home; (c) the "How EcoGo checks" page; (d) Home at "Larger"
and with high contrast: no sideways scroll (`scrollWidth <= clientWidth`), no clipped labels, tiles still two per row;
(e) keyboard: Tab reaches each tile with a visible ring. `check-home.mjs` all passing.

## 7. Not in this milestone

New explainer topics; grouping pages into categories (six tiles don't need it); pictures instead of icons; changes to page
text or sources; a dark theme.

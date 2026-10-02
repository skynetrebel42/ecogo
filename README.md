# EcoGo!

Scan a food barcode and see which ingredients carry an **official** health concern, with the source for every flag.

**Live demo:** https://skynetrebel42.github.io/ecogo/ (open it on a phone and tap Scan to read a grocery barcode with the
camera; on a laptop, use the webcam, the demo barcodes or type one).

## How it works

- **Product data:** 51 featured products live in a Supabase (Postgres) database. Any other barcode is looked up in
  **USDA FoodData Central** (label data supplied by manufacturers), then in **Open Food Facts** (crowd-sourced, and
  labelled as such).
- **Safety check:** the ingredient list is parsed and matched word for word against a small library of additives that
  IARC, the EU or the FDA have flagged. Each entry quotes its source verbatim and links to it. There's no AI and no
  made-up score: if nothing is flagged, the page says exactly that, "No flagged additives".
- **Trust checks:** `npm test` checks every featured product against hand-reviewed flags, and
  `npm run verify:sources` re-checks the quotes against the live source pages.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test
```

For product lookups, create `.env.local` with `VITE_FDC_API_KEY=<your free key from
https://fdc.nal.usda.gov/api-key-signup>`. Without it the app uses USDA's shared `DEMO_KEY` (30 lookups an hour).
The Supabase URL and publishable key in `.env` are public by design; the database only allows reading the catalog.

## Built with

React 18, Vite 6, Tailwind CSS 4, Supabase, deployed to GitHub Pages with GitHub Actions.
The original UI was designed in Figma Make.

## Data credits

- USDA FoodData Central, U.S. Department of Agriculture (public domain).
- Open Food Facts, © Open Food Facts contributors, [ODbL](https://opendatacommons.org/licenses/odbl/1-0/).
- Hazard sources: IARC (WHO), EFSA / EU regulations, U.S. FDA. Linked from each flag in the app.

This is a personal project, not medical advice.

Project docs: [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) (start here), [ARCHITECTURE.md](ARCHITECTURE.md),
[KNOWN_ISSUES.md](KNOWN_ISSUES.md), [FIXES_AND_UPDATES.md](FIXES_AND_UPDATES.md) (every fix and small update since the milestones).

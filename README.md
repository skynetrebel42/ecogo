# EcoGo!

Scan a food barcode and see which ingredients carry an **official** health concern, with the source for every flag.

**Live demo:** https://skynetrebel42.github.io/ecogo/ (open it on a phone and tap Scan to read a grocery barcode with the
camera; on a laptop, use the webcam, the demo barcodes or type one).

## How it works

- **Product data:** 51 featured products live in a Supabase (Postgres) database. Any other barcode is looked up in
  EcoGo's own copy of **USDA FoodData Central** (430,127 branded foods, label data supplied by manufacturers), then in
  **Open Food Facts** (crowd-sourced, and labelled as such).
- **Missing products:** if a barcode isn't found anywhere, you can add it: photograph the label, the ingredients are
  read on the phone and checked by you, and the product is sent to Open Food Facts for everyone. You can also check an
  ingredient list without a barcode (nothing is saved or sent).
- **Map:** free-food places near you in Los Angeles (food pantries, community fridges, farmers markets) from
  OpenStreetMap and LA County Public Health, credited and dated.
- **Safety check:** the ingredient list is parsed and matched word for word against a small library of additives that
  IARC, the EU or the FDA have flagged. Each entry quotes its source verbatim and links to it. There's no AI and no
  made-up score: if nothing is flagged, the page says exactly that, "Nothing flagged", and explains that this isn't the same as healthy.
- **Trust checks:** `npm test` checks every featured product against hand-reviewed flags, and
  `npm run verify:sources` re-checks the quotes against the live source pages.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test
```

Running it needs no API key: product lookups read EcoGo's copy of USDA FoodData Central from Supabase. To load or
refresh that copy (the owner's job): download USDA's Branded Foods JSON zip, put SUPABASE_SERVICE_ROLE_KEY in
.env.local, then run npm run import:usda -- <the zip>.
The Supabase URL and publishable key in `.env` are public by design; the browser can only read the catalog. Adding a
product goes through one server function (`supabase/functions/off-submit`) with an anonymous sign-in and a robot check.

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

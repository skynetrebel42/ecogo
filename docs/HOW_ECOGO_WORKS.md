# How EcoGo works (plain English)

For Minh. Reading this costs nothing. Ask a chat to add a line when something new ships.

## What it is
A phone website. You scan a barcode, and EcoGo shows which ingredients are worth knowing about. Every warning
links to a real quote from a trusted source. Nothing is made up.

## The five tabs
- **Home**: greeting, a Scan button, search, recently viewed products, and "Learn" tiles that explain things.
- **Map**: free food spots, farmers markets, and community gardens near a ZIP code (from OpenStreetMap and LA County).
- **Scan**: opens the camera and reads barcodes. The photo never leaves your phone.
- **Saved**: your favorite products and lists, kept on this phone only.
- **Profile**: text size, high contrast, and what data the app keeps (very little).

## What happens when you scan
1. The camera reads the barcode, right on your phone.
2. EcoGo looks the product up in **its own copy of the US government's food list** (about 430,000 products, stored in Supabase).
3. If the product isn't there, it checks **Open Food Facts** (a public, Wikipedia-style food database).
4. The **rulebook** (the "safety engine") reads the ingredient list and flags anything with a sourced concern.
5. If no one has the product, you can **add it**: take photos, the phone reads the label, and EcoGo sends it to Open Food Facts.

## The parts behind the scenes
| Part | Plain meaning |
|---|---|
| **GitHub** | Where the code is saved, with full history. Like Google Docs version history for code. |
| **GitHub Pages** | The free host that puts the website online. |
| **Supabase** | The online database (a giant spreadsheet) plus small server helpers. |
| **Edge Function** | A small helper that runs on Supabase's server instead of your phone. `off-submit` sends new products to Open Food Facts. |
| **Tests** (`npm test`) | Automatic checks that the rulebook still gives the right answers. |
| **Build** (`npm run build`) | Packages the code into the website. If it fails, nothing ships. |

## How we build (the team)
- **Planner chat**: talks to you, writes the **spec** (the description of what to build), and records your decisions.
- **Builder chat**: writes the code to match the spec, runs the tests, and reports back.
- **You**: pick options and approve the push.

## Words you'll see
- **Milestone (M8, M13…)**: one feature-sized chunk of work. Numbers like 055 or 057 are smaller tasks inside one.
- **Spec**: the written plan for a milestone: what it does and how it should look.
- **Commit**: saving a snapshot of the work, with a note about what changed. Safe.
- **Push**: sending commits to GitHub's `main`. **This makes it live on the website.** Read before you approve it.
- **Branch / worktree**: a side copy where the builder works without touching the live version.
- **Merge**: folding a side copy back into `main`.
- **Deploy**: putting a new version online. It happens automatically after a push.
- **Bug batch**: a bundle of small fixes shipped together.

## What's done and what's next
- **Done**: scanning, sourced warnings, the government food copy (M10), Learn tiles, Map near me, Saved lists,
  and adding a product to Open Food Facts (M8, plus its follow-ups).
- **Next, M8.1**: "Suggest a place" and "Report a problem" forms on the Map. The owner reads the reports in Supabase.

## Log (one line per shipped thing, plain words)
- 2026-10-15: Sending a new product handles edge cases: no double-sends, a "not sure it arrived" message, and rejected photos explained.
- 2026-10-15: Search results show a barcode line so look-alike products can be told apart. "Recently viewed" was renamed.

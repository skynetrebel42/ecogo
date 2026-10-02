# M8: Real map (Los Angeles food places from OpenStreetMap) and no invented content left: design spec

- **Date:** 2026-10-02
- **Status:** draft, awaiting the owner's review
- **Decided with:** the owner (Minh Bui), 2026-10-02, in the planning chat: **real map first** (before accounts);
  **food places only**; **snapshot into Supabase**; **show OSM data, labelled**; **LA default, locate on tap**; scope
  **map + prices + fake favorites**. Mockup approved: https://claude.ai/artifact/Taqd6vvM59Q3oyJzMHxF51 (3 screens).

## 1. Why

The Map is the last screen built on invented content: 18 made-up Chicago places hardcoded in `MapTab.tsx`
(`BASE_RESOURCES`), with invented star ratings, a "Smart Score" sort and a computed Open/Closed badge. It ignores the
database (K-06), and "My Location" empties it for anyone more than 50 miles from Chicago (K-05). Two smaller inventions
remain elsewhere: catalog **prices** shown as "best price" (K-30) and a **favorites seed** `[3, 5]` that makes Profile's
"Favorites are kept until you close EcoGo" untrue after a reload (K-16). Writing this spec also found a third: Saved ›
**Lists** shows three made-up shopping lists ("Weekly Groceries, 6 items"…) with a "New" button that does nothing.

**Done for M8:** the Map shows real Los Angeles County food places from OpenStreetMap, credited and dated; nothing in the
app is invented.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | **Place types: food only.** Food banks/pantries, farmers markets, community gardens. The other 9 types go |
| D2 | **Source: OpenStreetMap**, a reviewed **snapshot** stored in the existing Supabase `resources` table (not live queries from the browser). Refresh = rerun the script, add a new migration |
| D3 | **Area: Los Angeles County**, by its OSM boundary (`area["wikidata"="Q104994"]`), not a box (a box spills into Orange County) |
| D4 | **What counts.** Food bank: `amenity=food_bank` or `social_facility=food_bank`. Farmers market: `amenity=marketplace` whose name matches `/farmer/i` or any tag value is `farmers` (swap meets and malls drop out). Community garden: `leisure=garden` + `garden:type=community` **with a name** (unnamed ones skipped). Anything without a name is skipped |
| D5 | **Shown only when OSM has it:** name, type, address, hours, phone, website. **Removed:** star ratings, descriptions, "Smart Score", rating/open-now sorts, radius filter, the Open/Closed badge (computing it from community-entered hours can be wrong: no false claims) |
| D6 | **Hours in plain words**, converted by the script: `Mo-Fr 09:00-11:00` → "Mon–Fri, 9–11 am"; `Tu[2,4] 09:00-12:00` → "2nd & 4th Tue, 9 am–12 pm". A pattern the converter doesn't know is stored **as written** (never guessed). Under every hours line: "Hours can change — check before you go." No hours → "No hours listed" |
| D7 | **Labelled as community data:** list footer "Places from © OpenStreetMap contributors (community-edited), as of <Mon YYYY>. Hours can change — check before you go."; card footer "From OpenStreetMap (community-edited), as of <Mon YYYY>" linking the OSM object, plus **"Fix it on OSM"** (`https://www.openstreetmap.org/edit?<type>=<id>`), like the Open Food Facts "Fix it" link |
| D8 | **Card buttons:** **Call** (`tel:`, only with a phone), **Website** (only with one), **Directions**: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` (opens the phone's maps app; sends only the place's position, never the user's) *(recommended default)* |
| D9 | **Location:** opens on LA (34.0522, −118.2437, zoom 11). **My location** asks permission only when tapped, centres the map, shows the blue dot and sorts the list by distance (otherwise A–Z). Outside LA County's box (33.28–34.82 N, 118.95–117.65 W; includes Catalina): the note "The map covers LA County for now" + **Back to LA**. Denied/failed: stay on LA with "Location is off. Showing Los Angeles." The position is never stored or sent |
| D10 | **Filters:** three chips (Food banks, Farmers markets, Gardens), all on by default. No radius, no sort menu |
| D11 | **The map reads the database only.** `BASE_RESOURCES` (`MapTab.tsx`) and `RESOURCES`/`rowToResource` (`App.tsx`) are deleted. No connection → the map shows "Places need a connection" over the tiles, never fake places |
| D12 | **Licence (ODbL):** the © OpenStreetMap contributors credit is visible on the map (today Leaflet's attribution is hidden: a licence breach). `ATTRIBUTIONS.md` says the `resources` data is © OpenStreetMap contributors under ODbL 1.0. Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (the `{s}` subdomains are deprecated) |
| D13 | **Prices removed (K-30):** "best price" on product cards and the product page, the **Price** sort in search ("Fewest concerns" stays), the Price Comparison section, the "from $…" line and the price tie-break on alternatives. The `product_prices` table is **dropped**; `catalog.ts` stops reading it. `products.csv` keeps its price columns unread (rewriting the seed reshuffles the 51-product tests for no visible gain): logged in `KNOWN_ISSUES.md` |
| D14 | **Favorites:** start empty (`[]`, no seed), so Profile's sentence is true. **Fix the M7 follow-up:** a looked-up product opened from Recently scanned or a USDA search can be favorited and shows in Saved › Favorites (`openProduct` adds non-catalog products to `lookedUp`) |
| D15 | **Saved › Lists removed** (invented lists, dead "New" button). Saved has two tabs: Favorites, Scanned *(found while writing this spec; owner to confirm in review)* |
| D16 | **Profile:** "Where results come from" gains **OpenStreetMap**: "Map places, community-edited. Hours can change." Privacy gains: "The map asks for your location only when you tap My location. It stays on your phone. Map images load from OpenStreetMap." |

## 3. Data

### 3.1 The snapshot script

- `src/lib/osmPlaces.ts` (pure, import-free, tested by `npm test`):
  - `toPlace(element, asOf)` → a `resources` row or `null` (skipped), applying D4;
  - `formatHours(openingHours)` → plain words or the input unchanged (D6);
  - `formatAddress(tags)` → "701 Hoefner Avenue, Los Angeles 90022" from `addr:housenumber`, `addr:street`,
    `addr:city`, `addr:postcode`; "" when there's no street.
- `scripts/fetch-osm-places.mjs`: runs the Overpass query (D3, D4) with
  `User-Agent: EcoGo/0.1 (personal project)`, trying `overpass-api.de` and then one mirror (the main server was down
  once while planning). It maps the elements through `toPlace`, prints counts by type and skipped reasons, and writes
  the migration SQL (`delete from resources;` then one `insert` with every row). Run by hand; the generated migration is
  committed after review.
- Coordinates: a node's `lat`/`lon`; a way or relation's Overpass `center`.

### 3.2 The `resources` table (one migration, `m8_real_map`)

- `delete from public.resources;` (the 18 demo rows).
- Drop `rating` and `description`; add `osm_type text not null check (osm_type in ('node','way','relation'))`,
  `osm_id bigint not null`, `website text`, `as_of date not null`, `unique (osm_type, osm_id)`.
- Replace the `type` check with the three types: `'food-bank', 'farmers-market', 'community-garden'`.
- Insert the snapshot rows.
- `drop table public.product_prices;` (D13; also leaves the realtime publication).
- Grants, RLS and the "Catalog is publicly readable" policy on `resources` stay as they are. `get_advisors` must show
  nothing new (the only expected note stays `scan_events` "RLS, no policy").

### 3.3 The app's read path

- `catalog.ts`: products without `product_prices`; `ResourceRow` gets the new columns.
- `App.tsx`: `resources` state starts `[]`; realtime listens to `products` and `resources` only. `MapTab` gets the rows
  and a `status` (`loading | live | offline`).

## 4. Screens (as in the approved mockup)

1. **Map opens on LA:** the three chips on top; pins clustered as today (colours per type: food bank green `#1a5c39`,
   market brown `#8a5a12`, garden blue `#2f6f86`, each with its letter); **My location** button; the bottom sheet "Food
   places in LA County", sorted A–Z ("A–Z · tap My location to sort by distance"), each row = type icon, name, hours
   line; the OSM footer (D7).
2. **Place card:** type label, name, address (when known), the hours box with the "check before you go" line, Call /
   Website / Directions (D8), the OSM footer + "Fix it on OSM". Distance ("2.1 mi away") only after My location.
3. **Outside LA County:** the note and **Back to LA** (D9).

Touch targets stay ≥ 44 px. The phone layout (below 500 px) works as today.

## 5. Testing

- **`src/lib/osmPlaces.test.ts`** on a recorded, trimmed real Overpass response in `src/lib/fixtures/osm/`: food bank
  both tag styles; a farmers market kept and a swap meet dropped; an unnamed garden skipped; address built; hours
  converted for `Mo-Fr 09:00-11:00`, `Su 08:00-13:00`, `Tu[2,4] 09:00-12:00`, `Tu,We 09:00-15:00`, an unknown pattern
  left as written; way/relation centre used; OSM edit link.
- **Database:** after the migration, `execute_sql` checks the counts per type, that `rating`, `description` and
  `product_prices` are gone, and that the publishable key can read `resources` but not write it; then `get_advisors`.
- **Headless check** (`check-home.mjs` grows a map section, run against `vite preview`): pins come from the DB (count
  > 50); "© OpenStreetMap contributors" visible; no "Open"/"Closed" badge, no stars, no "Smart Score"; the outside-LA
  note with a faked location (CDP `Emulation.setGeolocationOverride` to Chicago); no "best price", "$" price or "Price"
  sort anywhere; Saved › Favorites starts empty and Saved has no "Lists" tab; a USDA-looked-up product saved to
  Favorites shows there. Every existing check still passes.
- `npm test` and `npm run build` green; the plan is dry-run in the scratchpad first, as for M5–M7.3.

## 6. Not in M8

- Accounts and syncing favorites/recently scanned (next milestone; S-06).
- Places outside LA County, live OSM queries, an "Open now" badge.
- Other place types (Wi-Fi, restrooms, clinics…); an official cross-check of food banks.
- Rewriting `products.csv` without prices; the four unused score columns.

## 7. Docs to update in the build

`ARCHITECTURE.md` (Map row, data map, schema, external services: Overpass at snapshot time only), `KNOWN_ISSUES.md`
(K-05, K-06, K-16 seed, K-30 closed; the CSV price columns and "refresh the snapshot" logged), `PROJECT_HANDOFF.md`
(decision 025: real map from OSM; 026: no invented content), `SYNOPSIS.md`, `ATTRIBUTIONS.md` (D12).

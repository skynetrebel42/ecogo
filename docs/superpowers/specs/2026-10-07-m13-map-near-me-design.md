# M13: Map near me (ZIP or location, radius, more free-food places): design spec

- **Date:** 2026-10-07
- **Status:** **approved by the owner 2026-10-07** (D1-D9 as written, OSM refresh included). Parts 1-3 are front end only (two static data files built by scripts, no
  database change, no new dependency). Part 4 is a refreshed OpenStreetMap snapshot = a **live database migration**: the
  builder asks the owner right before applying it.
- **From:** the owner's app review, item 3 (`docs/superpowers/ideas/2026-10-05-owner-app-review.md`); order is decision 033;
  sources are decision 036 (OSM + LA County sites) and 037 (ZIP table); the layout is **A, map on top, list below** (owner,
  2026-10-07, from three mockups: A map on top, B list first, C full map with a pull-up list).

## 1. What the owner asked for

ZIP code entry or precise location, radius chips 5 / 10 / 15 / 20 mi, a list sorted by distance, and food pantries
(campus pantries such as Cerritos College's Falcon's Nest included).

**Design check:** serves visibility of status (Nielsen 1: "24 places within 10 mi of 90017") and flexibility (Nielsen 7: ZIP
or location); risks universal usability (Shneiderman 2) because the map takes space from the list at large text sizes, so
the map's height is capped (D1).

## 2. Decisions (defaults; the owner may overturn)

| # | Decision |
|---|---|
| D1 | **Layout A.** Top: a ZIP box (5 digits, number keypad) and a "My location" button; under it the radius chips 5 / 10 / 15 / 20 mi. Then the map, `height: clamp(160px, 38vh, 320px)`, with the search circle; it zooms to fit the circle. Then the list, scrolling, nearest first, each row with its distance in miles; the type chips sit in the list header. Tapping a row or a pin shows the place card in place of the list, with Back. Zoom buttons stay on the map. |
| D2 | **Before a ZIP or location:** the map shows LA County, the list is A-Z with the line "Enter a ZIP or tap My location to see what's near you". **After:** default radius 10 mi; the header reads "N places within R mi of 90017" (or "of your location"). |
| D3 | **Privacy:** the ZIP and the location live in memory only: never stored, never sent, never in the URL. The ZIP is looked up in a table inside the app, so typing one makes no network request. |
| D4 | **Edge cases:** a ZIP not in the table says "EcoGo doesn't have that ZIP. The map covers LA County and nearby." A location outside LA County keeps today's note. Nothing inside the radius says "Nothing within 5 mi" with a button for the next size up. |
| D5 | **Free food from two sources.** The "Food banks" chip becomes **"Free food"** (food banks, pantries, meal sites, community fridges); the card's small heading says "Free food". OSM places keep their credit and "Fix it on OSM". LA County sites credit "LA County Public Health, Charitable Food Distribution Sites, updated April 2024" with a link to the County's open-data terms, and have no "Fix it" link. |
| D6 | **No duplicates:** a County site within 100 m of an OSM free-food place is left out; the OSM one stays (it has hours). |
| D7 | **County names in normal case.** The County lists every name in capitals; the app shows title case and keeps known acronyms (AIDS, YMCA, YWCA, SDA, LA, LAUSD, USA, AME, CME, WIC, "St."). The full name shows on the card; list rows truncate as today. Nothing else is rewritten. |
| D8 | **County cards have no hours or phone** (the data has neither): they show "No hours listed" plus today's "Hours can change — check before you go.", and Directions. |
| D9 | **Part 4, OSM refresh:** the snapshot (OSM data as of 2026-06-01) is re-fetched with `amenity=food_sharing` (community fridges, food sharing) added as free food. Campus pantries reach the app through OSM: the owner adds Falcon's Nest to OSM before the refresh if they want it in. |
| D10 | **"Missing a place? Add it on OpenStreetMap"** (owner, 2026-10-07, added after approval): one line under the list, linking to `https://www.openstreetmap.org/edit#map=18/<lat>/<lng>` at the map's current centre (new tab), with the hint "Add it as Social facility → Food bank. EcoGo shows it after the next update." EcoGo stores and sends nothing. In-app suggestions come later with M8 (decision 039). |

## 3. Parts (one commit each, in order)

### 3.1 ZIP table and radius (pure, test-first)
- `scripts/build-zcta-la.mjs <path to 2026_Gaz_zcta_national.txt>` writes `src/lib/data/zcta-la.json` as
  `[["90017", 34.0529, -118.2645], …]` (4 decimals): every ZCTA whose internal point (`INTPTLAT`, `INTPTLONG`, pipe-delimited) lies within
  20 mi of `inLaCounty`'s box. Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
  (US Census Bureau, public domain). The script header names the file and its date.
- `src/lib/nearMe.ts`: `zipPoint(zip): [number, number] | null` (trims, 5 digits only); `withinMiles(places, center, mi)`
  returning places with their distance, nearest first (reuse `distanceKm` from `osmPlaces.ts`); `RADII = [5, 10, 15, 20]`.
- Tests: 90017 resolves near downtown LA; "9001", "abcde" and an Ohio ZIP return null; `withinMiles` keeps a place at 4.9 mi
  for 5 and drops one at 5.1; the order is nearest first; the table has 450-500 rows and every row is inside the buffer.

### 3.2 LA County sites (pure, test-first)
- `scripts/fetch-county-food-sites.mjs` reads
  `https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Food_Distribution_chp/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json`
  and writes `src/lib/data/county-food-sites.json` (name, address, city, zip, lat, lng; plus `as_of`, the layer's last
  edit date, from the layer's info endpoint) as it is, no rewriting. Licence: https://egis-lacounty.hub.arcgis.com/pages/terms-of-use.
- `nearMe.ts`: `titleCase(name)` (D7); `countyPlaces(osmPlaces)` returns the County sites as places with
  `source: "lacounty"`, a negative `id` (`-OBJECTID`) and no OSM ids, minus those within 100 m of an OSM free-food place (D6).
  `ResourceRow` gains an optional `source` (absent = OSM).
- Tests: five real names convert as expected, including "AIDS PROJECT LOS ANGELES - …" → "AIDS Project Los Angeles - …" and
  "… ST. PAUL'S FIRST LUTHERAN CHURCH" → "… St. Paul's First Lutheran Church"; the merge drops a site 50 m from an OSM food bank
  and keeps one 150 m away; with today's 99 OSM food banks the result has 190-195 sites; every County site's ZIP resolves in the ZIP table
  except 93350 and 93140 (measured, the sites still show by their own coordinates).

### 3.3 Layout A (`MapTab.tsx`)
- D1-D5 and D8. `App.tsx` passes `places` as today; MapTab adds `countyPlaces(places)`. The circle is an `L.circle`; the user
  dot stays; a ZIP centre gets a plain pin. The ZIP box submits on Enter and on the 5th digit, `aria-label="ZIP code"`,
  `inputMode="numeric"`, `autoComplete="postal-code"`; the radius chips are a `role="radiogroup"` of 44 px buttons.
- The footer credit names both sources with their dates when County sites are shown.

### 3.4 OSM refresh (live database; ask the owner first)
- `fetch-osm-places.mjs`: add `nwr["amenity"="food_sharing"](area.la);`; `osmPlaces.ts` `toPlace` maps it to the free-food
  type (test). Run it and write the new migration; **ask the owner** with the row counts (old vs new, per type) before
  `apply_migration`. Then re-run part 3.2's merge test against the new rows and report the County count.

## 4. Evidence (2026-10-07)

- **ZIP table:** the 2026 Census file has 33,791 ZCTAs; 363 lie in LA County's box and 471 within about 20 mi of it, which is
  13 KB as JSON (the builder's exact buffer may give a slightly different count; the test allows 450-500).
- **County sites:** 220 sites in 77 cities (LA 62, Long Beach 9, Lancaster 8, …); 25, 28 and 31 of them are within 50, 100
  and 200 m of one of today's 99 OSM food banks, so about **192 new places**, most outside central LA where OSM is thin. All
  220 names are in capitals (median 44 characters, longest 163, 66 over 60). No hours, no phone, no duplicates, no missing
  coordinates. The 134 distinct ZIPs of the sites all resolve except 93350 and 93140.
- **Licences** (decision 036): Census = public domain; County = open data terms allow copying and publishing; 211 LA and the
  LA Regional Food Bank are not used.
- **Today's Map:** 162 OSM places (99 food banks, 28 farmers markets, 35 gardens), OSM data as of 2026-06-01.

## 5. Changes (files)

Parts 1-2: the two scripts, `src/lib/data/zcta-la.json`, `src/lib/data/county-food-sites.json`, `src/lib/nearMe.ts` +
`nearMe.test.ts`, `catalog.ts` (`source`). Part 3: `MapTab.tsx`. Part 4: `fetch-osm-places.mjs`, `osmPlaces.ts` + test, one new
migration. `check-map.mjs`: copy `docs/archive/plans/2026-10-02-m9-assets/check-map.mjs` to
`docs/superpowers/specs/2026-10-07-m13-assets/check-map.mjs` and update it (the builder may edit it for this milestone): ZIP
90017 → header count, 10 mi default, the 5 mi chip lowers the count, a bad ZIP shows the D4 note, a County card shows its credit
and no "Fix it", and no request contains the ZIP. Docs: `ARCHITECTURE.md` (Map rows, data map: two static files),
`PROJECT_HANDOFF.md` one line, `KNOWN_ISSUES.md` (the gaps below).

## 6. Verification (screenshots in the report)

`npm test`, `npm run build`, `check-map.mjs` all passing. At 375 px: (a) the Map before a ZIP; (b) after 90017 at 10 mi with
the circle and list; (c) 5 mi; (d) a County card and an OSM card; (e) a bad ZIP; (f) Larger text with high contrast, no sideways
scroll, list still visible under the map. Network: typing a ZIP makes no request (`read_network_requests`).

## 7. Known gaps (not in this milestone)

County data is dated April 2024 and has no hours; community fridges and County sites share the "Free food" heading (no
sub-type); places only in LA County and nearby; Falcon's Nest appears only once someone adds it to OSM; no "open now".

// build-zcta-la.mjs — the ZIP table for "Map near me" (M13), from the US Census Bureau's 2026 ZCTA Gazetteer
// (2026_Gaz_zcta_national.txt, Last-Modified 2026-09-08; public domain):
// https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip
//
//   node scripts/build-zcta-la.mjs <path to 2026_Gaz_zcta_national.txt>
//
// Writes src/lib/data/zcta-la.json: [["90017", 34.0531, -118.2645], …], every ZCTA whose internal point (INTPTLAT,
// INTPTLONG) lies within 20 mi of LA County's box, 4 decimals. Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md §3.1.

import { readFileSync, writeFileSync } from "node:fs";
import { milesFromLaBox } from "../src/lib/osmPlaces.ts";

const [header, ...lines] = readFileSync(process.argv[2], "utf8").trim().split(/\r?\n/);
const col = header.split("|").map(s => s.trim());
const [iZip, iLat, iLng] = ["GEOID", "INTPTLAT", "INTPTLONG"].map(c => col.indexOf(c));
const round = x => Number(Number(x).toFixed(4));

const rows = lines.map(l => l.split("|").map(s => s.trim()))
  .map(f => [f[iZip], round(f[iLat]), round(f[iLng])])
  .filter(([, lat, lng]) => milesFromLaBox(lat, lng) <= 20)
  .sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(new URL("../src/lib/data/zcta-la.json", import.meta.url), JSON.stringify(rows) + "\n");
console.error(`${lines.length} ZCTAs in the file, ${rows.length} within 20 mi of LA County's box`);

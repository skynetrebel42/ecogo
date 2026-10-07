// M13 (Map near me): ZIP table, radius. Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md §3.1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zipPoint, withinMiles, RADII, titleCase, countyPlaces, countyReportMailto, REPORT_EMAIL } from "./nearMe.ts";
import { distanceKm, milesFromLaBox, LA_CENTER, MI_PER_KM } from "./osmPlaces.ts";

const table: [string, number, number][] = JSON.parse(readFileSync(new URL("./data/zcta-la.json", import.meta.url), "utf8"));
const county: { as_of: string; sites: { id: number; name: string; zip: string; lat: number; lng: number }[] } =
  JSON.parse(readFileSync(new URL("./data/county-food-sites.json", import.meta.url), "utf8"));
// The 99 OSM food banks in `resources` before M13's refresh (OSM data as of 2026-06-01): [osm id, lat, lng].
const banks2026: [string, number, number][] = JSON.parse(readFileSync(new URL("./fixtures/osm/food-banks-2026-06-01.json", import.meta.url), "utf8"));
const bank = (lat: number, lng: number) => ({ type: "food-bank" as const, latitude: lat, longitude: lng });
const KM_PER_DEG_LAT = 6371 * Math.PI / 180;

test("zipPoint: 90017 is downtown LA; anything else that isn't an LA-area 5-digit ZIP is null", () => {
  const p = zipPoint("90017")!;
  assert.ok(distanceKm(p[0], p[1], LA_CENTER[0], LA_CENTER[1]) * MI_PER_KM < 2, `90017 at ${p}`);
  assert.deepEqual(zipPoint(" 90017 "), p, "trimmed");
  for (const bad of ["9001", "900170", "abcde", "9001a", "", "43215" /* Columbus, Ohio */]) assert.equal(zipPoint(bad), null, bad);
});

test("withinMiles: a place at 4.9 mi is in a 5 mi radius, one at 5.1 mi is not; nearest first, with the distance", () => {
  const MI_PER_DEG_LAT = 6371 * MI_PER_KM * Math.PI / 180; // along a meridian the haversine distance is exact
  const center: [number, number] = [34.05, -118.25];
  const at = (id: number, mi: number) => ({ id, latitude: center[0] + mi / MI_PER_DEG_LAT, longitude: center[1] });
  const out = withinMiles([at(1, 4.9), at(2, 5.1), at(3, 0.5), at(4, 3)], center, 5);
  assert.deepEqual(out.map(p => p.id), [3, 4, 1]);
  assert.ok(Math.abs(out[2].miles - 4.9) < 1e-6, String(out[2].miles));
  assert.deepEqual(RADII, [5, 10, 15, 20]);
});

test("the ZIP table: 450-500 ZCTAs, each within 20 mi of LA County's box, unique, 4 decimals", () => {
  assert.ok(table.length >= 450 && table.length <= 500, `${table.length} rows`);
  assert.equal(new Set(table.map(r => r[0])).size, table.length);
  for (const [zip, lat, lng] of table) {
    assert.match(zip, /^\d{5}$/);
    assert.ok(milesFromLaBox(lat, lng) <= 20, `${zip} is ${milesFromLaBox(lat, lng).toFixed(1)} mi out`);
    assert.ok(Number(lat.toFixed(4)) === lat && Number(lng.toFixed(4)) === lng, `${zip} has more than 4 decimals`);
  }
});

// §3.2 (decision 041): LA County Public Health's sites, from 211LA food resources (May 2023), updated April 2024.
test("titleCase: real County names in normal case, known acronyms kept (D7)", () => {
  const cases: [string, string][] = [
    ["AIDS PROJECT LOS ANGELES - VANCE NORTH NECESSITIES OF LIFE PROGRAM - NORTH HOLLYWOOD",
      "AIDS Project Los Angeles - Vance North Necessities of Life Program - North Hollywood"],
    ["RESCUE MISSION ALLIANCE - VALLEY FOOD BANK - ST. PAUL'S FIRST LUTHERAN CHURCH",
      "Rescue Mission Alliance - Valley Food Bank - St. Paul's First Lutheran Church"],
    ["YMCA OF METROPOLITAN LOS ANGELES - WESTCHESTER FAMILY YMCA - FOOD PROGRAM",
      "YMCA of Metropolitan Los Angeles - Westchester Family YMCA - Food Program"],
    ["RESCUE MISSION ALLIANCE - VALLEY FOOD BANK - LA VOZ SYLMAR SDA CHURCH",
      "Rescue Mission Alliance - Valley Food Bank - La Voz Sylmar SDA Church"], // "LA" before a word is Spanish, not Los Angeles
    ["SHEPHERD'S PANTRY - LA PUENTE", "Shepherd's Pantry - La Puente"],
    ["L A CARE HEALTH PLAN - COMMUNITY RESOURCE CENTER - INGLEWOOD", "L A Care Health Plan - Community Resource Center - Inglewood"], // initials, as the County spells them
    ["L.A. CARE HEALTH PLAN", "L.A. Care Health Plan"],
    ["BEREAN 7TH DAY ADVENTIST CHURCH COMMUNITY SERVICES", "Berean 7th Day Adventist Church Community Services"], // ordinals
    ["CATHOLIC CHARITIES OF LOS ANGELES - LOAVES AND FISHES II", "Catholic Charities of Los Angeles - Loaves and Fishes II"],
  ];
  for (const [raw, nice] of cases) assert.equal(titleCase(raw), nice);
  for (const raw of ["CITY OF LOS ANGELES", "THE PANTRY", "SERVING LA"]) assert.equal(titleCase(raw), { "CITY OF LOS ANGELES": "City of Los Angeles", "THE PANTRY": "The Pantry", "SERVING LA": "Serving LA" }[raw]);
});

test("countyPlaces: every site as a free-food place with a negative id and no OSM ids", () => {
  const all = countyPlaces([]);
  assert.equal(all.length, county.sites.length);
  assert.equal(county.sites.length, 220);
  for (const p of all) {
    assert.equal(p.source, "lacounty"); assert.equal(p.type, "food-bank"); assert.ok(p.id < 0);
    assert.equal(p.as_of, county.as_of); assert.ok(!("osm_id" in p) && !("osm_type" in p));
  }
  const first = all.find(p => p.id === -1)!;
  assert.equal(first.address, "501 S BIXEL ST, LOS ANGELES 90017", "only names are rewritten (D7)");
});

test("countyPlaces: a site within 100 m of an OSM free-food place is left out, one 150 m away stays (D6)", () => {
  const s = county.sites.find(x => x.id === 1)!;
  const north = (m: number) => bank(s.lat + m / 1000 / KM_PER_DEG_LAT, s.lng);
  assert.ok(!countyPlaces([north(50)]).some(p => p.id === -1));
  assert.ok(countyPlaces([north(150)]).some(p => p.id === -1));
  assert.ok(countyPlaces([{ ...north(50), type: "community-garden" as const }]).some(p => p.id === -1), "only free food counts");
  const n = countyPlaces(banks2026.map(([, lat, lng]) => bank(lat, lng))).length;
  assert.ok(n >= 190 && n <= 195, `${n} County sites next to the 99 OSM food banks of 2026-06-01`);
});

test("countyPlaces: sites on the hidden list (county-hidden.json) are left out (D13)", () => {
  const hidden = [{ id: 1, reason: "closed", checked: "2026-10-20", source: "phone call" }];
  const out = countyPlaces([], hidden);
  assert.equal(out.length, county.sites.length - 1);
  assert.ok(!out.some(p => p.id === -1));
  assert.deepEqual(JSON.parse(readFileSync(new URL("./data/county-hidden.json", import.meta.url), "utf8")), [], "starts empty");
});

// D12: "Report a problem". County places go by email to the owner's address; with none yet, no button at all.
test("countyReportMailto: subject with the County id, a body to fill in; REPORT_EMAIL starts empty, so the button is hidden", () => {
  const p = countyPlaces([]).find(x => x.id === -1)!;
  const href = countyReportMailto(p, "reports@example.org");
  assert.ok(href.startsWith("mailto:reports@example.org?subject="), href);
  const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  assert.equal(q.get("subject"), `EcoGo report: ${p.name} (County 1)`);
  assert.equal(q.get("body"), `${p.name}\n501 S BIXEL ST, LOS ANGELES 90017\nWhat's wrong: closed / moved / hours / other\nLink (optional): `);
  assert.equal(REPORT_EMAIL, "ecogo-admin@proton.me", "the owner's address (spec D12, 2026-10-07); never a made-up one");
});

test("every County site's ZIP is in the ZIP table, except 93350 and 93140 (they still show by their own coordinates)", () => {
  const missing = [...new Set(county.sites.map(s => s.zip).filter(z => !zipPoint(z)))].sort();
  assert.deepEqual(missing, ["93140", "93350"]);
});

// M13 (Map near me): ZIP table, radius. Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md §3.1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zipPoint, withinMiles, RADII } from "./nearMe.ts";
import { distanceKm, milesFromLaBox, LA_CENTER, MI_PER_KM } from "./osmPlaces.ts";

const table: [string, number, number][] = JSON.parse(readFileSync(new URL("./data/zcta-la.json", import.meta.url), "utf8"));

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

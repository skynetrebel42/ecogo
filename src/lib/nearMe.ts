// nearMe.ts — "Map near me" (M13): a ZIP code or the phone's location, a radius, places nearest first.
// Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md. Pure: the ZIP table ships inside the app
// (src/lib/data/zcta-la.json, built by scripts/build-zcta-la.mjs), so looking a ZIP up sends nothing anywhere (D3).

import ZCTA from "./data/zcta-la.json" with { type: "json" };
import { distanceKm, MI_PER_KM } from "./osmPlaces.ts";

export const RADII = [5, 10, 15, 20];

const ZIPS = new Map((ZCTA as [string, number, number][]).map(([zip, lat, lng]) => [zip, [lat, lng] as [number, number]]));

/** "90017" → the ZCTA's internal point; null unless it's 5 digits and in the LA table. */
export function zipPoint(zip: string): [number, number] | null {
  const z = zip.trim();
  return /^\d{5}$/.test(z) ? ZIPS.get(z) ?? null : null;
}

/** Places within `mi` miles of `center`, nearest first, each with its distance in miles. */
export function withinMiles<P extends { latitude: number; longitude: number }>(places: P[], center: [number, number], mi: number): (P & { miles: number })[] {
  return places
    .map(p => ({ ...p, miles: distanceKm(center[0], center[1], p.latitude, p.longitude) * MI_PER_KM }))
    .filter(p => p.miles <= mi)
    .sort((a, b) => a.miles - b.miles);
}

// nearMe.ts — "Map near me" (M13): a ZIP code or the phone's location, a radius, places nearest first.
// Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md. Pure: the ZIP table ships inside the app
// (src/lib/data/zcta-la.json, built by scripts/build-zcta-la.mjs), so looking a ZIP up sends nothing anywhere (D3).

import ZCTA from "./data/zcta-la.json" with { type: "json" };
import COUNTY from "./data/county-food-sites.json" with { type: "json" };
import COUNTY_HIDDEN from "./data/county-hidden.json" with { type: "json" };
import { distanceKm, MI_PER_KM, type PlaceType } from "./osmPlaces.ts";
import type { ResourceRow } from "./catalog.ts";

export const RADII = [5, 10, 15, 20];

const ZIPS = new Map((ZCTA as [string, number, number][]).map(([zip, lat, lng]) => [zip, [lat, lng] as [number, number]]));

/** "90017" → the ZCTA's internal point; null unless it's 5 digits and in the LA table. */
export function zipPoint(zip: string): [number, number] | null {
  const z = zip.trim();
  return /^\d{5}$/.test(z) ? ZIPS.get(z) ?? null : null;
}

// ── LA County Public Health's "Charitable Food Distribution Sites" (§3.2, decision 041) ─────────────────────────
// From 211LA food resources (May 2023), updated April 2024; built by scripts/fetch-county-food-sites.mjs.

export const COUNTY_AS_OF: string = COUNTY.as_of;
export type CountyPlace = Extract<ResourceRow, { source: "lacounty" }>;
interface HiddenSite { id: number; reason: string; checked: string; source: string }

const ACRONYMS = new Set(["AIDS", "YMCA", "YWCA", "SDA", "LA", "LAUSD", "USA", "AME", "CME", "WIC", "UMC", "II", "III"]);
const MINOR = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

/** "ST. PAUL'S FIRST LUTHERAN CHURCH" → "St. Paul's First Lutheran Church": the County's capitals in normal case, known
 *  acronyms kept (D7). "LA" stays capitals only on its own: before a word it is Spanish ("La Puente", "La Voz"). */
export function titleCase(name: string): string {
  return name.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word, at: number) => {
    const up = word.toUpperCase(), low = word.toLowerCase();
    if (/\d$/.test(name.slice(0, at))) return low; // an ordinal: "7TH" → "7th"
    if (ACRONYMS.has(up) && !(up === "LA" && /^\s+[A-Za-z]/.test(name.slice(at + word.length)))) return up;
    // An initial: "L.A. Care", or the County's spaced "L A CARE" (a single letter next to another one).
    if (word.length === 1 && (name[at + 1] === "." || /^\s[A-Za-z]\b/.test(name.slice(at + 1)) || /\b[A-Za-z]\s$/.test(name.slice(0, at)))) return up;
    if (MINOR.has(low) && /[A-Za-z0-9.']\s*$/.test(name.slice(0, at))) return low; // inside a phrase, not after " - "
    return low[0].toUpperCase() + low.slice(1);
  });
}

/** The County sites as Map places, minus those within 100 m of an OSM free-food place (D6: the OSM one has hours) and
 *  those on the owner's hidden list (D13). */
export function countyPlaces(osm: { type: PlaceType; latitude: number; longitude: number }[], hidden: HiddenSite[] = COUNTY_HIDDEN): CountyPlace[] {
  const freeFood = osm.filter(p => p.type === "food-bank");
  const gone = new Set(hidden.map(h => h.id));
  return COUNTY.sites
    .filter(s => !gone.has(s.id) && !freeFood.some(p => distanceKm(s.lat, s.lng, p.latitude, p.longitude) <= 0.1))
    .map(s => ({
      id: -s.id, source: "lacounty", name: titleCase(s.name), type: "food-bank", address: `${s.address}, ${s.city} ${s.zip}`,
      hours: "", phone: null, website: null, latitude: s.lat, longitude: s.lng, as_of: COUNTY.as_of,
    }));
}

/** D12: where County reports go, an address the owner supplies. Empty = no County "Report a problem" button (never a
 *  made-up address). */
export const REPORT_EMAIL = "";

/** D12: a filled-in email about a County site; EcoGo itself stores and sends nothing. */
export function countyReportMailto(p: CountyPlace, email: string): string {
  const subject = `EcoGo report: ${p.name} (County ${-p.id})`;
  const body = `${p.name}\n${p.address}\nWhat's wrong: closed / moved / hours / other\nLink (optional): `;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Places within `mi` miles of `center`, nearest first, each with its distance in miles. */
export function withinMiles<P extends { latitude: number; longitude: number }>(places: P[], center: [number, number], mi: number): (P & { miles: number })[] {
  return places
    .map(p => ({ ...p, miles: distanceKm(center[0], center[1], p.latitude, p.longitude) * MI_PER_KM }))
    .filter(p => p.miles <= mi)
    .sort((a, b) => a.miles - b.miles);
}

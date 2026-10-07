// osmPlaces.ts — Los Angeles County food places from OpenStreetMap (M9).
//
// Spec: docs/superpowers/specs/2026-10-02-m9-real-map-design.md. Pure and import-free: the snapshot script
// (scripts/fetch-osm-places.mjs) maps Overpass elements to `resources` rows with `toPlace`, and the Map uses the
// helpers below. OSM data is community-edited: nothing here guesses or fills in a missing fact.

export type PlaceType = "food-bank" | "farmers-market" | "community-garden";

/** One row of the `resources` table (without its database id). */
export interface Place {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name: string;
  type: PlaceType;
  address: string;
  hours: string;
  phone: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  as_of: string; // YYYY-MM-DD, the snapshot date
}

/** An element of an Overpass `out tags center` response. */
export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/** M13: a pantry only for students ("social_facility:for" = "student", or a list with it). The app can't label that yet,
 *  so it isn't shown as free food for everyone. */
export const studentsOnly = (t: Record<string, string>) => (t["social_facility:for"] ?? "").split(";").map(s => s.trim()).includes("student");

function placeType(t: Record<string, string>, name: string): PlaceType | null {
  // "Free food": food banks and pantries, and (M13) community fridges and food sharing.
  if (t.amenity === "food_bank" || t.social_facility === "food_bank" || t.amenity === "food_sharing") return studentsOnly(t) ? null : "food-bank";
  // Markets only when they say they are farmers markets (swap meets, malls and food halls drop out).
  if (t.amenity === "marketplace" && (/farmer/i.test(name) || Object.values(t).includes("farmers"))) return "farmers-market";
  if (t.leisure === "garden" && t["garden:type"] === "community") return "community-garden";
  return null;
}

/** "701 Hoefner Avenue, Los Angeles 90022"; "" without a street. */
export function formatAddress(t: Record<string, string>): string {
  const street = t["addr:street"];
  if (!street) return "";
  const line1 = t["addr:housenumber"] ? `${t["addr:housenumber"]} ${street}` : street;
  const line2 = [t["addr:city"], t["addr:postcode"]].filter(Boolean).join(" ");
  return line2 ? `${line1}, ${line2}` : line1;
}

/** A Place, or null when it isn't a named LA food place with a position. */
export function toPlace(el: OsmElement, asOf: string): Place | null {
  const t = el.tags ?? {};
  const name = (t.name ?? "").trim();
  if (!name) return null;
  const type = placeType(t, name);
  if (!type) return null;
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  if (el.type !== "node" && el.type !== "way" && el.type !== "relation") return null;
  const phone = (t.phone ?? t["contact:phone"] ?? "").split(";")[0].trim();
  const site = (t.website ?? t["contact:website"] ?? "").split(";")[0].trim();
  return {
    osm_type: el.type, osm_id: el.id, name, type,
    address: formatAddress(t),
    hours: t.opening_hours ? formatHours(t.opening_hours) : "",
    phone: phone || null,
    website: /^https?:\/\//i.test(site) ? site : null, // only web links become an href
    latitude: lat, longitude: lon, as_of: asOf,
  };
}

// ── Hours in plain words ─────────────────────────────────────────────────────

const DAY: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
const D = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const NTH = "\\[(-1|[1-5](?:-[1-5])?(?:,[1-5](?:-[1-5])?)*)\\]";
const DAY_ITEM = new RegExp(`^(${D})(?:-(${D}))?(?:${NTH})?$`);
const TIME_RANGE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

const ORD = (n: string) => n === "-1" ? "last" : n + ({ "1": "st", "2": "nd", "3": "rd" }[n] ?? "th");
const list = (xs: string[]) => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`;

function days(s: string): string | null {
  if (s === "Mo-Su") return "Every day";
  // Commas split items, except inside [..] ("Fr[1,3],Sa[1,3]").
  const items = s.split(/,(?![^[]*\])/).map(item => {
    const m = item.match(DAY_ITEM);
    if (!m) return null;
    const day = m[2] ? `${DAY[m[1]]}–${DAY[m[2]]}` : DAY[m[1]];
    if (!m[3]) return day;
    const ords = m[3].split(",").map(n => /^\d-\d$/.test(n) ? n.split("-").map(ORD).join("–") : ORD(n));
    return `${list(ords)} ${day}`;
  });
  return items.includes(null) ? null : list(items as string[]);
}

function clock(h: number, m: number): { num: string; mer: string } {
  if (h % 24 === 0 && m === 0) return { num: "midnight", mer: "" };
  const num = `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
  return { num, mer: h % 24 < 12 ? "am" : "pm" };
}

function times(s: string): string | null {
  const ranges = s.split(",").map(r => {
    const m = r.trim().match(TIME_RANGE);
    if (!m) return null;
    const [h1, m1, h2, m2] = m.slice(1).map(Number);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
    const a = clock(h1, m1), b = clock(h2, m2);
    const tail = (x: { num: string; mer: string }) => x.mer ? `${x.num} ${x.mer}` : x.num;
    return a.mer && a.mer === b.mer ? `${a.num}–${tail(b)}` : `${tail(a)}–${tail(b)}`;
  });
  return ranges.includes(null) ? null : list(ranges as string[]);
}

/** OSM `opening_hours` in plain words ("Mo-Fr 09:00-11:00" → "Mon–Fri, 9–11 am"); anything it doesn't know comes
 *  back exactly as written, never guessed. */
export function formatHours(raw: string): string {
  const text = raw.trim();
  if (text === "24/7") return "Open 24 hours, every day";
  const rules = text.replace(/\s*-\s*(?=\d)/g, "-").split(new RegExp(`\\s*;\\s*|,\\s+(?=${D}\\b)`));
  const out = rules.map(rule => {
    const t = rule.match(/^(\d.*)$/);
    if (t) { const tt = times(t[1]); return tt && `Every day, ${tt}`; }
    const m = rule.match(/^(\S+?),?\s+(.+)$/); // "Mo-Th, 07:00-14:00" happens too
    if (!m) return null;
    const d = days(m[1]);
    if (!d) return null;
    if (/^(off|closed)$/i.test(m[2])) return `${d} closed`;
    const tt = times(m[2]);
    return tt && `${d}, ${tt}`;
  });
  return out.some(x => !x) ? text : out.join("; ");
}

// ── Map helpers ──────────────────────────────────────────────────────────────

export const LA_CENTER: [number, number] = [34.0522, -118.2437];

/** LA County's bounding box, Catalina included: "near me" outside it gets the "covers LA County" note. */
export const LA_BOX = { south: 33.28, north: 34.82, west: -118.95, east: -117.65 };
export const inLaCounty = (lat: number, lng: number) =>
  lat >= LA_BOX.south && lat <= LA_BOX.north && lng >= LA_BOX.west && lng <= LA_BOX.east;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const MI_PER_KM = 0.621371;

/** Miles from a point to LA County's box (0 inside it). M13's ZIP table keeps ZCTAs within 20 mi. */
export function milesFromLaBox(lat: number, lng: number): number {
  const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
  return distanceKm(lat, lng, clamp(lat, LA_BOX.south, LA_BOX.north), clamp(lng, LA_BOX.west, LA_BOX.east)) * MI_PER_KM;
}

/** A–Z, or nearest first once the user's position is known. Doesn't change the input. */
export function sortPlaces<P extends Place>(places: P[], user: [number, number] | null): P[] {
  return [...places].sort(user
    ? (a, b) => distanceKm(user[0], user[1], a.latitude, a.longitude) - distanceKm(user[0], user[1], b.latitude, b.longitude)
    : (a, b) => a.name.localeCompare(b.name));
}

export const osmUrl = (p: Place) => `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`;
export const osmEditUrl = (p: Place) => `https://www.openstreetmap.org/edit?${p.osm_type}=${p.osm_id}`;
/** M13 D12, "Report a problem": a new anonymous OSM note at the place. */
export const osmNoteUrl = (p: Pick<Place, "latitude" | "longitude">) =>
  `https://www.openstreetmap.org/note/new#map=19/${p.latitude.toFixed(5)}/${p.longitude.toFixed(5)}`;
/** Opens the phone's maps app; sends only the place's position. */
export const directionsUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;

/** "2026-10-02" → "Oct 2026" (read and printed in UTC: no time-zone shift). */
export const formatAsOf = (asOf: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(asOf));

/** "+1-323-726-7998" → "(323) 726-7998"; anything else as written. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  toPlace, formatHours, formatAddress, inLaCounty, sortPlaces, osmUrl, osmEditUrl, osmNoteUrl, directionsUrl, formatAsOf,
  formatPhone, type OsmElement, type Place,
} from "./osmPlaces.ts";

// Real Overpass elements (LA area, 2026-10-02), trimmed.
const sample: OsmElement[] = JSON.parse(readFileSync(new URL("./fixtures/osm/la-sample.json", import.meta.url), "utf8")).elements;
const byId = (id: number) => sample.find(e => e.id === id)!;
const AS_OF = "2026-10-02";

test("a social_facility food bank becomes a full row", () => {
  assert.deepEqual(toPlace(byId(3646871294), AS_OF), {
    osm_type: "node", osm_id: 3646871294, name: "Eastmont Community Center - Food Bank", type: "food-bank",
    address: "701 Hoefner Avenue, Los Angeles 90022", hours: "Mon–Fri, 9–11 am", phone: "+1-323-726-7998",
    website: null, latitude: 34.0210673, longitude: -118.1498999, as_of: AS_OF,
  });
});

test("amenity=food_bank counts too", () => {
  const p = toPlace({ type: "node", id: 1, lat: 34, lon: -118.2, tags: { amenity: "food_bank", name: "Pantry" } }, AS_OF);
  assert.equal(p?.type, "food-bank");
});

// M13 D9: community fridges and food sharing are free food too.
test("amenity=food_sharing is free food (the food-bank type)", () => {
  const p = toPlace({ type: "node", id: 5, lat: 34.1, lon: -118.3, tags: { amenity: "food_sharing", name: "Community Fridge" } }, AS_OF);
  assert.equal(p?.type, "food-bank");
});

// M13: the app can't say "students only" yet, so a students-only pantry must not show as free food for everyone.
test("a pantry for students (social_facility:for=student, alone or in a list) is skipped", () => {
  const pantry = (forWhom?: string) => toPlace({ type: "node", id: 6, lat: 34.1, lon: -118.3,
    tags: { amenity: "social_facility", social_facility: "food_bank", name: "Campus Pantry", ...(forWhom ? { "social_facility:for": forWhom } : {}) } }, AS_OF);
  assert.equal(pantry("student"), null);
  assert.equal(pantry("student;staff"), null);
  assert.equal(pantry("homeless")?.type, "food-bank");
  assert.equal(pantry()?.type, "food-bank");
});

test("farmers markets are kept; swap meets, malls and plain markets are dropped", () => {
  assert.equal(toPlace(byId(2247860156), AS_OF)?.type, "farmers-market");
  assert.equal(toPlace(byId(2247860156), AS_OF)?.website, "https://hfm.la/");
  assert.equal(toPlace(byId(160146695), AS_OF)?.type, "farmers-market");
  assert.equal(toPlace(byId(3362770643), AS_OF), null);
  assert.equal(toPlace(byId(2406529085), AS_OF), null);
  const tagged = { type: "node", id: 2, lat: 34, lon: -118.2, tags: { amenity: "marketplace", name: "Plaza Market", marketplace: "farmers" } };
  assert.equal(toPlace(tagged, AS_OF)?.type, "farmers-market");
});

test("community gardens need a name; a way uses its centre", () => {
  assert.equal(toPlace(byId(9499533109), AS_OF), null);
  const way = toPlace(byId(184097821), AS_OF)!;
  assert.deepEqual([way.osm_type, way.latitude, way.longitude], ["way", 33.7745641, -117.9330796]);
  assert.equal(toPlace(byId(11981709979), AS_OF)?.address, "");
});

test("only http(s) websites are kept; the first phone of a list", () => {
  const p = toPlace({ type: "node", id: 3, lat: 34, lon: -118.2,
    tags: { amenity: "food_bank", name: "X", website: "javascript:alert(1)", phone: "+1 213 555 0100; +1 213 555 0101" } }, AS_OF)!;
  assert.equal(p.website, null);
  assert.equal(p.phone, "+1 213 555 0100");
  assert.equal(toPlace({ type: "node", id: 4, tags: { amenity: "food_bank", name: "No position" } }, AS_OF), null);
});

test("formatHours: the LA patterns in plain words", () => {
  const cases: [string, string][] = [
    ["Mo-Fr 09:00-11:00", "Mon–Fri, 9–11 am"],
    ["Su 08:00-13:00", "Sun, 8 am–1 pm"],
    ["Tu[2,4] 09:00-12:00", "2nd & 4th Tue, 9 am–12 pm"],
    ["Tu,We 09:00-15:00", "Tue & Wed, 9 am–3 pm"],
    ["Mo,We,Fr 10:00-13:30; Su[1,3] 09:00-12:00", "Mon, Wed & Fri, 10 am–1:30 pm; 1st & 3rd Sun, 9 am–12 pm"],
    ["Tu-Th 11:00-24:00, Sa 11:00-24:00", "Tue–Thu, 11 am–midnight; Sat, 11 am–midnight"],
    ["Fr 09:00-12:00,14:00-15:00", "Fri, 9 am–12 pm & 2–3 pm"],
    ["Sa[1-3] 07:00-09:00", "1st–3rd Sat, 7–9 am"],
    ["Th[-1] 12:00-13:00", "last Thu, 12–1 pm"],
    ["Fr[1,3],Sa[1,3] 10:00-13:00", "1st & 3rd Fri & 1st & 3rd Sat, 10 am–1 pm"],
    ["We 13:00 - 14:30", "Wed, 1–2:30 pm"],
    ["Mo-Su 10:00-19:00", "Every day, 10 am–7 pm"],
    ["Mo-Sa 13:00-20:00; Su Closed", "Mon–Sat, 1–8 pm; Sun closed"],
    ["24/7", "Open 24 hours, every day"],
    ["Sa 8:00-12:00", "Sat, 8 am–12 pm"],
    ["Mo-Th, 07:00-14:00", "Mon–Thu, 7 am–2 pm"],
    ["Mo-Tu 9:00-10:30;Th-Fr 9:00-10:30", "Mon–Tue, 9–10:30 am; Thu–Fri, 9–10:30 am"],
  ];
  for (const [raw, plain] of cases) assert.equal(formatHours(raw), plain, raw);
});

test("formatHours: anything it doesn't know comes back as written", () => {
  for (const raw of ['"See website"', "Sa", 'Sa 10:00-13:00 "biweekly"', "Sa[-1] 17:00-21:00; Feb-Mar off", "Mo 25:00-26:00",
    "Su-Mo off; Tu 08:00-13:00; We-Fr off; Sa 08:13:00", "3rd Fri. 9:00 AM - 12:00 PM"])
    assert.equal(formatHours(raw), raw);
});

test("formatAddress", () => {
  assert.equal(formatAddress({ "addr:street": "Ivar Avenue", "addr:housenumber": "1600", "addr:city": "Hollywood" }), "1600 Ivar Avenue, Hollywood");
  assert.equal(formatAddress({ "addr:street": "Main Street" }), "Main Street");
  assert.equal(formatAddress({ "addr:city": "Los Angeles" }), "");
});

test("map helpers: LA box, sorting, links, dates, phones", () => {
  assert.equal(inLaCounty(34.0522, -118.2437), true);
  assert.equal(inLaCounty(33.39, -118.42), true); // Avalon, Catalina
  assert.equal(inLaCounty(41.88, -87.62), false); // Chicago
  const places = sample.map(e => toPlace(e, AS_OF)).filter(Boolean) as Place[];
  assert.equal(sortPlaces(places, null)[0].name, "Altadena S.D.A. Church - Food Bank");
  assert.equal(sortPlaces(places, [34.10, -118.33])[0].name, "Hollywood Farmers Market");
  const p = places.find(x => x.osm_id === 184097821)!;
  assert.equal(osmUrl(p), "https://www.openstreetmap.org/way/184097821");
  assert.equal(osmEditUrl(p), "https://www.openstreetmap.org/edit?way=184097821");
  assert.equal(osmNoteUrl(p), "https://www.openstreetmap.org/note/new#map=19/33.77456/-117.93308", "M13 D12: an OSM note at the place");
  assert.equal(directionsUrl(p), "https://www.google.com/maps/dir/?api=1&destination=33.7745641,-117.9330796");
  assert.equal(formatAsOf("2026-10-02"), "Oct 2026");
  assert.equal(formatPhone("+1-323-726-7998"), "(323) 726-7998");
  assert.equal(formatPhone("+44 20 7946 0000"), "+44 20 7946 0000");
});

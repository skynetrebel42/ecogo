import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { formatAddress, photonUrl, suggestAddresses } from "./photon.ts";

// Decision 059 Q4 (docs/superpowers/specs/2026-10-16-map-feedback-design.md).
test("the request: the text, 5 results, English, LA County's box (west,south,east,north)", () => {
  const u = new URL(photonUrl("501 s bixel"));
  assert.equal(u.origin + u.pathname, "https://photon.komoot.io/api/");
  assert.deepEqual(Object.fromEntries(u.searchParams), { q: "501 s bixel", limit: "5", lang: "en", bbox: "-118.95,33.28,-117.65,34.82" });
});

test("a suggestion reads house number, street, city, ZIP; a place with no street uses its name; nothing to show is null", () => {
  assert.equal(formatAddress({ housenumber: "501", street: "South Bixel Street", city: "Los Angeles", postcode: "90017" }), "501 South Bixel Street, Los Angeles 90017");
  assert.equal(formatAddress({ street: "Pico Boulevard", locality: "Westwood" }), "Pico Boulevard, Westwood");
  assert.equal(formatAddress({ name: "Union Station", city: "Los Angeles", postcode: "90012" }), "Union Station, Los Angeles 90012");
  assert.equal(formatAddress({ city: "Los Angeles" }), null);
});

const feature = (p: Record<string, string>) => ({ type: "Feature", properties: p });
const answer = (features: unknown[], ok = true) => async () => ({ ok, json: async () => ({ type: "FeatureCollection", features }) }) as unknown as Response;

test("suggestions: formatted, duplicates and empty ones dropped, at most 5", async () => {
  const fs = [feature({ housenumber: "1", street: "Main St", city: "Los Angeles" }), feature({ housenumber: "1", street: "Main St", city: "Los Angeles" }),
    feature({ city: "Pasadena" }), ...[2, 3, 4, 5, 6].map(n => feature({ housenumber: String(n), street: "Main St" }))];
  assert.deepEqual(await suggestAddresses("main st", answer(fs)), ["1 Main St, Los Angeles", "2 Main St", "3 Main St", "4 Main St", "5 Main St"]);
});

test("under 3 characters asks nothing; a failed, odd or slow answer is no list", async () => {
  let asked = 0;
  const count = async () => { asked++; return {} as Response; };
  assert.deepEqual(await suggestAddresses("  ab ", count), []);
  assert.equal(asked, 0);
  assert.deepEqual(await suggestAddresses("main", answer([], false)), []);
  assert.deepEqual(await suggestAddresses("main", async () => { throw new Error("offline"); }), []);
  assert.deepEqual(await suggestAddresses("main", async () => ({ ok: true, json: async () => ({ features: "x" }) }) as unknown as Response), []);
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const slow = (_: string, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const p = suggestAddresses("main", slow);
    mock.timers.tick(2000);
    assert.deepEqual(await p, []);
  } finally { mock.timers.reset(); }
});

test("an older request is dropped when a newer one starts (its signal aborts it)", async () => {
  const ctl = new AbortController();
  const p = suggestAddresses("main", (_, init) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))), ctl.signal);
  ctl.abort();
  assert.deepEqual(await p, []);
});

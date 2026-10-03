import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knownNutrition, lookupBarcode, searchFoods, mapOffResponse, normalizeBarcode, barcodeKey, isBarcode, sameBarcode, tidyCase, offEditUrl, offAddUrl } from "./lookup.ts";
import { analyzeIngredients } from "./safety/analyze.ts";
import { foodRow, memoryFoods, rowFromUsdaSearch } from "./foodsFake.ts";

const fixture = (path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), "utf8"));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const NOT_FOUND = () => json(fixture("off/not-found-3017620429996").body, 404);

/** A fake Open Food Facts: answers from `off` by barcode, 404 otherwise. `calls` lists every web request made. */
function fakeOff(off: Record<string, { httpStatus: number; body: unknown }> = {}) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = off[url.match(/product\/(\d+)\.json/)?.[1] ?? ""];
    return hit ? json(hit.body, hit.httpStatus) : NOT_FOUND();
  }) as typeof fetch;
  return { impl, calls };
}
/** The lookup cache lives for the session, so every test below uses barcodes no other test uses. */
const rowFor = (code: string, over = {}) => foodRow({ barcode_key: barcodeKey(code), barcode: code, ...over });

// ── Mapping a foods row ──────────────────────────────────────────────────────

test("a USDA row is found with its source, and Open Food Facts is never asked", async () => {
  const db = memoryFoods([rowFromUsdaSearch(fixture("usda/coke-zero-00049000042566").foods[0])]);
  const off = fakeOff();
  const r = await lookupBarcode("049000042566", { foods: db, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "USDA FoodData Central");
  assert.equal(r.status === "found" && r.product.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
  assert.deepEqual(db.calls, ["byBarcode 49000042566"], "one request, though USDA stores this code as 14 digits");
  assert.equal(off.calls.length, 0);
});

// ── Open Food Facts mapper ─────────────────────────────────────────────────

test("an OFF product maps with English preferred and a crowd-sourced source", () => {
  const f = fixture("off/nutella-3017620422003");
  const r = mapOffResponse(f.body, f.httpStatus);
  assert.equal(r.status, "found");
  if (r.status !== "found") return;
  assert.equal(r.product.id, -3017620422003);
  assert.equal(r.product.name, "Nutella");
  assert.equal(r.product.brand, "Nutella");
  assert.match(r.product.ingredients, /^Sugar, vegetable fat \(palm\)/);
  assert.deepEqual(r.product.source, {
    name: "Open Food Facts", url: "https://world.openfoodfacts.org/product/3017620422003",
    crowdSourced: true, ingredientsLang: "en", additiveCodes: ["en:e322", "en:e322i"], categoryTags: ["en:breakfasts", "en:spreads", "en:sweet-spreads", "en:confectionary-based-spreads", "fr:Nutella"],
  });
});

test("OFF: non-English only keeps its language; 404 and empty shells are not found; 5xx/429 are errors", () => {
  const body = structuredClone(fixture("off/nutella-3017620422003").body);
  delete body.product.ingredients_text_en;
  const fr = mapOffResponse(body, 200);
  assert.equal(fr.status === "found" && fr.product.source?.ingredientsLang, "fr");
  const nf = fixture("off/not-found-3017620429996");
  assert.equal(mapOffResponse(nf.body, nf.httpStatus).status, "not-found");
  const empty = fixture("off/empty-9780000000002");
  assert.equal(mapOffResponse(empty.body, empty.httpStatus).status, "not-found");
  assert.equal(mapOffResponse(null, 503).status, "error");
  assert.equal(mapOffResponse(null, 429).status, "error");
  assert.equal(mapOffResponse("<html>", 200).status, "not-found");
});

test("huge or odd crowd-sourced text still maps and analyzes safely", () => {
  const body = { status: "success", product: { code: "123456789012", product_name: "Big &amp; odd <b>snack</b>", ingredients_text_en: "salt, ".repeat(20000) + "SODIUM NITRITE" } };
  const r = mapOffResponse(body, 200);
  assert.equal(r.status, "found");
  if (r.status !== "found") return;
  assert.equal(analyzeIngredients({ ingredients: r.product.ingredients }).verdict, "high");
});

// ── Barcodes ───────────────────────────────────────────────────────────────

test("barcodes compare by digits, ignoring spaces, dashes and leading zeros", () => {
  assert.equal(normalizeBarcode(" 0 49000-042566 "), "049000042566");
  assert.equal(barcodeKey(" 0 49000-042566 "), "49000042566");
  assert.equal(barcodeKey("00049000042566"), barcodeKey("049000042566"), "a 12-digit UPC and its 14-digit form share a key");
  assert.ok(sameBarcode("049000042566", "00049000042566"));
  assert.ok(!sameBarcode("049000042566", "049000042567"));
  assert.ok(!sameBarcode("", "000"));
  assert.ok(isBarcode("01311501") && isBarcode("00049000042566"));
  assert.ok(!isBarcode("1234") && !isBarcode("123456789012345"));
  assert.equal(tidyCase("LAY'S, CLASSIC POTATO CHIPS"), "Lay's, Classic Potato Chips");
  assert.equal(tidyCase("Coca-Cola Zero"), "Coca-Cola Zero");
});

// ── lookupBarcode: order, cache, errors ────────────────────────────────────

test("a miss in our table falls back to OFF; a miss in both is not found", async () => {
  const db = memoryFoods([]);
  const off = fakeOff({ "3017620422003": fixture("off/nutella-3017620422003") });
  const r = await lookupBarcode("3017620422003", { foods: db, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  assert.equal((await lookupBarcode("3017620429996", { foods: db, fetchImpl: off.impl })).status, "not-found");
});

test("results are cached per barcode, whatever the spelling", async () => {
  const db = memoryFoods([rowFor("036000291452")]);
  const off = fakeOff();
  assert.equal((await lookupBarcode("036000291452", { foods: db, fetchImpl: off.impl })).status, "found");
  const before = db.calls.length;
  assert.equal((await lookupBarcode("0 36000-291452", { foods: db, fetchImpl: off.impl })).status, "found");
  assert.equal((await lookupBarcode("00036000291452", { foods: db, fetchImpl: off.impl })).status, "found");
  assert.equal(db.calls.length, before, "later lookups served from the session cache");
});

// Review Focus: an unreachable source must never read as "not found".
test("errors are retried, never cached, and never read as 'not found'", async () => {
  const down = memoryFoods([], { fail: true });
  const off = fakeOff();
  assert.equal((await lookupBarcode("012000161155", { foods: down, fetchImpl: off.impl })).status, "error", "database down + OFF has nothing = try again");
  const again = down.calls.length;
  assert.equal((await lookupBarcode("012000161155", { foods: down, fetchImpl: off.impl })).status, "error");
  assert.ok(down.calls.length > again, "errors are retried, not cached");
  const web = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
  assert.equal((await lookupBarcode("041500000251", { foods: memoryFoods([]), fetchImpl: web })).status, "error", "OFF unreachable + not in our table = try again");
});

test("our table down but OFF has it: show OFF, and look again next time", async () => {
  const down = memoryFoods([], { fail: true });
  const off = fakeOff({ "4006381333931": fixture("off/nutella-3017620422003") });
  const r = await lookupBarcode("4006381333931", { foods: down, fetchImpl: off.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  assert.equal((await lookupBarcode("4006381333931", { foods: down, fetchImpl: off.impl })).status, "found");
  assert.equal(off.calls.length, 2, "an OFF find made while our table was unreachable isn't cached");
});

// 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8). OFF answered the Heinz UPC-E 01311501
// with a UK store product, so 8-digit codes are looked up in our USDA copy only.
test("8-digit codes are looked up in our USDA copy only, never Open Food Facts", async () => {
  const sweetcorn = { httpStatus: 200, body: { status: "success", product: { code: "01311501", product_name: "Sainsbury's Organic Sweetcorn", ingredients_text: "Sweetcorn" } } };
  const off = fakeOff({ "01311501": sweetcorn });
  assert.equal((await lookupBarcode("01311501", { foods: memoryFoods([]), fetchImpl: off.impl })).status, "not-found");
  assert.equal(off.calls.length, 0, "no OFF request");
  const upce = memoryFoods([rowFor("01311502")]);
  assert.equal((await lookupBarcode("01311502", { foods: upce, fetchImpl: off.impl })).status, "found");
});

test("codes outside 8-14 digits never reach the database or the network", async () => {
  const db = memoryFoods([]);
  const off = fakeOff();
  assert.equal((await lookupBarcode("1234", { foods: db, fetchImpl: off.impl })).status, "not-found");
  assert.equal((await lookupBarcode("abc", { foods: db, fetchImpl: off.impl })).status, "not-found");
  assert.equal(db.calls.length + off.calls.length, 0);
});

test("a USDA find carries its nutrition, and list cards can read it afterwards without a request", async () => {
  const db = memoryFoods([rowFromUsdaSearch(fixture("usda/oreo-nutrition-044000032029").foods[0])]);
  assert.equal(knownNutrition("044000032029"), null);
  const r = await lookupBarcode("044000032029", { foods: db, fetchImpl: fakeOff().impl });
  assert.equal(r.status === "found" && r.product.nutrition?.serving, "3 cookies (34 g)");
  await new Promise(resolve => setTimeout(resolve, 0)); // the cache bookkeeping runs after the promise settles
  assert.equal(knownNutrition("0 44000-032029")?.nutrients[0].dv, 28);
  assert.equal(knownNutrition(""), null);
});

// ── Text search ("More from USDA" in search results) ──────────────────────────

test("a text search maps rows to products, each with its source and nutrition", async () => {
  const seen = new Set<string>();
  const rows = fixture("usda/search-ice-cream").foods.map(rowFromUsdaSearch)
    .filter((r: { barcode_key: string }) => r.barcode_key && !seen.has(r.barcode_key) && seen.add(r.barcode_key));
  const db = memoryFoods(rows);
  const a = await searchFoods("Ice  Cream", { foods: db });
  assert.equal(a.status, "ok");
  if (a.status !== "ok") return;
  assert.equal(a.products.length, 10);
  assert.equal(new Set(a.products.map(p => barcodeKey(p.barcode))).size, 10, "distinct barcodes");
  for (const p of a.products) {
    assert.equal(p.source?.name, "USDA FoodData Central");
    assert.ok(p.id < 0, "looked-up ids are negative");
    assert.equal(p.name, "Ice Cream");
  }
  assert.ok(a.products.some(p => p.nutrition), "nutrition comes along");
});

test("searchFoods: one request per text for the session; errors aren't cached; blank text makes no request", async () => {
  const db = memoryFoods([rowFor("028400064057", { name: "Tostitos Bite Size", brand: "Tostitos" })]);
  const a = await searchFoods("Tostitos Bite", { foods: db });
  assert.equal(a.status === "ok" && a.products.length, 1);
  await searchFoods("tostitos  bite", { foods: db });
  assert.equal(db.calls.length, 1, "the second search is served from the session cache");
  assert.equal((await searchFoods("  ", { foods: db })).status, "ok");
  assert.equal(db.calls.length, 1);

  const down = memoryFoods([], { fail: true });
  assert.equal((await searchFoods("granola", { foods: down })).status, "error");
  await searchFoods("granola", { foods: down });
  assert.equal(down.calls.length, 2, "errors are retried");
});

// "Looks wrong? Fix it on Open Food Facts" (owner, 2026-10-01): users edit with their own OFF account; OFF's own AI
// reads nutrition from label photos. Both forms open with the barcode filled in (checked live 2026-10-01).
test("Open Food Facts edit and add links carry the cleaned barcode", () => {
  assert.equal(offEditUrl("3017620422003"), "https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=3017620422003");
  assert.equal(offAddUrl(" 30176-20429996 "), "https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=3017620429996");
});

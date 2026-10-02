import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knownNutrition, lookupBarcode, pickUsdaFood, mapOffResponse, normalizeBarcode, isBarcode, sameBarcode, tidyCase, mapUsdaSearch, searchUsda, offEditUrl, offAddUrl } from "./lookup.ts";
import { analyzeIngredients } from "./safety/analyze.ts";

const fixture = (path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), "utf8"));
const EMPTY_USDA = { totalHits: 0, foods: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake network: USDA answers from `usda` by exact query string, OFF from `off` by barcode; everything else is empty/404. */
function fakeNet(usda: Record<string, unknown>, off: Record<string, { httpStatus: number; body: unknown }>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://api.nal.usda.gov/")) {
      const q = new URL(url).searchParams.get("query") ?? "";
      return json(usda[q] ?? EMPTY_USDA);
    }
    const code = url.match(/product\/(\d+)\.json/)?.[1] ?? "";
    const hit = off[code];
    return hit ? json(hit.body, hit.httpStatus) : json(fixture("off/not-found-3017620429996").body, 404);
  }) as typeof fetch;
  return { impl, calls };
}

// ── USDA mapper ──────────────────────────────────────────────────────────────

test("a USDA record maps to a Product with its source", () => {
  const p = pickUsdaFood(fixture("usda/coke-zero-00049000042566"), "049000042566");
  assert.ok(p);
  assert.equal(p.id, -49000042566);
  assert.equal(p.barcode, "00049000042566");
  assert.equal(p.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
  assert.equal(p.brand, "Coca-Cola Zero");
  assert.equal(p.category, "");
  assert.match(p.ingredients, /^CARBONATED WATER, CARAMEL COLOR/);
  assert.deepEqual(p.source, {
    name: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/food-details/2742717/nutrients",
    crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: "Non Alcoholic Beverages - Ready to Drink",
  });
  assert.ok(analyzeIngredients({ ingredients: p.ingredients }).flags.some(f => f.entry.id === "aspartame"));
});

// Review Focus 5: untrusted text.
test("ALL-CAPS names are tidied; an 'INGREDIENTS:' prefix is dropped", () => {
  const d = pickUsdaFood(fixture("usda/doritos-028400335799"), "028400335799");
  assert.equal(d?.name, "Doritos, Tortilla Chips, Nacho Cheese, Nacho Cheese");
  assert.equal(d?.brand, "Doritos");
  const o = pickUsdaFood(fixture("usda/oreo-00044000042554"), "044000042554");
  assert.match(o?.ingredients ?? "", /^SUGAR, UNBLEACHED ENRICHED FLOUR/);
  assert.equal(tidyCase("LAY'S, CLASSIC POTATO CHIPS"), "Lay's, Classic Potato Chips");
  assert.equal(tidyCase("Coca-Cola Zero"), "Coca-Cola Zero");
});

// Review Focus 4: wrong-product matches.
test("non-exact hits, empty results and junk are rejected", () => {
  const tostitos = { foods: [{ fdcId: 1, gtinUpc: "00028400064057", description: "Tostitos Bite Size", ingredients: "CORN" }] };
  assert.equal(pickUsdaFood(tostitos, "049000042566"), null);
  assert.equal(pickUsdaFood(EMPTY_USDA, "049000042566"), null);
  assert.equal(pickUsdaFood(null, "049000042566"), null);
  assert.equal(pickUsdaFood("<html>", "049000042566"), null);
  assert.equal(pickUsdaFood({ foods: [{ gtinUpc: "049000042566" }] }, "049000042566"), null, "no name and no ingredients");
});

test("when USDA has several records for a barcode, the newest wins", () => {
  const body = { foods: [
    { fdcId: 1, gtinUpc: "012345678905", description: "Old label", ingredients: "SALT", publishedDate: "2021-03-19" },
    { fdcId: 2, gtinUpc: "00012345678905", description: "New label", ingredients: "SALT", publishedDate: "2025-09-18" },
  ] };
  assert.equal(pickUsdaFood(body, "012345678905")?.name, "New label");
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
  assert.ok(sameBarcode("049000042566", "00049000042566"));
  assert.ok(!sameBarcode("049000042566", "049000042567"));
  assert.ok(!sameBarcode("", "000"));
  assert.ok(isBarcode("01311501") && isBarcode("00049000042566"));
  assert.ok(!isBarcode("1234") && !isBarcode("123456789012345"));
});

// ── lookupBarcode: order, cache, errors ────────────────────────────────────

// Review Focus 1: USDA stores Coke Zero only as 14 digits.
test("USDA is tried as typed, then 14-digit; a USDA find never asks OFF", async () => {
  const net = fakeNet({ "00049000042566": fixture("usda/coke-zero-00049000042566") }, {});
  const r = await lookupBarcode("049000042566", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "USDA FoodData Central");
  assert.deepEqual(net.calls.map(u => new URL(u).searchParams.get("query")), ["049000042566", "00049000042566"]);
  assert.ok(net.calls.every(u => u.includes("api_key=TEST")));
});

test("USDA miss falls back to OFF; a miss in both is not found", async () => {
  const net = fakeNet({}, { "3017620422003": fixture("off/nutella-3017620422003") });
  const r = await lookupBarcode("3017620422003", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
  assert.equal((await lookupBarcode("3017620429996", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
});

// Review Focus 2 and 3.
test("results are cached per barcode; errors are not, and are never 'not found'", async () => {
  const net = fakeNet({ "00049000042566": fixture("usda/coke-zero-00049000042566") }, {});
  await lookupBarcode("049000042566", { fdcKey: "TEST", fetchImpl: net.impl });
  const before = net.calls.length;
  assert.equal((await lookupBarcode("0 49000-042566", { fdcKey: "TEST", fetchImpl: net.impl })).status, "found");
  assert.equal(net.calls.length, before, "second lookup served from the session cache");

  let calls = 0;
  const down = (async () => { calls++; throw new TypeError("Failed to fetch"); }) as typeof fetch;
  assert.equal((await lookupBarcode("012000161155", { fdcKey: "TEST", fetchImpl: down })).status, "error");
  const again = calls;
  assert.equal((await lookupBarcode("012000161155", { fdcKey: "TEST", fetchImpl: down })).status, "error");
  assert.ok(calls > again, "errors are retried, not cached");

  const usda503 = (async (input: RequestInfo | URL) => String(input).startsWith("https://api.nal.usda.gov/")
    ? json({}, 503) : json(fixture("off/not-found-3017620429996").body, 404)) as typeof fetch;
  assert.equal((await lookupBarcode("041500000251", { fdcKey: "TEST", fetchImpl: usda503 })).status, "error",
    "USDA down + OFF not found = try again, not 'not found'");
});

test("USDA down but OFF has it: show OFF", async () => {
  const f = (async (input: RequestInfo | URL) => {
    if (String(input).startsWith("https://api.nal.usda.gov/")) throw new TypeError("Failed to fetch");
    return json(fixture("off/nutella-3017620422003").body);
  }) as typeof fetch;
  const r = await lookupBarcode("03017620422003", { fdcKey: "TEST", fetchImpl: f });
  assert.equal(r.status === "found" && r.product.source?.name, "Open Food Facts");
});

// Final review: 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8). OFF answered the Heinz
// UPC-E 01311501 with a UK store product, so 8-digit codes are looked up in USDA only.
test("8-digit codes are looked up in USDA only, never Open Food Facts", async () => {
  const sweetcorn = { httpStatus: 200, body: { status: "success", product: { code: "01311501", product_name: "Sainsbury's Organic Sweetcorn", ingredients_text: "Sweetcorn" } } };
  const net = fakeNet({}, { "01311501": sweetcorn });
  assert.equal((await lookupBarcode("01311501", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
  assert.ok(net.calls.every(u => u.startsWith("https://api.nal.usda.gov/")), "no OFF request");
});

test("an OFF find made while USDA was unreachable is shown but not cached", async () => {
  let calls = 0;
  const f = (async (input: RequestInfo | URL) => {
    calls++;
    if (String(input).startsWith("https://api.nal.usda.gov/")) throw new TypeError("Failed to fetch");
    return json(fixture("off/nutella-3017620422003").body);
  }) as typeof fetch;
  assert.equal((await lookupBarcode("4006381333931", { fdcKey: "TEST", fetchImpl: f })).status, "found");
  const first = calls;
  assert.equal((await lookupBarcode("4006381333931", { fdcKey: "TEST", fetchImpl: f })).status, "found");
  assert.ok(calls > first, "looked up again once USDA may be back");
});

// M3: the first deploy's key secret carried a trailing newline and USDA answered 403 API_KEY_INVALID.
test("a USDA key with stray whitespace (e.g. a pasted newline) is trimmed before use", async () => {
  const net = fakeNet({}, {});
  await lookupBarcode("036000291452", { fdcKey: " KEY\n", fetchImpl: net.impl });
  const usda = net.calls.filter(u => u.startsWith("https://api.nal.usda.gov/"));
  assert.ok(usda.length > 0);
  assert.ok(usda.every(u => new URL(u).searchParams.get("api_key") === "KEY"));
});

test("codes outside 8–14 digits never hit the network", async () => {
  const net = fakeNet({}, {});
  assert.equal((await lookupBarcode("1234", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
  assert.equal((await lookupBarcode("abc", { fdcKey: "TEST", fetchImpl: net.impl })).status, "not-found");
  assert.equal(net.calls.length, 0);
});

test("a USDA find carries its nutrition, and list cards can read it afterwards without a request", async () => {
  const net = fakeNet({ "044000032029": fixture("usda/oreo-nutrition-044000032029") }, {});
  assert.equal(knownNutrition("044000032029"), null);
  const r = await lookupBarcode("044000032029", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(r.status === "found" && r.product.nutrition?.serving, "3 cookies (34 g)");
  await new Promise(resolve => setTimeout(resolve, 0)); // the cache bookkeeping runs after the promise settles
  assert.equal(knownNutrition("0 44000-032029")?.nutrients[0].dv, 28);
  assert.equal(knownNutrition(""), null);
});

// ── USDA text search ("More from USDA" in search results) ─────────────────────

test("a USDA text search maps to up to 10 distinct products, each with its source and nutrition", () => {
  const products = mapUsdaSearch(fixture("usda/search-ice-cream"));
  assert.equal(products.length, 10);
  assert.equal(new Set(products.map(p => p.barcode.replace(/^0+/, ""))).size, 10, "distinct barcodes");
  for (const p of products) {
    assert.equal(p.source?.name, "USDA FoodData Central");
    assert.ok(p.id < 0, "looked-up ids are negative");
    assert.equal(p.name, "Ice Cream");
  }
  assert.ok(products.some(p => p.nutrition), "nutrition comes along");
  assert.deepEqual(mapUsdaSearch(null), []);
  assert.deepEqual(mapUsdaSearch({ foods: [{ description: "No barcode" }] }), [], "records without a barcode are dropped");
});

test("searchUsda: one request per text for the session; errors aren't cached; blank text makes no request", async () => {
  const net = fakeNet({ "ice cream": fixture("usda/search-ice-cream") }, {});
  const a = await searchUsda("Ice  Cream", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(a.status === "ok" && a.products.length, 10);
  await searchUsda("ice cream", { fdcKey: "TEST", fetchImpl: net.impl });
  assert.equal(net.calls.length, 1, "the second search is served from the session cache");
  assert.equal((await searchUsda("  ", { fdcKey: "TEST", fetchImpl: net.impl })).status, "ok");
  assert.equal(net.calls.length, 1);

  let calls = 0;
  const down = (async () => { calls++; return json({}, 503); }) as typeof fetch;
  assert.equal((await searchUsda("granola", { fdcKey: "TEST", fetchImpl: down })).status, "error");
  await searchUsda("granola", { fdcKey: "TEST", fetchImpl: down });
  assert.equal(calls, 2, "errors are retried");
});

// "Looks wrong? Fix it on Open Food Facts" (owner, 2026-10-01): users edit with their own OFF account; OFF's own AI
// reads nutrition from label photos. Both forms open with the barcode filled in (checked live 2026-10-01).
test("Open Food Facts edit and add links carry the cleaned barcode", () => {
  assert.equal(offEditUrl("3017620422003"), "https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=3017620422003");
  assert.equal(offAddUrl(" 30176-20429996 "), "https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=3017620429996");
});

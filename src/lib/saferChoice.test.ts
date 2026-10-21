import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gtinValid, trimSaferChoice, saferChoiceMatch, saferChoiceProduct, inCaliforniaScope, CALIFORNIA_SCOPE, type SaferChoiceSnapshot } from "./saferChoice.ts";
import { analyzeIngredients } from "./safety/analyze.ts";

const row = (over: Record<string, unknown>) => ({
  program: "Safer Choice", category: "Consumer Product", sector: "Dish Soaps", upcs: null, gtins: null,
  product_name: "Check Dish Soap", company_name: "Check Co.", company_in_good_standing: true, ...over,
});

test("GTIN check digit: right-aligned, so lost leading zeros don't change it", () => {
  assert.equal(gtinValid("019200850179"), true);
  assert.equal(gtinValid("19200850179"), true);    // the same UPC with its leading zero lost
  assert.equal(gtinValid("00019200850179"), true); // its 14-digit form
  assert.equal(gtinValid("019200850178"), false);
  assert.equal(gtinValid("1234567"), false);       // under 8 digits
});

test("trim: Safer Choice rows with a valid UPC or GTIN from a company in good standing, keyed without leading zeros", () => {
  const { snapshot, stats } = trimSaferChoice([
    row({ upcs: 19200850179 }),                                       // 11 digits: lost its leading zero
    row({ upcs: 19200850179, sector: "Hand Soaps" }),                 // same product, second sector: one product
    row({ gtins: 10019200850176, upcs: "" }),                         // its case-level GTIN-14 (a different code); "" is no UPC
    row({ program: "DfE", upcs: 36000291452, product_name: "Disinfectant" }),
    row({ upcs: 36000291452, product_name: "Lapsed", company_in_good_standing: null }), // null is not true
    row({ upcs: 19200850178, product_name: "Bad check digit" }),
    row({ product_name: "No code" }),
  ], "2026-10-20");
  assert.deepEqual(snapshot.products, [{ name: "Check Dish Soap", company: "Check Co.", sectors: ["Dish Soaps", "Hand Soaps"], codes: ["10019200850176", "19200850179"] }]);
  assert.equal(snapshot.retrieved, "2026-10-20");
  assert.deepEqual(stats, { rows: 7, saferChoice: 6, withCode: 5, goodStanding: 4, badCheckDigit: 1, products: 1, codes: 2, sharedCodes: 0 });
});

test("a code EPA lists under two different products matches both (Q6)", () => {
  const { snapshot, stats } = trimSaferChoice([row({ upcs: 19200850179 }), row({ upcs: 19200850179, product_name: "Other" })], "2026-10-20");
  assert.deepEqual(saferChoiceMatch("019200850179", snapshot).map(p => p.name), ["Check Dish Soap", "Other"]);
  assert.deepEqual([stats.products, stats.codes, stats.sharedCodes], [2, 1, 1]);
});

test("California line: only products with at least one in-scope EPA type (no hand soap)", () => {
  assert.equal(inCaliforniaScope({ sectors: ["Laundry Products : Laundry Detergents"] }), true);
  assert.equal(inCaliforniaScope({ sectors: ["Hand Soaps"] }), false);
  assert.equal(inCaliforniaScope({ sectors: ["Hand Soaps", "Dish Soaps"] }), true);
  assert.equal(inCaliforniaScope({ sectors: [] }), false);
});

test("every EPA type in the snapshot is decided: in California's scope or knowingly out", () => {
  const OUT = new Set(["Hand Soaps", "Pet Care Products", "Medical Instrument Cleaners", "Deicers", "Fire Defense Products", "Athletic Field Paints",
    "Dust Control Products", "HVAC Maintenance", "Parts Washers", "Other Home Products", "Other Business Products", "Marine/RV Cleaners",
    "Aircraft Cleaning Products", "Air Conditioner Coil Cleaners"]);
  const snap: SaferChoiceSnapshot = JSON.parse(readFileSync(new URL("../data/safer-choice.json", import.meta.url), "utf8"));
  const undecided = [...new Set(snap.products.flatMap(p => p.sectors))].filter(s => !CALIFORNIA_SCOPE.has(s) && !OUT.has(s) && !s.startsWith("Biological-Based Products"));
  assert.deepEqual(undecided, []);
});

test("a page from EPA's list alone: EPA's name and company, no ingredients, the looked-up id scheme, the non-food 'Cleaning' category", () => {
  const p = saferChoiceProduct("019200850179", { name: "Check Dish Soap", company: "Check Co.", sectors: [], codes: [] });
  assert.deepEqual([p.id, p.name, p.brand, p.category, p.ingredients, p.source], [-19200850179, "Check Dish Soap", "Check Co.", "Cleaning", "", undefined]);
  assert.equal(analyzeIngredients(p).verdict, "non-food");
});

const SNAP: SaferChoiceSnapshot = { retrieved: "2026-10-20", source: "", products: [{ name: "Check Dish Soap", company: "Check Co.", sectors: ["Dish Soaps"], codes: ["19200850179"] }] };

test("match: the scanned 12-, 13- and 14-digit forms all find the product; exact digits only", () => {
  for (const code of ["019200850179", "0019200850179", "00019200850179", "0 19200-85017 9"])
    assert.deepEqual(saferChoiceMatch(code, SNAP).map(p => p.name), ["Check Dish Soap"], code);
  assert.deepEqual(saferChoiceMatch("019200850178", SNAP), []); // one digit off
  assert.deepEqual(saferChoiceMatch("19200850179000", SNAP), []);
  assert.deepEqual(saferChoiceMatch("", SNAP), []);
});

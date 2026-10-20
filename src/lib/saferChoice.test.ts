import { test } from "node:test";
import assert from "node:assert/strict";
import { gtinValid, trimSaferChoice, saferChoiceMatch, type SaferChoiceSnapshot } from "./saferChoice.ts";

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
    row({ gtins: 10019200850176 }),                                   // same product's 14-digit GTIN
    row({ program: "DfE", upcs: 36000291452, product_name: "Disinfectant" }),
    row({ upcs: 36000291452, product_name: "Lapsed", company_in_good_standing: null }), // null is not true
    row({ upcs: 19200850178, product_name: "Bad check digit" }),
    row({ product_name: "No code" }),
  ], "2026-10-20");
  assert.deepEqual(snapshot.products, [{ name: "Check Dish Soap", company: "Check Co.", sectors: ["Dish Soaps", "Hand Soaps"], codes: ["10019200850176", "19200850179"] }]);
  assert.equal(snapshot.retrieved, "2026-10-20");
  assert.deepEqual(stats, { rows: 7, saferChoice: 6, withCode: 5, goodStanding: 4, badCheckDigit: 1, products: 1, codes: 2, sharedCodes: 0 });
});

test("trim: a code listed under two different products matches neither", () => {
  const { snapshot, stats } = trimSaferChoice([row({ upcs: 19200850179 }), row({ upcs: 19200850179, product_name: "Other" })], "2026-10-20");
  assert.equal(saferChoiceMatch("019200850179", snapshot), null);
  assert.equal(stats.sharedCodes, 1);
});

const SNAP: SaferChoiceSnapshot = { retrieved: "2026-10-20", source: "", products: [{ name: "Check Dish Soap", company: "Check Co.", sectors: ["Dish Soaps"], codes: ["19200850179"] }] };

test("match: the scanned 12-, 13- and 14-digit forms all find the product; exact digits only", () => {
  for (const code of ["019200850179", "0019200850179", "00019200850179", "0 19200-85017 9"])
    assert.equal(saferChoiceMatch(code, SNAP)?.name, "Check Dish Soap", code);
  assert.equal(saferChoiceMatch("019200850178", SNAP), null); // one digit off
  assert.equal(saferChoiceMatch("19200850179000", SNAP), null);
  assert.equal(saferChoiceMatch("", SNAP), null);
});

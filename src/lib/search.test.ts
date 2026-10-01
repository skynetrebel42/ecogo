import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { searchCatalog } from "./search.ts";
import { parseProductsCSV } from "./productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../data/products.csv", import.meta.url), "utf8"));
const names = (q: string) => searchCatalog(catalog, q).map(p => p.id);

// The bug (owner, 2026-09-30): "ice cream" showed orange juice, iced tea, sliced cheese, butter, bread and dog food,
// because the first word matched INSIDE keywords ("ju-ice", "ice-d", "sl-ice-d", "r-ice") and "cream" matched butter.
test("every typed word must match a whole word: 'ice cream' finds only the ice cream", () => {
  assert.deepEqual(names("ice cream"), [44]);
  assert.deepEqual(names("ICE CREAM"), [44]);
  assert.ok(!names("ice").includes(9), "'ice' is not inside 'juice'");
});

test("plurals match either way, and brands, names and categories count", () => {
  assert.deepEqual(names("chips"), names("chip"));
  assert.ok(names("chips").includes(1) && names("chips").includes(13), "Lay's and Doritos");
  assert.ok(names("cookie").includes(14), "Oreo via 'cookies'");
  assert.ok(names("oreo").includes(14));
  assert.ok(names("lay's").includes(1) && names("lays").includes(1));
  assert.ok(names("snacks").length >= 5, "category");
  assert.ok(names("cheese").includes(32), "Kraft Singles");
});

test("blank or symbol-only queries find nothing", () => {
  assert.deepEqual(names(""), []);
  assert.deepEqual(names("   "), []);
  assert.deepEqual(names("!!"), []);
});

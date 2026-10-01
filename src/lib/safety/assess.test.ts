import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessProduct } from "./assess.ts";
import { analyzeIngredients } from "./analyze.ts";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));

test("catalog: only the four processed-meat products change level (to known); acrylamide changes nothing", () => {
  const changed = catalog
    .map(p => ({ id: p.id, before: analyzeIngredients(p).verdict, after: assessProduct(p).verdict }))
    .filter(r => r.before !== r.after);
  assert.deepEqual(changed.map(r => [r.id, r.after]), [[6, "known"], [36, "known"], [38, "known"], [42, "known"]]);
  const lays = assessProduct(catalog.find(p => p.id === 1)!);
  assert.ok(lays.concerns.some(c => c.id === "acrylamide"));
  assert.equal(lays.verdict, analyzeIngredients(catalog.find(p => p.id === 1)!).verdict);
});

// Review Focus 4.
test("a hot dog with no ingredient list still reads known, not 'not enough data'", () => {
  assert.equal(assessProduct({ name: "Beef Hot Dogs", category: "Meat", ingredients: "" }).verdict, "known");
  assert.equal(assessProduct({ name: "Mystery Snack", category: "Snacks", ingredients: "" }).verdict, "no-data");
});

test("non-food stays non-food, with no food-level concerns", () => {
  const a = assessProduct({ name: "Bacon Scented Candle", category: "Cleaning", ingredients: "Paraffin wax" });
  assert.equal(a.verdict, "non-food");
  assert.deepEqual(a.concerns, []);
});

test("looked-up products: USDA category drives the level; additive codes still count", () => {
  const franks = assessProduct({ name: "Classic Franks", category: "", ingredients: "BEEF, WATER, SALT", source: { foodCategory: "Sausages, Hotdogs & Brats" } });
  assert.equal(franks.verdict, "known");
  const cola = assessProduct({ name: "Diet Cola", category: "", ingredients: "", additiveCodes: ["en:e951"], source: { categoryTags: ["en:colas"] } });
  assert.equal(cola.verdict, "some");
});

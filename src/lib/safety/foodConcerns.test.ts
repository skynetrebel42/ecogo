import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foodConcerns, acrylamideMatch, PROCESSED_MEAT, ACRYLAMIDE, type FoodInput } from "./foodConcerns.ts";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const meat = (p: Partial<FoodInput>) => foodConcerns({ name: "", category: "Meat", ingredients: "", ...p }).find(c => c.id === "processed-meat")?.reason ?? null;
const usda = (foodCategory: string, name = "x", ingredients = "") => acrylamideMatch({ name, category: "", ingredients, source: { foodCategory } });
const off = (tags: string[]) => acrylamideMatch({ name: "x", category: "", ingredients: "", source: { categoryTags: tags } });

test("catalog: exactly the reviewed products are processed meat, with their reasons", () => {
  const hits = catalog.map(p => [p.id, foodConcerns(p).find(c => c.id === "processed-meat")?.reason] as const).filter(([, r]) => r);
  assert.deepEqual(hits, [
    [6, "Processed meat: Hot Dogs"],
    [36, "Processed meat: SPAM"],
    [38, "Processed meat: Sausage"],
    [42, "Contains processed meat: Pepperoni"],
  ]);
});

test("catalog: exactly the reviewed products get the acrylamide marker", () => {
  // Lay's, Oreo, Nature Valley, Pringles, Special K, Wonder bread, Goldfish (EU Reg 2017/2158 Art. 1(2)).
  // Not: Doritos/Cheetos (corn), Quaker oatmeal (porridge), frozen foods, drinks, non-food (incl. Gerber, "Baby Care").
  assert.deepEqual(catalog.filter(p => acrylamideMatch(p)).map(p => p.id), [1, 14, 16, 18, 20, 40, 41]);
});

// Review Focus 1 and 2.
test("processed meat: meat-free versions, flavourings and look-alike words don't match", () => {
  assert.equal(meat({ name: "Vegan Italian Sausage" }), null);
  assert.equal(meat({ name: "Plant-Based Bacon" }), null);
  assert.equal(meat({ name: "Salad Topping", ingredients: "Imitation bacon bits (soy flour, canola oil)" }), null);
  assert.equal(meat({ name: "Chips", category: "Snacks", ingredients: "Potatoes, oil, bacon flavor" }), null);
  assert.equal(meat({ name: "Graham Crackers", category: "Snacks", ingredients: "Enriched graham flour, sugar" }), null);
  assert.equal(meat({ name: "Frank's RedHot Original", category: "Condiments", ingredients: "Aged cayenne red peppers, vinegar" }), null);
  assert.equal(meat({ name: "Seasoning", ingredients: "Wheat flour, ham-free seasoning" }), null);
  assert.equal(meat({ name: "Pulled Pork", ingredients: "Pork, natural smoke flavor, salt" }), null);
  assert.equal(meat({ name: "Chicken Nuggets", ingredients: "Chicken, water, salt" }), null);
});

test("processed meat: real cases match, including inside other foods", () => {
  assert.equal(meat({ name: "Turkey Bacon" }), "Processed meat: Bacon");
  assert.equal(meat({ name: "Original Beef Jerky" }), "Processed meat: Jerky");
  assert.equal(meat({ name: "Club Sandwich Kit", ingredients: "Bread (wheat flour), ham (pork, water, salt, sodium nitrite)" }), "Contains processed meat: ham");
  assert.equal(meat({ name: "Breakfast Bowl", category: "Frozen", ingredients: "Potatoes, eggs, sausage (pork, salt, spices)" }), "Contains processed meat: sausage");
  assert.equal(meat({ name: "Classic Franks", category: "", source: { foodCategory: "Sausages, Hotdogs & Brats" } }),
    'Processed meat (USDA category "Sausages, Hotdogs & Brats")');
  assert.equal(meat({ name: "Bacon Air Freshener", category: "Cleaning" }), null, "non-food never matches");
});

// Review Focus 3: corn chips share USDA's chip category with potato chips.
test("acrylamide: USDA categories, decided by the first ingredient for snacks", () => {
  assert.equal(usda("Chips, Pretzels & Snacks", "Classic Potato Chips", "POTATOES, VEGETABLE OIL, SALT"), "a");
  assert.equal(usda("Chips, Pretzels & Snacks", "Tortilla Chips", "CORN, VEGETABLE OIL, SALT"), null);
  assert.equal(usda("Breads & Buns"), "c");
  assert.equal(usda("Cereal", "Honey Nut Cereal"), "d");
  assert.equal(usda("Cereal", "Instant Oatmeal Maple"), null);
  assert.equal(usda("Crackers & Biscotti"), "e");
  assert.equal(usda("Coffee"), "f");
  assert.equal(usda("Non Alcoholic Beverages - Ready to Drink"), null);
  assert.equal(usda(""), null);
});

test("acrylamide: Open Food Facts tags; porridge and corn chips excluded", () => {
  assert.equal(off(["en:snacks", "en:crisps", "en:potato-crisps"]), "a");
  assert.equal(off(["en:snacks", "en:chips-and-fries", "en:crisps", "en:corn-chips"]), null);
  assert.equal(off(["en:breakfasts", "en:breakfast-cereals"]), "d");
  assert.equal(off(["en:breakfasts", "en:breakfast-cereals", "en:porridge"]), null);
  assert.equal(off(["en:snacks", "en:biscuits-and-crackers"]), "e");
  assert.equal(off(["en:beverages", "en:colas"]), null);
  assert.equal(off([]), null);
});

test("food-level sources are complete (verify:sources checks the quotes)", () => {
  for (const c of [PROCESSED_MEAT, ACRYLAMIDE]) {
    assert.ok(c.sources.length >= 3, c.id);
    assert.ok(c.sources.some(s => s.basis !== "context"), `${c.id}: needs a classification source`);
    for (const s of c.sources) {
      assert.match(s.url, /^https?:\/\//);
      assert.ok(s.quote.trim() && s.quote.trim().split(/\s+/).length <= 25, s.url);
      assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  assert.equal(PROCESSED_MEAT.severity, "known");
  assert.equal(ACRYLAMIDE.severity, undefined, "acrylamide never sets a level (decision L6)");
});

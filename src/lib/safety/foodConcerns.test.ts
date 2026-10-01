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
    [6, "Processed meat: Franks"],
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
  assert.equal(meat({ name: "Classic Beef Links", category: "", source: { foodCategory: "Sausages, Hotdogs & Brats" } }),
    'Processed meat (USDA category "Sausages, Hotdogs & Brats")');
  assert.equal(meat({ name: "Bacon Air Freshener", category: "Cleaning" }), null, "non-food never matches");
});

// Final review C1: a meat word in the name isn't enough when the ingredients show no meat.
test("processed meat: the name needs meat in the ingredients; buns, sauces and plant-based versions don't match", () => {
  assert.equal(meat({ name: "Hot Dog Buns", category: "", ingredients: "ENRICHED WHEAT FLOUR, WATER, SUGAR, YEAST", source: { foodCategory: "Breads & Buns" } }), null);
  assert.equal(meat({ name: "Hot Dog Buns", category: "Bread" }), null, "no ingredient list: still a bun");
  assert.equal(meat({ name: "Hot Dog Chili Sauce", category: "Condiments", ingredients: "Water, beef, tomato paste, chili powder" }), null);
  assert.equal(meat({ name: "Beyond Sausage Brat Original", ingredients: "Water, pea protein, refined coconut oil, rice protein" }), null);
  assert.equal(meat({ name: "Coconut Bacon", ingredients: "Coconut, liquid smoke, bacon flavor" }), null);
  assert.equal(meat({ name: "Loaded Bacon & Cheddar Flavored Potato Chips", category: "Snacks", ingredients: "POTATOES, VEGETABLE OIL, SMOKE FLAVOR" }), null);
  assert.equal(meat({ name: "Ham-Free Split Pea Soup" }), null);
  assert.equal(meat({ name: "Plant Sausage", category: "", ingredients: "Soy protein, water", source: { foodCategory: "Sausages, Hotdogs & Brats" } }), null);
});

// Final review I1: common processed-meat names, including "uncured" ones, must not read "Nothing flagged".
test("processed meat: franks, kielbasa, brats and other cured-meat names match", () => {
  assert.equal(meat({ name: "Uncured Beef Franks", ingredients: "Beef, water, sea salt, cultured celery powder" }), "Processed meat: Franks");
  assert.equal(meat({ name: "Uncured Polska Kielbasa", ingredients: "Pork, beef, water, salt" }), "Processed meat: Kielbasa");
  assert.equal(meat({ name: "Johnsonville Bratwurst", ingredients: "Pork, water, salt, spices" }), "Processed meat: Bratwurst");
  assert.equal(meat({ name: "Classic Corn Dogs", category: "Frozen", ingredients: "Batter (enriched flour, water), uncured beef franks (beef, water, salt)" }), "Contains processed meat: franks");
  assert.equal(meat({ name: "Frank's RedHot Original", category: "Condiments", ingredients: "Aged cayenne red peppers, vinegar" }), null);
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

// Final review I2 + re-graded minor: a dish word marks "contains", but not when the product IS the meat.
test("processed meat: deli products named for a use stay known; mixed dishes named after their meat read high", () => {
  const level = (p: Partial<FoodInput>) => foodConcerns({ name: "", category: "", ingredients: "Pork, beef, salt, spices, sodium nitrite", ...p }).find(c => c.id === "processed-meat")?.severity ?? null;
  assert.equal(level({ name: "Hormel Sandwich Style Pepperoni", source: { foodCategory: "Pepperoni, Salami & Cold Cuts" } }), "known");
  assert.equal(level({ name: "Hormel Pepperoni Pizza Topping" }), "known");
  assert.equal(level({ name: "Boar's Head Pizza Style Pepperoni" }), "known");
  assert.equal(level({ name: "Hebrew National Salami Sandwich Slices" }), "known");
  assert.equal(level({ name: "Old Wisconsin Beef Sausage Bites", source: { foodCategory: "Sausages, Hotdogs & Brats" } }), "known");
  assert.equal(level({ name: "Jack Link's Beef Jerky Bites" }), "known");
  assert.equal(level({ name: "DiGiorno Pepperoni Pizza Slices", category: "Frozen", ingredients: "Crust (flour), pepperoni (pork, beef)" }), "high");
  assert.equal(level({ name: "Totino's Pepperoni Pizza Bites", category: "Frozen" }), "high");
  assert.equal(level({ name: "Jimmy Dean Sausage Breakfast Bowl", category: "Frozen", ingredients: "Potatoes, eggs, sausage (pork, salt)" }), "high");
  assert.equal(level({ name: "Bush's Maple Cured Bacon Baked Beans", category: "Condiments", ingredients: "Beans, water, sugar, bacon (pork, salt, sodium nitrite)" }), "high");
  assert.equal(level({ name: "Kraft Mac & Cheese with Bacon", category: "Frozen", ingredients: "Macaroni, cheese, bacon (pork, salt)" }), "high");
  assert.equal(level({ name: "Stouffer's Sausage Lasagna", category: "Frozen", ingredients: "Pasta, sausage (pork, salt)" }), "high");
});

// M5 decision N6: being processed meat is Known; only containing some is High.
test("processed meat: products that ARE it read known; products that only contain it read high", () => {
  const level = (p: Partial<FoodInput>) => foodConcerns({ name: "", category: "Meat", ingredients: "", ...p }).find(c => c.id === "processed-meat")?.severity ?? null;
  assert.equal(level({ name: "Classic Beef Hot Dogs", ingredients: "Beef, water, salt" }), "known");
  assert.equal(level({ name: "Pepperoni Pizza", category: "Frozen", ingredients: "Flour, water, pepperoni (pork, beef, salt)" }), "high");
  assert.equal(level({ name: "Baked Beans", category: "Condiments", ingredients: "Beans, water, sugar, bacon (pork, salt, sodium nitrite)" }), "high");
  assert.equal(level({ name: "Classic Beef Links", category: "", ingredients: "BEEF, WATER, SALT", source: { foodCategory: "Sausages, Hotdogs & Brats" } }), "known");
  const digiorno = foodConcerns(catalog.find(p => p.id === 42)!).find(c => c.id === "processed-meat")!;
  assert.equal(digiorno.severity, "high");
  assert.match(digiorno.context, /much smaller than IARC's 50 g daily portion/);
  for (const id of [6, 36, 38]) assert.equal(foodConcerns(catalog.find(p => p.id === id)!).find(c => c.id === "processed-meat")?.severity, "known", `#${id}`);
});

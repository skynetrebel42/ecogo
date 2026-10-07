// M11 part 1: food icons. Copy to src/lib/foodIcon.test.ts and usda-categories.json to src/lib/fixtures/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foodIcon, iconForCategory, DEFAULT_ICON, CATALOG_ICON } from "./foodIcon.ts";

const categories: { category: string; n: number }[] =
  JSON.parse(readFileSync(new URL("./fixtures/usda-categories.json", import.meta.url), "utf8"));

test("real USDA categories: the common ones get the icon a shopper expects", () => {
  const expect: Record<string, string> = {
    "Candy": "🍬", "Cheese": "🧀", "Soda": "🥤", "Water": "💧", "Cereal": "🥣", "Yogurt": "🥛", "Milk": "🥛",
    "Ice Cream & Frozen Yogurt": "🍦", "Cookies & Biscuits": "🍪", "Chips, Pretzels & Snacks": "🥨",
    "Chocolate": "🍫", "Snack, Energy & Granola Bars": "🍫", "Breads & Buns": "🍞", "Pizza": "🍕",
    "Prepared Pasta & Pizza Sauces": "🥫", "Ketchup, Mustard, BBQ & Cheese Sauce": "🥫", "Salad Dressing & Mayonnaise": "🥫",
    "Frozen Breakfast Sandwiches, Biscuits & Meals": "🥪", "Non Alcoholic Beverages - Ready to Drink": "🥤",
    "Alcohol": "🍷", "Liquid Water Enhancer": "🥤", "Iced & Bottle Tea": "🥤", "Tea Bags": "🍵", "Coffee": "☕",
    "Vegetable & Cooking Oils": "🧈", "Nut & Seed Butters": "🥜", "Jam, Jelly & Fruit Spreads": "🍯", "Honey": "🍯",
    "Other Grains & Seeds": "🍚", "Pasta by Shape & Type": "🍝", "Canned Soup": "🍲", "Pepperoni, Salami & Cold Cuts": "🌭",
    "Frozen Fish & Seafood": "🐟", "Eggs & Egg Substitutes": "🥚", "Deli Salads": "🥗", "Frozen Patties and Burgers": "🍔",
    "Popcorn, Peanuts, Seeds & Related Snacks": "🍿", "Pre-Packaged Fruit & Vegetables": "🍎", "Canned Vegetables": "🥦",
    "Frozen Dinners & Entrees": "🍽️", "Seasoning Mixes, Salts, Marinades & Tenderizers": "🧂",
  };
  for (const [category, icon] of Object.entries(expect)) assert.equal(iconForCategory(category), icon, category);
});

test("real USDA categories: at least 99.9% of the products get an icon other than the cart, and none fall outside the rules by accident", () => {
  const total = categories.reduce((s, c) => s + c.n, 0);
  const unmapped = categories.filter(c => c.category !== "" && iconForCategory(c.category) === null);
  const missing = unmapped.reduce((s, c) => s + c.n, 0) + (categories.find(c => c.category === "")?.n ?? 0);
  assert.ok(missing / total < 0.001, `${missing} of ${total} products would show the cart: ${unmapped.map(c => c.category).join("; ")}`);
  assert.ok(unmapped.length <= 6, unmapped.map(c => c.category).join("; "));
});

test("a product: catalog category first, then USDA, then the most specific Open Food Facts tag, else the cart", () => {
  assert.equal(foodIcon({ category: "Beverages" }), CATALOG_ICON.Beverages);
  assert.equal(foodIcon({ category: "Cleaning" }), "🧽");
  assert.equal(foodIcon({ category: "", source: { foodCategory: "Cheese" } }), "🧀");
  assert.equal(foodIcon({ source: { foodCategory: "Media" } }), DEFAULT_ICON);
  assert.equal(foodIcon({ category: "" }), DEFAULT_ICON);
  assert.equal(foodIcon({ source: { foodCategory: "" } }), DEFAULT_ICON, "a USDA row with no category");
});

test("Open Food Facts tags: last (most specific) first, generic ones skipped", () => {
  const tags = ["en:plant-based-foods-and-beverages", "en:plant-based-foods", "en:cereals-and-potatoes", "en:breakfast-cereals"];
  assert.equal(foodIcon({ source: { categoryTags: tags } }), "🥣");
  assert.equal(foodIcon({ source: { categoryTags: ["en:plant-based-foods-and-beverages", "en:plant-based-foods"] } }), DEFAULT_ICON, "only generic tags");
  assert.equal(foodIcon({ source: { categoryTags: ["en:snacks", "en:sweet-snacks", "en:chocolate-biscuits"] } }), "🍫", "chocolate wins before biscuit by order");
  assert.equal(foodIcon({ source: { categoryTags: ["en:beverages", "en:carbonated-drinks", "en:sodas"] } }), "🥤");
  assert.equal(foodIcon({ source: { categoryTags: [] } }), DEFAULT_ICON);
});

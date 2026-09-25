import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredients } from "./parse.ts";

test("a comma between digits does not split a chemical name", () => {
  const items = parseIngredients("Water, 1,4-dioxane (trace), salt");
  assert.ok(items.includes("1,4-dioxane"));
  assert.ok(!items.includes("1"));
  assert.ok(!items.includes("4-dioxane"));
});

test("sub-ingredients inside parentheses are extracted", () => {
  const items = parseIngredients("Enriched flour, pepperoni (pork, beef, salt, spices, sodium nitrite), mozzarella");
  assert.ok(items.includes("pepperoni"));
  assert.ok(items.includes("sodium nitrite"));
  assert.ok(items.includes("mozzarella"));
});

test("nested brackets are expanded at every depth", () => {
  const items = parseIngredients("seasoning (cheese [milk, salt, enzymes], Yellow 6)");
  assert.deepEqual(items, ["seasoning", "cheese", "milk", "salt", "enzymes", "Yellow 6"]);
});

test("label filler prefixes are removed but the items after them are kept", () => {
  const items = parseIngredients("Ingredients: Wheat flour, water, contains 2% or less of: salt, yeast");
  assert.deepEqual(items, ["Wheat flour", "water", "salt", "yeast"]);
});

test("semicolons split, and 'inactive:' is filler", () => {
  const items = parseIngredients("Acetaminophen 500mg; inactive: corn starch, hypromellose");
  assert.deepEqual(items, ["Acetaminophen 500mg", "corn starch", "hypromellose"]);
});

test("allergen statements are dropped", () => {
  const items = parseIngredients("Sugar, cocoa butter. Contains: Milk, Soy. May contain traces of peanuts, tree nuts.");
  assert.deepEqual(items, ["Sugar", "cocoa butter"]);
});

test("and/or separates alternatives", () => {
  const items = parseIngredients("Vegetable Oil (Sunflower, Corn, and/or Canola Oil)");
  assert.deepEqual(items, ["Vegetable Oil", "Sunflower", "Corn", "Canola Oil"]);
});

test("trailing periods and footnote asterisks are stripped", () => {
  assert.deepEqual(parseIngredients("Organic sugar*, salt."), ["Organic sugar", "salt"]);
});

// Review Focus: an unclosed bracket must not hide the rest of the label.
test("an unclosed bracket still yields its inner items", () => {
  const items = parseIngredients("Enriched flour (wheat flour, niacin, sodium nitrite");
  assert.ok(items.includes("sodium nitrite"));
});

// Review Focus: negated mentions are claims of absence, not ingredients.
test("negated mentions are dropped", () => {
  const items = parseIngredients("Pork, water, no titanium dioxide, free from aspartame, nitrite-free, salt");
  assert.deepEqual(items, ["Pork", "water", "salt"]);
});

// Review Focus: odd whitespace and dash characters from real labels are normalized.
test("non-breaking spaces and unicode dashes are normalized", () => {
  const items = parseIngredients("sodium nitrite, E‑250");
  assert.deepEqual(items, ["sodium nitrite", "E-250"]);
});

// Final review fixes: real label wording that used to hide or invent flags.
test("a 'may contain' inside brackets does not delete the rest of the list", () => {
  const items = parseIngredients("Vegetable oil (may contain one or more of the following: canola, soybean oil), salt, Yellow 5, sodium nitrite.");
  for (const want of ["salt", "Yellow 5", "sodium nitrite"]) assert.ok(items.includes(want), want);
});

test("a sentence period ends an item", () => {
  assert.deepEqual(parseIngredients("Pork, water, salt. No titanium dioxide."), ["Pork", "water", "salt"]);
  assert.deepEqual(parseIngredients("Pork, salt, sodium nitrite. Gluten-free."), ["Pork", "salt", "sodium nitrite"]);
});

test("a '-free' claim removes only that word", () => {
  assert.deepEqual(parseIngredients("Sugar-free sweetener blend: aspartame, sucralose"), ["sweetener blend: aspartame", "sucralose"]);
});

test("a leading 'Contains:' is a heading, not an allergen statement", () => {
  assert.deepEqual(parseIngredients("Contains: Water, sugar, Red 40."), ["Water", "sugar", "Red 40"]);
});

test("empty and non-string input yield an empty list", () => {
  assert.deepEqual(parseIngredients(""), []);
  assert.deepEqual(parseIngredients("   "), []);
  assert.deepEqual(parseIngredients(undefined as unknown as string), []);
});

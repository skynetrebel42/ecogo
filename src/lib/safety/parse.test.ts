import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredients } from "./parse.ts";
import { analyzeIngredients } from "./analyze.ts";
import { analyzeCare } from "./personalCare.ts";

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

// 075 GA-01/02 (decision 076, grand audit): absence wording never reads as presence. "No added X" is an absence, not a
// claim glued to X; what a negated item names in brackets is absent too.
test("'no added X' and a negated item's bracket are absences", () => {
  assert.deepEqual(parseIngredients("Water, no added formaldehyde"), ["Water"]);
  assert.deepEqual(parseIngredients("Pork, no added sodium nitrite"), ["Pork"]);
  assert.deepEqual(parseIngredients("Water, free from (formaldehyde)"), ["Water"]);
  assert.deepEqual(parseIngredients("Sugar, no titanium dioxide (E171)"), ["Sugar"]);
  assert.deepEqual(parseIngredients("Sausage (pork, no added nitrite (E250)), salt"), ["Sausage", "pork", "salt"]);
  // M10.1 E still holds: a claim glued to the first ingredient keeps the ingredient and its bracket.
  assert.deepEqual(parseIngredients("NO NITRATES OR NITRITES ADDED*** PORK (WATER, SALT)"), ["PORK", "WATER", "SALT"]);
});

test("the audit's inputs: no false flag for an absence; the controls still flag", () => {
  assert.equal(analyzeCare("Water, no added formaldehyde").flags.length, 0);
  assert.equal(analyzeCare("Water, free from (formaldehyde)").flags.length, 0);
  const food = (t: string) => analyzeIngredients({ ingredients: t, category: "Snacks" }).flags.map(f => f.entry.id);
  assert.deepEqual(food("Pork, no added sodium nitrite"), []);
  assert.deepEqual(food("Sugar, no titanium dioxide (E171)"), []);
  assert.equal(analyzeCare("Water, formaldehyde").verdict, "known");
  assert.ok(food("Pork, sodium nitrite").length > 0, "sodium nitrite");
  assert.ok(food("Sugar, titanium dioxide").length > 0, "titanium dioxide");
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

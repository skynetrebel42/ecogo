import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanIngredients, labelLines, linesText, trimToIngredients, unsureWords } from "./ocr.ts";

const word = (text: string, confidence: number) => ({ text, confidence });
const page = (...lines: { text: string; confidence: number }[][]) => [{ paragraphs: [{ lines: lines.map(words => ({ words })) }] }];

test("words read with low confidence are the unsure ones, without their punctuation, once each", () => {
  const blocks = page([word("Sugar,", 96), word("Red", 91), word("4O,", 41)], [word("camauba", 55), word("wax.", 88), word("4O", 30)]);
  assert.deepEqual(unsureWords(blocks), ["4O", "camauba"]);
});

test("a page with no blocks has no unsure words", () => {
  assert.deepEqual(unsureWords(null), []);
  assert.deepEqual(unsureWords(page([word(",", 10)])), [], "lone punctuation isn't a word");
});

test("a leading 'Ingredients:' label is dropped, in any case or spacing", () => {
  assert.equal(cleanIngredients("INGREDIENTS: Sugar, salt"), "Sugar, salt");
  assert.equal(cleanIngredients("  Ingredients : water"), "water");
  assert.equal(cleanIngredients("Ingredient:corn"), "corn");
});

test("a word split across lines with a hyphen is joined back", () => {
  assert.equal(cleanIngredients("enriched flo-\nur, niacin"), "enriched flour, niacin");
  assert.equal(cleanIngredients("riboflav- \r\n  in"), "riboflavin");
});

test("line breaks become single spaces and the ends are trimmed", () => {
  assert.equal(cleanIngredients("sugar,\n  salt,\n\nRed 40 \n"), "sugar, salt, Red 40");
});

test("'Ingredients' later in the text and other labels are left alone", () => {
  assert.equal(cleanIngredients("Water. Contains: milk. Other ingredients: salt"), "Water. Contains: milk. Other ingredients: salt");
  assert.equal(cleanIngredients(""), "");
});

// M8 follow-up F1/F2 (docs/superpowers/specs/2026-10-08-m8-followup-label-trim-design.md).
const kept = (text: string) => { const t = trimToIngredients(text); return text.slice(t.start, t.end).trim(); };

test("the ingredients part starts after 'Ingredients:' and stops before 'Contains', junk before it left out", () => {
  const label = "Fruity Chews\nNet 4 oz\nINGREDIENTS: sugar, corn syrup, Red 40. CONTAINS: MILK.";
  assert.equal(kept(label), "sugar, corn syrup, Red 40.");
  assert.equal(trimToIngredients(label).startWord, "Ingredients");
  assert.equal(trimToIngredients(label).stopWord, "Contains");
});

test("'May contain' mid-text stops it, and other stop phrases do too, across a line break", () => {
  assert.equal(kept("Ingredients: oats, honey. May contain traces of nuts."), "oats, honey.");
  assert.equal(kept("Ingredient water, salt\nDistributed\nby Acme Foods"), "water, salt");
  assert.equal(trimToIngredients("Ingredients: water. Nutrition Facts serving").stopWord, "Nutrition facts");
});

test("with no 'Ingredients' it starts at the beginning; with no stop phrase it runs to the end", () => {
  assert.deepEqual(trimToIngredients("sugar, salt. Contains: soy"), { start: 0, end: 13, stopWord: "Contains" });
  assert.deepEqual(trimToIngredients("Ingredients: sugar, salt"), { start: 12, end: 24, startWord: "Ingredients" });
  assert.deepEqual(trimToIngredients("sugar, salt"), { start: 0, end: 11 });
});

test("'ingredient' inside another word isn't the start word", () => {
  assert.equal(kept("Noningredients sugar, Superingredient salt"), "Noningredients sugar, Superingredient salt");
});

test("a stop phrase before 'Ingredients' is ignored", () => {
  assert.equal(kept("Keep refrigerated. Ingredients: cocoa, sugar. Allergens: milk"), "cocoa, sugar.");
});

test("'Contains 2% or less of', 'Contains: less than 2% of' and 'Contains one or more of' are part of the list", () => {
  assert.equal(kept("Ingredients: water, sugar, contains 2% or less of: salt, Red 40. Contains: soy"),
    "water, sugar, contains 2% or less of: salt, Red 40.");
  assert.equal(kept("Ingredients: water. Contains: less than 2% of salt. May contain milk"), "water. Contains: less than 2% of salt.");
  assert.equal(kept("Ingredients: flour, contains one or more of the following: canola oil, soybean oil. Allergy: wheat"),
    "flour, contains one or more of the following: canola oil, soybean oil.");
});

test("'CONTAINS: MILK, SOY' still ends the list", () => {
  assert.equal(kept("INGREDIENTS: SUGAR, COCOA BUTTER. CONTAINS: MILK, SOY."), "SUGAR, COCOA BUTTER.");
});

test("each line read keeps its part of the ingredients; lines outside start unticked", () => {
  const lines = labelLines(["Fruity Chews", "INGREDIENTS: SUGAR, CORN", "SYRUP, RED 40. CONTAINS: NO", "ALLERGENS.", "Distributed by Acme"]);
  assert.deepEqual(lines.map(l => [l.kept, l.on]), [["", false], ["SUGAR, CORN", true], ["SYRUP, RED 40.", true], ["", false], ["", false]]);
  assert.equal(linesText(lines), "SUGAR, CORN SYRUP, RED 40.");
  lines[2].on = false; lines[4].on = true;
  assert.equal(linesText(lines), "SUGAR, CORN Distributed by Acme", "an unticked line leaves; a ticked outside line comes in whole");
});

test("the ticked text doesn't end in a dangling ',' or ';'", () => {
  const lines = labelLines(["Ingredients: sugar, corn starch,", "citric acid; Red 40;", "Contains: milk"]);
  assert.equal(linesText(lines), "sugar, corn starch, citric acid; Red 40");
  lines[1].on = false;
  assert.equal(linesText(lines), "sugar, corn starch");
});

test("a line with only punctuation left in the range isn't ticked", () => {
  assert.deepEqual(labelLines(["Ingredients:", "salt", ". Contains milk"]).map(l => l.on), [false, true, false]);
});

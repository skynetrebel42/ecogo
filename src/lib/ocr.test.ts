import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanIngredients, unsureWords } from "./ocr.ts";

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

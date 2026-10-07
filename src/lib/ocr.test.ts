import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanIngredients } from "./ocr.ts";

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

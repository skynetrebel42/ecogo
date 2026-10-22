import { test } from "node:test";
import assert from "node:assert/strict";
import { addComma, fixList, loadMoreNames, nearKnownName, replaceWord, splitAt, suggestWords } from "./suggest.ts";

// 066 R4 (Minh: "row under the box"): what the row offers for the text in the box, and the two edits it can make.
test("the row lists the unsure words still in the box, in reading order, and the items to split", () => {
  const text = "HEXAMETHYLINDANOPYRA BENZYL SALICYLATE, VANILLIN, HYDROXYCITRONELLASS UIHONENE, GERANYL ACETATE";
  assert.deepEqual(fixList(text, ["UIHONENE", "HYDROXYCITRONELLASS", "GERANYL", "PNENE"]), {
    words: ["HEXAMETHYLINDANOPYRA", "HYDROXYCITRONELLASS", "UIHONENE", "GERANYL"], // the first: a letter off a known name
    splits: [{ at: 20, before: "HEXAMETHYLINDANOPYRA", after: "BENZYL SALICYLATE" },
      { at: text.indexOf(" UIHONENE"), before: "HYDROXYCITRONELLASS", after: "UIHONENE" }],
  });
  assert.deepEqual(fixList("", ["X"]), { words: [], splits: [] });
  // A word read with confidence but one letter off a known name is offered too (the perfume's "LMONENE").
  assert.deepEqual(fixList("VANILLIN, LMONENE, SALT", []).words, ["LMONENE"]);
});

test("a chosen name replaces the word wherever it stands alone, never inside another word", () => {
  assert.equal(replaceWord("UIHONENE, XUIHONENE, (UIHONENE)", "UIHONENE", "LIMONENE"), "LIMONENE, XUIHONENE, (LIMONENE)");
});

test("an accepted split adds a comma where the second name starts", () => {
  const text = "VANILLIN, HEXAMETHYLINDANOPYRA BENZYL SALICYLATE";
  assert.equal(addComma(text, fixList(text, []).splits[0].at), "VANILLIN, HEXAMETHYLINDANOPYRA, BENZYL SALICYLATE");
});

// Runs before loadMoreNames() below: until the USDA words load, only EcoGo's own names are offered.
test("food words come only after the USDA list loads; it adds them, accents folded", async () => {
  assert.deepEqual(suggestWords("GAFLIC"), []);
  await loadMoreNames();
  assert.deepEqual(suggestWords("GAFLIC"), ["GARLIC"]);
  assert.deepEqual(suggestWords("MONÓSODIUM"), ["MONOSODIUM"]);
  assert.deepEqual(suggestWords("lNOSINATE"), ["Inosinate"], "mixed case: the name in title case");
  assert.deepEqual(suggestWords("iNOSINATE"), [], "already a name, only its case differs");
  assert.deepEqual(suggestWords("UIHONENE")[0], "LIMONENE", "EcoGo's names still come first when as close");
  assert.equal(nearKnownName("GAFLIC"), false, "the retake hint still counts words only the USDA list knows (R6 as accepted)");
});

// 066 R4: up to 3 real name words for a word the reader wasn't sure of, closest first, in the read word's case.
test("the perfume's misreads get the right name among up to 3 suggestions", () => {
  assert.ok(suggestWords("UIHONENE").includes("LIMONENE"), String(suggestWords("UIHONENE")));
  assert.ok(suggestWords("HYDROXYCITRONELLASS").includes("HYDROXYCITRONELLAL"), String(suggestWords("HYDROXYCITRONELLASS")));
  assert.equal(suggestWords("LNONENE")[0], "LIMONENE");
  assert.equal(suggestWords("vanilli")[0], "vanillin");
  for (const w of ["UIHONENE", "SALICYLAT", "ACETAIE"]) assert.ok(suggestWords(w).length <= 3, w);
});

test("no suggestions for short words, words that are already names, or words near no name", () => {
  for (const w of ["AGE", "LIMONENE", "FLAMMABIE", "60730"]) assert.deepEqual(suggestWords(w), [], w);
});

test("accents a reader adds are folded before matching, and the plain name is suggested", () => {
  // PINENE allows one changed letter: an added accent mustn't use it up.
  assert.equal(nearKnownName("PÍNENF"), true);
  assert.deepEqual(suggestWords("PÍNENF"), ["PINENE"]);
  assert.deepEqual(suggestWords("LÍMONENE"), ["LIMONENE"]);
});

// The split (spec R4): an item that is two known names run together gets a comma offered between them; 062's
// whole-name matching stays, so nothing is matched inside an item until the person accepts the comma.
test("two known names run together are split where the second one starts", () => {
  assert.equal(splitAt("HEXAMETHYLINDANOPYRA BENZYL SALICYLATE"), "HEXAMETHYLINDANOPYRA".length);
  assert.equal(splitAt("DIMETHYL PHENETHYL ACETATE ROSE KETONES"), "DIMETHYL PHENETHYL ACETATE".length);
  assert.equal(splitAt("HYDROXYCITRONELLAL LIMONENE"), "HYDROXYCITRONELLAL".length);
});

test("a CAS number in the middle of an item ends an ingredient: the comma goes right after it", () => {
  const glued = "COCAMIPAOPROBY BETAINE C61789-40-0) SODIUM LAURYL SULFATE";
  assert.equal(splitAt(glued), glued.indexOf("SODIUM") - 1);
  assert.equal(splitAt("WATER (7732-18-5) SODIUM LAURETH SULFATE"), "WATER (7732-18-5)".length);
  for (const item of ["SODIUM CHLORIDE (7647-14-5)", "BENZYL SALICYLATE (118-58-1).", "RED 33 (3567-66-6)"]) assert.equal(splitAt(item), null, item);
});

test("one name, or words that aren't two names, aren't split", () => {
  for (const item of ["BENZYL SALICYLATE", "CITRUS LIMON PEEL OIL", "PINENE EXT. VIOLET 2 (CI 60730)", "SUGAR", "",
    "FRAGRANCE (PARFUM)", "WATER (AQUA)", "LIMONENE (ORANGE) PEEL"]) assert.equal(splitAt(item), null, item);
});

// 066 R6 (planner, Option A): the first slice of R4's matcher. Misreads from Minh's perfume label (OCR-01).
test("a misread close to a known ingredient name is near one, at any case", () => {
  for (const w of ["UIHONENE", "LNONENE", "HYDROXYCITRONELLASS", "HEXAMETHYLINDANOFISA", "VANILLI", "Benzyl", "phenethyl"])
    assert.equal(nearKnownName(w), true, w);
});

test("a near-miss of a word that isn't an ingredient name stays unsure", () => {
  for (const w of ["FLAMMABIE", "UNDERARMUSE", "DERMATOLOGIST", "Repetir"]) assert.equal(nearKnownName(w), false, w);
});

test("short words are never near a name, so junk like 'AGE' or 'Fi' always counts", () => {
  for (const w of ["AGE", "Fi", "BUTL", "C1", "60730"]) assert.equal(nearKnownName(w), false, w);
});

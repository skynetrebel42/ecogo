import { test } from "node:test";
import assert from "node:assert/strict";
import { nearKnownName, splitAt, suggestWords } from "./suggest.ts";

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

// The split (spec R4): an item that is two known names run together gets a comma offered between them; 062's
// whole-name matching stays, so nothing is matched inside an item until the person accepts the comma.
test("two known names run together are split where the second one starts", () => {
  assert.equal(splitAt("HEXAMETHYLINDANOPYRA BENZYL SALICYLATE"), "HEXAMETHYLINDANOPYRA".length);
  assert.equal(splitAt("DIMETHYL PHENETHYL ACETATE ROSE KETONES"), "DIMETHYL PHENETHYL ACETATE".length);
  assert.equal(splitAt("HYDROXYCITRONELLAL LIMONENE"), "HYDROXYCITRONELLAL".length);
});

test("one name, or words that aren't two names, aren't split", () => {
  for (const item of ["BENZYL SALICYLATE", "CITRUS LIMON PEEL OIL", "PINENE EXT. VIOLET 2 (CI 60730)", "SUGAR", ""]) assert.equal(splitAt(item), null, item);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { addComma, fixList, loadMoreNames, nameFixes, nearKnownName, replaceWord, splitAt, suggestWords } from "./suggest.ts";

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

// 071 I: Minh's 2F soda, pasted from iPhone Live Text (notes: research-2f-paste-verbatim.md, transcribed by Scout, A and B).
const PASTED_2F = "CARBONATED WATER,\nCANE SUGAR, CITRIC ACID, NATURAL AND ARTIFICIAL\nGUAVA FLAVORS, ASCORBIC ACID (VITAMIN O, MALIC\n"
  + "ACID, ACESULFAME POTASSIEM, SUCRALOSE, COLOR\nED&C YILLOW 0. 5, EDIA (TO PRESERVED FRESHNESS),\nCOLORFD&C RED No.40, CARAMEL COLOR, SODIUM\n"
  + "BENZOATE  AND POTASSIUM SORBATE (AS\nPRESERVATIVE";
const CLEAN_2F = "CARBONATED WATER, CANE SUGAR, CITRIC ACID, NATURAL AND ARTIFICIAL GUAVA FLAVORS, ASCORBIC ACID (VITAMIN C), MALIC ACID, "
  + "ACESULFAME POTASSIUM, SUCRALOSE, COLOR FD&C YELLOW No. 5, EDTA (TO PRESERVED FRESHNESS), COLOR FD&C RED No. 40, CARAMEL COLOR, "
  + "SODIUM BENZOATE, AND POTASSIUM SORBATE (AS PRESERVATIVE)";

test("071 I: a misread colour name is offered whole, and taking it gives the Yellow 5 flag back", async () => {
  await loadMoreNames();
  const { assessProduct } = await import("./safety/assess.ts");
  const flags = (t: string) => assessProduct({ name: "", category: "", ingredients: t, source: {} }).flags.map(f => f.entry.id).sort();
  assert.deepEqual(flags(PASTED_2F), ["allura-red"]); // the silent loss Minh saw
  const fix = nameFixes(PASTED_2F).find(f => f.by.includes("YELLOW"));
  assert.deepEqual(fix, { text: "ED&C YILLOW 0. 5", by: "FD&C YELLOW NO. 5" });
  assert.deepEqual(flags(PASTED_2F.split(fix!.text).join(fix!.by)), flags(CLEAN_2F));
  assert.deepEqual(fixList(PASTED_2F, [], true).words, ["POTASSIEM", "YILLOW"]); // and the one-word slips, in reading order
  assert.deepEqual(nameFixes("water, Yelow 5"), [{ text: "Yelow 5", by: "Yellow 5" }], "in the stretch's own case");
});

test("071 I: a clean list (and a real look-alike) gets no chips", async () => {
  await loadMoreNames();
  assert.deepEqual(nameFixes(CLEAN_2F), []);
  assert.deepEqual(fixList(CLEAN_2F, [], true), { words: [], splits: [] });
  // Sodium laureth sulfate is its own ingredient, never a misread sodium lauryl sulfate; nor is Red 3 a misread Red 40.
  assert.deepEqual(nameFixes("Water, Sodium Laureth Sulfate, Red 3, Yellow 6, FD&C Blue No. 1"), []);
});

test("071 I: a typed misspelling is offered the name it misses", async () => {
  await loadMoreNames();
  assert.deepEqual(fixList("water, sodium benozate, ascorbic acid", [], true).words, ["benozate"]);
  assert.equal(suggestWords("benozate")[0], "benzoate");
});

test("071 I: none of the catalog's 51 real lists, typed, gets a chip", async () => {
  await loadMoreNames();
  const { readFileSync } = await import("node:fs");
  const { parseProductsCSV } = await import("./productImporter.ts");
  const offered = parseProductsCSV(readFileSync(new URL("../data/products.csv", import.meta.url), "utf8"))
    .flatMap(p => [...fixList(p.ingredients, [], true).words, ...nameFixes(p.ingredients).map(f => f.text)].map(w => `${p.name}: ${w}`));
  assert.deepEqual(offered, []);
});

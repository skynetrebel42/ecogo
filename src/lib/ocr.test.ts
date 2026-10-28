import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterRead, cleanIngredients, cloudHelpOn, hardToRead, joinReads, knownCount, labelLines, linesText, pasteInto, readPhoto, setCloudHelp, trimToIngredients, unglue, unsureCount, unsureWords, withCloud } from "./ocr.ts";
import { loadMoreNames } from "./suggest.ts";
import { assessProduct } from "./safety/assess.ts";
import { analyzeCare } from "./safety/personalCare.ts";

// 068 S2 (G6): Paste fills an empty box, adds to a typed one on a new line, and an empty clipboard counts as refused.
test("paste fills the box", () => {
  assert.equal(pasteInto("", "  Water, Sodium Laureth Sulfate\n"), "Water, Sodium Laureth Sulfate");
  assert.equal(pasteInto("Sugar, salt \n", "Red 40"), "Sugar, salt\nRed 40");
  assert.equal(pasteInto("Sugar", " \n "), null);
});

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

test("a stop phrase right after '(' or followed by '-' doesn't end the list", () => {
  assert.equal(kept("Ingredients: pasta, cheese (contains milk), salt. Contains: wheat"), "pasta, cheese (contains milk), salt.");
  assert.equal(kept("Ingredients: oats, Allergen-free chocolate. Distributed by Acme"), "oats, Allergen-free chocolate.");
});

test("'CONTAINS: MILK, SOY' still ends the list", () => {
  assert.equal(kept("INGREDIENTS: SUGAR, COCOA BUTTER. CONTAINS: MILK, SOY."), "SUGAR, COCOA BUTTER.");
});

// 066 R5 (OCR-02): personal-care and cleaner warnings end the list. Lines as read from Minh's perfume label.
test("a warning after a personal-care list ends it, so 'CAUTION: FLAMMABLE…' never joins the last item", () => {
  const lines = labelLines(["INGREDIENTS: ALCOHOL DENAT., WATER (AQUA, EAU),", "CITRUS LIMON PEEL OIL, TERPINEOL, PINENE",
    "EXT. VIOLET 2 (CI 60730).", "CAUTION: FLAMMABLE.", "KEEP AWAY FROM FLAME OR HIGH HEAT.", "NOT FOR UNDERARM USE.", "AVOID CONTACT WITH EYES."]);
  assert.equal(linesText(lines), "ALCOHOL DENAT., WATER (AQUA, EAU), CITRUS LIMON PEEL OIL, TERPINEOL, PINENE EXT. VIOLET 2 (CI 60730).");
  assert.deepEqual(lines.map(l => l.on), [true, true, true, false, false, false, false]);
  assert.equal(trimToIngredients(lines.map(l => l.text).join("\n")).stopWord, "Caution");
});

test("other warning phrases end the list too, in any case, across a line break", () => {
  assert.equal(kept("Ingredients: water, sodium laureth sulfate. Warning: for external use only."), "water, sodium laureth sulfate.");
  assert.equal(kept("Ingredients: water, glycerin. Warnings: avoid contact with eyes."), "water, glycerin.");
  assert.equal(kept("Ingredients: water, glycerin. Directions: apply daily."), "water, glycerin.");
  assert.equal(kept("Ingredients: water, surfactants. Keep out of\nreach of children."), "water, surfactants.");
  assert.equal(kept("Ingredients: water, glycerin. For external use only."), "water, glycerin.");
  assert.equal(kept("Ingredients: water, glycerin. Avoid contact with eyes."), "water, glycerin.");
  assert.equal(kept("Ingredients: butane, propane. Extremely flammable."), "butane, propane. Extremely");
});

// 066 R5 add (planner, Minh's live tests 2026-10-22): his Equate lotion kept its service line; Burberry's box says "DIST. FOR/POUR".
test("service and distributor lines end the list; ingredients that look like them don't", () => {
  assert.equal(kept("Ingredients: water, glycerin, dimethicone. Satisfaction guaranteed – For questions or comments please call 1-888-287-1915."),
    "water, glycerin, dimethicone.");
  assert.equal(kept("Ingredients: water, glycerin.\nQuestions or comments? 1-800-000-0000"), "water, glycerin.");
  assert.equal(kept("Ingredients: water, glycerin. Please call 1-800-000-0000"), "water, glycerin.");
  assert.equal(kept("Ingredients: alcohol, parfum (fragrance), aqua (water), coumarin\nDIST. FOR/POUR COTY INC."), "alcohol, parfum (fragrance), aqua (water), coumarin");
  assert.equal(kept("Ingredients: alcohol, coumarin, citral NY10118 DIST,FOR/POUR COTYINC."), "alcohol, coumarin, citral NY10118", "as the new reader read the box");
  for (const list of ["water, hamamelis virginiana (witch hazel) distillate, glycerin", "rose flower water dist., glycerin, calendula",
    "water, guaranteed fresh salt, callus remover", "lavender water distilled for skin, glycerin"])
    assert.equal(kept(`Ingredients: ${list}`), list, list);
});

// 066 (planner): a curve or a cut edge can lose the start of "INGREDIENTS:" (Minh's mousse read "CREDIENTS:").
test("a start word cut at the left edge counts at the start of a line: a word ending in DIENTS(S) and a colon", () => {
  const label = "Salon foam.\nDIRECTIONS: Apply evenly.\nCREDIENTS: WATER (AQUA), GLYCERIN,\nPHENOXYETHANOL\nCAUTION: KEEP OUT OF REACH";
  assert.equal(kept(label), "WATER (AQUA), GLYCERIN,\nPHENOXYETHANOL");
  assert.equal(trimToIngredients(label).startWord, "Credients");
  assert.equal(trimToIngredients("Hair care\nDIENTS: WATER, SALT").startWord, "Dients");
});

test("NUTRIENTS:, CONTENTS: and DIRECTIONS: never start the list, nor a cut start word mid-line or without a colon", () => {
  for (const t of ["NUTRIENTS: iron\nwater, salt", "CONTENTS: 200 ml\nwater, salt", "DIRECTIONS: rinse\nwater, salt",
    "Made with CREDIENTS: water, salt", "CREDIENTS water, salt"]) assert.equal(trimToIngredients(t).startWord, undefined, t);
});

test("with no start word, a stop phrase before any text doesn't empty the list: nothing is cut", () => {
  const label = "DIRECTIONS: Use to wash hands.\nWATER, GLYCERIN, SODIUM CHLORIDE.\nDISTRIBUTED BY: Acme";
  assert.deepEqual(trimToIngredients(label), { start: 0, end: label.length });
  assert.ok(labelLines(label.split("\n")).every(l => l.on), "every line ticked: the checkboxes are the person's way to leave lines out");
  assert.deepEqual(trimToIngredients("sugar, salt. Contains: soy"), { start: 0, end: 13, stopWord: "Contains" }, "text before the stop: unchanged");
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

// M8 follow-up 2 (docs/superpowers/specs/2026-10-08-m8-followup2-photo-quality-design.md G4, G6).
test("unsure words are counted in the kept text only, each time they appear", () => {
  assert.deepEqual(unsureCount("SUGAR, PEp2szlt, SALT, PEp2szlt", ["PEp2szlt", "Psmartlobel", "75019"]), { words: 4, unsure: 2 });
  assert.deepEqual(unsureCount("", ["x"]), { words: 0, unsure: 0 });
});

test("a photo is hard to read at 25% unsure kept words, or when nothing was kept", () => {
  assert.equal(hardToRead("a b c d e f g h i j k l m n o p q r s t", ["a", "b", "c", "d"]), false, "20%");
  assert.equal(hardToRead("a b c d e f g h i j k l m n o p q r s t", ["a", "b", "c", "d", "e"]), true, "25%");
  assert.equal(hardToRead("  ", []), true, "nothing kept");
});

// 066 R6 (OCR-03): recorded Tesseract reads. Unsure words near a known ingredient name (R4 offers a fix) don't count
// toward the retake hint; a sharp but narrow, curved label isn't the photo's fault. Glare, angle, cut-off and blur still are.
const recorded: Record<string, { lines: string[]; unsure: string[] }> =
  JSON.parse(readFileSync(new URL("./fixtures/ocr/tesseract-reads.json", import.meta.url), "utf8")).reads;
const hardRead = (name: string) => { const r = recorded[name]; return hardToRead(linesText(labelLines(r.lines)), r.unsure); };

test("a sharp perfume label whose unsure words are near-misses of known names isn't hard to read", () => {
  assert.equal(hardRead("perfume-screen"), false);
});

test("glare, an angle, a cut-off edge or blur still make a photo hard to read", () => {
  for (const name of ["chips3", "chips4", "chips5", "chips7", "chips8"]) assert.equal(hardRead(name), true, name);
});

test("unsure words that are near a known name are left out of the share; others still count", () => {
  assert.equal(hardToRead("LNONENE VANILLI SALT SUGAR", ["LNONENE", "VANILLI"]), false, "both near names: 0 %");
  assert.equal(hardToRead("FLAMMABIE AGE SALT SUGAR", ["FLAMMABIE"]), true, "not near a name: 25 %");
});

test("a line with only punctuation left in the range isn't ticked", () => {
  assert.deepEqual(labelLines(["Ingredients:", "salt", ". Contains milk"]).map(l => l.on), [false, true, false]);
});

// M8 follow-up 6, K2: junk never goes into the box; it waits behind "Show what we read".
test("a hard-to-read photo starts with an empty box and no lines; what was read is kept for 'Show what we read'", () => {
  const lines = labelLines(["Ingredients: Xq vb, Zrt"]);
  const r = afterRead({ text: "Xq vb, Zrt", unsure: ["Xq", "vb"], lines });
  assert.deepEqual(r, { text: "", unsure: ["Xq", "vb"], lines: [], hard: true, read: "Xq vb, Zrt" });
});

test("a clear photo fills the box and its lines, with nothing held back", () => {
  const lines = labelLines(["Ingredients: Sugar, salt"]);
  assert.deepEqual(afterRead({ text: "Sugar, salt", unsure: [], lines }), { text: "Sugar, salt", unsure: [], lines, hard: false });
});

test("lines with nothing kept are hard to read, with nothing to show; no lines at all is 'couldn't read'", () => {
  assert.deepEqual(afterRead({ text: "", unsure: [], lines: labelLines(["Nutrition Facts"]).map(l => ({ ...l, kept: "", on: false })) }),
    { text: "", unsure: [], lines: [], hard: true, read: "" });
  assert.equal(afterRead({ text: "", unsure: [], lines: [] }).error, "Couldn't read it. Type the ingredients or retake the photo.");
});

// 066 R9: Minh's chip bag read by the stronger reader (R3), as the box gets it: photo 7 cut off on the right, photo 8 on
// the left (with the nutrition panel above it). Reader output, copied from the R3 run.
const CHIPS7 = "CORN, VEGETABLE OIL (CORM, CAOLA SOYBEAN, AND/0R SUNFLOWER OIL), CORN MALTODETRIN, AND LESS THAN 2%OF CHEDDAR CHEESE (MILK, HESE CULTURES, SALT, ENZYMES), SALT, WHEY, MONOSODIU GLUTAMATE, BUTTERMILK, ROMANO CHEESE (MILK, CHE CULTURES, SALT, ENZYMES), WHEY PROTEIN CONCETAE ONION POWDER, POTASSIUM SALT, CORN FLOUR, NATUR ARTIFICIAL FLAVORS, DEXTROSE, TOMATO POWDER, LAT SPICES, ARTIFICIAL COLOR (YELLOW 6, ELLOW 5 RE LACTIC ACID, CITRIC ACID, SUGAR, GARLIC POWDER.S RED AND GREEN BELL PEPPERS, DISODIUM INOSMI DISODIUM GUANYLATE.";
const CHIPS8 = "0.3mg 10.7mg 2% 250mg 100mg 4% e nificant surceofadded sugars. yValue (DV) tels ou how much a nutrient in a serving of utes toa daiy diet ,000 calories a day is used for ition advice. TS: CORN, VEGETABLE OIL (CORN, CANOLA, ND/OR SUNFLOWER OIL), CORN MALTODEXTRIN, HAN 2% OF CHEDDAR CHEESE (MILK, CHEESE SALT, ENZYMES), SALT, WHEY, MONOSODIUM BUTTERMILK, ROMANO CHEESE (MILK, CHEESE SALT, ENZYMES), WHEY PROTEIN CONCENTRATE, DER, POTASSIUM SALT, CORN FLOUR, NATURAL & LAVORS, DEXTROSE, TOMATO POWDER, LACTOSE, TIFCIAL COLOR (YELLOW 6, YELLOW 5, RED 40), CTICACID, SUGAR, GARLIC POWDER, SKIM MILK, REEN BLL EPPERS, DISODIUM INOSINATE, AND ANYLATE. ILKINGREDIENTS. AY,INC";

test("a second photo of a label cut off at the bottom joins where the two overlap", () => {
  assert.deepEqual(joinReads("Sugar, corn syrup, modified corn starch, citric acid", "modified corn starch, citric acid, natural flavors, Red 40"),
    { text: "Sugar, corn syrup, modified corn starch, citric acid, natural flavors, Red 40", joined: true });
});

test("misread words still meet; a half-cut last line, what came before the overlap, and the box's own fixes are handled", () => {
  assert.deepEqual(joinReads("SUGAR, CORN SYRUP, MODIFIED CORN STARCH, CITRIC ACID, NATURAL AND ARTIFLCLAL FLAV0RS, R",
    "Nutrition Facts 2% MODIFIED CORN STARCH, CITRIC ACID, NATURAL AND ARTIFICIAL FLAVORS, RED 40, YELLOW 5, CARNAUBA WAX."),
  { text: "SUGAR, CORN SYRUP, MODIFIED CORN STARCH, CITRIC ACID, NATURAL AND ARTIFLCLAL FLAV0RS, RED 40, YELLOW 5, CARNAUBA WAX.", joined: true });
  assert.equal(joinReads("CORN, SALT, WHEY, MONOSODIU", "SALT, WHEY, MONOSODIUM GLUTAMATE").text, "CORN, SALT, WHEY, MONOSODIUM GLUTAMATE", "a cut-off word is completed");
});

test("photos each cut off on one side (Minh's chip photos 7 and 8) don't line up: the new text goes at the end", () => {
  assert.deepEqual(joinReads(CHIPS7, CHIPS8), { text: `${CHIPS7}, ${CHIPS8}`, joined: false });
});

test("the box's own words win where both photos have one (a fix the person made stays)", () => {
  assert.equal(joinReads("water, glycerin, Limonene, linalool", "glycerin, LMONENE, linalool, citral").text, "water, glycerin, Limonene, linalool, citral");
});

test("no overlap of 3 words in a row: the new text goes at the end; one shared word isn't an overlap", () => {
  assert.deepEqual(joinReads("sugar, salt", "salt, pepper, paprika"), { text: "sugar, salt, salt, pepper, paprika", joined: false });
  assert.deepEqual(joinReads("", "water, salt"), { text: "water, salt", joined: false });
  // A comma between them: else the box's last item and the new first one become one item, and whole-name matching misses both.
  assert.equal(joinReads("Water, Glycerin", "formaldehyde, fragrance").text, "Water, Glycerin, formaldehyde, fragrance");
  assert.equal(joinReads("Water, Glycerin,", "formaldehyde").text, "Water, Glycerin, formaldehyde");
});

// 070 C3 (docs/superpowers/specs/2026-10-23-cloud-help-070-design.md): cloud help's read replaces a hard photo's only
// when it reads better (more words of known names); a tie or no answer keeps the phone's.
const hardPhone = afterRead({ text: "LIMONENE Xq LNALOOL vb", unsure: ["Xq", "LNALOOL", "vb"], lines: labelLines(["LIMONENE Xq LNALOOL vb"]) });

test("words of known names are counted whole, in any case; near misses and short words aren't", () => {
  assert.equal(knownCount("Water, LIMONENE, linalool, LMONENE, salt"), 3);
});

test("a cloud read with more known name words fills the box, with its lines and no unsure words", () => {
  assert.equal(hardPhone.hard, true);
  const r = withCloud(hardPhone, ["INGREDIENTS: ALCOHOL DENAT, LIMONENE,", "LINALOOL", "CAUTION: FLAMMABLE"]);
  assert.equal(r.hard, false);
  assert.equal(r.text, "ALCOHOL DENAT, LIMONENE, LINALOOL");
  assert.deepEqual(r.unsure, []);
  assert.deepEqual(r.lines.map(l => l.on), [true, true, false]);
  assert.equal(r.busy, undefined);
});

test("a cloud read no better than the phone's (a tie) keeps the phone's hard-to-read result", () => {
  assert.deepEqual(withCloud(hardPhone, ["Zz LIMONENE"]), hardPhone);
  assert.deepEqual(withCloud(hardPhone, []), hardPhone);
});

test("no answer from cloud help keeps the phone's result and says busy", () => {
  assert.deepEqual(withCloud(hardPhone, null), { ...hardPhone, busy: true });
});

// 075 H1 (audit P1): whether cloud help is wanted is asked when the phone's read ends, so a check closed (or anything
// newer begun) during the read uploads nothing. In Node the upload itself fails, which shows as "busy".
test("a hard photo goes to cloud help only if still wanted when the phone's read ends", async () => {
  const phone = async () => ({ text: hardPhone.read!, unsure: hardPhone.unsure, lines: labelLines([hardPhone.read!]) });
  let open = true;
  const closedDuringRead = async () => { const r = await phone(); open = false; return r; };
  assert.deepEqual(await readPhoto(new Blob(), () => open, closedDuringRead), hardPhone);
  assert.equal((await readPhoto(new Blob(), () => true, phone)).busy, true, "still open: it goes (and fails here)");
});

test("the cloud help switch is off until turned on, and remembered on this device", () => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  const before = Object.getOwnPropertyDescriptor(g, "localStorage");
  Object.defineProperty(g, "localStorage", { configurable: true, value: {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
  try {
    assert.equal(cloudHelpOn(), false);
    setCloudHelp(true);
    assert.equal(cloudHelpOn(), true);
    setCloudHelp(false);
    assert.equal(cloudHelpOn(), false);
  } finally {
    if (before) Object.defineProperty(g, "localStorage", before); else delete g.localStorage;
  }
});

// 071 Round 2 (docs/superpowers/specs/2026-10-28-label-reader-v3-071-design.md). K–N: the grand audit's GA-03..06,
// inputs rebuilt from its shorthand (research-grand-audit-chatgpt.md, planner 2026-10-28).
const photo = (lines: string[]) => linesText(labelLines(lines));
const food = (text: string) => assessProduct({ name: "", category: "", ingredients: text, source: {} }).verdict;
const careFlags = (text: string) => analyzeCare(text).flags.map(f => f.entry.id);

test("071 K (GA-03): a stop phrase after '(' and a space doesn't end the list", () => {
  const text = photo(["INGREDIENTS: wheat flour, cheese ( contains milk), sodium nitrite"]);
  assert.equal(text, "wheat flour, cheese ( contains milk), sodium nitrite");
  assert.equal(food(text), "high");
  assert.equal(kept("Ingredients: pasta, cheese (\ncontains milk), salt. Contains: wheat"), "pasta, cheese (\ncontains milk), salt.");
});

test("071 L (GA-04): a hyphen after a digit at a line's end is kept; one inside a word still joins", () => {
  const text = photo(["INGREDIENTS: WATER, HYDROXYISOHEXYL 3-", "CYCLOHEXENE CARBOXALDEHYDE, GLYCERIN"]);
  assert.equal(text, "WATER, HYDROXYISOHEXYL 3-CYCLOHEXENE CARBOXALDEHYDE, GLYCERIN");
  assert.deepEqual(careFlags(text), ["hydroxyisohexyl-3-cyclohexene-carboxaldehyde"]);
  assert.equal(cleanIngredients("methyl-\nparaben, 1,2-\nhexanediol"), "methylparaben, 1,2-hexanediol");
});

test("071 D: '…Imported Ingredients' never starts the list (Pantene)", () => {
  const label = "Made in Mexico with US and Imported Ingredients\nDistributed by Procter & Gamble\nINGREDIENTS: WATER, SODIUM LAURETH SULFATE, FRAGRANCE";
  assert.equal(kept(label), "WATER, SODIUM LAURETH SULFATE, FRAGRANCE");
});

test("071 G: 'INGREDIENTS,' with a comma starts the list (Burberry)", () => {
  assert.equal(photo(["BURBERRY", "INGREDIENTS, ALCOHOL, PARFUM (FRAGRANCE), COUMARIN"]), "ALCOHOL, PARFUM (FRAGRANCE), COUMARIN");
});

const DRUG_FACTS = ["Drug Facts", "Active ingredient", "Zinc pyrithione 1%", "Purpose", "Antidandruff", "Uses",
  "helps prevent recurrence of flaking and itching", "Warnings", "For external use only", "Inactive ingredients: Water, formaldehyde"];

test("071 G, M (GA-05): Drug Facts keeps the active line up to 'Purpose', and the inactive list", () => {
  const lines = labelLines(DRUG_FACTS);
  assert.deepEqual(lines.map(l => l.on), [false, false, true, false, false, false, false, false, false, true]);
  assert.equal(linesText(lines), "Zinc pyrithione 1%, Water, formaldehyde");
  assert.ok(careFlags(linesText(lines)).includes("formaldehyde"));
  assert.equal(kept("Active ingredients Titanium dioxide 6%\nUses helps prevent sunburn"), "Titanium dioxide 6%");
  assert.equal(kept("Active ingredient Avobenzone 3%\nWarnings For external use only"), "Avobenzone 3%");
  assert.equal(kept("Ingredients: all-purpose flour, sugar, all purpose seasoning"), "all-purpose flour, sugar, all purpose seasoning",
    "'Purpose' and 'Uses' end only a Drug Facts active line");
});

test("071 A: brand, product name and net quantity lines are never kept", () => {
  const front = labelLines(["ACME", "Organic Tomato Soup", "NET WT 15 OZ (425g)", "Tomatoes, water, sea salt, citric acid"]);
  assert.deepEqual(front.map(l => l.on), [false, false, false, true]);
  assert.equal(linesText(front), "Tomatoes, water, sea salt, citric acid");
  assert.equal(photo(["Ingredients: water, glycerin, fragrance", "8 FL OZ (236 mL)"]), "water, glycerin, fragrance");
  assert.equal(photo(["INGREDIENTS: WATER, GLYCERIN", "1.7 oz / 50 g"]), "WATER, GLYCERIN");
  assert.equal(photo(["Tomatoes, water, salt", "NET WT 15 OZ (425g)"]), "Tomatoes, water, salt", "a list before the net weight stays");
  assert.equal(kept("Ingredients: water, contains 2% or less of salt, vitamin D3 (400 IU)"), "water, contains 2% or less of salt, vitamin D3 (400 IU)");
});

test("071 N (GA-06): joining two reads never drops a word only one of them has", () => {
  const j = joinReads("Water, sodium chloride, talc, glycerin", "Water, sodium chloride, glycerin, fragrance");
  assert.deepEqual(j, { text: "Water, sodium chloride, talc, glycerin, fragrance", joined: true });
  assert.equal(analyzeCare(j.text).verdict, "high");
});

test("071 C: two photos of a label's top and bottom join once at their shared lines, the cut-off line read from the second", () => {
  const top = photo(["INGREDIENTS: WATER, SODIUM LAURETH SULFATE,", "COCAMIDOPROPYL BETAINE, GLYCERIN, SODIUM",
    "CHLORIDE, CITRIC ACID, FRAGRANCE, TALC,", "S0DlUN 8FNZ0ATF, DMDN HYDANT0IN, METHYLPARABFN"]); // the last line cut by the edge
  const bottom = photo(["C0CAMIDOPR0PYL BFTAINE, GLYCFRIN, S0DIUN", "CHLORIDE, CITRIC ACID, FRAGRANCE, TALC,",
    "SODIUM BENZOATE, DMDM HYDANTOIN, METHYLPARABEN,", "METHYLISOTHIAZOLINONE, RED 40."]);
  assert.deepEqual(joinReads(top, bottom), { joined: true, text: "WATER, SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE, GLYCERIN, "
    + "SODIUM CHLORIDE, CITRIC ACID, FRAGRANCE, TALC, SODIUM BENZOATE, DMDM HYDANTOIN, METHYLPARABEN, METHYLISOTHIAZOLINONE, RED 40." });
});

test("071 E: one of EcoGo's names glued on condensed print gets its spaces back; 'INGREDIENTS' glued on is split off (Burberry)", async () => {
  assert.equal(unglue("BENZYLSALICYLATE, Hydroxycitronellal, sodiumnitrite"), "BENZYL SALICYLATE, Hydroxycitronellal, sodium nitrite");
  assert.equal(unglue("INGREDIENTSALCOHOL DENAT., PARFUM"), "INGREDIENTS ALCOHOL DENAT., PARFUM");
  assert.equal(unglue("INGREDIENTES: AGUA"), "INGREDIENTES: AGUA");
  const r = withCloud(hardPhone, ["BURBERRY", "INGREDIENTSALCOHOL, PARFUM (FRAGRANCE), BENZYLSALICYLATE, COUMARIN"]);
  assert.equal(r.text, "ALCOHOL, PARFUM (FRAGRANCE), BENZYL SALICYLATE, COUMARIN");
  assert.ok(analyzeCare(r.text).notes.some(n => n.note.name === "Benzyl Salicylate"));
  await loadMoreNames();
  for (const w of ["SUNFLOWER", "BUTTERMILK", "CORNSTARCH", "PEPPERMINT", "WATERMELON", "Hydroxyethylcellulose", "Methylisothiazolinone"])
    assert.equal(unglue(w), w, `${w}: a real word isn't split`);
});

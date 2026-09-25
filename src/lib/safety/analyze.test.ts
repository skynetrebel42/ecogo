import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeIngredients, VERDICT_RANK } from "./analyze.ts";
import type { LibraryEntry } from "./library.ts";

const src = { body: "IARC", finding: "test", url: "https://example.org", quote: "test", checkedOn: "2026-09-24" } as const;

/** Test-only library: the engine is tested independently of the real library's content. */
const LIB: LibraryEntry[] = [
  { id: "sodium-nitrite", name: "Sodium nitrite", aliases: ["sodium nitrite"], eCodes: ["E250"], severity: "high", concern: "t", sources: [{ ...src, basis: "iarc-2a" }] },
  { id: "aspartame", name: "Aspartame", aliases: ["aspartame"], eCodes: ["E951"], severity: "some", concern: "t", sources: [{ ...src, basis: "iarc-2b" }] },
  { id: "brilliant-blue", name: "Blue 1", aliases: ["blue 1"], eCodes: ["E133"], severity: "some", concern: "t", sources: [{ ...src, basis: "eu-warning-label" }] },
  { id: "caramel-iv", name: "Sulphite ammonia caramel", aliases: ["sulphite ammonia caramel"], eCodes: ["E150D"], severity: "some", concern: "t", sources: [{ ...src, basis: "iarc-2b" }] },
];
const food = (ingredients: string, extra: Partial<{ category: string; additiveCodes: string[] }> = {}) =>
  analyzeIngredients({ ingredients, category: "Snacks", ...extra }, LIB);
const ids = (a: ReturnType<typeof food>) => a.flags.map(f => f.entry.id);

test("names match only as whole phrases (the old '1' → 'Blue 1' false alarm is gone)", () => {
  assert.deepEqual(ids(food("Water, 1,4-dioxane (trace)")), []);
  assert.deepEqual(ids(food("Acetaminophen 500mg")), []);
  assert.deepEqual(ids(food("Red 40, Blue 1")), ["brilliant-blue"]);
});

test("a flagged sub-ingredient inside parentheses is found", () => {
  const a = food("Enriched flour, pepperoni (pork, beef, salt, spices, sodium nitrite)");
  assert.deepEqual(ids(a), ["sodium-nitrite"]);
  assert.equal(a.flags[0].matchedText, "sodium nitrite");
});

test("E-codes match with or without a space, hyphen or brackets", () => {
  for (const text of ["E250", "e 250", "E-250", "preservative (E250)"]) {
    assert.deepEqual(ids(food(text)), ["sodium-nitrite"], text);
  }
});

test("generic terms are not flagged; the precise form is", () => {
  assert.deepEqual(ids(food("Carbonated water, caramel color, phosphoric acid")), []);
  assert.deepEqual(ids(food("caramel color (E150d)")), ["caramel-iv"]);
});

test("additive codes from Open Food Facts are matched", () => {
  assert.deepEqual(ids(food("", { additiveCodes: ["en:e951"] })), ["aspartame"]);
});

test("verdicts follow severity, and high-concern flags come first", () => {
  assert.equal(food("salt, sugar").verdict, "none");
  assert.equal(food("aspartame").verdict, "some");
  const both = food("aspartame, sodium nitrite");
  assert.equal(both.verdict, "high");
  assert.deepEqual(ids(both), ["sodium-nitrite", "aspartame"]);
});

test("no ingredient text means not enough data; non-food categories are not analyzed", () => {
  assert.equal(food("   ").verdict, "no-data");
  assert.equal(analyzeIngredients({ ingredients: "sodium nitrite", category: "Cleaning" }, LIB).verdict, "non-food");
  assert.equal(analyzeIngredients({ ingredients: "sodium nitrite" }, LIB).verdict, "high"); // no category = food (Open Food Facts)
});

test("checkedCount reports the library size", () => {
  assert.equal(food("salt").checkedCount, LIB.length);
});

test("VERDICT_RANK orders fewest concerns first", () => {
  assert.ok(VERDICT_RANK.none < VERDICT_RANK.some && VERDICT_RANK.some < VERDICT_RANK.high);
  assert.ok(VERDICT_RANK.high < VERDICT_RANK["no-data"] && VERDICT_RANK["no-data"] < VERDICT_RANK["non-food"]);
});

// Review Focus: the same additive named twice (name + E-code) is one flag, not two.
test("an ingredient named and coded is flagged once", () => {
  assert.deepEqual(ids(food("Sodium nitrite (E250), salt, E 250")), ["sodium-nitrite"]);
});

// Review Focus: ALL-CAPS labels match.
test("ALL-CAPS labels match", () => {
  assert.deepEqual(ids(food("PORK, WATER, SODIUM NITRITE")), ["sodium-nitrite"]);
});

// Review Focus: "vitamin E" followed by a dose is not an E-number.
test("'vitamin E 250' is not read as E250", () => {
  assert.deepEqual(ids(food("vitamin E 250 IU, water")), []);
});

// Review Focus: negated mentions never flag.
test("'no aspartame' / 'nitrite-free' do not flag", () => {
  assert.deepEqual(ids(food("Water, no aspartame, nitrite-free")), []);
});

test("the engine never throws on hostile input", () => {
  const nasty = ["", "((((", "))))", "[{(", ",,,;;;", "\u0000￿", "🍕".repeat(500), "a, ".repeat(5000), "E".repeat(10000)];
  for (const text of nasty) assert.doesNotThrow(() => food(text));
  assert.doesNotThrow(() => analyzeIngredients({ ingredients: undefined as unknown as string }, LIB));
});

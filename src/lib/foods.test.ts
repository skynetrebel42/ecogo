import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foodRowToProduct, tsQueryFor, snapshotLabel } from "./foods.ts";
import { foodRow, rowFromUsdaSearch } from "./foodsFake.ts";
import { analyzeIngredients } from "./safety/analyze.ts";

const record = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/usda/${name}.json`, import.meta.url), "utf8")).foods[0];

test("a foods row maps to a Product with its source, snapshot date and a negative id", () => {
  const rec = record("coke-zero-00049000042566");
  const p = foodRowToProduct(rowFromUsdaSearch(rec));
  assert.equal(p.id, -49000042566);
  assert.equal(p.barcode, "00049000042566");
  assert.equal(p.name, "Coca-Cola Zero Sugar Can, 12 fl oz");
  assert.equal(p.brand, "Coca-Cola Zero");
  assert.equal(p.category, "");
  assert.match(p.ingredients, /^CARBONATED WATER, CARAMEL COLOR/);
  assert.deepEqual(p.source, {
    name: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/food-details/2742717/nutrients",
    crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: "Non Alcoholic Beverages - Ready to Drink",
    snapshot: String(rec.publishedDate),
  });
  assert.ok(analyzeIngredients({ ingredients: p.ingredients }).flags.some(f => f.entry.id === "aspartame"));
});

// Review Focus: untrusted text. USDA writes names in capitals and sometimes prefixes the ingredients.
test("ALL-CAPS names are tidied and an 'INGREDIENTS:' prefix is dropped", () => {
  const d = foodRowToProduct(rowFromUsdaSearch(record("doritos-028400335799")));
  assert.equal(d.name, "Doritos, Tortilla Chips, Nacho Cheese, Nacho Cheese");
  assert.equal(d.brand, "Doritos");
  const o = foodRowToProduct(rowFromUsdaSearch(record("oreo-00044000042554")));
  assert.match(o.ingredients, /^SUGAR, UNBLEACHED ENRICHED FLOUR/);
});

test("a row with a serving and nutrients carries nutrition; one without carries none; an empty name is still shown", () => {
  const oreo = foodRowToProduct(rowFromUsdaSearch(record("oreo-nutrition-044000032029")));
  assert.equal(oreo.nutrition?.serving, "3 cookies (34 g)");
  assert.equal(foodRowToProduct(foodRow({ added_sugar_100g: null, sat_fat_100g: null, sodium_100g: null })).nutrition, undefined);
  assert.equal(foodRowToProduct(foodRow({ name: "" })).name, "Unnamed product");
});

test("search words become a whole-word, plural-either-way Postgres query", () => {
  assert.equal(tsQueryFor("ice cream"), "(ice | ices) & (cream | creams)");
  assert.equal(tsQueryFor("Cookies"), "(cookie | cookies)");
  assert.equal(tsQueryFor("chips"), "(chip | chips)");
  assert.equal(tsQueryFor("glass"), "(glass | glasss)", "'-ss' words are not stemmed");
  assert.equal(tsQueryFor("  "), "");
  assert.equal(tsQueryFor("!!! ???"), "");
});

// Review Focus: the text reaches to_tsquery, which has its own syntax (& | ! ( ) : *) and would throw on a stray one.
test("only letters and digits ever reach the database query; long searches are cut at 8 words", () => {
  const q = tsQueryFor(`a'; drop table foods; -- ) ( & | ! : * <-> é`);
  assert.match(q, /^[a-z0-9 |&()]+$/);
  assert.equal(tsQueryFor("one two three four five six seven eight nine ten").split(" & ").length, 8);
});

test("a snapshot date reads as month and year; anything else is left alone", () => {
  assert.equal(snapshotLabel("2025-12-18"), "Dec 2025");
  assert.equal(snapshotLabel("2024-04-01"), "Apr 2024");
  assert.equal(snapshotLabel("not a date"), "not a date");
});

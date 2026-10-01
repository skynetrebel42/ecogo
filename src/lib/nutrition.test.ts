import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usdaNutrition, offNutrition, nutrient, topHigh, DAILY_VALUE } from "./nutrition.ts";

const usda = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/usda/${name}.json`, import.meta.url), "utf8")).foods[0];
const off = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/off/${name}.json`, import.meta.url), "utf8")).body.product;
const row = (n: ReturnType<typeof usdaNutrition>, id: string) => n!.nutrients.find(x => x.id === id)!;

test("Oreo (USDA): 3 cookies hold 14 g added sugar, 28% DV, High; matches the printed label", () => {
  const n = usdaNutrition(usda("oreo-nutrition-044000032029"))!;
  assert.equal(n.serving, "3 cookies (34 g)");
  assert.equal(n.perServing, true);
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [14, 28, "high"]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv, row(n, "satFat").level], [2, 10, null]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv, row(n, "sodium").level], [130, 6, null]);
  assert.equal(topHigh(n)?.short, "High sugar");
});

test("Lay's (USDA): added sugar is not listed (never 'Low'); nothing High", () => {
  const n = usdaNutrition(usda("lays-nutrition-028400199148"))!;
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [null, null, null]);
  assert.deepEqual([row(n, "satFat").amount, row(n, "satFat").dv], [1.5, 8]);
  assert.deepEqual([row(n, "sodium").amount, row(n, "sodium").dv], [170, 7]);
  assert.equal(topHigh(n), null);
});

test("Coke Zero (USDA, ml serving): all Low", () => {
  const n = usdaNutrition(usda("coke-zero-nutrition-00049000042566"))!;
  assert.equal(n.serving, "1 Can (355 ml)");
  assert.deepEqual(n.nutrients.map(x => x.level), ["low", "low", "low"]);
  assert.equal(row(n, "sodium").amount, 39);
});

test("FDA 5/20 boundaries, classified on the rounded %DV as a label shows it", () => {
  assert.equal(nutrient("satFat", 1, true).level, "low");    // 5%
  assert.equal(nutrient("satFat", 1.1, true).level, null);   // 6% (rounded 1.1 g = 5.5% → 6)
  assert.equal(nutrient("satFat", 3.9, true).level, "high"); // 19.5% → 20
  assert.equal(nutrient("addedSugar", 10, true).level, "high"); // exactly 20%
  assert.equal(nutrient("sodium", 2300, true).dv, 100);
  assert.deepEqual(DAILY_VALUE, { addedSugar: 50, satFat: 20, sodium: 2300 });
});

test("no serving size: per 100 g values, no %DV and no High/Low", () => {
  const n = usdaNutrition({ foodNutrients: [{ nutrientName: "Sugars, added", unitName: "G", value: 41.2 }] })!;
  assert.equal(n.perServing, false);
  assert.equal(n.serving, "100 g");
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "addedSugar").dv, row(n, "addedSugar").level], [41.2, null, null]);
  assert.equal(usdaNutrition({ foodNutrients: [] }), null);
  assert.equal(usdaNutrition(null), null);
});

test("Open Food Facts: per 100 g when no serving data (Nutella); sodium converted from grams; per serving when given", () => {
  const n = offNutrition(off("nutella-nutrition-3017620422003"))!;
  assert.equal(n.source, "Open Food Facts");
  assert.equal(n.perServing, false);
  assert.deepEqual([row(n, "addedSugar").amount, row(n, "satFat").amount, row(n, "sodium").amount], [52.1, 10.6, 43]);
  assert.equal(topHigh(n), null, "no High/Low without a serving");
  const s = offNutrition({ serving_size: "2 tbsp (37 g)", nutriments: { "added-sugars_serving": 19, "saturated-fat_serving": 4, "sodium_serving": 0.015 } })!;
  assert.equal(s.serving, "2 tbsp (37 g)");
  assert.deepEqual(s.nutrients.map(x => [x.dv, x.level]), [[38, "high"], [20, "high"], [1, "low"]]);
  assert.equal(topHigh(s)?.id, "addedSugar");
  assert.equal(offNutrition({ nutriments: {} }), null);
});

test("a household serving that already names its weight isn't repeated", () => {
  const n = usdaNutrition({ householdServingFullText: "1/6 pizza (130g)", servingSize: 130, servingSizeUnit: "GRM",
    foodNutrients: [{ nutrientName: "Sodium, Na", unitName: "MG", value: 577 }] })!;
  assert.equal(n.serving, "1/6 pizza (130g)");
  assert.equal(row(n, "sodium").amount, 750);
});

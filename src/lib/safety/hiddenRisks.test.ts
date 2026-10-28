// 064 hidden risks (docs/superpowers/specs/2026-10-20-hidden-risks-design.md §2): H2's benzene info row needs a benzoate
// AND ascorbic or erythorbic acid in a drink, and never touches the badge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { benzeneNote, foodConcerns, PROCESSED_MEAT, CELERY_CURING, type FoodInput } from "./foodConcerns.ts";
import { assessProduct } from "./assess.ts";

const drink = (ingredients: string, over: Partial<FoodInput> = {}): FoodInput => ({ name: "Orange Soda", category: "Beverages", ingredients, ...over });
const usda = (foodCategory: string) => ({ category: "", source: { foodCategory } });
const off = (...categoryTags: string[]) => ({ category: "", source: { categoryTags } });

test("H2: a benzoate and ascorbic or erythorbic acid in a drink → the row, naming both as listed", () => {
  assert.deepEqual(benzeneNote(drink("CARBONATED WATER, SUGAR, SODIUM BENZOATE, ASCORBIC ACID")), ["SODIUM BENZOATE", "ASCORBIC ACID"]);
  assert.deepEqual(benzeneNote(drink("Water, potassium benzoate (preservative), erythorbic acid", usda("Soda"))), ["potassium benzoate", "erythorbic acid"]);
  assert.ok(benzeneNote(drink("water, sodium benzoate, L-ascorbic acid", off("en:beverages", "en:sodas"))));
  assert.ok(benzeneNote(drink("WATER, SODIUM BENZOATE, ASCORBIC ACID", usda("Fruit & Vegetable Juice, Nectars & Fruit Drinks"))));
});

test("H2: one of the two alone → no row", () => {
  assert.equal(benzeneNote(drink("CARBONATED WATER, SUGAR, SODIUM BENZOATE")), null);
  assert.equal(benzeneNote(drink("ORANGE JUICE, ASCORBIC ACID (VITAMIN C)")), null);
  assert.equal(benzeneNote(drink("")), null);
});

test("H2: only FDA's words match: benzoate salts, ascorbic or erythorbic acid (no benzoic acid, ascorbate, 'vitamin C' or E-numbers)", () => {
  assert.equal(benzeneNote(drink("WATER, BENZOIC ACID, ASCORBIC ACID")), null);
  assert.equal(benzeneNote(drink("WATER, SODIUM BENZOATE, SODIUM ASCORBATE")), null);
  assert.equal(benzeneNote(drink("WATER, SODIUM BENZOATE, VITAMIN C")), null);
  assert.equal(benzeneNote(drink("WATER, E211, E300")), null);
  assert.equal(benzeneNote(drink("WATER, SODIUM BENZOATES, DEHYDROASCORBIC ACID")), null);
});

test("H2: drinks only (FDA's page is about beverages): not cakes, dips or a catalog snack", () => {
  const both = "FLOUR, SUGAR, SODIUM BENZOATE, ASCORBIC ACID";
  assert.equal(benzeneNote(drink(both, usda("Cakes, Cupcakes, Snack Cakes"))), null);
  assert.equal(benzeneNote(drink(both, usda("Dips & Salsa"))), null);
  assert.equal(benzeneNote(drink(both, off("en:snacks"))), null);
  assert.equal(benzeneNote(drink(both, { category: "Snacks" })), null);
  assert.equal(benzeneNote(drink(both, { category: "", source: {} })), null);
});

// H3 (Minh 2026-10-21, option A): context inside an existing processed-meat finding whose label lists a celery cure
// item. Never a second row, never on a product the rules leave unflagged; level, reason and count stay the rules' own.
const meat = (name: string, ingredients: string, foodCategory: string): FoodInput => ({ name, category: "", ingredients, source: { foodCategory } });
const BSR = "Bacon, Sausages & Ribs";
const celeryCases: [FoodInput, "known" | "high", string][] = [
  [meat("Simplicity", "PORK, WATER, SEA SALT, VINEGAR, LEMON JUICE CONCENTRATE, CANE SUGAR, CELERY JUICE SOLIDS.", BSR), "known",
    'Processed meat (celery juice on the label; USDA category "Bacon, Sausages & Ribs")'],
  [meat("Uncured Beef Franks", "BEEF, WATER, SALT, CULTURED CELERY POWDER, CHERRY POWDER", "Sausages, Hotdogs & Brats"), "known", "Processed meat: Franks"],
  [meat("Uncured Pepperoni Pizza", "CRUST (WHEAT FLOUR, WATER), CHEESE, UNCURED PEPPERONI (PORK, SALT, CELERY POWDER)", "Pizza"), "high", "Contains processed meat: Pepperoni"],
  [meat("Smoked Ham", "HAM CURED WITH: WATER, SALT, CELERY CONCENTRATE", "Meat/Poultry/Other Animals - Prepared/Processed"), "known", "Processed meat: Ham"],
];

test("H3: a processed-meat finding with celery powder, juice or concentrate on the label gets the context, nothing else changes", () => {
  for (const [p, severity, reason] of celeryCases) {
    const concerns = foodConcerns(p);
    const pm = concerns.filter(c => c.id === "processed-meat");
    assert.equal(pm.length, 1, `${p.name}: one processed-meat finding`);
    assert.equal(concerns.filter(c => c.kind === "food").length, 1, `${p.name}: no second food row`);
    assert.equal(pm[0].severity, severity, p.name);
    assert.equal(pm[0].reason, reason, p.name);
    assert.ok(pm[0].context.endsWith(` ${CELERY_CURING.text}`), `${p.name}: context`);
    assert.deepEqual(pm[0].sources, [...PROCESSED_MEAT.sources, ...CELERY_CURING.sources], `${p.name}: sources`);
    assert.equal(pm[0].learn, "hidden-risks", p.name);
  }
});

test("H3: no celery cure item → the finding is exactly as before; celery salt is a spice", () => {
  const [plain] = foodConcerns(meat("Uncured Beef Franks", "BEEF, WATER, SALT, SODIUM NITRITE", "Sausages, Hotdogs & Brats"));
  assert.deepEqual(plain, { ...PROCESSED_MEAT, reason: "Processed meat: Franks" });
  const [salt] = foodConcerns(meat("Beef Franks", "BEEF, WATER, SALT, CELERY SALT, SODIUM NITRITE", "Sausages, Hotdogs & Brats"));
  assert.deepEqual(salt, { ...PROCESSED_MEAT, reason: "Processed meat: Franks" });
});

test("H3: celery on a meat the rules leave unflagged shows nothing (028: injected fresh poultry; no meat category)", () => {
  assert.deepEqual(foodConcerns(meat("Oven Roasted Chicken Breast", "CHICKEN BREAST, WATER, SALT, CELERY POWDER", "Meat/Poultry/Other Animals - Prepared/Processed")), []);
  assert.deepEqual(foodConcerns({ name: "Chicken Breast", category: "Meat", ingredients: "CHICKEN, WATER, CULTURED CELERY POWDER" }), []);
  assert.deepEqual(foodConcerns(meat("Vegetable Soup", "WATER, CARROTS, CELERY POWDER", "Other Soups")), []);
});

test("H2: the row never reaches the badge: same level, flags and concerns as without the acid", () => {
  for (const extra of [usda("Soda"), {}]) {
    const withRow = assessProduct(drink("CARBONATED WATER, SODIUM BENZOATE, ASCORBIC ACID, RED 40", extra));
    const without = assessProduct(drink("CARBONATED WATER, SODIUM BENZOATE, RED 40", extra));
    assert.deepEqual(withRow, without);
  }
});

// 071 J: Minh's 2F soda as iPhone Live Text pasted it (notes: research-2f-paste-verbatim.md, A), "SODIUM" and
// "BENZOATE" on two lines. A line break or a wide gap inside a name is a space, for every label-text rule here.
test("071 J: a name split by a line break still counts (Minh's pasted 2F soda; the celery cure too)", () => {
  const pasted = "CARBONATED WATER,\nCANE SUGAR, CITRIC ACID, NATURAL AND ARTIFICIAL\nGUAVA FLAVORS, ASCORBIC ACID (VITAMIN O, MALIC\n"
    + "ACID, ACESULFAME POTASSIEM, SUCRALOSE, COLOR\nED&C YILLOW 0. 5, EDIA (TO PRESERVED FRESHNESS),\nCOLORFD&C RED No.40, CARAMEL COLOR, SODIUM\n"
    + "BENZOATE  AND POTASSIUM SORBATE (AS\nPRESERVATIVE";
  assert.deepEqual(benzeneNote(drink(pasted)), ["SODIUM BENZOATE", "ASCORBIC ACID"]);
  assert.deepEqual(benzeneNote(drink("water, sodium  benzoate, ascorbic\tacid")), ["sodium benzoate", "ascorbic acid"]);
  const franks = foodConcerns(meat("Uncured Beef Franks", "BEEF, WATER, SALT, CULTURED\nCELERY POWDER", "Sausages, Hotdogs & Brats"));
  assert.ok(franks.find(c => c.id === "processed-meat")?.context.endsWith(` ${CELERY_CURING.text}`));
});

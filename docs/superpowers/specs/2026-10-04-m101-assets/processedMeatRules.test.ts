// M10.1: processed-meat rules. One test per cause found by the M10 launch audit (410 real USDA products) and by the
// 2,500-product regression runs behind docs/superpowers/specs/2026-10-04-m101-processed-meat-rules-design.md.
// Labels are real USDA labels, shortened. Plant-based, fish and cheese items in the same USDA categories must keep reading
// "Nothing flagged": a wrong "Known carcinogen" and a wrong "Nothing flagged" are both the worst bugs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foodConcerns } from "./foodConcerns.ts";
import { parseIngredients } from "./parse.ts";

const COLD_CUTS = "Pepperoni, Salami & Cold Cuts";
const SAUSAGES = "Sausages, Hotdogs & Brats";
const BACON = "Bacon, Sausages & Ribs";
const concern = (name: string, ingredients: string, foodCategory = "") =>
  foodConcerns({ name, category: "", ingredients, source: { foodCategory } }).find(c => c.id === "processed-meat") ?? null;
const reason = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.reason ?? null;
const level = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.severity ?? null;

// ── A1: the USDA label lists only the brine, glaze or cure; the meat itself is missing ─────────────────────────────
test("A1: a deli ham whose label is only its solution is processed meat", () => {
  assert.equal(reason("Applewood Smoked Ham", "WATER, SALT, TURBINADO SUGAR, NATURAL FLAVOR, LACTIC ACID STARTER CULTURE (NOT FROM MILK).", COLD_CUTS), "Processed meat: Ham");
  assert.equal(reason("Uncured Honey Maple Ham", "SOLUTION INGREDIENTS: WATER, HONEY, CONTAINS 2% OR LESS OF: SEA SALT, EVAPORATED CANE SYRUP, SEASONING (BROWN SUGAR, MAPLE SUGAR, SALT, NATURAL FLAVOR, MOLASSES, SPICES, MAPLE SYRUP), NATURAL FLAVOR.", COLD_CUTS), "Processed meat: Ham");
  assert.equal(reason("Uncured Ham, Honey Maple", "WATER, HONEY, CONTAINS 2% OR LESS OF: SEA SALT, RAW CANE SUGAR, SEASONING (BROWN SUGAR, MAPLE SUGAR, SALT, NATURAL FLAVOR, MOLASSES, SPICES, MAPLE SYRUP), NATURAL FLAVOR.", COLD_CUTS), "Processed meat: Ham");
  assert.equal(level("Cooked Deli Ham", "SOLUTION INGREDIENTS: WATER, SALT, TURBINADO SUGAR, CULTURED CELERY POWDER, CHERRY POWDER.", COLD_CUTS), "known");
  assert.equal(reason("Ham Steak", "HIGH FRUCTOSE CORN SYRUP, BROWN SUGAR (SUGAR, CANE SYRUPS), WATER, MODIFIED CORN STARCH, SOYBEAN OIL, CELLULOSE GUM, POTASSIUM SORBATE AND SODIUM BENZOATE (PRESERVATIVES), SPICES (CLOVES, GINGER, RED PEPPER), CALCIUM DISODIUM EDTA.", COLD_CUTS), "Processed meat: Ham");
});

test("A1: the same holds for bacon and sausage in their own USDA categories", () => {
  assert.equal(reason("Uncured Canadian Bacon", "WATER, SALT, TURBINADO SUGAR, CULTURED CELERY POWDER, CHERRY POWDER, BAKING SODA.", BACON), "Processed meat: Bacon");
  assert.equal(reason("Applewood Thick Cut Bacon", "CURED WITH: WATER, SALT, SUGAR, SODIUM PHOSPHATE, SODIUM ERYTHORBATE, SODIUM NITRITE.", BACON), "Processed meat: Bacon");
});

// Owner decision 3 (2026-10-03): deli roast beef in a salt or preservative solution is processed meat ("salting … or other
// processes to improve preservation", WHO/IARC Q&A, quoted in the engine).
test("A1: deli roast beef in a salt or preservative solution is processed meat, by its USDA category", () => {
  const cat = 'Processed meat (USDA category "Pepperoni, Salami & Cold Cuts")';
  assert.equal(reason("Deli Shaved Roast Beef", "CONTAINS UP TO 15% OF A SOLUTION OF: WATER, SALT, SODIUM LACTATE, SEASONING (SALT, SUGAR, MALTODEXTRIN, YEAST EXTRACT, GARLIC POWDER, ONION POWDER, NATURAL FLAVORS), SODIUM PHOSPHATE, SODIUM DIACETATE. COATED WITH CARAMEL COLOR.", COLD_CUTS), cat);
  assert.equal(reason("Deli Roast Beef", "WATER, SALT, TURBINADO SUGAR, BAKING SODA, NATURAL FLAVORING.", COLD_CUTS), cat);
  assert.equal(reason("Oven Roasted Beef", "COATED WITH: DEXTROSE, SALT, CARAMEL COLOR, NATURAL FLAVORING. SEASONED WITH: WATER, SALT, HYDROLYZED SOY PROTEIN, SODIUM PHOSPHATE, NATURAL FLAVORING.", COLD_CUTS), cat);
});

// Owner decision 2 (2026-10-03): canned and deli chicken and turkey are processed meat (IARC: "canned meat"; poultry counts).
test("owner decision 2: canned and deli poultry stay processed meat", () => {
  assert.equal(level("Chunked Turkey", "SKINLESS BREAST, THIGH AND SALT", "Canned Meat"), "known");
  assert.equal(level("Premium Chunk White Chicken", "WHITE CHICKEN, WATER, SALT", "Canned Meat"), "known");
  assert.equal(level("Oven Roasted Turkey Breast", "TURKEY BREAST, WATER, SALT, SODIUM DIACETATE", COLD_CUTS), "known");
});

// The constraint: the same USDA categories hold plant-based, fish and cheese products. They have a base the label names.
test("A1 constraint: plant-based, fish, cheese and bread products in meat categories stay 'Nothing flagged'", () => {
  assert.equal(concern("Original Bratwurst Plant-Based Sausages", "WATER, SOY PROTEIN CONCENTRATE, CANOLA OIL, WHEAT GLUTEN, PALM OIL, METHYLCELLULOSE, SALT", SAUSAGES), null);
  assert.equal(concern("Soy Chorizo", "WATER, TEXTURED VEGETABLE PROTEIN (SOY FLOUR, CARAMEL COLOR), SOYBEAN OIL, PAPRIKA, SALT, VINEGAR, SPICES", SAUSAGES), null);
  assert.equal(concern("Classic Smoked Plant-Based Frankfurters", "FILTERED WATER, VITAL WHEAT GLUTEN, EXPELLER PRESSED SAFFLOWER OIL, YEAST EXTRACT, SEA SALT, NATURAL SMOKE FLAVOR", SAUSAGES), null);
  assert.equal(concern("Applewood Smoked Ham", "WATER, VITAL WHEAT GLUTEN, CANOLA OIL, VEGAN HAM FLAVOR (MALTODEXTRIN, SUGAR), SEA SALT, NATURAL SMOKE FLAVOR", COLD_CUTS), null, "a vegan ham without 'vegan' in its name");
  assert.equal(concern("Yves Veggie Cuisine Veggie Pepperoni", "WATER, ISOLATED SOY PROTEIN, VITAL WHEAT GLUTEN, TOFU (SOYBEANS), SPICES", COLD_CUTS), null);
  assert.equal(concern("Wild Caught Salmon Sausage, Jalapeno Cheddar", "SALMON, CHEDDAR CHEESE (MILK, CHEESE CULTURES, SALT, ENZYMES), JALAPENO PEPPER, WATER", SAUSAGES), null);
  assert.equal(concern("Pastrami Spices Smoked Salmon", "FARM RAISED ATLANTIC SALMON, SALT, CANE SUGAR, SPICES, HARDWOOD SMOKE", COLD_CUTS), null);
  assert.equal(concern("Provolone Cheese", "PASTEURIZED MILK, CULTURE, SALT, ENZYMES.", COLD_CUTS), null);
  assert.equal(concern("Jalapeno Crab & Cheese Spread", "CREAM CHEESE (PASTEURIZED CULTURED MILK AND CREAM, SALT), IMITATION CRABMEAT (FISH PROTEIN [POLLOCK], WATER)", COLD_CUTS), null);
  assert.equal(concern("Hot Dog Buns", "UNBLEACHED ENRICHED WHEAT FLOUR, WATER, CORN SYRUP, YEAST, SALT", SAUSAGES), null);
  assert.equal(concern("Ham Twin", "ENRICHED WHEAT FLOUR, WATER, SUGAR, YEAST, SESAME SEEDS, SALT", COLD_CUTS), null);
  assert.equal(concern("Silken Firm Tofu", "SOYMILK (FILTERED WATER AND SOYBEANS), CALCIUM CHLORIDE", COLD_CUTS), null);
});

test("A1 scope: the brine rule needs a USDA meat category and a meat noun in the name", () => {
  assert.equal(concern("Syrup, Bacon", "CORN SYRUP, HIGH FRUCTOSE CORN SYRUP, WATER, NATURAL AND ARTIFICIAL FLAVOR, SALT", "Syrups & Molasses"), null);
  assert.equal(concern("Smoke Infused Applewood Bacon", "SALT, DEXTROSE, SUGAR, BACON FLAVOR (YEAST EXTRACT, NATURAL FLAVORS)", "Herbs & Spices"), null);
  assert.equal(concern("Savory Seasoning Blend", "WATER, SALT, SUGAR, SPICES", COLD_CUTS), null, "no meat word in the name, nothing on the label");
  assert.equal(concern("Everything Glaze", "WATER, SALT, SUGAR, SPICES", COLD_CUTS), null, "a glaze, not the meat");
  assert.equal(concern("Sweet Bourbon Chipotle Bacon, Sweet Bourbon", "SUGAR, SALT, BACON FLAVOR (SALT, TORULA YEAST, AUTOLYZED YEAST EXTRACT, NATURAL FLAVORS), DRIED CHIPOTLE, SPICES", BACON), null, "a bacon seasoning filed under bacon");
});

// ── B: a flavour word in the name hides a real sausage ──────────────────────────────────────────────────────────────
test("B: 'Bacon Flavored Sausage' is a sausage when the label starts with meat", () => {
  assert.equal(reason("Pineapple Bacon Flavored Sausage, Pineapple Bacon", "PORK, BROWN SUGAR, LESS THAN 2% OF THE FOLLOWING: WATER, SALT, BACON TYPE FLAVOR (POTATO MALTODEXTRIN, SUNFLOWER OIL), RENDERED BACON FAT.", SAUSAGES), "Processed meat: Sausage");
  assert.equal(reason("Sergeant Pepperoni And Cheese Pepperoni Flavored Italian Sausage With Cheese", "PORK, SEASONING [EVAPORATED CANE JUICE, SALT, NATURAL PEPPERONI FLAVOR], PASTEURIZED CHEESE", COLD_CUTS)?.startsWith("Processed meat"), true);
});

test("B: flavoured and '-free' names without real meat stay 'Nothing flagged'", () => {
  assert.equal(concern("Bacon Flavored Almonds, Bacon", "DRY ROASTED ALMONDS, SMOKEY BACON SEASONING [SUGAR, SALT, WHEY]", "Popcorn, Peanuts, Seeds & Related Snacks"), null);
  assert.equal(concern("Ham Flavored 16 Beans Soup Mix, Ham", "CONTAINS 16 OF THE FOLLOWING VARIETIES: PINTO BEANS, BLACKEYE PEAS, NAVY BEANS. HAM, SALT"), null);
  assert.equal(concern("Country Sausage Flavor Gravy Mix, Country Sausage", "ENRICHED BLEACHED FLOUR, FOOD STARCH-MODIFIED, SALT, BACON"), null);
  assert.equal(concern("Maple Bacon Flavored Sweet Potato Root Vegetable Chips", "SWEET POTATO, CANOLA OIL, MAPLE BACON SEASONING (SUGAR, SALT)", "Chips, Pretzels & Snacks"), null);
});

// ── C: "Vegetarian-Fed" describes the animal's diet ────────────────────────────────────────────────────────────────
test("C: 'Vegetarian-Fed' pork is still meat; a 'Vegetarian' product is not", () => {
  assert.equal(reason("Pork Raised With Vegetarian-Fed Diet*", "PORK, SEA SALT, CONTAINS LESS THAN 2% OF THE FOLLOWING: NATURAL FLAVORING, TURBINADO SUGAR, CELERY POWDER.", COLD_CUTS), 'Processed meat (USDA category "Pepperoni, Salami & Cold Cuts")');
  assert.equal(concern("Vegetarian Chorizo & Red Pepper Quiche Bites", "PASTEURIZED WHOLE EGG, RED BELL PEPPER, ONIONS, SOY CHORIZO (SOY PROTEIN)"), null);
  assert.equal(concern("Vegetarian Sausage Patties", "WATER, WHEAT GLUTEN, SOY FLOUR, EGG WHITES", SAUSAGES), null);
});

// ── D: meat words the engine did not know ───────────────────────────────────────────────────────────────────────────
test("D: boar, duck, elk, hog and buffalo are meat; quail eggs are not", () => {
  assert.equal(reason("Wild Boar Sausage, Wild Boar", "BOAR+, SALT, SHALLOTS, SPICES, SHERRY WINE, SAGE", SAUSAGES), "Processed meat: Sausage");
  assert.equal(reason("Uncured Duck Hot Dogs", "DUCK, WATER, SEA SALT, NATURAL SPICES, RAW SUGAR, NATURAL CELERY JUICE POWDER", SAUSAGES), "Processed meat: Hot Dogs");
  assert.equal(reason("Lean Elk Breakfast Sausage, Lean Elk", "ELK, WATER, SEASONING (SALT, SPICES, DEXTROSE), CORN STARCH, CULTURED CELERY POWDER", BACON), "Processed meat: Sausage");
  assert.equal(reason("Whole Hog Fresh Sausage Links", "Whole Boned Hog, Water, Contains less than 2% of: Salt, Spices and Spice Extractives", "Meat/Poultry/Other Animals Sausages - Prepared/Processed"), "Processed meat: Sausage");
  assert.equal(reason("Buffalo Jerky, Original", "BUFFALO, SUGAR, WATER, SOY SAUCE (WATER, WHEAT, SOYBEANS, SALT), APPLE CIDER VINEGAR", "Other Snacks"), "Processed meat: Jerky");
  assert.equal(concern("Quail Eggs", "QUAIL EGGS, WATER, SALT.", "Canned Meat"), null, "eggs are not meat");
});

// ── E: the parser dropped "NO NITRATES OR NITRITES ADDED*** PORK" with the pork ───────────────────────────────────────
test("E: a 'no … added' claim glued to the first ingredient is dropped, the ingredient is kept", () => {
  assert.deepEqual(parseIngredients("NO NITRATES OR NITRITES ADDED*** PORK, SEA SALT, CELERY POWDER."), ["PORK", "SEA SALT", "CELERY POWDER"]);
  assert.deepEqual(parseIngredients("No Nitrates Or Nitrites Added Except For Those Naturally Occurring In Celery Powder, Pork"), ["Pork"], "the longer claim is dropped whole, as before");
  assert.deepEqual(parseIngredients("WATER, SALT, NO PRESERVATIVES ADDED, SUGAR"), ["WATER", "SALT", "SUGAR"]);
  assert.equal(reason("Uncured Hard Salami", "NO NITRATES OR NITRITES ADDED*** PORK, SEA SALT, NATURAL SMOKE FLAVOR, CELERY POWDER.", COLD_CUTS), "Processed meat: Salami");
});

// ── F: a fresh ham cut is not processed meat ───────────────────────────────────────────────────────────────────────────
test("F: a fresh ham cut with no curing on the label is not processed meat", () => {
  assert.equal(concern("Pork Ham Bone In Select Vacuum Pack", "Pork", "Meat/Poultry/Other Animals  Unprepared/Unprocessed"), null);
  assert.equal(concern("Pork Boneless Ham Knuckle", "Pork Ham Knuckle", "Meat/Poultry/Other Animals  Unprepared/Unprocessed"), null);
  assert.equal(concern("Fresh Ham", "Pork"), null, "no USDA category: a single raw meat item");
});

test("F: a cured, smoked or prepared ham still is", () => {
  assert.equal(reason("Dry-Cured Iberico Pork Ham", "IBRICO PORK HAM AND SEA SALT.", COLD_CUTS), "Processed meat: Ham");
  assert.equal(reason("Country Ham", "Pork, salt, sugar, sodium nitrite", "Meat/Poultry/Other Animals  Unprepared/Unprocessed"), "Processed meat: Ham");
  assert.equal(reason("Pork Boneless Ham", "Basted NTE 16% Added Solution* of Water, Potassium Chloride, Vinegar, Natural Flavor. Contains Pork", "Meat/Poultry/Other Animals  Unprepared/Unprocessed"), "Processed meat: Ham", "a basted ham reads processed (owner decision 3's principle)");
  assert.equal(level("Honey Ham", "Pork, water, honey, salt"), "known");
});

// ── G: bacon FAT and imitation bacon BITS are not bacon ────────────────────────────────────────────────────────────────
test("G: rendered bacon fat and imitation bacon bits are not processed meat", () => {
  assert.equal(concern("Portabella Cabernet Sauce", "TOMATOES, WATER, RENDERED BACON FAT, ONION, GARLIC", "Prepared Pasta & Pizza Sauces"), null);
  assert.equal(concern("Black Bean Dip", "PREPARED BLACK BEANS, WATER, TOMATOES, BACON FAT, ONION", "Dips & Salsa"), null);
  assert.equal(concern("Bacon Horseradish Dip & Spread", "SOUR CREAM, HORSERADISH, BACON BITS (SOY FLOUR, CANOLA OIL, NATURAL FLAVOR, SALT)", "Dips & Salsa"), null);
});

test("G: real bacon next to bacon fat, and real bacon bits, still count", () => {
  assert.equal(reason("Loaded Potato Casserole", "POTATOES, ONION, BACON FAT AND COOKED BACON (CURED WITH WATER, SALT, SODIUM ERYTHORBATE, SODIUM NITRITE), CHIVES", "Vegetable Based Products / Meals"), "Contains processed meat: BACON");
  assert.equal(reason("Cheddar Potato Bake", "POTATOES, CHEDDAR CHEESE, BACON BITS (PORK, WATER, SALT, SODIUM NITRITE)", "Vegetable Based Products / Meals"), "Contains processed meat: BACON");
});

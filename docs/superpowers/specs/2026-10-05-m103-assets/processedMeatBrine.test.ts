// M10.3: processed-meat rules, round three. Two old false flags and the misses of the M10.2 re-gate (1,106 entries, Sonnet first
// pass), docs/superpowers/specs/2026-10-05-m103-roast-beef-brine-design.md. Labels are real USDA labels, shortened. A wrong "Known
// carcinogen" and a wrong "Nothing flagged" are both the worst bugs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foodConcerns } from "./foodConcerns.ts";

const MPOA_PREPARED = "Meat/Poultry/Other Animals - Prepared/Processed";
const concern = (name: string, ingredients: string, foodCategory = "") =>
  foodConcerns({ name, category: "", ingredients, source: { foodCategory } }).find(c => c.id === "processed-meat") ?? null;
const reason = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.reason ?? null;
const level = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.severity ?? null;

// ── F: two old false flags ──────────────────────────────────────────────────────────────────────────────────────────
test("F1: Franks Red Hot, with or without its apostrophe, is a hot sauce, not franks", () => {
  assert.equal(concern("Buffalo Style Chicken Take & Bake Pizza", "CRUST: ENRICHED WHEAT FLOUR, WATER, OLIVE OIL, YEAST. SAUCE: [TOMATO PASTE, FRANKS RED HOT SAUCE (AGED CAYENNE RED PEPPERS, DISTILLED VINEGAR, WATER, SALT GARLIC POWDER)], CHICKEN BREAST, MOZZARELLA CHEESE", "Other Deli"), null);
  assert.equal(concern("FRANKS RED HOT SAUCE", "AGED CAYENNE RED PEPPERS, DISTILLED VINEGAR, WATER, SALT, GARLIC POWDER", "Ketchup, Mustard, BBQ & Cheese Sauce"), null);
  assert.equal(concern("Frank's RedHot Original", "AGED CAYENNE RED PEPPERS, DISTILLED VINEGAR, WATER, SALT", ""), null);
  assert.equal(concern("Franks Redhot Buffalo Wings Sauce", "VINEGAR, WATER, CAYENNE", ""), null);
  assert.equal(reason("Beef Franks", "BEEF, WATER, SALT, SODIUM NITRITE", "Sausages, Hotdogs & Brats"), "Processed meat: Franks", "real franks still flag");
  assert.equal(reason("Skinless Franks", "PORK, WATER, SALT", ""), "Processed meat: Franks");
});

test("F2: coconut meat, nut meats and crab meat are not meat; a jerky name alone cannot flag them", () => {
  assert.equal(concern("Original Coconut Jerky, Original", "ORGANIC DRIED COCONUT MEAT, ORGANIC APPLE CIDER VINEGAR, ORGANIC COCONUT AMINOS, SMOKED SEA SALT, ORGANIC SMOKED PAPRIKA", "Other Snacks"), null);
  assert.equal(concern("Smoky Walnut Meat Jerky", "WALNUT MEAT, TAMARI, SMOKED PAPRIKA", "Other Snacks"), null);
  assert.equal(concern("Crab Jerky Strips", "CRAB MEAT, SALT, SUGAR", "Other Snacks"), null);
  assert.equal(reason("Beef Jerky Original", "BEEF, SOY SAUCE, SALT, SUGAR", "Other Snacks"), "Processed meat: Jerky", "real jerky still flags");
  assert.equal(reason("Peppered Jerky", "MEAT, SALT, SPICES", "Other Snacks"), "Processed meat: Jerky", "a plain 'meat' item is still meat");
});

// ── R: ribs, meat sticks and roast beef (owner decisions 029 and 032) ─────────────────────────────────────────────────
test("R1: ribs whose label is only the coating or the marinade are still cured or preserved", () => {
  assert.equal(reason("Bryan Fully Cooked St Louis Style Spare Ribs", "Coated with: potassium lactate, water, salt, maltodextrin, caramel color, sodium diacetate, grill flavor (from sunflower oil), paprika, natural flavor, natural hickory smoke flavor.", MPOA_PREPARED),
    `Processed meat (potassium lactate on the label; USDA category "${MPOA_PREPARED}")`);
  assert.equal(reason("Seasoned St. Louis Ribs With Bbq Sauce", "ST. LOUIS STYLE PORK RIBS; TUMBLED WITH (WATER, DARK BROWN SUGAR, SALT, SPICES, CELERY POWDER, SUGAR, DEXTROSE, GRANULATED GARLIC), BBQ SAUCE (WATER, SUGAR, TOMATO PASTE)", "Cooked & Prepared"),
    'Processed meat (celery powder on the label; USDA category "Cooked & Prepared")');
  assert.equal(concern("Fully Cooked St Louis Style Spare Ribs", "Coated with: water, salt, maltodextrin, caramel color, grill flavor, paprika, natural flavor, natural hickory smoke flavor.", MPOA_PREPARED), null, "no cure or preservative: unflagged");
  assert.equal(concern("Rib Sauce", "TOMATO PASTE, SUGAR, VINEGAR, POTASSIUM LACTATE, SALT", MPOA_PREPARED), null, "a sauce is not ribs");
});

test("R2: meat sticks with a cure are processed meat; a cheese stick is not", () => {
  assert.equal(reason("Jack Link's Teriyaki Beef Sticks 1/1 Count", "BEEF, WATER, BROWN SUGAR, FRUCTOSE, CONTAINS 2% OR LESS OF SALT, SEA SALT, FLAVORS, SOY SAUCE (SOYBEANS, SALT, SUGAR), YEAST EXTRACT, CULTURED CELERY EXTRACT, PINEAPPLE JUICE", MPOA_PREPARED),
    `Processed meat (cultured celery on the label; USDA category "${MPOA_PREPARED}")`);
  assert.equal(reason("Jack Link's Beef Original Sticks 1/1 Count", "BEEF, WATER, CONTAINS 2% OR LESS OF ENCAPSULATED LACTIC ACID, SALT, FLAVORS, SEA SALT, CULTURED CELERY EXTRACT, SAFFLOWER OIL", MPOA_PREPARED),
    `Processed meat (cultured celery on the label; USDA category "${MPOA_PREPARED}")`);
  assert.equal(concern("Mozzarella String Cheese Sticks", "MILK, CULTURES, SALT, ENZYMES, CELERY POWDER", MPOA_PREPARED), null);
});

test("R3: roast beef in an added brine or solution is processed meat (decision 032); plain cooked beef is not", () => {
  assert.equal(reason("Organic Diced Roast Beef", "ORGANIC GRASSFED BEEF, WATER, SEA SALT, ORGANIC BLACK PEPPER.", "Other Meats"),
    'Processed meat (roast beef in a brine or solution; USDA category "Other Meats")');
  assert.equal(reason("Angus Seasoned Roast Beef", "BEEF, WATER, CONTAINS LESS THAN 2% OF VINEGAR, SALT, DEXTROSE, SODIUM PHOSPHATE, ONION POWDER", "Other Meats"),
    'Processed meat (roast beef in a brine or solution; USDA category "Other Meats")');
  assert.equal(reason("Medium Cooked Roast Beef", "BEEF, WATER, CONTAINS 2% OR LESS OF POTASSIUM LACTATE, SUGAR, SALT", "Other Meats"),
    'Processed meat (potassium lactate on the label; USDA category "Other Meats")');
  assert.equal(concern("Roast Beef", "BEEF, SALT, BLACK PEPPER.", "Other Meats"), null, "salt and pepper, no brine");
  assert.equal(concern("Roast Beef with Gravy", "Cooked Beef, Water, Corn Flour, Tomato Puree, Wheat Flour, Salt, Sugar, Onion Powder", MPOA_PREPARED), null, "the water is a gravy's");
  assert.equal(concern("Roast Beef Seasoning", "SALT, WATER, ONION, GARLIC", "Other Meats"), null);
});

test("R4: preserved roast beef inside another product reads 'contains', as the label says it", () => {
  const slider = "PRETZEL BUN (ENRICHED FLOUR, WATER, CANOLA OIL, SUGAR), ROAST BEEF (CONTAINS UP TO A 20% SOLUTION OF BEEF BROTH, SEA SALT, VINEGAR, SODIUM PHOSPHATE, NATURAL FLAVORS), CHEDDAR CHEESE (PASTEURIZED MILK, CHEESE CULTURES, SALT).";
  assert.equal(reason("Roast Beef & Cheddar Pretzel Roll Sliders", slider, "Prepared Subs & Sandwiches"), "Contains processed meat: roast beef");
  assert.equal(level("Roast Beef & Cheddar Pretzel Roll Sliders", slider, "Prepared Subs & Sandwiches"), "high");
  assert.equal(reason("Roast Beef & Cheddar Baguette", "ROAST BEEF (BEEF, CONTAINS WATER, CULTURED SUGAR AND VINEGAR, NATURAL FLAVORINGS, SALT, SODIUM PHOSPHATE), BREAD (ENRICHED UNBLEACHED WHEAT FLOUR, WATER, SALT)", "Prepared Subs & Sandwiches"), "Contains processed meat: roast beef");
  assert.equal(reason("Roast Beef & Cheddar Cheese On A Brioche Bun Sliders", "BRIOCHE BUN SLIDER: ENRICHED WHEAT FLOUR, WATER, SUGAR. ROAST BEEF - WATER AND FOOD STARCH - MODIFIED PRODUCT: BEEF, BEEF BROTH, SALT, CONTAINS 2% OR LESS OF: FOOD STARCH - MODIFIED, POTASSIUM ACETATE, SODIUM PHOSPHATES, POTASSIUM LACTATE, NATURAL FLAVOR, SUGAR. PASTEURIZED PROCESS SHARP CHEDDAR CHEESE: MILK, CREAM, WATER, SALT", "Frozen Appetizers & Hors D'oeuvres"), "Contains processed meat: roast beef");
  assert.equal(concern("Roast Beef Sandwich", "WHEAT BREAD (ENRICHED FLOUR, WATER, SALT), ROAST BEEF (BEEF, SALT, PEPPER), LETTUCE", "Prepared Subs & Sandwiches"), null, "plain roast beef inside a sandwich");
});

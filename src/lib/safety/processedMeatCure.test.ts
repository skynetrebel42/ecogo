// M10.2: processed-meat rules, round two. One test per cause found by the M10.1 re-gate (first pass, 220 products) and by the
// live-table checks behind docs/superpowers/specs/2026-10-04-m102-sausage-cure-rules-design.md. Labels are real USDA labels,
// shortened. Plant-based items and plain ground-meat products in the same categories must keep reading "Nothing flagged": a
// wrong "Known carcinogen" and a wrong "Nothing flagged" are both the worst bugs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { foodConcerns } from "./foodConcerns.ts";

const MPOA_SAUSAGES = "Meat/Poultry/Other Animals Sausages - Prepared/Processed";
const MPOA_SAUSAGES2 = "Meat/Poultry/Other Animals Sausages  Prepared/Processed";
const MPOA_PREPARED = "Meat/Poultry/Other Animals - Prepared/Processed";
const BSR = "Bacon, Sausages & Ribs";
const FROZEN_BSR = "Frozen Bacon, Sausages & Ribs";
const concern = (name: string, ingredients: string, foodCategory = "") =>
  foodConcerns({ name, category: "", ingredients, source: { foodCategory } }).find(c => c.id === "processed-meat") ?? null;
const reason = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.reason ?? null;
const level = (name: string, ingredients: string, foodCategory = "") => concern(name, ingredients, foodCategory)?.severity ?? null;

// ── S: sausage names in sausage categories (owner decision 1) ───────────────────────────────────────────────────────
test("S1: USDA's sausage abbreviations and typos mean sausage in a sausage category", () => {
  assert.equal(reason("OC Sthrn Pork Ssg Patties 6/5# 30#", "GROUND PORK (no more than 30% fat), SEASONING (potassium chloride, flavor [contains maltodextrin]), SALT, SPICES, SUGAR, WATER.", MPOA_SAUSAGES), "Processed meat: Sausage");
  assert.equal(reason("Saus,Roll,58%ln,Fs,Fl,2/6#,Z", "Pork, Water, Salt, Dextrose, Flavorings, Citric Acid, BHT, Propyl Gallate", MPOA_SAUSAGES2), "Processed meat: Sausage");
  assert.equal(reason("saus,Smkd,Split,2/6#,Z", "Pork, water, salt, dextrose, sodium erythorbate, flavorings, sodium notrite, smoke flavoring", MPOA_SAUSAGES2), "Processed meat: Sausage");
  assert.equal(reason("Saus,Pty,Fc,Orig,Ef,2oz,Cn,10#,Z", "Pork, water, salt, corn syrup solids, spices, sugar, dextrose, BHT", MPOA_SAUSAGES2), "Processed meat: Sausage");
  assert.equal(reason("All Natural Pork Sauage Patties, Southern Style", "PORK,WATER,SALT,SPICES,DEXTROSE,SUGAR", MPOA_SAUSAGES2), "Processed meat: Sausage");
  assert.equal(reason("Pork Sausge Links, Uncooked", "PORK,WATER,DEXTROSE,SALT,SPICES,IN A COLLAGEN CASING", MPOA_SAUSAGES2), "Processed meat: Sausage");
  assert.equal(reason("Golden Brown All Natural Chicken Links, 10 Links/Pkg", "CHICKEN,WATER,SALT,SPICES,DEXTROSE,SUGAR,DRIED PARSEY", MPOA_SAUSAGES), "Processed meat: Sausage");
  assert.equal(level("Saus,Pty,Fc,Orig,Ef,2oz,Cn,10#,Z", "Pork, water, salt", MPOA_SAUSAGES2), "known");
});

test("S2: links, patties, bangers and chipolatas mean sausage in 'Bacon, Sausages & Ribs'", () => {
  assert.equal(reason("Breakfast Links", "PORK, WATER, SEA SALT, BLACK PEPPER, SAGE, ORGANIC CANE SUGER, CULTURED CELERY POWDER", BSR), "Processed meat: Sausage");
  assert.equal(reason("Maple Pork Links", "PORK, WATER, BROWN SUGAR, SODIUM LACTATE, CONTAINS 2% OR LESS OF SALT, SUGAR, MAPLE SYRUP", BSR), "Processed meat: Sausage");
  assert.equal(reason("Pork Chipolatas (Breakfast Bangers)", "PORK, WATER, CRACKERMEAL (CONTAINS BLEACHED WHEAT FLOUR), SALT, SODIUM TRIPOLYPHOSPHATE, DEXTROSE", BSR), "Processed meat: Sausage");
  assert.equal(reason("Patties, Apple", "CHICKEN, WATER, APPLES, SEA SALT, SPICES (INCLUDING PEPPER AND SAGE), RAW SUGAR, HONEY.", FROZEN_BSR), "Processed meat: Sausage");
});

test("S3: a label that only says 'see package' is still the sausage its name and category say", () => {
  assert.equal(reason("saus,Lk,Fc,Ef,20:1,2/10#,Z", "See package for additional ingrediants", MPOA_SAUSAGES), "Processed meat: Sausage");
});

test("S4: burgers, plant-based links and patties, and products outside sausage categories are not sausage", () => {
  assert.equal(concern("Angus Beef Burger Patties", "BEEF.", FROZEN_BSR), null);
  assert.equal(concern("Maple Plant-Based Breakfast Patties", "WATER, SOY PROTEIN CONCENTRATE, COCONUT OIL, CANOLA OIL, ISOLATED SOY PROTEIN, MAPLE SYRUP", BSR), null);
  assert.equal(concern("Sausage Veggimornin' Meatless Breakfast Links", "FILTERED WATER, TEXTURED VEGETABLE PROTEIN, BROWN RICE, EGG WHITES, NATURAL FLAVORS", "Other Meats"), null);
  assert.equal(concern("Tyson Fully Cooked Breaded Chicken Patties", "Chicken, water, wheat flour, salt, sodium phosphates", MPOA_PREPARED), null, "chicken patties outside a sausage category");
  assert.equal(concern("Jack Link's Beef Original Sticks", "BEEF, WATER, CONTAINS 2% OR LESS OF ENCAPSULATED LACTIC ACID, SALT, FLAVORS", MPOA_PREPARED), null, "Jack Link's is a brand, not links");
});

test("S5: pork or breakfast links in the cooked and frozen meat categories are sausage too; sandwiches stay 'contains'", () => {
  assert.equal(reason("Premium Pork Links, Original", "PORK, WATER, SODIUM LACTATE, 2% OR LESS OF SALT, DEXTROSE, SUGAR, FLAVORINGS, BHT", "Other Meats"), "Processed meat: Sausage");
  assert.equal(reason("Jimmy Dean Sausage, Egg & Cheese On a Biscuit", "Biscuit (enriched flour, water), sausage (pork, salt, spices), egg, cheese", MPOA_SAUSAGES), "Contains processed meat: Sausage");
});

// ── C: cured, preserved or smoked meat (owner decision 2; deli turkey from decision 1) ──────────────────────────────
test("C1: meatballs with a cure or a preservative are processed meat", () => {
  assert.equal(reason("Original Meatballs", "BEEF, PORK, WATER, SOY PROTEIN CONCENTRATE, SEASONING: (CORN SYRUP SOLIDS, SALT, NATURAL FLAVORINGS, CELERY POWDER), SODIUM PHOSPHATE", FROZEN_BSR),
    'Processed meat (celery powder on the label; USDA category "Frozen Bacon, Sausages & Ribs")');
  assert.equal(reason("Mild Italian Style Pork Meatballs", "PORK, WATER, CORN SYRUP, CONTAINS 2% OR LESS OF: SALT, SODIUM LACTATE, RED PEPPER, DEXTROSE, SPICES", FROZEN_BSR),
    'Processed meat (sodium lactate on the label; USDA category "Frozen Bacon, Sausages & Ribs")');
  assert.equal(reason("Italian Style Meatballs", "BEEF, PORK, WATER, TEXTURED SOY PROTEIN (SOY FLOUR, CARAMEL COLOR), SALT, POTASSIUM LACTATE", BSR),
    'Processed meat (potassium lactate on the label; USDA category "Bacon, Sausages & Ribs")');
  assert.equal(level("Original Meatballs", "BEEF, PORK, WATER, CELERY POWDER", FROZEN_BSR), "known");
});

test("C2: plain ground-meat meatballs (meat, salt, spices, phosphate) stay unflagged", () => {
  assert.equal(concern("Italian Style Meatballs", "BEEF AND PORK, WATER, TEXTURED SOY FLOUR, BREAD CRUMBS (WHEAT FLOUR, SALT), SOY PROTEIN CONCENTRATE, SALT, SODIUM PHOSPHATE", FROZEN_BSR), null);
  assert.equal(concern("Turkey Meatballs", "TURKEY, WATER, ONIONS, MECHANICALLY SEPARATED TURKEY, TEXTURED SOY FLOUR, BREAD CRUMBS (WHEAT FLOUR, SALT), SODIUM PHOSPHATE", FROZEN_BSR), null);
  assert.equal(concern("Chicken Meatballs, Italian Style", "SKINLESS CHICKEN, WATER, ROMANO CHEESE (PASTEURIZED MILK, CHEESE CULTURE, SALT AND ENZYMES), SEA SALT, FENNEL", BSR), null);
  assert.equal(concern("Italian Style Mini Meatballs", "BEEF, WATER, EGGS, SEASONING (SOY PROTEIN CONCENTRATE, SODIUM PHOSPHATES), CELERY SALT, FRESH GARLIC", FROZEN_BSR), null, "celery salt is a spice");
});

test("C3: ribs that are smoked (by name) or preserved (lactate, diacetate) are processed meat", () => {
  assert.equal(reason("Barbecue Smoked & Fully Cooked Seasoned And Sauced Pork Baby Back Ribs", "PORK BACK RIBS, WATER, SODIUM PHOSPHATES, SALT. COATED WITH: SAUCE (WATER, SUGAR, TOMATO PASTE)", BSR),
    'Processed meat (smoked; USDA category "Bacon, Sausages & Ribs")');
  assert.equal(reason("St. Louis Style Pork Spare Ribs, Chipotle", "**SOLUTION INGREDIENTS: WATER, POTASSIUM LACTATE, SODIUM PHOSPHATE, SALT, SODIUM DIACETATE. ***SEASONING INGREDIENTS: SPICES, SUGAR", FROZEN_BSR),
    'Processed meat (potassium lactate on the label; USDA category "Frozen Bacon, Sausages & Ribs")');
  assert.equal(reason("Boneless Country-Style Pork Ribs, Barbecue", "PORK, MARINATED WITH (PORK STOCK, POTASSIUM LACTATE, SODIUM PHOSPHATE, SALT, NATURAL FLAVORS)", BSR),
    'Processed meat (potassium lactate on the label; USDA category "Bacon, Sausages & Ribs")');
  assert.equal(reason("Hickory Smoked & Seasoned Baby Back Pork Ribs With Barbecue Sauce", "SEASONED PORK LOIN BACK RIBS (WATER, SALT, SUGAR, SPICES, SODIUM PHOSPHATES). SAUCE: WATER, SUGAR", "Other Frozen Meats"),
    'Processed meat (smoked; USDA category "Other Frozen Meats")');
});

test("C4: plain ribs, 'smoke flavor' and 'rib meat' do not count", () => {
  assert.equal(concern("Baby Back Pork Ribs In Bbq Sauce", "PORK BABY BACK RIBS, WATER, CANE SUGAR, TOMATO PASTE, DISTILLED VINEGAR, NATURAL SMOKE FLAVOR, SODIUM PHOSPHATE", BSR), null);
  assert.equal(concern("Fully Cooked Pork Baby Back Ribs", "COOKED PORK BACK RIBS, BUFFALO SAUCE (CAYENNE PEPPER, WATER, SALT), SMOKE FLAVOR AND SODIUM PHOSPHATE", BSR), null);
  assert.equal(concern("Sliced & Shaped Chicken Breast With Rib Meat", "Chicken Breast With Rib Meat. Contains Up To 22% Of A Solution Of Water, Potassium Lactate, Dextrose", MPOA_PREPARED), null, "injected fresh chicken stays unflagged (D6)");
});

test("C5: deli turkey and pork filed under 'Bacon, Sausages & Ribs' with a cure on the label are processed meat", () => {
  assert.equal(reason("Garret Valley, All Natural Classic Sliced Turkey", "TURKEY THIGHS, WATER, SEA SALT, RAW SUGAR, CELERY POWDER, PAPRIKA, ONION POWDER, SPICE.", BSR),
    'Processed meat (celery powder on the label; USDA category "Bacon, Sausages & Ribs")');
  assert.equal(reason("Simplicity", "PORK, WATER, SEA SALT, VINEGAR, LEMON JUICE CONCENTRATE, CANE SUGAR, CELERY JUICE SOLIDS.", BSR),
    'Processed meat (celery juice on the label; USDA category "Bacon, Sausages & Ribs")');
  assert.equal(reason("Fratelli Beretta Coppa Sweet", "PORK SHOULDER BUTT, SALT, DEXTROSE, SPICES, SODIUM ERYTHORBATE, GARLIC, SODIUM NITRITE, LACTIC ACID STARTER CULTURE", BSR),
    'Processed meat (nitrite on the label; USDA category "Bacon, Sausages & Ribs")');
});

test("C6: roast beef in a preservative solution is processed meat; plain roast beef is not (M10.3 widens this: decision 032)", () => {
  assert.equal(reason("Medium Cooked Roast Beef", "BEEF, WATER, CONTAINS 2% OR LESS OF POTASSIUM LACTATE, SUGAR, SALT, BEEF FLAVORED JUICE", "Other Meats"),
    'Processed meat (potassium lactate on the label; USDA category "Other Meats")');
  assert.equal(concern("Roast Beef", "BEEF, SALT, BLACK PEPPER", "Other Meats"), null);
});

test("C7: a product that lists a processed meat among other things keeps reading 'contains', and a bacon seasoning stays unflagged", () => {
  assert.equal(reason("Loaded Italian Style Meatballs With Provolone Cheese", "MEATBALLS (BEEF, PORK, WATER), pepperoni (pork, beef, salt, sodium nitrite), provolone cheese", BSR), "Contains processed meat: pepperoni");
  assert.equal(level("Loaded Italian Style Meatballs With Provolone Cheese", "MEATBALLS (BEEF, PORK, WATER), pepperoni (pork, beef, salt, sodium nitrite), provolone cheese", BSR), "high");
  assert.equal(concern("Sweet Bourbon Chipotle Bacon", "SUGAR, SALT, BACON FLAVOR (SALT, TORULA YEAST, NATURAL FLAVORS), DRIED CHIPOTLE, SPICES", BSR), null);
});

// ── G, N, P: the generic prepared-meat category, plurals, Australian and New Zealand categories ──────────────────────
test("G: bacon and ham in USDA's generic prepared-meat category, with a label that lists only the cure", () => {
  assert.equal(reason("Jimmy Dean Fully Cooked Bacon Pieces", "CUREDWITH: Water, salt, sugar, sodium phosphates, sodium erythorbate, sodiumnitrite. May contain smoke flavoring.", MPOA_PREPARED), "Processed meat: Bacon");
  assert.equal(reason("Daily's Applewood Smoked All Natural Uncured Ham", "CURED WITH: WATER, SALT, SUGAR, CELERY POWDER, SEA SALT, AND LACTIC ACID STARTER CULTURE.", MPOA_PREPARED), "Processed meat: Ham");
  assert.equal(reason("Hardwood Smoked Honey Cured Center Cut Bacon", "Cured with Water, salt, sodium phosphate, honey, sodium erythorbate, flavoring, sodium nitrite", "Meat/Poultry/Other Animals  Prepared/Processed"), "Processed meat: Bacon");
  assert.equal(level("Jimmy Dean Fully Cooked Bacon Pieces", "CUREDWITH: Water, salt, sodium nitrite", MPOA_PREPARED), "known");
});

test("G2: the generic category does not make plain cooked meat processed", () => {
  assert.equal(concern("Fully Cooked Ground Beef Patties", "Beef, Water, Contains less than 2% of Salt, Potassium Lactate, Sodium Phosphate", MPOA_PREPARED), null);
  assert.equal(concern("Fresh boneless pork hams", "Fresh boneless pork hams", "Meat/Poultry/Other Animals  Prepared/Processed"), null, "a fresh ham cut");
});

test("N: salamis (plural) is salami", () => {
  assert.equal(reason("Verkerks 10 Lunchbox Salamis BBQ 100g", "Pork, BBQ Flavour, Salt, Spices, Raw Sugar", "Salami / Cured Meat"), "Processed meat: Salamis");
  assert.equal(reason("Hot Salamis Sampler", "pork, salt, spices, sodium nitrite", "Other Deli"), "Processed meat: Salamis");
});

test("P: Australian and New Zealand deli categories are processed meat by definition", () => {
  assert.equal(reason("Tegel Classic Roast Shredded Chicken Twin Pack 100g", "Chicken, Salt, Sugar, Acidity Regulators (326, 262), Maltodextrin, Dehydrated Vegetables", "Ham/Cold Meats"), 'Processed meat (USDA category "Ham/Cold Meats")');
  assert.equal(reason("Hellers Roast Beef 1kg", "Beef, Water, Potato Starch, Salt, Dextrose, Thickeners (1412, 407), Mineral Salts (451, 452)", "Ham/Cold Meats"), 'Processed meat (USDA category "Ham/Cold Meats")');
  assert.equal(reason("Hellers Pork Flavoured Chipolatas 4.95kg", "Meat (Chicken, Pork), Water, Potato Starch, Rice Flour, Salt, Soy Protein, Edible Casing (Beef)", "Sausages/Smallgoods"), 'Processed meat (USDA category "Sausages/Smallgoods")');
  assert.equal(concern("Miss Bong Fish Sausage 10 Sticks 340g", "Fish Paste (Golden Threadfin Bream), Soybean Oil, Corn Starch, Wheat Flour", "Sausages/Smallgoods"), null, "fish is not meat");
});

// M10.2 reference implementation: the processed-meat rules of src/lib/safety/foodConcerns.ts, round two, tested.
// Spec: docs/superpowers/specs/2026-10-04-m102-sausage-cure-rules-design.md. Replaces the M10.1 block
// (docs/superpowers/specs/2026-10-04-m101-assets/processed-meat-rules.ts) and contains it unchanged except where marked "M10.2".
// HOW TO APPLY: in foodConcerns.ts, replace the processed-meat block with the code below the dashed line (this header is NOT
// part of it). The block starts at the comment line that begins with the words IARC's examples, just before PM_WORD, and ends
// just before the doc comment on containsProcessedMeat (the one that begins A product that only CONTAINS processed meat reads
// High): the same span the M10.1 block occupies. The constants FOOD_CATEGORIES, PROCESSED_MEAT, parseIngredients,
// containsProcessedMeat, FoodInput and FoodConcern already exist in that file. Checked on a scratch copy of the M10.1 engine:
// all 181 tests (the existing ones and the M10.1 ones) pass with it, plus the 16 in processedMeatCure.test.ts (same folder; copy
// it to src/lib/safety/).
// ---------------------------------------------------------------------------------------------------------------------
// IARC's examples ("hot dogs (frankfurters), ham, sausages, corned beef, and biltong or beef jerky as well as canned
// meat") plus common cured/smoked meats. Whole words only ("graham" is not ham). "franks" never matches before an
// apostrophe, so "Frank's RedHot" isn't meat.
const PM_WORD = /\b(hot ?dogs?|frankfurters?|franks?(?!['’])|wieners?|bacon|hams?|sausages?|salamis?|pepperoni|chorizo|bologna|pastrami|corned beef|jerky|biltong|prosciutto|spam|luncheon meat|lunch ?meats?|deli meats?|cold cuts?|kielbasa|brat(?:wurst)?s?|mortadella|pancetta|(?:cured|smoked)[- ](?:pork|beef|turkey|chicken|meat))\b/i;
// A name that says the product is meat-free: "Vegan Italian Sausage", "Plant-Based Bacon". "Vegetarian-Fed" describes the
// animal's diet, not the product (M10.1 C).
const NEGATOR = /\b(?:imitation|vegan|vegetarian(?![- ](?:fed|diet|raised))|plant[- ]based|meatless|meat[- ]free|veggie)\b|\bno (?:bacon|ham|sausage|pepperoni|salami|meat)\b/i;
// "Ham-Free", "Ham Flavored", "Bacon Flavor": the word right after the meat word says it isn't meat (M10.1 B). A name like
// that reads "not meat" unless the label starts with real meat ("Pineapple Bacon Flavored Sausage": PORK, ...).
const NOT_AFTER = /^[- ]?(?:free\b|flavou?r)/i;
const FLAVOURED_NAME = /\b(?:bacon|ham|sausage|pepperoni|salami|jerky)(?:[- ]flavou?r|[- ]free\b)/i;
// Label items that are not meat: flavourings, meat-free versions, and an item that is only bacon FAT (M10.1 A3). "BACON FAT AND COOKED BACON (CURED …)" still counts: the item names bacon.
const NOT_MEAT_ITEM = /\b(imitation|vegan|vegetarian(?![- ](?:fed|diet|raised))|plant[- ]based|meatless|meat[- ]free|veggie)\b|\b(?:bacon|ham|sausage|pepperoni|salami|jerky)(?:[- ]flavou?r|[- ]free\b)|\bno (?:bacon|ham|sausage|pepperoni|salami|meat)\b|^(?:rendered )?bacon (?:fat|grease|drippings)$|\bbacon[- ]?(?:type|style)\b/i;
// "BACON BITS (SOY FLOUR, …)": imitation bits, cut out of the label text before it is split into items (M10.1 A3).
const IMITATION_BITS = /\bbacon bits?\s*[([][^)\]]*\b(?:soy|textured|vegetable|plant)\b[^)\]]*[)\]]/gi;
// Meat words on a label: poultry, game and hog included (M10.1 D). Eggs of those birds are not meat.
const MEAT_INGREDIENT = /\b(pork|hog|beef|chicken|turkey|veal|lamb|mutton|goat|venison|bison|buffalo|meat|poultry|(?:duck|goose|quail|pheasant|ostrich)(?!\s+eggs?\b)|boar|elk|moose|rabbit)\b/i;
// Named after a meat but made to go with it: "Hot Dog Buns", "Ham Glaze", "Sausage Seasoning". Only hot dog rolls are
// bread: a "sausage roll" is meat.
const ACCESSORY = new RegExp(PM_WORD.source + /\s+(buns?|relish|chili|sauce|seasoning|glaze|mix)\b|\bhot ?dogs? rolls?\b/.source, "i");
// A dish named after its meat ("Pepperoni Pizza") contains processed meat rather than being it.
// "bites" isn't one: "Sausage Bites" and "Jerky Bites" are the meat itself ("Pizza Bites" still match "pizza").
const DISH = /\b(pizzas?|sandwich(es)?|wraps?|salads?|soups?|pasta|burritos?|calzones?|biscuits?|bagels?|pockets?|kits?|bowls?|beans|mac(?:aroni)? (?:&|and) cheese|lasagnas?|pot pies?|casseroles?|skillets?|scrambles?|omelets?|quiches?|dressing|dips?)\b/i;
// Named for a use, but still the meat itself: "Sandwich Style Pepperoni", "Pepperoni Pizza Topping", "Salami Sandwich Slices".
const USE = /\b(?:style|toppings?)\b|\bsandwich (?:slices|sliced|size)\b/i;
// USDA categories that are processed meat by definition (sampled from real records 2026-09-30).
const PM_USDA = new Set(["Sausages, Hotdogs & Brats", "Frozen Sausages, Hotdogs & Brats", "Pepperoni, Salami & Cold Cuts", "Canned Meat",
  "Ham/Cold Meats", "Salami / Cured Meat", "Sausages/Smallgoods"]); // the last three: Australian/New Zealand deli categories (M10.2 P)
// USDA's generic prepared-meat category: not processed by definition (it holds cooked patties and wings), but a ham or bacon whose
// label lists only the brine is the same case as in a cold-cut category (M10.2 G).
const GENERIC_PREPARED = /^Meat\/Poultry\/Other Animals\s*-?\s*Prepared\/Processed$/i;
// Other categories of cooked and frozen meat, where meatballs and ribs are filed (M10.2 C).
const MEAT_PRODUCT_CATEGORY = /^(?:Other Meats|Other Frozen Meats|Frozen Meat)$/i;
const MEATBALL_OR_RIBS = /\b(?:meat ?balls?|ribs|rib tips?|riblets?|spareribs?|roast beef)\b/i;
// "Pork Links", "Breakfast Links" in the cooked and frozen meat categories (not "Jack Link's"): sausage there too (M10.2 S).
const MEAT_LINKS_NAME = /\b(?:pork|beef|chicken|turkey|breakfast)\s+links?\b/i;
// A category with "sausage" in its name (also USDA's "Meat/Poultry/Other Animals Sausages - Prepared/Processed", spelled several
// ways), and the names that mean sausage there (M10.2 S): links, patties, bangers, chipolatas, USDA's abbreviations (Saus, Ssg,
// Lk, Pty) and typos (Sauage, Sausge). A burger is not a sausage. Not every product in these categories is a sausage (USDA
// files sandwiches and biscuits in them), so the category alone proves nothing; the name does.
const SAUSAGE_CATEGORY = /\bsausages?\b/i;
const SAUSAGE_NAME = /\b(?:saus|ssg|lk|pty|sauage|sausge|links?|patt(?:y|ies)|bangers?|chipolatas?)\b/i;
const BURGER_NAME = /\bburgers?\b/i;
// Label items that show a cure or a preservative, and a name that says smoked (M10.2 C). Phosphates are not on the list: a
// meatball of meat, salt, spices and phosphate is unflagged. "Smoke flavor" on the label is a flavouring, not smoking; celery
// salt is a spice.
const CURE_ITEM = /\b(?:nitrites?|nitrates?|(?:sodium|potassium) (?:lactate|diacetate)|cultured celery|celery (?:powder|juice))\b/i;
const SMOKED_NAME = /\bsmoked\b/i;
// USDA categories of meat products (cold cuts, sausages, bacon, ham): where a label that lists no base other than meat is the
// brine-only label of a meat product (M10.1 A1). Not "Vegetarian Frozen Meats", fish, cheese, bread or snacks.
const MEAT_CATEGORY = /\b(?:sausages?|bacon|salami|cold cuts?|cured meat|hot ?dogs?|canned meat|ham)\b/i;
const NOT_MEAT_CATEGORY = /vegetarian|fish|seafood|cheese|bread|bun|snack/i;
// Evidence that a label's base is NOT meat: plant proteins, grains, legumes, dairy, eggs, fish. "Hydrolyzed soy protein" is a
// flavour enhancer in meat labels (it is in real deli roast beef), not a base.
const NON_MEAT_BASE = /(?<!hydrolyzed )\b(?:soy|pea|wheat|potato|faba|rice|plant|vegetable|milk) protein|\b(?:textured|gluten|seitan|tofu|tempeh|soymilk|soy flour|jackfruit|chickpeas?|lentils?|beans?|mushrooms?|quinoa|nuts?|almonds?|walnuts?|coconut|oats?|flour|rice|cheese|milk|cream|eggs?|salmon|tuna|fish|shrimp|crab(?:meat)?|surimi|pollock|whitefish|roe|seafood|cod|tilapia|scallops?)\b/i;
// A label that has a "bacon flavor" or "ham flavor" item is a seasoning or a flavoured product, not a brine-only meat label.
const MEAT_FLAVOUR_ITEM = /\b(?:bacon|ham|sausage|pepperoni|salami|jerky|pork|beef)[- ](?:type |style )?flavou?r/i;
// A name that says it is not a deli meat itself (a spread, a sauce, bread...): the brine rule does not apply.
const NOT_DELI_NAME = /\b(?:spreads?|dips?|sauces?|dressing|seasoning|rub|marinade|glaze|buns?|rolls?|bread|crackers?|chips?|cheese|tofu|tempeh)\b/i;
// A label that shows curing, smoking or a brine: the exemption for fresh cuts does not apply.
const CURE_SIGNAL = /\b(?:cured?|nitrit\w*|nitrat\w*|smoked?|brine|solution|celery|starter culture|sodium (?:lactate|diacetate|erythorbate)|potassium lactate)\b/i;
// Name words of a prepared ham: "Dry-Cured", "Country", "Honey", "Black Forest", "Iberico", "Cooked".
const PREPARED_HAM_NAME = /\b(?:dry[- ]?cured|cured|uncured|smoked|country|honey|glazed|baked|cooked|spiral|black forest|iberico|serrano|jamon|deli)\b/i;

/** The meat words in a product name that really name meat: "Pineapple Bacon Flavored Sausage" → Sausage. */
function plainMeatWords(name: string): string[] {
  const out: string[] = [];
  for (const m of name.matchAll(new RegExp(PM_WORD.source, "gi"))) {
    if (!NOT_AFTER.test(name.slice(m.index! + m[0].length))) out.push(m[0]);
  }
  return out;
}

function processedMeat(p: FoodInput): FoodConcern | null {
  if (p.category && !FOOD_CATEGORIES.has(p.category)) return null;
  const name = p.name;
  const words = plainMeatWords(name);
  if (NEGATOR.test(name)) return null;
  const text = p.ingredients || "";
  const items = parseIngredients(text.replace(IMITATION_BITS, " ")).filter(item => !NOT_MEAT_ITEM.test(item));
  if (FLAVOURED_NAME.test(name) && !(items.length > 0 && MEAT_INGREDIENT.test(items[0]))) return null;
  const cat = p.source?.foodCategory ?? "";
  const familyCategory = MEAT_CATEGORY.test(cat) && !NOT_MEAT_CATEGORY.test(cat);
  const meatCategory = familyCategory || GENERIC_PREPARED.test(cat);
  const sausageName = !BURGER_NAME.test(name) && (SAUSAGE_CATEGORY.test(cat) && !NOT_MEAT_CATEGORY.test(cat) && SAUSAGE_NAME.test(name)
    || (meatCategory || MEAT_PRODUCT_CATEGORY.test(cat)) && MEAT_LINKS_NAME.test(name));
  if (words.length === 0 && sausageName && !PM_USDA.has(cat)) words.push("Sausage"); // a USDA processed-meat category already says it
  const meatNoun = words.length > 0 || sausageName || MEAT_INGREDIENT.test(name);
  // A: the label names meat, or there is no label, or (a meat category, a meat noun in the name, and no non-meat base on the
  // label) the label is only the brine, glaze or cure of a product whose meat the label leaves out.
  const brineOnly = meatCategory && meatNoun && items.length > 0 && !NOT_DELI_NAME.test(name) && !MEAT_FLAVOUR_ITEM.test(text)
    && !items.some(i => NON_MEAT_BASE.test(i.replace(/\bnot from milk\b/gi, "")));
  const backed = !text.trim() || items.some(item => MEAT_INGREDIENT.test(item) || PM_WORD.test(item)) || brineOnly;
  // I: a fresh cut named "ham" ("Pork Ham Bone In", label "Pork"): USDA says unprepared, or the label is one meat item, and
  // nothing on it shows curing, smoking or a brine. Not processed: no finding at all, not even "contains".
  const freshCut = words.length > 0 && words.every(w => /^hams?$/i.test(w)) && !CURE_SIGNAL.test(text)
    && !PREPARED_HAM_NAME.test(name) && !PM_USDA.has(cat)
    && (/unprepared|unprocessed/i.test(cat) || (items.length === 1 && MEAT_INGREDIENT.test(items[0])));
  if (freshCut) return null;
  const inName = backed && !ACCESSORY.test(name) && words.length > 0 ? words[0].match(PM_WORD) : null; // reasons keep the label's casing ("SPAM")
  const pmCategory = backed && PM_USDA.has(cat);
  const dish = DISH.test(name) && !USE.test(name) && !pmCategory; // a USDA processed-meat category says it IS the meat
  if (inName) return dish ? containsProcessedMeat(inName[1]) : { ...PROCESSED_MEAT, reason: `Processed meat: ${inName[1]}` };
  if (pmCategory) return { ...PROCESSED_MEAT, reason: `Processed meat (USDA category "${cat}")` };
  for (const item of items) {
    const m = item.match(PM_WORD);
    if (m) return containsProcessedMeat(m[1]);
  }
  // C: a label that starts with meat (or is only the brine of a meat) and shows a cure, a preservative or a smoked name is
  // processed meat even when the name says meatballs, ribs or only "Sliced Turkey" (M10.2). In the sausage, bacon, ham and
  // cold-cut categories always; for meatballs and ribs also in the cooked and frozen meat categories. After the loop above:
  // a product that lists a processed meat among other things keeps reading "contains".
  const cure = items.map(i => i.match(CURE_ITEM)).find(Boolean);
  const cureScope = familyCategory || (MEATBALL_OR_RIBS.test(name) && (meatCategory || MEAT_PRODUCT_CATEGORY.test(cat)));
  if (cureScope && items.length > 0 && (MEAT_INGREDIENT.test(items[0]) || brineOnly) && !DISH.test(name) && (cure || SMOKED_NAME.test(name))) {
    return { ...PROCESSED_MEAT, reason: `Processed meat (${cure ? `${cure[0].toLowerCase()} on the label` : "smoked"}; USDA category "${cat}")` };
  }
  return null;
}

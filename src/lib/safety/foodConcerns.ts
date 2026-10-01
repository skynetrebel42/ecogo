// foodConcerns.ts — concerns about the food itself or how it's made, which an ingredient list doesn't show.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.2. Processed meat raises the badge
// (IARC Group 1). Acrylamide is a cooking marker only: it never changes the badge (decision L6).
import type { Severity, Source } from "./library.ts";
import { FOOD_CATEGORIES } from "./analyze.ts";
import { parseIngredients } from "./parse.ts";

export interface FoodConcern {
  id: "processed-meat" | "acrylamide";
  kind: "food" | "cooking";  // "food" can raise the badge; "cooking" is a marker only
  severity?: Severity;       // processed meat: "known"; acrylamide: none
  name: string;
  reason: string;            // why this product matched, e.g. "Contains processed meat: pepperoni"
  concern: string;           // one plain-English sentence
  context: string;           // regulator context shown next to the finding
  sources: Source[];
}

/** What the rules read: a catalog product, or a looked-up one (with its USDA category or OFF tags). */
export interface FoodInput {
  name: string;
  category: string;
  ingredients: string;
  source?: { foodCategory?: string; categoryTags?: string[] };
}

const CHECKED = "2026-09-30";
const WHO_QA = "https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat";
const IARC_QA = "https://www.iarc.who.int/wp-content/uploads/2018/07/Monographs-QA_Vol114.pdf"; // PDF: hand-checked 2026-09-30

// ── Processed meat (IARC Group 1) ────────────────────────────────────────────

export const PROCESSED_MEAT: Omit<FoodConcern, "reason"> = {
  id: "processed-meat", kind: "food", severity: "known", name: "Processed meat",
  concern: "IARC classifies eating processed meat as carcinogenic to humans (Group 1): it causes colorectal cancer.",
  context: "Group 1 describes how strong the evidence is, not how dangerous something is: IARC says this does not mean processed meat is as dangerous as smoking. Its estimate: each 50 g eaten daily raises colorectal cancer risk by about 18%. WHO advises eating it in moderation.",
  sources: [
    { body: "WHO", basis: "iarc-1", finding: "Group 1 (carcinogenic to humans): consumption of processed meat (IARC Monographs vol. 114, 2015)",
      url: WHO_QA, quote: "Processed meat has been classified as Group 1, carcinogenic to humans.", checkedOn: CHECKED },
    { body: "WHO", basis: "context", finding: "WHO's definition: meat that is salted, cured, fermented or smoked",
      url: WHO_QA, quote: "Processed meat refers to meat that has been transformed through salting, curing, fermentation, smoking or other processes to enhance flavour or improve preservation.", checkedOn: CHECKED },
    { body: "IARC", basis: "context", finding: "IARC: being in Group 1 with tobacco does not mean equally dangerous",
      url: IARC_QA, quote: "this does NOT mean that they are all equally dangerous", checkedOn: CHECKED },
    { body: "IARC", basis: "context", finding: "IARC's risk estimate: about 18% higher colorectal cancer risk per 50 g eaten daily",
      url: IARC_QA, quote: "every 50 gram portion of processed meat eaten daily increases the risk of colorectal cancer by about 18%", checkedOn: CHECKED },
  ],
};

// IARC's examples ("hot dogs (frankfurters), ham, sausages, corned beef, and biltong or beef jerky as well as canned
// meat") plus common cured/smoked meats. Whole words only ("graham" is not ham). "franks" never matches before an
// apostrophe, so "Frank's RedHot" isn't meat.
const PM_WORD = /\b(hot ?dogs?|frankfurters?|franks?(?!['’])|wieners?|bacon|hams?|sausages?|salami|pepperoni|chorizo|bologna|pastrami|corned beef|jerky|biltong|prosciutto|spam|luncheon meat|lunch ?meats?|deli meats?|cold cuts?|kielbasa|brat(?:wurst)?s?|mortadella|pancetta|(?:cured|smoked)[- ](?:pork|beef|turkey|chicken|meat))\b/i;
// Meat-free versions and flavourings aren't meat.
const NOT_MEAT = /\b(imitation|vegan|vegetarian|plant[- ]based|meatless|meat[- ]free|veggie)\b|\b(?:bacon|ham|sausage|pepperoni|salami|jerky)(?:[- ]flavou?r|[- ]free\b)|\bno (?:bacon|ham|sausage|pepperoni|salami|meat)\b/i;
// A name match needs meat in the ingredients (when there are any): hot dog buns and plant-based "sausage" aren't meat.
const MEAT_INGREDIENT = /\b(pork|beef|chicken|turkey|veal|lamb|mutton|goat|venison|bison|meat|poultry)\b/i;
// Named after a meat but made to go with it: "Hot Dog Buns", "Ham Glaze", "Sausage Seasoning". Only hot dog rolls are
// bread: a "sausage roll" is meat.
const ACCESSORY = new RegExp(PM_WORD.source + /\s+(buns?|relish|chili|sauce|seasoning|glaze|mix)\b|\bhot ?dogs? rolls?\b/.source, "i");
// A dish named after its meat ("Pepperoni Pizza") contains processed meat rather than being it.
const DISH = /\b(pizzas?|sandwich(es)?|wraps?|salads?|soups?|pasta|burritos?|calzones?|biscuits?|bagels?|pockets?|bites|kits?)\b/i;
// USDA categories that are processed meat by definition (sampled from real records 2026-09-30).
const PM_USDA = new Set(["Sausages, Hotdogs & Brats", "Frozen Sausages, Hotdogs & Brats", "Pepperoni, Salami & Cold Cuts", "Canned Meat"]);

function processedMeat(p: FoodInput): FoodConcern | null {
  if (p.category && !FOOD_CATEGORIES.has(p.category)) return null;
  if (NOT_MEAT.test(p.name)) return null;
  const text = p.ingredients || "";
  const items = parseIngredients(text).filter(item => !NOT_MEAT.test(item));
  const backed = !text.trim() || items.some(item => MEAT_INGREDIENT.test(item) || PM_WORD.test(item));
  const inName = backed && !ACCESSORY.test(p.name) ? p.name.match(PM_WORD) : null; // reasons keep the label's casing ("SPAM")
  if (inName) return { ...PROCESSED_MEAT, reason: `${DISH.test(p.name) ? "Contains processed meat" : "Processed meat"}: ${inName[1]}` };
  if (backed && p.source?.foodCategory && PM_USDA.has(p.source.foodCategory)) {
    return { ...PROCESSED_MEAT, reason: `Processed meat (USDA category "${p.source.foodCategory}")` };
  }
  for (const item of items) {
    const m = item.match(PM_WORD);
    if (m) return { ...PROCESSED_MEAT, reason: `Contains processed meat: ${m[1]}` };
  }
  return null;
}

// ── Acrylamide (cooking marker) ──────────────────────────────────────────────

const M2_CHECKED = "2026-09-28"; // sources verified for the superseded M2 spec §3

export const ACRYLAMIDE: FoodConcern = {
  id: "acrylamide", kind: "cooking", name: "Acrylamide",
  reason: "Forms when starchy foods are fried, baked or roasted; it isn't an added ingredient.",
  concern: "IARC classifies acrylamide as probably carcinogenic to humans (Group 2A), and EFSA says it potentially increases cancer risk.",
  context: "EU law requires makers of these foods to keep it as low as reasonably achievable. The FDA does not advise avoiding fried, roasted or baked foods; cooking to golden rather than brown helps reduce it.",
  sources: [
    { body: "IARC", basis: "iarc-2a", finding: "Group 2A (probably carcinogenic to humans), IARC Monographs vol. 60 (1994)",
      url: "https://publications.iarc.who.int/78", quote: "Acrylamide was classified as probably carcinogenic to humans.", checkedOn: M2_CHECKED },
    { body: "EFSA", basis: "context", finding: "EFSA's 2015 opinion: acrylamide in food potentially increases cancer risk for all age groups",
      url: "https://www.efsa.europa.eu/en/press/news/150604",
      quote: "acrylamide in food potentially increases the risk of developing cancer for consumers in all age groups", checkedOn: M2_CHECKED },
    { body: "EU", basis: "context", finding: "Regulation (EU) 2017/2158 requires makers of fries, crisps, bread, breakfast cereals, biscuits, coffee and baby food to reduce it",
      url: "http://publications.europa.eu/resource/celex/32017R2158",
      quote: "(a) French fries, other cut (deep fried) products and sliced potato crisps from fresh potatoes;", checkedOn: M2_CHECKED },
    { body: "FDA", basis: "context", finding: "FDA's Q&A answers 'No' to whether people should stop eating fried, roasted or baked foods",
      url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers",
      quote: "Should I stop eating foods that are fried, roasted, or baked?", checkedOn: M2_CHECKED },
    { body: "FDA", basis: "context", finding: "FDA home-cooking advice: fry and toast to golden rather than brown",
      url: "https://www.fda.gov/food/process-contaminants-food/acrylamide-and-diet-food-storage-and-food-preparation",
      quote: "to a golden yellow color rather than a brown color helps reduce acrylamide formation", checkedOn: M2_CHECKED },
  ],
};

/** EU Regulation 2017/2158 Article 1(2) food types. */
export type EuCategory = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";

// OFF category ids (verified against the OFF taxonomy 2026-09-28). Tags are hierarchical, so parents cover children.
// Generic "en:crisps" / "en:chips-and-fries" are NOT listed: they include corn chips.
const OFF_TAGS: [string, EuCategory][] = [
  ["en:potato-fries", "a"], ["en:potato-crisps", "a"], ["en:salty-snacks-made-from-potato", "b"],
  ["en:breads", "c"], ["en:breakfast-cereals", "d"],
  ["en:biscuits-and-crackers", "e"], ["en:cereal-bars", "e"], ["en:gingerbreads", "e"],
  ["en:coffees", "f"], ["en:instant-coffees", "f"], ["en:instant-coffee-substitutes", "g"], ["en:baby-foods", "h"],
];

// USDA foodCategory values (sampled from real records 2026-09-30). "snack" = decided by the first ingredient, because
// potato chips and corn tortilla chips share "Chips, Pretzels & Snacks".
const USDA_CATEGORIES: Record<string, EuCategory | "snack"> = {
  "French Fries, Potatoes & Onion Rings": "a", "Chips, Pretzels & Snacks": "snack",
  "Breads & Buns": "c", "Processed Cereal Products": "d", "Cereal": "d",
  "Biscuits/Cookies": "e", "Cookies & Biscuits": "e", "Crackers & Biscotti": "e", "Flavored Snack Crackers": "e",
  "Snack, Energy & Granola Bars": "e", "Coffee": "f",
};
const CATALOG_CATEGORIES: Record<string, EuCategory | "snack"> = { Snacks: "snack", Bread: "c", Breakfast: "d" };

const PORRIDGE = /\b(oat ?meal|oats|porridge|grits)\b/i;            // (d) excludes porridge
const BAKERY_WORDS = /\b(cookies?|biscuits?|crackers?|wafers?|rusks?|gingerbread|crispbreads?|(granola|cereal) bars?)\b/i;
const CEREAL_FLOUR_FIRST = /^(enriched |unbleached enriched |whole grain |whole )?(wheat |oat |rice |rye )?flour\b/i;

function snack(name: string, ingredients: string): EuCategory | null {
  const first = ingredients.trim();
  if (/^potato(es)?\b/i.test(first)) return "a";
  if (/^dried potato(es)?\b/i.test(first)) return "b";
  // EU (e): "a cracker is a dry biscuit (a baked product based on cereal flour)"
  if (BAKERY_WORDS.test(name) || CEREAL_FLOUR_FIRST.test(first)) return "e";
  return null;
}

/** Which EU acrylamide food type a product is, or null. */
export function acrylamideMatch(p: FoodInput): EuCategory | null {
  if (p.source?.categoryTags) { // Open Food Facts
    const tags = new Set(p.source.categoryTags);
    for (const [tag, eu] of OFF_TAGS) {
      if (eu === "d" && tags.has("en:porridge")) continue;
      if (tags.has(tag)) return eu;
    }
    return null;
  }
  const bucket = p.source ? USDA_CATEGORIES[p.source.foodCategory ?? ""] : CATALOG_CATEGORIES[p.category];
  if (!p.source && !FOOD_CATEGORIES.has(p.category)) return null;
  if (bucket === "snack") return snack(p.name, p.ingredients);
  if (bucket === "d" && PORRIDGE.test(p.name)) return null;
  if (bucket) return bucket;
  if (/\b(coffee|espresso)\b/i.test(p.name) && !/creamer/i.test(p.name)) return "f";
  return null;
}

/** Food-level concerns for a product: processed meat first, then the acrylamide marker. */
export function foodConcerns(p: FoodInput): FoodConcern[] {
  const out: FoodConcern[] = [];
  const meat = processedMeat(p);
  if (meat) out.push(meat);
  if (acrylamideMatch(p)) out.push(ACRYLAMIDE);
  return out;
}

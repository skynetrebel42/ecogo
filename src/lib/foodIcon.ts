// foodIcon.ts: one emoji per product, from its category. M11 (quick wins) part 1.
// Spec: docs/superpowers/specs/2026-10-05-m11-quick-wins-design.md. Copy to src/lib/foodIcon.ts. Pure: no React, no network.
// The icon is a picture of the shelf the product sits on, not a claim about it; unknown categories keep the shopping cart.

/** The catalog's own categories (the 51 seeded products), moved here from verdict.tsx's categoryIcon. */
export const CATALOG_ICON: Record<string, string> = {
  Beverages: "🥤", Bread: "🍞", Breakfast: "🥣", Condiments: "🧂", Dairy: "🧀", Frozen: "🧊", Meat: "🥩", Snacks: "🍪",
  Cleaning: "🧽", "Personal Care": "🧴", "Baby Care": "🍼", Medicine: "💊", "Pet Food": "🐾",
};

/** Ordered: the first pattern that matches a USDA food category wins. Tuned against the 351 real categories of the `foods`
 *  table (usda-categories.json): 99.97% of its 430,127 products get an icon other than the cart. Order matters: a sauce
 *  before a pizza ("Pasta & Pizza Sauces"), a sandwich before a biscuit ("Breakfast Sandwiches, Biscuits"), bars before drinks. */
export const ICON_RULES: [string, RegExp][] = [
  ["🍼", /baby|infant|formula/i],
  ["💊", /supplement|vitamin|mineral|remed|health care|amino acid|antioxidant|fatty acid|weight control|oral hygiene|sports and weight/i],
  ["🥜", /nut (?:&|and) seed butter|peanut butter|nut butter/i],
  ["🍯", /honey|syrup|molasses|\bjam\b|jelly|sweet spread/i],
  ["🥫", /sauce|ketchup|mustard|dressing|mayonnaise|condiment|\bdips?\b|salsa|vinegar|cooking wine|gravy|\bspreads?\b|hummus|pate\b/i],
  ["🍕", /pizza/i],
  ["🍦", /ice cream|ice-cream|frozen yogurt|frozen dessert|ice novelties|ice-block|ice block/i],
  ["💧", /\bwater\b(?!.*enhancer)/i],
  ["☕", /coffee/i],
  ["🥤", /iced|bottle(?:d)? tea|ready to drink|not ready to drink/i],
  ["🍵", /\btea\b|tea bags|infusions|tisanes/i],
  ["🍷", /\balcohol|\bbeer\b|\bwine\b/i],
  ["🥛", /milk|\bcream\b|creamer|yogurt|yoghurt/i],
  ["🍫", /chocolate|\bbars?\b/i],
  ["🥤", /soda|juice|drink|beverage|nectar|enhancer|sport/i],
  ["🧀", /cheese/i],
  ["🥞", /pancake|waffle|french toast|crepe/i],
  ["🥪", /sandwich|\bsubs?\b|\bwraps?\b|burrito|\bdeli\b(?!.*salad)/i],
  ["🥗", /salad/i],
  ["🍔", /burger|patties/i],
  ["🍰", /cake|cupcake|pastr|muffin|croissant|dessert|pudding|custard|gelatin|\bpies?\b/i],
  ["🍪", /cookie|biscuit|cracker/i],
  ["🍬", /candy|confection|\bgum\b|mints/i],
  ["🥣", /cereal|granola|muesli|breakfast/i],
  ["🥨", /chips|pretzel/i],
  ["🍿", /popcorn|peanut|snack|\bnuts?\b/i],
  ["🍞", /bread|\bbuns?\b|dough|crust|bakery|bagel|stuffing|taco shell/i],
  ["🍲", /soup|stew|chili/i],
  ["🧈", /\boils?\b|\bfats?\b|butter|margarine/i],
  ["🧂", /seasoning|salt|spice|herb|marinade|extract|baking|flour|corn meal|sugar/i],
  ["🌮", /mexican|taco/i],
  ["🍣", /sushi/i],
  ["🐟", /fish|seafood|tuna|shellfish|salmon|crab|shrimp|mussel|aquatic/i],
  ["🌭", /sausage|hotdog|hot dog|brat|salami|pepperoni|cold cut|smallgoods|bacon|\bham\b/i],
  ["🥩", /meat|beef|pork|poultry|chicken|turkey|\bribs\b|jerky/i],
  ["🥚", /\beggs?\b/i],
  ["🍝", /pasta|noodle|macaroni/i],
  ["🍚", /rice|grain|quinoa/i],
  ["🍟", /fries|potato/i],
  ["🍎", /fruit|berries|apple/i],
  ["🥦", /vegetable|veges|tomato|pickle|olive|pepper|bean|chickpea|lentil|tofu|vegetarian/i],
  ["🍽️", /frozen|dinner|entree|meal|prepared|cooked|combination|appetizer|sides|deli/i],
];

export const DEFAULT_ICON = "🛒";

/** One USDA food category ("Chips, Pretzels & Snacks") or one Open Food Facts tag ("en:breakfast-cereals") → an emoji, or null. */
export function iconForCategory(category: string): string | null {
  const text = category.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
  for (const [emoji, pattern] of ICON_RULES) if (pattern.test(text)) return emoji;
  return null;
}

// OFF's broadest tags describe half the shop ("plant-based foods and beverages"); they must not pick an icon.
const GENERIC_TAGS = new Set(["en:plant-based-foods-and-beverages", "en:plant-based-foods", "en:foods", "en:food", "en:beverages-and-beverages-preparations"]);

export interface IconSource {
  category?: string;
  source?: { foodCategory?: string; categoryTags?: string[] };
}

/** The icon for a product: its catalog category, else its USDA category, else its most specific Open Food Facts tag that
 *  maps (tags run from general to specific, so they are tried from the last), else the cart. */
export function foodIcon(p: IconSource): string {
  if (p.category && CATALOG_ICON[p.category]) return CATALOG_ICON[p.category];
  const usda = p.source?.foodCategory;
  if (usda) return iconForCategory(usda) ?? DEFAULT_ICON;
  for (const tag of [...(p.source?.categoryTags ?? [])].reverse()) {
    if (GENERIC_TAGS.has(tag)) continue;
    const icon = iconForCategory(tag);
    if (icon) return icon;
  }
  return DEFAULT_ICON;
}

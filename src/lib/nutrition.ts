// nutrition.ts — added sugar, saturated fat and sodium per serving, as FDA % Daily Value with FDA's 5/20 rule.
// Spec: docs/superpowers/specs/2026-10-01-m5-nutrition-barcodes-design.md §3, §4.1. A separate signal from the
// concern badge: it never changes it. Pure and import-free, so Node tests can load it.

export type NutrientId = "addedSugar" | "satFat" | "sodium";

export interface NutrientValue {
  id: NutrientId;
  label: string;          // "Added sugar"
  short: string;          // card chip: "High sugar"
  amount: number | null;  // per serving (or per 100 g when there's no serving size); null = not listed
  unit: "g" | "mg";
  dv: number | null;      // % Daily Value, rounded as a label shows it; null when there's no serving size
  level: "high" | "low" | null;
}

export interface Nutrition {
  serving: string;        // "3 cookies (34 g)", or "100 g" when per100
  perServing: boolean;    // false: values are per 100 g/ml and High/Low can't apply (FDA's rule is per serving)
  nutrients: NutrientValue[];
  source: "USDA FoodData Central" | "Open Food Facts";
}

/** FDA Daily Values, adults and children 4+ (checked 2026-10-01). */
export const DAILY_VALUE: Record<NutrientId, number> = { addedSugar: 50, satFat: 20, sodium: 2300 };

export const FDA_RULE = {
  quote: "5% DV or less of a nutrient per serving is considered low. 20% DV or more of a nutrient per serving is considered high.",
  url: "https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels",
  checkedOn: "2026-10-01",
};

const META: Record<NutrientId, { label: string; short: string; unit: "g" | "mg" }> = {
  addedSugar: { label: "Added sugar", short: "High sugar", unit: "g" },
  satFat: { label: "Saturated fat", short: "High sat fat", unit: "g" },
  sodium: { label: "Sodium", short: "High sodium", unit: "mg" },
};
const ORDER: NutrientId[] = ["addedSugar", "satFat", "sodium"];

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const record = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

/** One nutrient: amount rounded like a label (g to 0.1, mg whole), %DV rounded, then FDA's 5/20 rule. */
export function nutrient(id: NutrientId, amount: number | null, perServing: boolean): NutrientValue {
  const { label, short, unit } = META[id];
  const rounded = amount === null ? null : unit === "mg" ? Math.round(amount) : Math.round(amount * 10) / 10;
  const dv = rounded === null || !perServing ? null : Math.round((rounded / DAILY_VALUE[id]) * 100);
  const level = dv === null ? null : dv >= 20 ? "high" : dv <= 5 ? "low" : null;
  return { id, label, short, amount: rounded, unit, dv, level };
}

const USDA_NAMES: Record<string, NutrientId> = { "Sugars, added": "addedSugar", "Fatty acids, total saturated": "satFat", "Sodium, Na": "sodium" };
const UNIT: Record<string, string> = { GRM: "g", G: "g", MLT: "ml", ML: "ml" };

/** From a USDA /foods/search record: `foodNutrients` are per 100 g/ml; scale by `servingSize`. */
export function usdaNutrition(food: unknown): Nutrition | null {
  const f = record(food);
  const per100: Partial<Record<NutrientId, number>> = {};
  for (const n of Array.isArray(f.foodNutrients) ? f.foodNutrients.map(record) : []) {
    const id = USDA_NAMES[String(n.nutrientName)];
    const v = num(n.value);
    if (id && v !== null) per100[id] = v;
  }
  if (Object.keys(per100).length === 0) return null;
  const size = num(f.servingSize);
  const unit = UNIT[String(f.servingSizeUnit ?? "").toUpperCase()];
  const perServing = size !== null && size > 0 && unit !== undefined;
  const factor = perServing ? size! / 100 : 1;
  const household = typeof f.householdServingFullText === "string" ? f.householdServingFullText.trim() : "";
  // "3 cookies" → "3 cookies (34 g)"; "1/6 pizza (130g)" already names its weight, so it's kept as is.
  const named = /\d\s*(g|ml)\b/i.test(household);
  const serving = !perServing ? "100 g" : household ? (named ? household : `${household} (${size} ${unit})`) : `${size} ${unit}`;
  return {
    serving, perServing, source: "USDA FoodData Central",
    nutrients: ORDER.map(id => nutrient(id, per100[id] === undefined ? null : per100[id]! * factor, perServing)),
  };
}

/** From an Open Food Facts product: `nutriments` per serving when present, else per 100 g. Sodium is stored in grams. */
export function offNutrition(product: unknown): Nutrition | null {
  const p = record(product);
  const n = record(p.nutriments);
  const keys: Record<NutrientId, string> = { addedSugar: "added-sugars", satFat: "saturated-fat", sodium: "sodium" };
  const perServing = ORDER.some(id => num(n[`${keys[id]}_serving`]) !== null);
  const suffix = perServing ? "_serving" : "_100g";
  const raw = ORDER.map(id => num(n[keys[id] + suffix]));
  if (raw.every(v => v === null)) return null;
  const servingText = typeof p.serving_size === "string" ? p.serving_size.trim() : "";
  return {
    serving: perServing ? servingText || "1 serving" : "100 g", perServing, source: "Open Food Facts",
    nutrients: ORDER.map((id, i) => nutrient(id, raw[i] === null ? null : id === "sodium" ? raw[i]! * 1000 : raw[i], perServing)),
  };
}

/** The card chip: the High nutrient with the largest %DV, or null. */
export function topHigh(n: Nutrition | null | undefined): NutrientValue | null {
  const highs = (n?.nutrients ?? []).filter(x => x.level === "high");
  return highs.sort((a, b) => (b.dv ?? 0) - (a.dv ?? 0))[0] ?? null;
}

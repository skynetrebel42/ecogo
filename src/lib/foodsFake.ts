// foodsFake.ts — test doubles for the `foods` table: an in-memory FoodsSource, a row builder, and a converter from the
// USDA search-API fixtures already in src/lib/fixtures/usda. Not imported by the app, so it never ships.
import type { FoodRow, FoodsSource } from "./foods.ts";
import { tidyCase } from "./lookup.ts";

/** A complete row; override what a test cares about. */
export function foodRow(over: Partial<FoodRow> = {}): FoodRow {
  return {
    barcode_key: "12345678905", barcode: "012345678905", fdc_id: 1, name: "Test Snack", brand: "Test Brand",
    category: "Chips, Pretzels & Snacks", ingredients: "CORN, SALT", serving_size: 28, serving_unit: "g", serving_text: "1 oz",
    added_sugar_100g: null, sat_fat_100g: 1, sodium_100g: 500, verdict: "none", verdict_rank: 0, flags: 0, cooked: false,
    engine_rev: 1, snapshot: "2025-12-18", ...over,
  };
}

/** A USDA /foods/search record (the shape of the fixtures) as the row the importer would store for it. */
export function rowFromUsdaSearch(f: any): FoodRow {
  const digits = String(f.gtinUpc ?? "").replace(/\D/g, "");
  const per100 = (name: string) => {
    const n = (f.foodNutrients ?? []).find((x: any) => x.nutrientName === name);
    return typeof n?.value === "number" ? n.value : null;
  };
  return foodRow({
    barcode_key: digits.replace(/^0+/, ""), barcode: String(f.gtinUpc ?? ""), fdc_id: f.fdcId ?? 1,
    name: tidyCase(String(f.description ?? "")), brand: tidyCase(String(f.brandName || f.brandOwner || "")),
    category: String(f.foodCategory ?? ""), ingredients: String(f.ingredients ?? "").replace(/^ingredients:\s*/i, ""),
    serving_size: typeof f.servingSize === "number" ? f.servingSize : null, serving_unit: String(f.servingSizeUnit ?? ""),
    serving_text: String(f.householdServingFullText ?? ""),
    added_sugar_100g: per100("Sugars, added"), sat_fat_100g: per100("Fatty acids, total saturated"), sodium_100g: per100("Sodium, Na"),
    snapshot: String(f.publishedDate ?? "2025-12-18"),
  });
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** An in-memory FoodsSource. `fail: true` makes every call throw, like an unreachable database. `calls` logs them. */
export function memoryFoods(rows: FoodRow[], opts: { fail?: boolean } = {}): FoodsSource & { calls: string[] } {
  const calls: string[] = [];
  const guard = () => { if (opts.fail) throw new TypeError("Failed to fetch"); };
  return {
    calls,
    async byBarcode(key) { calls.push(`byBarcode ${key}`); guard(); return rows.find(r => r.barcode_key === key) ?? null; },
    async search(text, limit) {
      calls.push(`search ${text}`); guard();
      const want = words(text);
      return rows.filter(r => { const have = new Set(words(`${r.name} ${r.brand}`)); return want.every(w => have.has(w)); }).slice(0, limit);
    },
    async alternatives(category, myRank, excludeKey, limit) {
      calls.push(`alternatives ${category}`); guard();
      return rows.filter(r => r.category === category && r.verdict_rank < myRank && r.barcode_key !== excludeKey).slice(0, limit);
    },
  };
}

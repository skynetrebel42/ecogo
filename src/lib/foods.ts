// foods.ts — the `foods` table (EcoGo's read-only copy of USDA Branded Foods): the row shape, row → Product, the search
// query builder and the interface the app reads it through. Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md
// §3, §5. Nothing here touches the network or the browser, so Node tests can load it. Adapters: foodsDb.ts (Supabase)
// and foodsFake.ts (tests).
import type { Product } from "./productImporter.ts";
import { dbNutrition } from "./nutrition.ts";

export interface FoodRow {
  barcode_key: string;          // digits with leading zeros stripped: the barcodeKey() of lookup.ts
  barcode: string;              // as USDA stores it (8, 12 or 14 digits)
  fdc_id: number;
  name: string;
  brand: string;
  category: string;             // USDA brandedFoodCategory, e.g. "Chips, Pretzels & Snacks"
  ingredients: string;
  serving_size: number | null;
  serving_unit: string;         // "g" or "ml" (USDA may also write GRM / MLT)
  serving_text: string;         // household serving, e.g. "3 cookies"
  added_sugar_100g: number | null; // per 100 g or ml; null = not listed
  sat_fat_100g: number | null;
  sodium_100g: number | null;   // mg
  verdict: string;              // the engine's level when the row was imported; orders results, never shown
  verdict_rank: number;         // VERDICT_RANK of that level
  flags: number;                // findings behind it
  cooked: boolean;              // 🔥 acrylamide marker
  engine_rev: number;
  snapshot: string;             // USDA release date, YYYY-MM-DD
}

/** Everything the app asks of the table. Reads only; the browser never writes it. */
export interface FoodsSource {
  byBarcode(barcodeKey: string): Promise<FoodRow | null>;
  search(text: string, limit: number): Promise<FoodRow[]>;
  /** Same category, strictly better level than `myRank`, complete records only, best first. */
  alternatives(category: string, myRank: number, excludeKey: string, limit: number): Promise<FoodRow[]>;
}

/** A `foods` row as the app's Product, with its source and nutrition. Like every looked-up product its id is negative. */
export function foodRowToProduct(r: FoodRow): Product {
  const product: Product = {
    id: -Number(r.barcode_key), // catalog ids are positive, so a looked-up product never collides with one
    barcode: r.barcode, name: r.name || "Unnamed product", brand: r.brand, category: "", description: "",
    ingredients: r.ingredients, imageUrl: "", keywords: [],
    source: {
      name: "USDA FoodData Central", url: `https://fdc.nal.usda.gov/food-details/${r.fdc_id}/nutrients`,
      crowdSourced: false, ingredientsLang: "en", additiveCodes: [], foodCategory: r.category, snapshot: r.snapshot,
    },
  };
  const nutrition = dbNutrition(r);
  return nutrition ? { ...product, nutrition } : product;
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Typed words → a Postgres to_tsquery string: every word must appear as a whole word, plural either way (like
 * search.ts): "ice creams" → "(ice | ices) & (cream | creams)". Only [a-z0-9] reaches the database. "" = no words.
 */
export function tsQueryFor(text: string): string {
  return words(text).slice(0, 8).map(w => {
    const base = w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
    return `(${base} | ${base}s)`;
  }).join(" & ");
}

/** "2025-12-18" → "Dec 2025" (the label on a product page); anything else is returned as is. */
export function snapshotLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

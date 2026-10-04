// foodsImport.ts — USDA Branded Foods download → `foods` rows. Used by scripts/import-usda.mjs and its tests.
// Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §4. Pure: no network, no files.
import type { FoodRow } from "./foods.ts";
import { assessProduct } from "./safety/assess.ts";
import { VERDICT_RANK } from "./safety/analyze.ts";
import { tidyCase } from "./lookup.ts";

/** Bump when the library or the rules change, so a row can say which engine scored it. */
export const ENGINE_REV = 2;

// USDA nutrient numbers: added sugars, saturated fat, sodium (amounts are per 100 g/ml).
const NUTRIENT: Record<string, "added_sugar_100g" | "sat_fat_100g" | "sodium_100g"> = {
  "539": "added_sugar_100g", "606": "sat_fat_100g", "307": "sodium_100g",
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

/** The download writes dates as "3/22/2018" (not sortable as text); returns "YYYY-MM-DD", or "" when unreadable. */
export function usdaDate(v: unknown): string {
  const s = text(v);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

/** One record of the Branded Foods JSON → a table row, scored by the app's own engine; null without a barcode or ingredients. */
export function usdaRecordToRow(raw: unknown, snapshot: string): FoodRow | null {
  const r = obj(raw);
  const barcode = text(r.gtinUpc).replace(/\D/g, "");
  const key = barcode.replace(/^0+/, "");
  const ingredients = text(r.ingredients).replace(/^ingredients:\s*/i, "");
  const fdcId = Number(r.fdcId);
  if (!key || !ingredients || !Number.isFinite(fdcId)) return null;

  const row: FoodRow = {
    barcode_key: key, barcode, fdc_id: fdcId,
    name: tidyCase(text(r.description)), brand: tidyCase(text(r.brandName) || text(r.brandOwner)),
    category: text(r.brandedFoodCategory), ingredients,
    serving_size: typeof r.servingSize === "number" && Number.isFinite(r.servingSize) ? r.servingSize : null,
    serving_unit: text(r.servingSizeUnit), serving_text: text(r.householdServingFullText),
    added_sugar_100g: null, sat_fat_100g: null, sodium_100g: null,
    verdict: "no-data", verdict_rank: VERDICT_RANK["no-data"], flags: 0, cooked: false, engine_rev: ENGINE_REV, snapshot,
  };
  for (const n of Array.isArray(r.foodNutrients) ? r.foodNutrients : []) {
    const column = NUTRIENT[text(obj(obj(n).nutrient).number)];
    const amount = obj(n).amount;
    if (column && typeof amount === "number" && Number.isFinite(amount)) row[column] = amount;
  }
  try {
    const a = assessProduct({ name: row.name, category: "", ingredients, source: { foodCategory: row.category }, additiveCodes: [] });
    row.verdict = a.verdict;
    row.verdict_rank = VERDICT_RANK[a.verdict];
    row.flags = a.flags.length + a.concerns.filter(c => c.kind === "food").length;
    row.cooked = a.concerns.some(c => c.kind === "cooking");
  } catch { /* keep "no-data": the app computes the badge itself when the page opens */ }
  return row;
}

/** One row per barcode: the record with the newest modified date wins (a tie goes to the later record). */
export function keepNewest(rows: Map<string, { row: FoodRow; modified: string }>, row: FoodRow, modified: string): void {
  const old = rows.get(row.barcode_key);
  if (!old || modified >= old.modified) rows.set(row.barcode_key, { row, modified });
}

/** After a full import, removes rows from older snapshots `batch` at a time (one DELETE over the whole table hits the
 *  free tier's statement timeout); the snapshot index makes each "any older left?" check cheap. Returns the count. */
export async function deleteOlderSnapshots(db: { from(table: string): any }, snapshot: string, batch = 500): Promise<number> {
  let removed = 0;
  for (;;) {
    const { data, error } = await db.from("foods").select("barcode_key").lt("snapshot", snapshot).limit(batch);
    if (error) throw error;
    if (!data?.length) return removed;
    const { error: e } = await db.from("foods").delete().in("barcode_key", data.map((r: { barcode_key: string }) => r.barcode_key));
    if (e) throw e;
    removed += data.length;
  }
}

/**
 * For text shaped {"BrandedFoods":[{...},{...}]}: returns a function to feed chunks to, which calls `onRecord` with the
 * JSON text of each record (brace depth 2) however the text is chunked. Braces inside strings are ignored.
 */
export function recordSplitter(onRecord: (json: string) => void): (chunk: string) => void {
  let depth = 0, inStr = false, esc = false, collecting = false;
  let buf: string[] = [];
  return (s: string) => {
    let from = collecting ? 0 : -1;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (inStr) { if (esc) esc = false; else if (c === 92) esc = true; else if (c === 34) inStr = false; continue; }
      if (c === 34) { inStr = true; continue; }
      if (c === 123) { depth++; if (depth === 2) { collecting = true; from = i; } }
      else if (c === 125) {
        if (depth === 2) { buf.push(s.slice(from, i + 1)); onRecord(buf.join("")); buf = []; collecting = false; from = -1; }
        depth--;
      }
    }
    if (collecting) buf.push(s.slice(from));
  };
}

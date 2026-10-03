import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { keepNewest, recordSplitter, usdaDate, usdaRecordToRow, ENGINE_REV, deleteOlderSnapshots } from "./foodsImport.ts";
import { dbNutrition } from "./nutrition.ts";
import type { FoodRow } from "./foods.ts";

/** A Branded Foods download record (the shape of FoodData_Central_branded_food_json_*.json). */
const rec = (over: Record<string, unknown> = {}) => ({
  fdcId: 2500691, gtinUpc: "044000032029", description: "CHOCOLATE SANDWICH COOKIES, CHOCOLATE", brandName: "OREO",
  brandOwner: "Nabisco Biscuit Company", ingredients: "INGREDIENTS: UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, SALT.",
  brandedFoodCategory: "Cookies & Biscuits", servingSize: 34, servingSizeUnit: "g", householdServingFullText: "3 cookies",
  modifiedDate: "2023-03-16", marketCountry: "United States",
  foodNutrients: [
    { type: "FoodNutrient", nutrient: { id: 1093, number: "307", name: "Sodium, Na", unitName: "mg" }, amount: 382 },
    { type: "FoodNutrient", nutrient: { id: 1235, number: "539", name: "Sugars, added", unitName: "g" }, amount: 41.2 },
    { type: "FoodNutrient", nutrient: { id: 1258, number: "606", name: "Fatty acids, total saturated", unitName: "g" }, amount: 5.88 },
    { type: "FoodNutrient", nutrient: { id: 1003, number: "203", name: "Protein", unitName: "g" }, amount: 4 },
  ],
  ...over,
});

test("a record becomes a row: key, tidy text, serving, the three nutrients, and the engine's level", () => {
  const row = usdaRecordToRow(rec(), "2025-12-18")!;
  assert.equal(row.barcode_key, "44000032029");
  assert.equal(row.barcode, "044000032029");
  assert.equal(row.fdc_id, 2500691);
  assert.equal(row.name, "Chocolate Sandwich Cookies, Chocolate");
  assert.equal(row.brand, "Oreo");
  assert.equal(row.category, "Cookies & Biscuits");
  assert.equal(row.ingredients, "UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN), SUGAR, PALM OIL, SALT.");
  assert.deepEqual([row.serving_size, row.serving_unit, row.serving_text], [34, "g", "3 cookies"]);
  assert.deepEqual([row.added_sugar_100g, row.sat_fat_100g, row.sodium_100g], [41.2, 5.88, 382]);
  assert.deepEqual([row.verdict, row.verdict_rank, row.flags, row.cooked, row.engine_rev, row.snapshot], ["none", 0, 0, true, ENGINE_REV, "2025-12-18"]);
});

test("the stored nutrition reproduces the Oreo label: 14 g added sugar, 28% DV, High", () => {
  const n = dbNutrition(usdaRecordToRow(rec(), "2025-12-18")!)!;
  assert.equal(n.serving, "3 cookies (34 g)");
  assert.deepEqual([n.nutrients[0].amount, n.nutrients[0].dv, n.nutrients[0].level], [14, 28, "high"]);
});

test("the level comes from the app's own engine: processed meat with nitrite reads Known, with two findings", () => {
  const row = usdaRecordToRow(rec({ description: "BEEF FRANKS", brandedFoodCategory: "Sausages, Hotdogs & Brats",
    ingredients: "BEEF, WATER, SALT, SODIUM NITRITE." }), "2025-12-18")!;
  assert.deepEqual([row.verdict, row.verdict_rank, row.flags, row.cooked], ["known", 3, 2, false]);
});

// Review Focus: records the table must not hold.
test("no barcode, a zero-only barcode, no ingredients, no id or junk give no row", () => {
  assert.equal(usdaRecordToRow(rec({ gtinUpc: "" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ gtinUpc: "0000-0000" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ ingredients: "  " }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ ingredients: "INGREDIENTS:" }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(rec({ fdcId: undefined }), "2025-12-18"), null);
  assert.equal(usdaRecordToRow(null, "2025-12-18"), null);
  assert.equal(usdaRecordToRow("<html>", "2025-12-18"), null);
});

test("a barcode keeps only its digits; odd or missing nutrients and serving data are tolerated", () => {
  const row = usdaRecordToRow(rec({ gtinUpc: " 0 44000-032029 ", servingSize: "n/a", servingSizeUnit: undefined, householdServingFullText: undefined,
    foodNutrients: [{ nutrient: { number: "307" }, amount: "lots" }, { nutrient: { number: "999" }, amount: 3 }, null, { amount: 1 }] }), "2025-12-18")!;
  assert.deepEqual([row.barcode, row.barcode_key], ["044000032029", "44000032029"]);
  assert.deepEqual([row.serving_size, row.serving_unit, row.serving_text], [null, "", ""]);
  assert.deepEqual([row.added_sugar_100g, row.sat_fat_100g, row.sodium_100g], [null, null, null]);
  assert.equal(dbNutrition(row), null, "no nutrients stored → no nutrition section");
});

// The download writes dates as month/day/year ("3/22/2018" in the December 2025 file), which don't sort as text:
// "9/1/2019" > "11/2/2022" letter by letter. They must be turned into YYYY-MM-DD before anyone compares them.
test("usdaDate: month/day/year becomes sortable YYYY-MM-DD; ISO is kept; anything else is empty", () => {
  assert.equal(usdaDate("3/22/2018"), "2018-03-22");
  assert.equal(usdaDate(" 11/2/2022 "), "2022-11-02");
  assert.equal(usdaDate("2025-12-18"), "2025-12-18");
  assert.equal(usdaDate("2025-12-18T00:00:00Z"), "2025-12-18");
  for (const bad of ["", "soon", "13", undefined, null, 20250101]) assert.equal(usdaDate(bad), "");
  assert.ok(usdaDate("9/1/2019") < usdaDate("11/2/2022"), "as dates, 2019 is older than 2022");
});

// Review Focus: USDA lists a barcode more than once (4.5% of the December 2025 file); the newest label must win.
test("keepNewest: the newest record per barcode wins, in either order; a tie goes to the later record", () => {
  const old = usdaRecordToRow(rec({ fdcId: 1 }), "2025-12-18")!;
  const recent = usdaRecordToRow(rec({ fdcId: 2 }), "2025-12-18")!;
  const [oldDay, recentDay] = [usdaDate("9/1/2019"), usdaDate("11/2/2022")];
  const a = new Map<string, { row: FoodRow; modified: string }>();
  keepNewest(a, old, oldDay); keepNewest(a, recent, recentDay);
  const b = new Map<string, { row: FoodRow; modified: string }>();
  keepNewest(b, recent, recentDay); keepNewest(b, old, oldDay);
  assert.deepEqual([a.get(old.barcode_key)!.row.fdc_id, b.get(old.barcode_key)!.row.fdc_id], [2, 2]);
  keepNewest(b, old, recentDay);
  assert.equal(b.get(old.barcode_key)!.row.fdc_id, 1, "a tie goes to the later record");
  assert.equal(a.size, 1);
});

test("the import script, dry-run on the sample file: one row per barcode, label-less records skipped, nothing written", () => {
  const script = fileURLToPath(new URL("../../scripts/import-usda.mjs", import.meta.url));
  const sample = fileURLToPath(new URL("./fixtures/usda-download/sample-branded_2025-12-18.json", import.meta.url));
  const out = execFileSync(process.execPath, [script, sample, "--dry-run"], { encoding: "utf8" });
  assert.match(out, /Snapshot 2025-12-18: 4 records, 2 products kept/);
  assert.match(out, /1 without a barcode or ingredients/);
  assert.match(out, /"none":1,"known":1/);
  assert.match(out, /Dry run: nothing was written/);
});

// ── The streaming splitter ───────────────────────────────────────────────────

// Braces and quotes inside strings, an escaped quote, a string ending in an escaped backslash, nesting.
const DOC = String.raw`{"BrandedFoods": [
{"a":"x}{\"y","n":{"b":[1,2,{"c":"}"}]}},
{"p":"C:\\"},
{"a":2}
]}`;
const WANT = [String.raw`{"a":"x}{\"y","n":{"b":[1,2,{"c":"}"}]}}`, String.raw`{"p":"C:\\"}`, `{"a":2}`];

function split(chunks: string[]): string[] {
  const out: string[] = [];
  const feed = recordSplitter(json => out.push(json));
  chunks.forEach(feed);
  return out;
}

test("the splitter returns each record whole, however the text is chunked", () => {
  assert.deepEqual(split([DOC]), WANT);
  assert.deepEqual(split([...DOC]), WANT, "one character at a time");
  for (let i = 1; i < DOC.length; i++) assert.deepEqual(split([DOC.slice(0, i), DOC.slice(i)]), WANT, `split at ${i}`);
  for (const r of split([DOC])) JSON.parse(r);
});

test("the splitter finds nothing in an empty list or in text with no records", () => {
  assert.deepEqual(split([`{"BrandedFoods": []}`]), []);
  assert.deepEqual(split([""]), []);
});

// One DELETE over the whole table timed out on the free tier (statement timeout) at the end of the first real import.
test("older snapshots are deleted in small batches until none are left; current rows stay", async () => {
  let rows = [
    ...Array.from({ length: 1203 }, (_, i) => ({ barcode_key: `old${i}`, snapshot: "2025-12-18" })),
    ...Array.from({ length: 5 }, (_, i) => ({ barcode_key: `new${i}`, snapshot: "2026-04-30" })),
  ];
  const deletes: number[] = [];
  const db = {
    from: () => ({
      select: () => ({ lt: (_c: string, v: string) => ({ limit: async (n: number) =>
        ({ data: rows.filter(r => r.snapshot < v).slice(0, n).map(r => ({ barcode_key: r.barcode_key })), error: null }) }) }),
      delete: () => ({ in: async (_c: string, keys: string[]) => {
        deletes.push(keys.length); rows = rows.filter(r => !keys.includes(r.barcode_key)); return { error: null };
      } }),
    }),
  };
  assert.equal(await deleteOlderSnapshots(db, "2026-04-30", 500), 1203);
  assert.deepEqual(deletes, [500, 500, 203]);
  assert.deepEqual(rows.map(r => r.snapshot), Array(5).fill("2026-04-30"));
  assert.equal(await deleteOlderSnapshots(db, "2026-04-30", 500), 0, "nothing older: one cheap check, no delete");
  assert.equal(deletes.length, 3);
});

test("a failed batch stops the cleanup with its error", async () => {
  const db = { from: () => ({ select: () => ({ lt: () => ({ limit: async () => ({ data: null, error: new Error("timeout") }) }) }) }) };
  await assert.rejects(deleteOlderSnapshots(db, "2026-04-30"), /timeout/);
});

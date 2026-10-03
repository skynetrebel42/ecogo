// lookup.ts — find a barcode that isn't in the catalog. EcoGo's own copy of USDA FoodData Central first (the `foods`
// table: label data supplied by manufacturers), then Open Food Facts (crowd-sourced, live). Spec:
// docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md. The database is passed in (see foods.ts), and the app's
// own modules are imported without the browser, so Node tests can load this module.
import type { Product, ProductSource } from "./productImporter.ts";
import { offNutrition, record, type Nutrition } from "./nutrition.ts";
import { foodRowToProduct, type FoodsSource } from "./foods.ts";

export type LookupResult =
  | { status: "found"; product: Product }
  | { status: "not-found" }
  | { status: "error"; message: string };

const OFF = "https://world.openfoodfacts.org/api/v3/product/";
const OFF_FIELDS = "code,product_name,product_name_en,brands,lang,ingredients_text,ingredients_text_en,additives_tags,categories_tags,nutriments,serving_size";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// ── Barcodes ─────────────────────────────────────────────────────────────────

/** Digits only: " 0 49000-042566 " → "049000042566". */
export const normalizeBarcode = (raw: string) => raw.replace(/\D/g, "");
/** UPC-E (8) up to GTIN-14. */
export const isBarcode = (code: string) => code.length >= 8 && code.length <= 14;
/** The `foods` table's key: digits without leading zeros, so a 12-digit UPC and its 14-digit form are one product. */
export const barcodeKey = (code: string) => normalizeBarcode(code).replace(/^0+/, "");
/** Same product code, ignoring spaces, dashes and leading zeros (12-digit UPC vs 13/14-digit forms). */
export function sameBarcode(a: string, b: string): boolean {
  const x = barcodeKey(a);
  return x !== "" && x === barcodeKey(b);
}

/** ALL-CAPS label text → "Lay's, Classic Potato Chips"; text with any lowercase letter is left alone. */
export const tidyCase = (s: string) =>
  /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s,(/&-])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase());

function toProduct(code: string, name: string, brand: string, ingredients: string, source: ProductSource): Product {
  return {
    id: -Number(barcodeKey(code)), // catalog ids are positive, so a looked-up product never collides with one
    barcode: code, name: name || "Unnamed product", brand, category: "", description: "", ingredients,
    imageUrl: "", keywords: [], source,
  };
}

// ── EcoGo's copy of USDA FoodData Central ────────────────────────────────────

async function fetchFood(code: string, foods: FoodsSource): Promise<LookupResult> {
  const row = await foods.byBarcode(barcodeKey(code));
  return row ? { status: "found", product: foodRowToProduct(row) } : { status: "not-found" };
}

export type SearchResult = { status: "ok"; products: Product[] } | { status: "error"; message: string };
const searchCache = new Map<string, Promise<SearchResult>>();

/** USDA products matching a text search (up to 10); one request per text per session; errors aren't cached. */
export function searchFoods(text: string, opts: { foods: FoodsSource }): Promise<SearchResult> {
  const q = text.toLowerCase().trim().replace(/\s+/g, " ");
  if (!q) return Promise.resolve({ status: "ok", products: [] });
  const hit = searchCache.get(q);
  if (hit) return hit;
  const pending: Promise<SearchResult> = opts.foods.search(q, 10)
    .then(rows => ({ status: "ok" as const, products: rows.map(foodRowToProduct) }))
    .catch((err: unknown) => ({ status: "error" as const, message: err instanceof Error ? err.message : String(err) }));
  searchCache.set(q, pending);
  pending.then(r => { if (r.status === "error") searchCache.delete(q); });
  return pending;
}

// ── Open Food Facts ──────────────────────────────────────────────────────────

/** Open Food Facts pages where a user, signed in with their own OFF account, can fix a product or add a missing one
 *  (values or a label photo; OFF's own AI reads nutrition from photos). EcoGo itself never writes to OFF. */
export const offEditUrl = (code: string) => `https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${normalizeBarcode(code)}`;
export const offAddUrl = (code: string) =>
  `https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=${normalizeBarcode(code)}`;

/** Pure: an OFF v3 response body plus its HTTP status → our result. */
export function mapOffResponse(json: unknown, httpStatus: number): LookupResult {
  if (httpStatus === 404) return { status: "not-found" };
  if (httpStatus !== 200) return { status: "error", message: `Open Food Facts returned HTTP ${httpStatus}` };
  const body = record(json);
  if (body.status !== "success" && body.status !== "success_with_warnings") return { status: "not-found" };
  const p = record(body.product);
  const code = normalizeBarcode(str(p.code) || str(body.code));
  const name = str(p.product_name_en) || str(p.product_name);
  const english = str(p.ingredients_text_en);
  const ingredients = english || str(p.ingredients_text);
  if (!code || (!name && !ingredients)) return { status: "not-found" };
  const product = toProduct(code, name, str(p.brands).split(",")[0].trim(), ingredients, {
    name: "Open Food Facts", url: `https://world.openfoodfacts.org/product/${code}`, crowdSourced: true,
    ingredientsLang: english ? "en" : str(p.lang) || "en", additiveCodes: strings(p.additives_tags), categoryTags: strings(p.categories_tags),
  });
  const nutrition = offNutrition(p);
  return { status: "found", product: nutrition ? { ...product, nutrition } : product };
}

async function fetchOff(code: string, f: typeof fetch): Promise<LookupResult> {
  const res = await f(`${OFF}${code}.json?fields=${OFF_FIELDS}`, { headers: { "X-User-Agent": "EcoGo/0.1 (https://github.com/skynetrebel42/ecogo)" } });
  return mapOffResponse(await res.json().catch(() => null), res.status);
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<LookupResult>>();
const nutritionSeen = new Map<string, Nutrition>();

/** Nutrition already fetched this session for a barcode (sync, for list cards); no request is made. */
export const knownNutrition = (barcode: string): Nutrition | null => (barcode ? nutritionSeen.get(barcodeKey(barcode)) ?? null : null);
const safely = (p: Promise<LookupResult>): Promise<LookupResult> =>
  p.catch((err: unknown) => ({ status: "error", message: err instanceof Error ? err.message : String(err) }));

export interface LookupOptions { foods: FoodsSource; fetchImpl?: typeof fetch }

/**
 * Our `foods` table → Open Food Facts → not found. Cached per barcode for the session; errors aren't cached, so Try
 * again can succeed. An unreachable source gives "error", never "not found".
 */
export function lookupBarcode(raw: string, opts: LookupOptions): Promise<LookupResult> {
  const code = normalizeBarcode(raw);
  if (!isBarcode(code)) return Promise.resolve({ status: "not-found" });
  const k = barcodeKey(code);
  const hit = cache.get(k);
  if (hit) return hit;
  const f = opts.fetchImpl ?? fetch;
  let provisional = false; // an OFF find while our database was unreachable: show it, but look again next time
  const pending = (async (): Promise<LookupResult> => {
    const db = await safely(fetchFood(code, opts.foods));
    if (db.status === "found") return db;
    // 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8): OFF answered the Heinz UPC-E
    // 01311501 with a UK store product. Those go to our USDA copy only.
    if (code.length === 8) return db;
    const off = await safely(fetchOff(code, f));
    if (off.status === "found") { provisional = db.status === "error"; return off; }
    return db.status === "error" ? db : off;
  })();
  cache.set(k, pending);
  pending.then(r => {
    if (r.status === "error" || provisional) cache.delete(k);
    if (r.status === "found" && r.product.nutrition) nutritionSeen.set(k, r.product.nutrition);
  });
  return pending;
}

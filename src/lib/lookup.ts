// lookup.ts — find a barcode that isn't in our catalog. USDA FoodData Central first (label data supplied by
// manufacturers), then Open Food Facts (crowd-sourced). Spec: docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md.
// Type-only imports, so Node tests can load this module.
import type { Product, ProductSource } from "./productImporter.ts";

export type LookupResult =
  | { status: "found"; product: Product }
  | { status: "not-found" }
  | { status: "error"; message: string };

const USDA = "https://api.nal.usda.gov/fdc/v1/foods/search";
const OFF = "https://world.openfoodfacts.org/api/v3/product/";
const OFF_FIELDS = "code,product_name,product_name_en,brands,lang,ingredients_text,ingredients_text_en,additives_tags";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const record = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

// ── Barcodes ─────────────────────────────────────────────────────────────────

/** Digits only: " 0 49000-042566 " → "049000042566". */
export const normalizeBarcode = (raw: string) => raw.replace(/\D/g, "");
/** UPC-E (8) up to GTIN-14. */
export const isBarcode = (code: string) => code.length >= 8 && code.length <= 14;
const key = (code: string) => normalizeBarcode(code).replace(/^0+/, "");
/** Same product code, ignoring spaces, dashes and leading zeros (12-digit UPC vs 13/14-digit forms). */
export function sameBarcode(a: string, b: string): boolean {
  const x = key(a);
  return x !== "" && x === key(b);
}

/** ALL-CAPS label text → "Lay's, Classic Potato Chips"; text with any lowercase letter is left alone. */
export const tidyCase = (s: string) =>
  /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s,(/&-])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase());

function toProduct(code: string, name: string, brand: string, ingredients: string, source: ProductSource): Product {
  return {
    id: -Number(key(code)), // catalog ids are positive, so a looked-up product never collides with one
    barcode: code, name: name || "Unnamed product", brand, category: "", description: "", ingredients,
    imageUrl: "", keywords: [], source,
  };
}

// ── USDA FoodData Central ────────────────────────────────────────────────────

/** Pure: a USDA /foods/search body → the food whose gtinUpc is this barcode (newest record wins), or null. */
export function pickUsdaFood(json: unknown, code: string): Product | null {
  const foods = Array.isArray(record(json).foods) ? (record(json).foods as unknown[]).map(record) : [];
  const f = foods
    .filter(x => sameBarcode(str(x.gtinUpc), code)) // the search is full-text: drop anything that isn't this code
    .sort((a, b) => str(b.publishedDate).localeCompare(str(a.publishedDate)))[0];
  if (!f) return null;
  const name = tidyCase(str(f.description));
  const ingredients = str(f.ingredients).replace(/^ingredients:\s*/i, "");
  if (!name && !ingredients) return null;
  return toProduct(str(f.gtinUpc), name, tidyCase(str(f.brandName) || str(f.brandOwner)), ingredients, {
    name: "USDA FoodData Central", url: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
    crowdSourced: false, ingredientsLang: "en", additiveCodes: [],
  });
}

/** USDA stores codes as 8, 12 or 14 digits, so try the typed digits, then the 14-digit form. */
async function fetchUsda(code: string, fdcKey: string, f: typeof fetch): Promise<LookupResult> {
  for (const q of new Set([code, code.padStart(14, "0")])) {
    const res = await f(`${USDA}?api_key=${encodeURIComponent(fdcKey)}&dataType=Branded&pageSize=5&query=${q}`);
    if (!res.ok) return { status: "error", message: `USDA returned HTTP ${res.status}` };
    const product = pickUsdaFood(await res.json().catch(() => null), code);
    if (product) return { status: "found", product };
  }
  return { status: "not-found" };
}

// ── Open Food Facts ──────────────────────────────────────────────────────────

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
  return {
    status: "found",
    product: toProduct(code, name, str(p.brands).split(",")[0].trim(), ingredients, {
      name: "Open Food Facts", url: `https://world.openfoodfacts.org/product/${code}`, crowdSourced: true,
      ingredientsLang: english ? "en" : str(p.lang) || "en", additiveCodes: strings(p.additives_tags),
    }),
  };
}

async function fetchOff(code: string, f: typeof fetch): Promise<LookupResult> {
  const res = await f(`${OFF}${code}.json?fields=${OFF_FIELDS}`, { headers: { "X-User-Agent": "EcoGo/0.1 (personal project)" } });
  return mapOffResponse(await res.json().catch(() => null), res.status);
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<LookupResult>>();
const safely = (p: Promise<LookupResult>): Promise<LookupResult> =>
  p.catch((err: unknown) => ({ status: "error", message: err instanceof Error ? err.message : String(err) }));

/**
 * USDA → Open Food Facts → not found. Cached per barcode for the session (rate limits); errors aren't cached, so
 * Try again can succeed. An unreachable source gives "error", never "not found".
 */
export function lookupBarcode(raw: string, opts: { fdcKey?: string; fetchImpl?: typeof fetch } = {}): Promise<LookupResult> {
  const code = normalizeBarcode(raw);
  if (!isBarcode(code)) return Promise.resolve({ status: "not-found" });
  const k = key(code);
  const hit = cache.get(k);
  if (hit) return hit;
  const f = opts.fetchImpl ?? fetch;
  let fdcKey = opts.fdcKey;
  if (!fdcKey) {
    console.warn("[lookup] VITE_FDC_API_KEY is not set; using USDA's DEMO_KEY (30 lookups an hour)");
    fdcKey = "DEMO_KEY";
  }
  let provisional = false; // an OFF find while USDA was unreachable: show it, but look again next time
  const pending = (async (): Promise<LookupResult> => {
    const usda = await safely(fetchUsda(code, fdcKey, f));
    if (usda.status === "found") return usda;
    // 8-digit codes are ambiguous worldwide (US UPC-E vs store-internal EAN-8): OFF answered the Heinz UPC-E
    // 01311501 with a UK store product. Those go to USDA only.
    if (code.length === 8) return usda;
    const off = await safely(fetchOff(code, f));
    if (off.status === "found") { provisional = usda.status === "error"; return off; }
    return usda.status === "error" ? usda : off;
  })();
  cache.set(k, pending);
  pending.then(r => { if (r.status === "error" || provisional) cache.delete(k); });
  return pending;
}

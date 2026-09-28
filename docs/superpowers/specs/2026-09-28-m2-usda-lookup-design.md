# M2: look up any US food barcode (USDA first): design spec

- **Date:** 2026-09-28
- **Status:** draft, awaiting the owner's review
- **Supersedes:** `2026-09-28-m2-open-food-facts-design.md` and its plan `plans/2026-09-28-m2-open-food-facts.md`
  (Open Food Facts as the main source). The acrylamide note, nutrition section and Baby Food move are **deferred**, not
  dropped; that spec keeps their verified sources for later.
- **Branch:** `m2-open-food-facts` (stacked on `simplify-cuts`; neither merged to `main`).

## 1. Why

The app knows 51 products; any other barcode is a dead end. The owner wants a **diverse product lineup** from a source
people can trust. Open Food Facts is crowd-sourced and worldwide. **USDA FoodData Central "Branded Foods"** is US
government data sent by manufacturers from their own labels (GS1 / GDSN feeds), the same kind of supplier data retail
apps use. So USDA is the main source, and Open Food Facts is only a clearly labelled fallback.

**Done for M2:** scanning (or typing) a real US food barcode shows a product page with the same ingredient check as the
catalog, and every product page says where its data came from.

## 2. Decisions (owner, 2026-09-28, unless marked *recommended default*)

| # | Decision |
|---|---|
| U1 | USDA FoodData Central (Branded) is the primary lookup; Open Food Facts is a fallback labelled "crowd-sourced" |
| U2 | The browser calls USDA directly with the owner's data.gov key in `VITE_FDC_API_KEY` (`.env.local`, host env var at deploy). The key is public by design: read-only public data, limit counted per visitor IP |
| U3 | Deferred: acrylamide cooking note, Nutri-Score/NOVA section, Baby Food category |
| U4 | Fix the catalog's barcodes: the Figma data invented them (below) *(recommended default)* |
| U5 | Looked-up products are not stored in Supabase; scans of them log as unknown barcodes (`product_id` null) *(recommended default)* |
| U6 | Demo picker gets real non-catalog barcodes plus a "type a barcode" field *(recommended default)* |

## 3. Facts this design rests on (checked live 2026-09-28)

- **API:** `GET https://api.nal.usda.gov/fdc/v1/foods/search?api_key=KEY&dataType=Branded&pageSize=5&query=CODE`.
  CORS `Access-Control-Allow-Origin: *` (browser-callable). The owner's key allows 3,600 requests/hour
  (`X-Ratelimit-Limit`); the docs state 1,000/hour per IP by default and a 1-hour block after exceeding it (HTTP 429).
- **Barcodes are stored in mixed forms:** Coca-Cola Zero is `00049000042566` (14 digits) and did **not** match the
  12-digit `049000042566`; Lay's is stored as 12 digits `028400421584`; Heinz has 8-digit UPC-E `01311501`. So the
  client queries the typed digits and the 14-digit zero-padded form, and accepts a hit only when `gtinUpc` equals the
  code after stripping leading zeros (the search is full-text, so non-exact hits come back too).
- **Record fields used:** `fdcId`, `gtinUpc`, `description`, `brandName`, `brandOwner`, `ingredients` (usually
  UPPERCASE; the engine lowercases, so no change needed), `foodCategory`, `marketCountry`, `publishedDate`.
- **The catalog's barcodes are not real.** All 51 were checked: 49 match nothing in USDA; 2 match *other* products
  (Doritos' barcode is Tostitos Bite Size, Oreo's is Wheat Thins Sun Dried Tomato). Name searches find the real
  products (Diet Coke, DiGiorno Rising Crust, Heinz Ketchup, Gerber Puffs), so USDA coverage is fine; the Figma export
  made the numbers up. Today a real Lay's bag scans as "not found".

## 4. Architecture

```
ScanTab ─► catalog match? ─yes─► product page (unchanged)
              │ no
              ▼
          lib/lookup.ts lookupBarcode(code)  (session cache, one Promise per normalized code)
              ├─► USDA  (lib/usda.ts)  found ─► product page, source "USDA"
              └─► OFF   (lib/off.ts)   found ─► product page, source "Open Food Facts (crowd-sourced)"
                                       neither ─► honest not-found screen
```

### Units

1. **`src/lib/usda.ts`** (new; imports only the `Product` type, so Node tests can load it)
   - `mapUsdaSearch(json: unknown, code: string): Product | null`: pure. Picks the exact-`gtinUpc` food; if several,
     the newest `publishedDate`. `null` when none, or when it has neither a name nor ingredients.
   - `fetchUsda(code): Promise<LookupResult>` runs the up-to-2 queries from §3.
2. **`src/lib/off.ts`** (new): `mapOffResponse` + `fetchOff`, as specified in the superseded spec §4.1 (v3 product
   endpoint, `X-User-Agent`, 404/`failure` = not found, empty shell = not found), minus nutrition fields.
3. **`src/lib/lookup.ts`** (new): `normalizeBarcode(input)` (strip spaces/dashes; 8–14 digits, else invalid) and
   `lookupBarcode(code): Promise<LookupResult>` where
   `LookupResult = { status: "found"; product: Product } | { status: "not-found" } | { status: "error"; message: string }`.
   USDA first; on USDA not-found, try OFF. Found and not-found are cached for the session; errors aren't. If USDA
   errors and OFF finds it, show OFF; if both error, show the error state.
4. **`Product` type** gains optional `source?: { name: "USDA FoodData Central" | "Open Food Facts"; url: string;
   crowdSourced: boolean; published?: string }`. Catalog products don't set it. Mapped products: `id = -Number(code)`
   (catalog ids are positive), `category = ""`, no prices, no alternatives.
5. **Safety engine:** `safeAnalyze` passes `category: p.source ? undefined : p.category` (both sources are food-only,
   so the food check applies). Open Food Facts additive codes (`en:e951` → `E951`) go back in as
   `additiveCodes?: string[]`, as in the superseded spec §4.3. USDA has no codes; its ingredient text is enough.
6. **Product page:** a source line under the name: "Label data from USDA FoodData Central · view record" or "Product
   data from Open Food Facts (crowd-sourced, may contain errors) · view on Open Food Facts". OFF also shows
   "Data © Open Food Facts contributors, ODbL", and the language note when ingredients aren't English. Prices and
   alternatives are hidden when absent. The layout is otherwise the Figma one.
7. **Scan flow (`ScanTab.tsx`):** states scanning → found (catalog | lookup) | not found | error ("Couldn't reach the
   product databases. Check your connection and try again", with Retry). Not-found copy replaces the false "saved for
   review… analysed and published": "We couldn't find this barcode in USDA or Open Food Facts yet." The barcode is
   still logged. Demo picker: drop the `UNKNOWN-*` entries, add real non-catalog barcodes (Coca-Cola Zero
   `049000042566` from USDA, one OFF-only product, one absent code) and a "Type a barcode" field (8–14 digits).
8. **App state (`App.tsx`):** a session list of looked-up products, so they show in Saved › Scanned and can be
   favorited (still in-memory, K-16), with no duplicates on re-open.
9. **Catalog barcode fix (U4):** a script (`scripts/find-usda-barcodes.mjs`) prints USDA candidates for each food
   product by name. Candidates are picked by hand (same product, closest pack size) and shown to the owner as a
   table before anything changes. Then one migration updates `products.barcode`, `products.csv` is updated to match,
   and the demo picker uses the real codes. Catalog ingredient text and the 51 hand-reviewed flags stay as they are.
   Non-food products (not in USDA) keep their codes, marked unverified in KNOWN_ISSUES.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| Offline, DNS, 5xx, 429 | Error state with Retry; never shown as "not found"; not cached |
| USDA has it, no ingredients | Product page, verdict "Not enough data" |
| Several USDA records for one barcode | Newest `publishedDate` |
| Missing `VITE_FDC_API_KEY` | Fall back to `DEMO_KEY` and log a console warning (30 lookups/hour) |
| Typed input not 8–14 digits | Inline "Enter the 8–14 digits under the barcode"; no request |
| Engine throws | Existing `safeAnalyze` fallback |

## 6. Testing

- `usda.test.ts` on **recorded** responses in `src/lib/fixtures/usda/` (no network in tests): Coca-Cola Zero found
  with aspartame in the ingredients; a full-text non-exact hit is rejected; an empty result is not found; newest record
  wins; negative id.
- `off.test.ts`: found, not found, empty shell, additive codes (from the superseded spec §6).
- `lookup.test.ts`: `normalizeBarcode` (spaces, dashes, 12 vs 13 vs 14 digits, junk); USDA-then-OFF order; caching
  (a second lookup makes no request); errors not cached. Uses injected fake fetchers, not the network.
- `analyze.test.ts`: additive codes flag; codes alone count as analyzed.
- `catalog.test.ts`: still 51 products and the same flags after the barcode fix.
- Browser: Coca-Cola Zero via the type-a-barcode field shows amber (aspartame) and the USDA source line; a real
  catalog barcode opens the catalog product; the absent code shows not found; offline shows the error with Retry;
  Saved › Scanned has no duplicates; no console errors.

## 7. Out of scope

Camera scanning (M4), deploy (M3), storing looked-up products, nutrition, acrylamide, non-food lookups, contributing
to Open Food Facts.

## 8. Pre-launch checklist additions

- Set `VITE_FDC_API_KEY` on the host. If the key is abused, regenerate it (free, instant).
- Credit USDA FoodData Central on product pages (done by the source line) and re-check its citation guidance.

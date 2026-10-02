// productImporter.ts — products.csv → Product[], and the canonical Product type.
//
// The live catalog comes from Supabase (catalog.ts). This parses the bundled src/data/products.csv: the offline
// fallback (App.tsx) and the test fixture (src/lib/safety/catalog.test.ts). The CSV has one row per product and store;
// rows sharing an id are one product, read from its first row. No imports, so Node tests and
// scripts/apply-verified-barcodes.mjs can load it.

/** Where a looked-up product's data came from. Catalog products never set it. */
export interface ProductSource {
  name: "USDA FoodData Central" | "Open Food Facts";
  url: string;             // the record's public page (credit + "view record" link)
  crowdSourced: boolean;   // true for Open Food Facts
  ingredientsLang: string; // "en", or the label's language when no English text exists
  additiveCodes: string[]; // Open Food Facts additive tags, e.g. "en:e951"; always [] for USDA
  foodCategory?: string;   // USDA only, e.g. "Chips, Pretzels & Snacks" (drives the food-level checks)
  categoryTags?: string[]; // Open Food Facts only, e.g. ["en:snacks", "en:potato-crisps"]
}

/** The canonical Product shape consumed by the rest of the application. */
export interface Product {
  id: number;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  ingredients: string;
  imageUrl: string;
  keywords: string[];
  source?: ProductSource;
  nutrition?: import("./nutrition.ts").Nutrition; // per serving, for looked-up products (catalog: fetched by barcode)
}

/** Split one CSV line into fields: quoted fields keep their commas, and "" inside quotes is a literal quote. */
export function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { fields.push(current); current = ""; }
    else current += ch;
  }
  fields.push(current);
  return fields;
}

/** products.csv text → products sorted by id. Blank lines, repeated headers and rows without a positive id or a
 *  name are skipped. */
export function parseProductsCSV(csvText: string): Product[] {
  const lines = csvText.replace(/\r\n?/g, "\n").split("\n");
  const header = lines[0].trim();
  const columns = splitCSVLine(lines[0]).map(c => c.trim());
  const firstRowById = new Map<string, Record<string, string>>();
  for (const line of lines.slice(1)) {
    if (!line.trim() || line.trim() === header) continue;
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    columns.forEach((c, i) => { row[c] = values[i]?.trim() ?? ""; });
    if (!(parseInt(row.id, 10) > 0) || !row.product_name) continue;
    if (!firstRowById.has(row.id)) firstRowById.set(row.id, row);
  }
  return [...firstRowById.values()].map(r => ({
    id:          parseInt(r.id, 10),
    barcode:     r.barcode ?? "",
    name:        r.product_name,
    brand:       r.brand ?? "",
    category:    r.category ?? "",
    description: r.description ?? "",
    ingredients: r.ingredients ?? "",
    imageUrl:    r.image_url ?? "",
    keywords:    (r.keywords ?? "").split("|").map(k => k.trim()).filter(Boolean),
  })).sort((a, b) => a.id - b.id);
}

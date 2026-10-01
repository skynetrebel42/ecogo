// search.ts — catalog search: every typed word must appear as a WHOLE word (plurals either way) in the product's name,
// brand, category or keywords. Replaces substring matching, which made "ice cream" find "juice", "iced tea" and "rice".
// Type-only imports, so Node tests can load this module.
import type { Product } from "./productImporter.ts";

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
/** "chips" → "chip", "cookies" → "cookie"; short words and "-ss" words ("glass") are kept. */
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

export function searchCatalog(products: Product[], query: string): Product[] {
  const wanted = words(query).map(stem);
  if (wanted.length === 0) return [];
  return products.filter(p => {
    const have = new Set(words([p.name, p.brand, p.category, ...p.keywords].join(" ")).map(stem));
    return wanted.every(w => have.has(w));
  });
}

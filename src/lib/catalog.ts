// catalog.ts — reads the product catalog and community resources from Supabase.
//
// Schema: supabase/migrations/20260923221344_catalog_schema.sql. Rows are mapped
// into the same Product shape the CSV importer produces. The legacy score
// columns stay in the DB but are not read (the safety verdict replaced them in M1), and neither are the invented
// product_prices rows (K-30; the UI stopped showing prices in M7.4).

import { supabase } from "./supabase";
import type { Product } from "./productImporter";

interface ProductRow {
  id: number;
  barcode: string | null;
  name: string;
  brand: string;
  description: string;
  ingredients: string;
  image_url: string;
  keywords: string[];
  categories: { name: string } | null;
}

export interface ResourceRow {
  id: number;
  name: string;
  type: string;
  address: string;
  hours: string;
  phone: string | null;
  description: string;
  latitude: number;
  longitude: number;
  rating: number | null;
}

const PRODUCT_COLUMNS = "id, barcode, name, brand, description, ingredients, image_url, keywords, categories(name)";

export function rowToProduct(row: ProductRow): Product {
  return {
    id:          row.id,
    barcode:     row.barcode ?? "",
    name:        row.name,
    brand:       row.brand,
    category:    row.categories?.name ?? "",
    description: row.description,
    ingredients: row.ingredients,
    imageUrl:    row.image_url,
    keywords:    row.keywords,
  };
}

/** Fetch products and resources in parallel. Throws if either query fails. */
export async function loadCatalog(): Promise<{ products: Product[]; resources: ResourceRow[] }> {
  const [products, resources] = await Promise.all([
    supabase.from("products").select(PRODUCT_COLUMNS).order("id"),
    supabase.from("resources").select("*").order("id"),
  ]);
  if (products.error) throw products.error;
  if (resources.error) throw resources.error;
  return {
    products:  (products.data as unknown as ProductRow[]).map(rowToProduct),
    resources: resources.data as ResourceRow[],
  };
}

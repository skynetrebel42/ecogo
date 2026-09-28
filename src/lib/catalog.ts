// catalog.ts — reads the product catalog and community resources from Supabase.
//
// Schema: supabase/migrations/20260923221344_catalog_schema.sql. Rows are mapped
// into the same Product shape the CSV importer produces. The legacy score
// columns stay in the DB but are not read (the safety verdict replaced them in M1).

import { supabase } from "./supabase";
import type { Product } from "./productImporter";

interface PriceRow {
  store: "amazon" | "walmart" | "facebook";
  price: number;
  rating: number | null;
  condition: string | null;
}

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
  product_prices: PriceRow[];
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

const PRODUCT_COLUMNS =
  "id, barcode, name, brand, description, ingredients, image_url, keywords, " +
  "categories(name), product_prices(store, price, rating, condition)";

export function rowToProduct(row: ProductRow): Product {
  const price = (store: PriceRow["store"]) => row.product_prices.find((p) => p.store === store);
  const amazon = price("amazon"), walmart = price("walmart"), facebook = price("facebook");

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

    amazon:   amazon   ? { price: amazon.price,   rating: amazon.rating ?? 0 }       : undefined,
    walmart:  walmart  ? { price: walmart.price,  rating: walmart.rating ?? 0 }      : undefined,
    facebook: facebook ? { price: facebook.price, condition: facebook.condition ?? "" } : undefined,
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

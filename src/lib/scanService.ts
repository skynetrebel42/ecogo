// ─────────────────────────────────────────────────────────────────────────────
// scanService.ts — Barcode scan pipeline
//
// Responsibilities:
//   1. Look up a scanned barcode against the local product database.
//   2. Record every scan event (product found or not) to persistent storage.
//   3. Create placeholder entries for unrecognised barcodes so they can be
//      reviewed and enriched later, enabling crowd-sourced database growth.
//   4. Provide read access to the full scan history and placeholder queue.
//
// Supabase storage: scan events are persisted via the edge function to the
// `scan_history` key in kv_store. Placeholders are flagged entries inside
// that same collection.
// ─────────────────────────────────────────────────────────────────────────────

import { SERVER } from "./supabase";
import type { Product } from "./productImporter";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single barcode scan event stored in the database. */
export interface ScanEvent {
  /** Auto-assigned integer primary key. */
  id: number;
  /** Raw barcode string captured by the scanner. */
  barcode: string;
  /** Matched product ID, or null if the barcode was not found in the database. */
  product_id: number | null;
  /** Product name at time of scan (snapshot, survives product renames). */
  product_name: string;
  /** Store where the best price was found at time of scan. */
  store: string;
  /** Best price at time of scan, or null if unknown. */
  price: number | null;
  /** ISO 8601 UTC timestamp — when the scan occurred. */
  scanned_at: string;
  /** GPS latitude, or null if location was unavailable / denied. */
  latitude: number | null;
  /** GPS longitude, or null if location was unavailable / denied. */
  longitude: number | null;
  /**
   * True when the barcode did not match any known product.
   * Placeholder entries appear in the admin review queue so the database
   * can be enriched by future contributors.
   */
  is_placeholder: boolean;
  /** Free-text note attached to the scan (e.g. "Seen at Costco"). */
  note: string;
}

/** Aggregated view of an unrecognised barcode. */
export interface PlaceholderSummary {
  barcode: string;
  scan_count: number;
  first_seen: string;
  last_seen: string;
  locations: Array<{ lat: number; lng: number }>;
}

/** Statistics returned by the stats endpoint. */
export interface ScanStats {
  total_scans: number;
  unique_products: number;
  unknown_barcodes: number;
  scans_today: number;
  most_scanned_product: string | null;
}

// ─── Geolocation ──────────────────────────────────────────────────────────────

/**
 * Request the device's current position.
 * Returns null when the API is unavailable or the user denies the permission.
 * Resolves immediately with null rather than hanging — the caller should not
 * block the scan flow on geolocation.
 */
export function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60_000 }
    );
  });
}

// ─── Barcode Lookup ───────────────────────────────────────────────────────────

/**
 * Look up a scanned barcode in the local product array.
 *
 * Matching rules (in priority order):
 *   1. Exact match on `product.barcode`
 *   2. Case-insensitive match after trimming whitespace
 *
 * Returns null when no product matches — the caller should then call
 * `createPlaceholder()` to queue the barcode for later review.
 */
export function findProductByBarcode(
  barcode: string,
  products: Product[]
): Product | null {
  if (!barcode?.trim()) return null;
  const normalised = barcode.trim();
  return (
    products.find((p) => p.barcode === normalised) ??
    products.find((p) => p.barcode.toLowerCase() === normalised.toLowerCase()) ??
    null
  );
}

/**
 * Derive the "best store" label and price from a product for scan-event storage.
 * Prefers the cheapest listed price across all stores.
 */
function bestStorePrice(product: Product): { store: string; price: number | null } {
  const options: Array<{ store: string; price: number }> = [];
  if (product.amazon)   options.push({ store: "amazon",   price: product.amazon.price });
  if (product.walmart)  options.push({ store: "walmart",  price: product.walmart.price });
  if (product.facebook) options.push({ store: "facebook", price: product.facebook.price });

  if (options.length === 0) return { store: "unknown", price: null };
  return options.reduce((best, cur) => cur.price < best.price ? cur : best);
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[scanService] GET ${path} failed:`, err);
    return null;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[scanService] POST ${path} failed:`, err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a successful scan of a known product.
 *
 * This is a fire-and-forget operation from the UI's perspective — the product
 * detail screen opens immediately and the event is persisted in the background.
 * Failures are logged but never surfaced to the user.
 */
export async function recordProductScan(
  product: Product,
  location: { lat: number; lng: number } | null,
  note = ""
): Promise<ScanEvent | null> {
  const { store, price } = bestStorePrice(product);

  const event: Omit<ScanEvent, "id"> = {
    barcode:       product.barcode,
    product_id:    product.id,
    product_name:  product.name,
    store,
    price,
    scanned_at:    new Date().toISOString(),
    latitude:      location?.lat  ?? null,
    longitude:     location?.lng  ?? null,
    is_placeholder: false,
    note,
  };

  return apiPost<ScanEvent>("/commons/scan-history", event);
}

/**
 * Record a scan of an unrecognised barcode as a placeholder.
 *
 * Placeholder entries accumulate in the review queue. Each additional scan
 * of the same barcode increments the scan count, signalling which unknown
 * products have the highest demand for addition to the database.
 *
 * A future product reviewer can:
 *   1. Retrieve the placeholder queue via `getPlaceholders()`
 *   2. Look up the barcode externally (Open Food Facts, UPC lookup, etc.)
 *   3. Add the product to the CSV and link the barcode
 */
export async function createPlaceholder(
  barcode: string,
  location: { lat: number; lng: number } | null,
  note = ""
): Promise<ScanEvent | null> {
  const event: Omit<ScanEvent, "id"> = {
    barcode,
    product_id:    null,
    product_name:  "Unknown Product",
    store:         "unknown",
    price:         null,
    scanned_at:    new Date().toISOString(),
    latitude:      location?.lat  ?? null,
    longitude:     location?.lng  ?? null,
    is_placeholder: true,
    note,
  };

  return apiPost<ScanEvent>("/commons/scan-history", event);
}

/** Retrieve the full scan history, newest first. */
export async function getScanHistory(): Promise<ScanEvent[]> {
  const data = await apiGet<ScanEvent[]>("/commons/scan-history");
  return (data ?? []).sort(
    (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
  );
}

/** Retrieve aggregated statistics about the scan database. */
export async function getScanStats(): Promise<ScanStats | null> {
  return apiGet<ScanStats>("/commons/scan-history/stats");
}

/**
 * Retrieve all placeholder entries, grouped and sorted by scan count descending.
 * The product with the most scans is the highest-priority candidate for addition.
 */
export async function getPlaceholders(): Promise<PlaceholderSummary[]> {
  return (await apiGet<PlaceholderSummary[]>("/commons/scan-history/placeholders")) ?? [];
}

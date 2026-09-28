// ─────────────────────────────────────────────────────────────────────────────
// scanService.ts — Barcode scan pipeline
//
// Responsibilities:
//   1. Look up a scanned barcode against the local product database.
//   2. Record every scan event (product found or not) in the `scan_events` table.
//   3. Barcodes not in the catalog (looked up in USDA / Open Food Facts, or not
//      found at all) are recorded with product_id = null.
//
// Supabase storage: browsers may only INSERT scans (see supabase/migrations);
// scan history can never be read back by clients, and locations are rounded
// to ~100 m before they leave the device.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { Product } from "./productImporter";
import { sameBarcode } from "./lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type Store = "amazon" | "walmart" | "facebook";

/** A scan event as recorded by this client. */
export interface ScanEvent {
  /** Raw barcode string captured by the scanner. */
  barcode: string;
  /** Matched product ID, or null if the barcode was not found in the database. */
  product_id: number | null;
  /** Store with the best price at time of scan, or null if unknown. */
  store: Store | null;
  /** Best price at time of scan, or null if unknown. */
  price: number | null;
  /** Latitude rounded to 3 decimals, or null if location was unavailable / denied. */
  latitude: number | null;
  /** Longitude rounded to 3 decimals, or null if location was unavailable / denied. */
  longitude: number | null;
  /** Client clock, for display only (the database stamps its own scanned_at). */
  scanned_at: string;
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

/** Look up a barcode in the catalog: same digits, ignoring spaces, dashes and leading zeros (12- vs 13/14-digit forms). */
export function findProductByBarcode(barcode: string, products: Product[]): Product | null {
  return products.find((p) => sameBarcode(p.barcode, barcode)) ?? null;
}

/**
 * Derive the "best store" label and price from a product for scan-event storage.
 * Prefers the cheapest listed price across all stores.
 */
function bestStorePrice(product: Product): { store: Store | null; price: number | null } {
  const options: Array<{ store: Store; price: number }> = [];
  if (product.amazon)   options.push({ store: "amazon",   price: product.amazon.price });
  if (product.walmart)  options.push({ store: "walmart",  price: product.walmart.price });
  if (product.facebook) options.push({ store: "facebook", price: product.facebook.price });

  if (options.length === 0) return { store: null, price: null };
  return options.reduce((best, cur) => cur.price < best.price ? cur : best);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Round to 3 decimals (~110 m) so a stored scan never pinpoints a person. */
const coarsen = (degrees: number) => Math.round(degrees * 1000) / 1000;

async function recordScan(
  barcode: string,
  product_id: number | null,
  { store, price }: { store: Store | null; price: number | null },
  location: { lat: number; lng: number } | null
): Promise<ScanEvent | null> {
  const row = {
    barcode,
    product_id,
    store,
    price,
    latitude:  location ? coarsen(location.lat) : null,
    longitude: location ? coarsen(location.lng) : null,
  };
  const { error } = await supabase.from("scan_events").insert(row);
  if (error) {
    console.warn("[scanService] scan not saved:", error.message);
    return null;
  }
  return { ...row, scanned_at: new Date().toISOString() };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Record a scan of a known product. Failures are logged and return null. */
export function recordProductScan(
  product: Product,
  location: { lat: number; lng: number } | null
): Promise<ScanEvent | null> {
  return recordScan(product.barcode, product.id, bestStorePrice(product), location);
}

/**
 * Record a scan of an unrecognised barcode (product_id = null).
 *
 * Unknown barcodes accumulate as a review queue. A future product reviewer can
 * query `scan_events where product_id is null` (dashboard / service role),
 * look the barcode up externally, and add the product to the catalog.
 */
export function createPlaceholder(
  barcode: string,
  location: { lat: number; lng: number } | null
): Promise<ScanEvent | null> {
  return recordScan(barcode, null, { store: null, price: null }, location);
}

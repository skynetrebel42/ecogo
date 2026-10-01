// recent.ts — "Recently scanned": the last 10 products opened, kept on this device only.
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.1.

import type { Product } from "./productImporter.ts";

export interface RecentEntry { id: number; barcode: string; product?: Product; at: number }

export const RECENT_KEY = "ecogo.recent.v1";
export const RECENT_MAX = 10;

/** Newest first, no duplicates, at most 10. Catalog products (id > 0) are stored by id only, so they stay fresh;
 *  looked-up ones (id < 0) keep a snapshot so they reopen without a request. */
export function addRecent(list: RecentEntry[], p: Product, now: number): RecentEntry[] {
  const entry: RecentEntry = { id: p.id, barcode: p.barcode, at: now, ...(p.id < 0 ? { product: p } : {}) };
  return [entry, ...list.filter(e => e.id !== p.id)].slice(0, RECENT_MAX);
}

/** Entries → products. A catalog id that's no longer in the catalog is dropped. */
export function resolveRecent(list: RecentEntry[], catalog: Product[]): Product[] {
  const byId = new Map(catalog.map(p => [p.id, p]));
  return list.flatMap(e => {
    const p = e.product ?? byId.get(e.id);
    return p ? [p] : [];
  });
}

const validProduct = (p: any) => p && typeof p.id === "number" && typeof p.name === "string" && typeof p.barcode === "string";

/** Stored JSON → entries. Corrupt JSON gives []; malformed entries (e.g. from an older version) are skipped. */
export function parseRecent(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(e => e && typeof e.id === "number" && typeof e.barcode === "string" && typeof e.at === "number"
      && (e.product === undefined || validProduct(e.product))).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

// Storage can be missing, blocked (private mode) or full: never let that break the app.
export function loadRecent(): RecentEntry[] {
  try { return parseRecent(localStorage.getItem(RECENT_KEY)); } catch { return []; }
}
export function saveRecent(list: RecentEntry[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* not saved; the list still works this visit */ }
}

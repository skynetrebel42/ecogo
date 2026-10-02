// recent.ts — "Recently scanned": the last 10 products opened, kept on this device only.
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.1.

import type { Product } from "./productImporter.ts";

export interface RecentEntry { id: number; product?: Product }

const RECENT_KEY = "ecogo.recent.v1";
export const RECENT_MAX = 10;

/** Newest first, no duplicates, at most 10. Catalog products (id > 0) are stored by id only, so they stay fresh;
 *  looked-up ones (id < 0) keep a snapshot so they reopen without a request. */
export function addRecent(list: RecentEntry[], p: Product): RecentEntry[] {
  const entry: RecentEntry = { id: p.id, ...(p.id < 0 ? { product: p } : {}) };
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

/** Stored JSON → entries. Corrupt JSON gives []; malformed entries are skipped. Older saves also hold `barcode` and
 *  `at`: extra fields are fine. */
export function parseRecent(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(e => e && typeof e.id === "number" && (e.product === undefined || (e.product
      && typeof e.product.id === "number" && typeof e.product.name === "string" && typeof e.product.barcode === "string")))
      .slice(0, RECENT_MAX);
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

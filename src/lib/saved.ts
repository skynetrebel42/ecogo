// saved.ts: saved products and the user's lists, kept on this device only (like recent.ts).
// Spec: docs/superpowers/specs/2026-10-07-m14-collections-design.md part 1.

import type { Product } from "./productImporter.ts";

export interface SavedItem { id: number; product?: Product }
export interface SavedList { id: string; name: string; ids: number[] }
export interface SavedStore { items: SavedItem[]; lists: SavedList[] }

const SAVED_KEY = "ecogo.saved.v1";
export const EMPTY_SAVED: SavedStore = { items: [], lists: [] };

/** Save newest first (catalog by id, looked-up with a snapshot), or unsave from Saved and every list. */
export function toggleSave(s: SavedStore, p: Product): SavedStore {
  if (s.items.some(i => i.id === p.id)) {
    return { items: s.items.filter(i => i.id !== p.id), lists: s.lists.map(l => ({ ...l, ids: l.ids.filter(id => id !== p.id) })) };
  }
  return { ...s, items: [{ id: p.id, ...(p.id < 0 ? { product: p } : {}) }, ...s.items] };
}

/** A looked-up product opened again replaces its saved snapshot. */
export function refreshSnapshot(s: SavedStore, p: Product): SavedStore {
  if (p.id >= 0 || !s.items.some(i => i.id === p.id)) return s;
  return { ...s, items: s.items.map(i => i.id === p.id ? { id: p.id, product: p } : i) };
}

export function setInList(s: SavedStore, listId: string, productId: number, inList: boolean): SavedStore {
  return { ...s, lists: s.lists.map(l => l.id !== listId || l.ids.includes(productId) === inList ? l
    : { ...l, ids: inList ? [productId, ...l.ids] : l.ids.filter(id => id !== productId) }) };
}

/** Trimmed name, or an error message to show under the text box. */
function checkName(s: SavedStore, name: string, exceptId?: string): string | { name: string } {
  const n = name.trim();
  if (n.length < 1 || n.length > 30) return "Use 1 to 30 characters.";
  if (s.lists.some(l => l.id !== exceptId && l.name.toLowerCase() === n.toLowerCase())) return `You already have a list called ${n}.`;
  return { name: n };
}

export function createList(s: SavedStore, name: string, ids: number[] = []): SavedStore | string {
  const c = checkName(s, name);
  if (typeof c === "string") return c;
  return { ...s, lists: [...s.lists, { id: crypto.randomUUID(), name: c.name, ids }] };
}

export function renameList(s: SavedStore, listId: string, name: string): SavedStore | string {
  const c = checkName(s, name, listId);
  if (typeof c === "string") return c;
  return { ...s, lists: s.lists.map(l => l.id === listId ? { ...l, name: c.name } : l) };
}

export function deleteList(s: SavedStore, listId: string): SavedStore {
  return { ...s, lists: s.lists.filter(l => l.id !== listId) };
}

/** Ids (default: all saved, newest first) → products. A catalog id no longer in the catalog is dropped. */
export function resolveSaved(s: SavedStore, catalog: Product[], ids = s.items.map(i => i.id)): Product[] {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const snaps = new Map(s.items.map(i => [i.id, i.product]));
  return ids.flatMap(id => {
    const p = snaps.has(id) ? snaps.get(id) ?? byId.get(id) : undefined;
    return p ? [p] : [];
  });
}

/** Stored JSON → store. Corrupt JSON gives an empty store; malformed entries are skipped; list ids that aren't saved are dropped. */
export function parseSaved(raw: string | null): SavedStore {
  if (!raw) return EMPTY_SAVED;
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return EMPTY_SAVED;
    const items: SavedItem[] = data.items.filter((e: SavedItem) => e && typeof e.id === "number" && (e.product === undefined || (e.product
      && typeof e.product.id === "number" && typeof e.product.name === "string" && typeof e.product.barcode === "string")));
    const saved = new Set(items.map(i => i.id));
    const lists: SavedList[] = (Array.isArray(data.lists) ? data.lists : [])
      .filter((l: SavedList) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.ids))
      .map((l: SavedList) => ({ id: l.id, name: l.name, ids: l.ids.filter(id => saved.has(id)) }));
    return { items, lists };
  } catch {
    return EMPTY_SAVED;
  }
}

// Storage can be missing, blocked or full: never let that break the app. saveSaved reports whether the write worked.
export function loadSaved(): SavedStore {
  try { return parseSaved(localStorage.getItem(SAVED_KEY)); } catch { return EMPTY_SAVED; }
}
export function saveSaved(s: SavedStore): boolean {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(s)); return true; } catch { return false; }
}

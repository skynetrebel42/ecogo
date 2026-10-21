// saferChoice.ts — M17 (decision 065, docs/superpowers/specs/2026-10-20-m17-cleaners-design.md): EPA's Safer Choice
// list, as a snapshot committed in src/data/safer-choice.json (`npm run import:saferchoice`). A scanned barcode on
// the list gets EPA's own product name and company; a barcode not on it gets nothing (no match is no claim). The app
// never calls EPA. No React, so the Node script and tests load it.
import { barcodeKey } from "./lookup.ts";
import type { Product } from "./productImporter.ts";

export interface SaferChoiceProduct { name: string; company: string; sectors: string[]; codes: string[] }
export interface SaferChoiceSnapshot { retrieved: string; source: string; products: SaferChoiceProduct[] }

export const ENVIROFACTS = "https://data.epa.gov/efservice/t_safer_choice_and_design_for_the_environment/JSON";
export const PRODUCT_SEARCH = "https://www.epa.gov/saferchoice/products";
const STANDARD = "https://www.epa.gov/system/files/documents/2024-08/epas-safer-choice-and-design-for-the-environment-dfe-standard.pdf";

/** EPA's own line, required wherever a partner presents a certified product (2024 Standard §6.1.2). */
export const NOT_ENDORSEMENT = {
  id: "safer-choice-not-endorsement", text: "EPA certification does not constitute endorsement of this product.",
  sources: [{ body: "EPA", url: STANDARD, quote: "EPA certification does not constitute endorsement of this product.",
    checkedOn: "2026-10-20", checkedByHand: "2026-10-20" }], // a PDF: read in full, §6.1.2 (p. 36)
};
/** Every Safer Choice claim the app shows, for `npm run verify:sources`. */
export const SAFER_CHOICE_SOURCES = [NOT_ENDORSEMENT];

let snapshot: Promise<SaferChoiceSnapshot> | null = null;
/** The committed snapshot, fetched from EcoGo's own site the first time a scan needs it (a separate chunk). */
export function loadSaferChoice(): Promise<SaferChoiceSnapshot> {
  snapshot ??= import("../data/safer-choice.json", { with: { type: "json" } }).then(m => m.default as SaferChoiceSnapshot);
  snapshot.catch(() => { snapshot = null; }); // offline: try again next scan
  return snapshot;
}

/** A barcode found nowhere but on EPA's list: a page with EPA's name and company and no ingredients (spec S2). The
 *  catalog's "Cleaning" category gives it the cleaning icon and keeps the food check and nutrition lookup off. */
export const saferChoiceProduct = (barcode: string, p: SaferChoiceProduct): Product => ({
  id: -Number(barcodeKey(barcode)), barcode, name: p.name, brand: p.company, category: "Cleaning",
  description: "", ingredients: "", imageUrl: "", keywords: [],
});

/** GS1 check digit, counted from the right, so leading zeros (lost when EPA stores a UPC as a number) don't change it. */
export function gtinValid(digits: string): boolean {
  if (!/^\d{8,14}$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(digits[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** EPA's Envirofacts rows → the snapshot: program "Safer Choice" (Design for the Environment stays out, spec S1), a UPC
 *  or GTIN with a valid check digit, company in good standing (S1a: null is not true). One product per name + company. */
export function trimSaferChoice(rows: Row[], retrieved: string) {
  const sc = rows.filter(r => r.program === "Safer Choice");
  const withCode = sc.filter(r => r.upcs != null || r.gtins != null);
  const good = withCode.filter(r => r.company_in_good_standing === true);
  const byProduct = new Map<string, SaferChoiceProduct>();
  const owners = new Map<string, Set<string>>(); // code → products listing it
  let badCheckDigit = 0;
  for (const r of good) {
    const name = text(r.product_name), company = text(r.company_name), id = `${name}\u0000${company}`;
    const p = byProduct.get(id) ?? { name, company, sectors: [], codes: [] };
    byProduct.set(id, p);
    const sector = text(r.sector);
    if (sector && !p.sectors.includes(sector)) p.sectors.push(sector);
    for (const raw of [r.upcs, r.gtins]) {
      if (raw == null) continue;
      const digits = String(raw).replace(/\D/g, "");
      if (!gtinValid(digits)) { badCheckDigit++; continue; }
      const key = barcodeKey(digits);
      if (!p.codes.includes(key)) p.codes.push(key);
      owners.set(key, (owners.get(key) ?? new Set()).add(id));
    }
  }
  // A code EPA lists under two different products can't say which one was scanned: it matches neither.
  const shared = new Set([...owners].filter(([, ids]) => ids.size > 1).map(([k]) => k));
  const products = [...byProduct.values()]
    .map(p => ({ ...p, sectors: p.sectors.sort(), codes: p.codes.filter(c => !shared.has(c)).sort() }))
    .filter(p => p.codes.length > 0)
    .sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));
  const snapshot: SaferChoiceSnapshot = { retrieved, source: ENVIROFACTS, products };
  return {
    snapshot,
    stats: { rows: rows.length, saferChoice: sc.length, withCode: withCode.length, goodStanding: good.length, badCheckDigit,
      products: products.length, codes: products.reduce((n, p) => n + p.codes.length, 0), sharedCodes: shared.size },
  };
}

/** The listed product for a scanned barcode, by exact digits (leading zeros aside), or null. */
export function saferChoiceMatch(barcode: string, snapshot: SaferChoiceSnapshot): SaferChoiceProduct | null {
  const key = barcodeKey(barcode);
  return key ? snapshot.products.find(p => p.codes.includes(key)) ?? null : null;
}

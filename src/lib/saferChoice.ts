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
/** S4: what the label means, in EPA's words (shown on the not-found screen's "Cleaning product"). */
const LABEL_PAGE = "https://www.epa.gov/saferchoice/learn-about-safer-choice-label";
export const SAFER_CHOICE_MEANING = {
  id: "safer-choice-meaning", text: "Products with EPA's Safer Choice label have had every chemical ingredient reviewed by EPA against criteria for human health and the environment.",
  sources: [
    { body: "EPA", url: LABEL_PAGE, checkedOn: "2026-10-20", quote: "Before a product can carry the Safer Choice label, EPA reviews all chemical ingredients, regardless of their percentage in the product." },
    { body: "EPA", url: LABEL_PAGE, checkedOn: "2026-10-20", quote: "Every ingredient must meet strict safety criteria for both human health and the environment" },
  ],
};

/** S3: California's Cleaning Product Right to Know Act (Health & Safety Code §108954.5; scope in §108952). leginfo
 *  answers a plain fetch with 403: every quote was confirmed on its page in the built-in browser. */
const CA_108954_5 = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=108954.5";
const CA_108952 = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=108952";
export const CALIFORNIA_LINE = {
  id: "california-ingredients-online",
  text: "California law requires the maker of a cleaning product sold in the state to post its intentionally added ingredients online, with some exceptions such as confidential business information.",
  sources: [
    { body: "California", url: CA_108954_5, checkedOn: "2026-10-20", checkedByHand: "2026-10-20", quote: "The manufacturer of a designated product sold in the state shall post on its Internet Web site, in an electronically readable format, the following information related to the designated product:" },
    { body: "California", url: CA_108954_5, checkedOn: "2026-10-20", checkedByHand: "2026-10-20", quote: "A list of each intentionally added ingredient contained in the product, except for the following:" },
    { body: "California", url: CA_108954_5, checkedOn: "2026-10-20", checkedByHand: "2026-10-20", quote: "Intentionally added ingredients that are confidential business information." },
    // Which products the line is shown on (CALIFORNIA_SCOPE):
    { body: "California", url: CA_108952, checkedOn: "2026-10-20", checkedByHand: "2026-10-20", quote: "“Designated product” means a finished product that is an air care product, automotive product, general cleaning product, or a polish or floor maintenance product used primarily for janitorial, domestic, or institutional cleaning purposes." },
    { body: "California", url: CA_108952, checkedOn: "2026-10-20", checkedByHand: "2026-10-20", quote: "Foods, drugs, and cosmetics, including personal care items such as toothpaste, shampoo, and hand soap." },
  ],
};
/** EPA's product types that fall under the Act's "designated product" (§108952: air care, automotive, general cleaning,
 *  polish or floor maintenance; not hand soap or other personal care). Planner-approved list (decision 065 Q2); when
 *  unsure (Marine/RV, Aircraft, Air Conditioner Coil cleaners) it stays out: no claim. */
export const CALIFORNIA_SCOPE = new Set([
  "All-Purpose Cleaners", "Laundry Products : Laundry Detergents", "Laundry Products : Pre-Treaters", "Laundry Products : Boosters",
  "Laundry Products : Fabric Softeners", "Floor Care Products : Floor Cleaners", "Floor Care Products : Floor Finishes",
  "Floor Care Products : Floor Strippers", "Carpet Care Products : Carpet Cleaners", "Carpet Care Products : Spot Removers",
  "Upholstery Cleaners", "Odor Removers", "Window/Glass Cleaners", "Degreasers", "Dish Soaps", "Automatic Dishwasher Products",
  "Rinse Aids", "Tub/Tile Cleaners", "Toilet Bowl Cleaners", "Descalers", "Wood Cleaners", "Appliance Cleaners",
  "Oven/Grill/Barbeque Cleaners", "Stainless Steel Cleaners", "Metal Cleaner/Polishes", "Leather Cleaners", "Granite/Stone Cleaners",
  "Kitchen/Countertop Cleaners", "Brick and Masonry Cleaners", "Dry Erase Board Cleaners", "Car Care Products",
]);
export const inCaliforniaScope = (p: Pick<SaferChoiceProduct, "sectors">) => p.sectors.some(s => CALIFORNIA_SCOPE.has(s));

/** Every Safer Choice claim the app shows, for `npm run verify:sources`. */
export const SAFER_CHOICE_SOURCES = [NOT_ENDORSEMENT, SAFER_CHOICE_MEANING, CALIFORNIA_LINE];

let snapshot: Promise<SaferChoiceSnapshot> | null = null;
/** The committed snapshot, fetched from EcoGo's own site the first time a scan needs it (a separate chunk). */
export function loadSaferChoice(): Promise<SaferChoiceSnapshot> {
  // No `with { type: "json" }`: Vite strips it only from static imports, and the dev server breaks on it here.
  return snapshot ??= import("../data/safer-choice.json")
    .then(m => m.default as SaferChoiceSnapshot)
    .catch((err: unknown) => { snapshot = null; throw err; }); // offline: try again next scan
}

/** A barcode found nowhere but on EPA's list: a page with EPA's name and company (the first, when EPA lists several; the
 *  card names them all) and no ingredients (spec S2). The catalog's "Cleaning" category gives it the cleaning icon and
 *  keeps the food check and nutrition lookup off. */
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
  const withCode = sc.filter(r => String(r.upcs ?? "").trim() !== "" || String(r.gtins ?? "").trim() !== "");
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
      if (String(raw ?? "").trim() === "") continue;
      const digits = String(raw).replace(/\D/g, "");
      if (!gtinValid(digits)) { badCheckDigit++; continue; }
      const key = barcodeKey(digits);
      if (!p.codes.includes(key)) p.codes.push(key);
      owners.set(key, (owners.get(key) ?? new Set()).add(id));
    }
  }
  const products = [...byProduct.values()]
    .map(p => ({ ...p, sectors: p.sectors.sort(), codes: p.codes.sort() }))
    .filter(p => p.codes.length > 0)
    .sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));
  const snapshot: SaferChoiceSnapshot = { retrieved, source: ENVIROFACTS, products };
  return {
    snapshot,
    stats: { rows: rows.length, saferChoice: sc.length, withCode: withCode.length, goodStanding: good.length, badCheckDigit,
      products: products.length, codes: owners.size, sharedCodes: [...owners.values()].filter(ids => ids.size > 1).length },
  };
}

/** Every listed product for a scanned barcode, by exact digits (leading zeros aside); [] when it isn't listed. EPA lists
 *  some barcodes under two or three products (scents, "PRO" or store-brand versions): all of them are shown (Q6). */
export function saferChoiceMatch(barcode: string, snapshot: SaferChoiceSnapshot): SaferChoiceProduct[] {
  const key = barcodeKey(barcode);
  return key ? snapshot.products.filter(p => p.codes.includes(key)) : [];
}

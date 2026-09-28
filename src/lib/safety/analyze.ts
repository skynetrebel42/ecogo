// analyze.ts — ingredient text → verdict and flags.
// Deterministic: no network, no AI. Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §4, §6.

import { LIBRARY, type LibraryEntry } from "./library.ts";
import { parseIngredients } from "./parse.ts";

export type Verdict = "high" | "some" | "none" | "no-data" | "non-food";
export interface Flag { entry: LibraryEntry; matchedText: string }
export interface Analysis { verdict: Verdict; flags: Flag[]; checkedCount: number }

/** "Fewest concerns first" order; lower is better. no-data / non-food sort last. */
export const VERDICT_RANK: Record<Verdict, number> = { none: 0, some: 1, high: 2, "no-data": 3, "non-food": 4 };

/** Categories the library covers (food & drinks first). */
export const FOOD_CATEGORIES: ReadonlySet<string> = new Set([
  "Beverages", "Bread", "Breakfast", "Condiments", "Dairy", "Frozen", "Meat", "Snacks",
]);

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** E-numbers in label text: "E250", "E 250", "E-250", "e150d" — but never a vitamin E dose ("vitamin E 250", "E 250 IU"). */
const E_CODE = /(?<!\bvit(?:amine?)?\.?[\s-]*)(?<![a-z0-9])e[\s-]?(\d{3,4}[a-z]?)(?![a-z0-9])(?!\s*(?:iu|mg|mcg|µg|%))/g;

/** US colour spellings → the library's form: "Red #40", "FD&C Red No. 40", "Red Dye 40" → "red 40"; "yellow 5 & 6" → both. */
const normalizeColours = (s: string) => s
  .replace(/\b(red|yellow|blue|green)\s+(?:dye\s+)?(?:(?:no\.?|#)\s*)?(?=\d)/g, "$1 ")
  .replace(/\b(red|yellow|blue|green) (\d+)\s*(?:&|and)\s*(\d+)\b/g, "$1 $2, $1 $3");

export function analyzeIngredients(
  input: { ingredients: string; category?: string },
  library: LibraryEntry[] = LIBRARY,
): Analysis {
  const checkedCount = library.length;
  if (input.category !== undefined && !FOOD_CATEGORIES.has(input.category)) {
    return { verdict: "non-food", flags: [], checkedCount };
  }
  const items = parseIngredients(typeof input.ingredients === "string" ? input.ingredients : "");
  // Nothing parsed (blank, or only an allergen sentence) is not the same as "checked and clean".
  if (items.length === 0) return { verdict: "no-data", flags: [], checkedCount };

  const matchers = library.map(entry => ({
    entry,
    // "non-bromated" / "un-bromated" claim absence.
    aliases: entry.aliases.map(a => new RegExp(`(?<![a-z0-9])(?<!\\b(?:non|un)-)${escapeRegExp(a)}(?![a-z0-9])`)),
  }));
  const flags: Flag[] = [];
  const flagged = new Set<string>();
  const flag = (entry: LibraryEntry, matchedText: string) => {
    if (flagged.has(entry.id)) return;
    flagged.add(entry.id);
    flags.push({ entry, matchedText });
  };

  for (const item of items) {
    const lower = normalizeColours(item.toLowerCase());
    const itemCodes = [...lower.matchAll(E_CODE)].map(m => `E${m[1].toUpperCase()}`);
    for (const { entry, aliases } of matchers) {
      if (aliases.some(re => re.test(lower)) || itemCodes.some(c => entry.eCodes.includes(c))) flag(entry, item);
    }
  }

  flags.sort((a, b) => (a.entry.severity === b.entry.severity ? 0 : a.entry.severity === "high" ? -1 : 1));
  const verdict: Verdict = flags.some(f => f.entry.severity === "high") ? "high" : flags.length > 0 ? "some" : "none";
  return { verdict, flags, checkedCount };
}

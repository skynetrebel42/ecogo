// analyze.ts — ingredient text (+ optional additive codes) → verdict and flags.
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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** E-numbers in label text: "E250", "E 250", "E-250", "e150d" — but never "vitamin E 250". */
const E_CODE = /(?<!vitamin\s)(?<![a-z0-9])e[\s-]?(\d{3,4}[a-z]?)(?![a-z0-9])/g;

/** "en:e250" (Open Food Facts), "E 250", "e250" → "E250". */
const normalizeCode = (code: string) => code.replace(/^[a-z]{2}:/i, "").replace(/[\s-]/g, "").toUpperCase();

export function analyzeIngredients(
  input: { ingredients: string; category?: string; additiveCodes?: string[] },
  library: LibraryEntry[] = LIBRARY,
): Analysis {
  const checkedCount = library.length;
  if (input.category !== undefined && !FOOD_CATEGORIES.has(input.category)) {
    return { verdict: "non-food", flags: [], checkedCount };
  }
  const text = typeof input.ingredients === "string" ? input.ingredients : "";
  const codes = (input.additiveCodes ?? []).map(normalizeCode);
  if (!text.trim() && codes.length === 0) return { verdict: "no-data", flags: [], checkedCount };

  const matchers = library.map(entry => ({
    entry,
    aliases: entry.aliases.map(a => new RegExp(`(?<![a-z0-9])${escapeRegExp(a)}(?![a-z0-9])`)),
  }));
  const flags: Flag[] = [];
  const flagged = new Set<string>();
  const flag = (entry: LibraryEntry, matchedText: string) => {
    if (flagged.has(entry.id)) return;
    flagged.add(entry.id);
    flags.push({ entry, matchedText });
  };

  for (const item of parseIngredients(text)) {
    const lower = item.toLowerCase();
    const itemCodes = [...lower.matchAll(E_CODE)].map(m => `E${m[1].toUpperCase()}`);
    for (const { entry, aliases } of matchers) {
      if (aliases.some(re => re.test(lower)) || itemCodes.some(c => entry.eCodes.includes(c))) flag(entry, item);
    }
  }
  for (const code of codes) {
    for (const { entry } of matchers) if (entry.eCodes.includes(code)) flag(entry, code);
  }

  flags.sort((a, b) => (a.entry.severity === b.entry.severity ? 0 : a.entry.severity === "high" ? -1 : 1));
  const verdict: Verdict = flags.some(f => f.entry.severity === "high") ? "high" : flags.length > 0 ? "some" : "none";
  return { verdict, flags, checkedCount };
}

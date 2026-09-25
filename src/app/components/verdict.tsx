// verdict.tsx — how a safety verdict looks, shared by the product page and product lists.

import { AlertTriangle, CheckCircle, HelpCircle, ShieldAlert } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { analyzeIngredients, type Analysis, type Verdict } from "../../lib/safety/analyze";

export const VERDICT_STYLE: Record<Verdict, {
  label: string; short: string; color: string; bg: string; gradient: string; Icon: typeof CheckCircle;
}> = {
  high:       { label: "High-concern ingredient",         short: "High concern", color: "#B91C1C", bg: "#FEE2E2", gradient: "linear-gradient(160deg, #450a0a, #dc2626)", Icon: ShieldAlert },
  some:       { label: "Ingredients of some concern",     short: "Some concern", color: "#B45309", bg: "#FEF3C7", gradient: "linear-gradient(160deg, #78350f, #d97706)", Icon: AlertTriangle },
  none:       { label: "No ingredients of concern found", short: "No concerns",  color: "#15803D", bg: "#DCFCE7", gradient: "linear-gradient(160deg, #064e3b, #10b981)", Icon: CheckCircle },
  "no-data":  { label: "Not enough data",                 short: "No data",      color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
  "non-food": { label: "Ingredient check covers food & drinks for now", short: "Food only", color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
};

const NO_DATA: Analysis = { verdict: "no-data", flags: [], checkedCount: 0 };

/** Never let the engine blank a screen: an unexpected error shows "Not enough data" and is logged. */
export function safeAnalyze(p: Product): Analysis {
  try {
    return analyzeIngredients({ ingredients: p.ingredients, category: p.category });
  } catch (err) {
    console.error("[safety] analysis failed for product", p.id, err);
    return NO_DATA;
  }
}

/** "1 high-concern ingredient · 1 of some concern", "2 ingredients of some concern", or the verdict label. */
export function verdictHeadline(a: Analysis): string {
  const high = a.flags.filter(f => f.entry.severity === "high").length;
  const some = a.flags.length - high;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (a.verdict === "high") return some ? `${plural(high, "high-concern ingredient")} · ${some} of some concern` : plural(high, "high-concern ingredient");
  if (a.verdict === "some") return `${plural(some, "ingredient")} of some concern`;
  return VERDICT_STYLE[a.verdict].label;
}

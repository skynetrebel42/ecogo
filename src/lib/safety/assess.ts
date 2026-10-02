// assess.ts — one product → its concern level: the strongest of the additive check and the food-level concerns.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.3. Pure, so Node tests can load it.
import { analyzeIngredients, LEVELS, type Analysis } from "./analyze.ts";
import { SEVERITY_RANK } from "./library.ts";
import { foodConcerns, type FoodConcern, type FoodInput } from "./foodConcerns.ts";

export interface Assessment extends Analysis { concerns: FoodConcern[] }

export function assessProduct(p: FoodInput & { additiveCodes?: string[] }): Assessment {
  // Looked-up products have no catalog category (both sources are food databases).
  const a = analyzeIngredients({ ingredients: p.ingredients, category: p.source ? undefined : p.category, additiveCodes: p.additiveCodes });
  if (a.verdict === "non-food") return { ...a, concerns: [] };
  let concerns: FoodConcern[] = [];
  try {
    concerns = foodConcerns(p);
  } catch (err) {
    console.error("[safety] food-level check failed; showing the additive result only", err);
  }
  const foodTop = Math.max(0, ...concerns.map(c => (c.kind === "food" && c.severity ? SEVERITY_RANK[c.severity] : 0)));
  const current = LEVELS.indexOf(a.verdict); // -1 = no-data: a food concern still lifts it
  return { ...a, concerns, verdict: foodTop > Math.max(current, 0) ? LEVELS[foodTop] : a.verdict };
}

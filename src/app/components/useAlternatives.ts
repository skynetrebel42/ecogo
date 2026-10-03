// useAlternatives.ts — other products in the same USDA category with a strictly better badge, read from the `foods`
// table. Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md O6. Optional: any failure shows nothing.
import { useEffect, useState } from "react";
import type { Product } from "../../lib/productImporter";
import { VERDICT_RANK, type Verdict } from "../../lib/safety/analyze";
import type { Assessment } from "../../lib/safety/assess";
import { foodRowToProduct } from "../../lib/foods";
import { supabaseFoods } from "../../lib/foodsDb";
import { barcodeKey } from "../../lib/lookup";
import { fewestConcerns, safeAnalyze } from "./verdict";

export interface Alternative { p: Product; a: Assessment }

export function useAlternatives(product: Product, verdict: Verdict): Alternative[] {
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  useEffect(() => {
    setAlternatives([]);
    // Only offered when this product has a finding; Open Food Facts products have no USDA category to compare within.
    if (verdict !== "known" && verdict !== "high" && verdict !== "some") return;
    if (!product.barcode || product.source?.crowdSourced) return;
    let live = true;
    const mine = VERDICT_RANK[verdict];
    const self = barcodeKey(product.barcode);
    (async () => {
      // A looked-up USDA product knows its category; a catalog product takes it from its own USDA row.
      const category = product.source?.foodCategory ?? (await supabaseFoods.byBarcode(self))?.category ?? "";
      if (!category) return;
      const rows = await supabaseFoods.alternatives(category, mine, self, 3);
      const found = rows.map(foodRowToProduct)
        .map(p => ({ p, a: safeAnalyze(p) }))
        .filter(({ a }) => VERDICT_RANK[a.verdict] < mine) // the app's engine, not the stored level, decides what is better
        .sort((x, y) => fewestConcerns(x.a, y.a) || x.p.name.localeCompare(y.p.name));
      if (live) setAlternatives(found);
    })().catch(() => { /* alternatives are optional: stay silent */ });
    return () => { live = false; };
  }, [product.id, verdict]); // eslint-disable-line react-hooks/exhaustive-deps
  return alternatives;
}

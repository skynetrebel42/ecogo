// NutritionPanel.tsx — added sugar, saturated fat and sodium as FDA % Daily Value per serving (M5 spec §4.2, §4.3).
// A separate signal from the concern badge, in slate (never red or green); "High"/"Low" are always written out.

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { FOOD_CATEGORIES } from "../../lib/safety/analyze";
import { knownNutrition, lookupBarcode } from "../../lib/lookup";
import { supabaseFoods } from "../../lib/foodsDb";
import { FDA_RULE, type Nutrition } from "../../lib/nutrition";

export type NutritionState =
  | { status: "none" }                       // non-food, or a catalog product without a verified barcode
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; nutrition: Nutrition };

/** Looked-up products bring their nutrition; catalog food products fetch it once per session by their verified barcode. */
export function useNutrition(product: Product): NutritionState {
  const ready = product.nutrition ?? knownNutrition(product.barcode);
  const canLookUp = !product.source && product.barcode !== "" && FOOD_CATEGORIES.has(product.category);
  const [state, setState] = useState<NutritionState>(ready ? { status: "ready", nutrition: ready } : canLookUp ? { status: "loading" } : { status: "none" });
  useEffect(() => {
    if (ready) { setState({ status: "ready", nutrition: ready }); return; }
    if (!canLookUp) { setState({ status: "none" }); return; }
    let live = true;
    setState({ status: "loading" });
    lookupBarcode(product.barcode, { foods: supabaseFoods }).then(r => {
      if (!live) return;
      const n = r.status === "found" ? r.product.nutrition : undefined;
      setState(n ? { status: "ready", nutrition: n } : { status: "unavailable" });
    });
    return () => { live = false; };
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

const SLATE = { text: "#1E293B", bg: "#F1F5F9", border: "#CBD5E1", bar: "#E2E8F0", fill: "#475569", fillHigh: "#1E293B" };

/** M11 3.2: outline "Update info" button for crowd-sourced products, opening Open Food Facts' edit form in a new tab. */
export function UpdateInfoButton({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={label}
      className="flex-shrink-0 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl border border-border text-xs font-bold text-gray-700">
      Update info <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
export const UpdateInfoHelp = () => (
  <p className="text-micro text-gray-500 leading-snug mb-3">Opens Open Food Facts. Sign in there to correct the values or add a photo of the label.</p>
);

export default function NutritionPanel({ state, updateUrl }: { state: NutritionState; updateUrl?: string | null }) {
  if (state.status === "none" && !updateUrl) return null;
  const n = state.status === "ready" ? state.nutrition : null;
  const showUpdate = updateUrl && (state.status === "ready" || state.status === "none");
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className={`flex items-center justify-between gap-2 ${showUpdate ? "mb-1" : "mb-3"}`}>
        <div className="min-w-0">
          <span className="font-bold text-sm">Nutrition</span>
          {n && <span className="block text-mini text-gray-500">{n.perServing ? "per serving" : "per"} · {n.serving}</span>}
        </div>
        {showUpdate && <UpdateInfoButton url={updateUrl} label="Update nutrition info on Open Food Facts" />}
      </div>
      {showUpdate && <UpdateInfoHelp />}
      {state.status === "loading" && <p className="text-xs text-gray-500">Nutrition loading…</p>}
      {(state.status === "unavailable" || state.status === "none") && <p className="text-xs text-gray-500">Nutrition not available for this product.</p>}
      {n && (
        <div className="space-y-3">
          {n.nutrients.map(x => (
            <div key={x.id}>
              <div className="flex justify-between gap-2 text-xs">
                <span><strong>{x.label}</strong> · {x.amount === null ? "not listed" : `${x.amount} ${x.unit}`}</span>
                <span style={{ color: SLATE.text, fontWeight: x.level === "high" ? 800 : 500 }}>
                  {x.dv === null ? "" : `${x.dv}% DV`}{x.level ? ` · ${x.level === "high" ? "High" : "Low"}` : ""}
                </span>
              </div>
              {x.dv !== null && (
                <div className="h-2 rounded mt-1.5" style={{ background: SLATE.bar }}>
                  <div className="h-2 rounded" style={{ width: `${Math.min(x.dv, 100)}%`, background: x.level === "high" ? SLATE.fillHigh : SLATE.fill }} />
                </div>
              )}
            </div>
          ))}
          <p className="text-micro text-gray-500 leading-snug">
            {n.perServing ? <>FDA: “{FDA_RULE.quote}” </> : <>Values per 100 g: FDA's high/low guide is per serving, so none is applied. </>}
            <a href={FDA_RULE.url} target="_blank" rel="noreferrer" className="underline" style={{ color: SLATE.text }}>FDA Daily Values <ExternalLink size={9} className="inline" /></a>
            <span className="block mt-1">
              {n.source === "Open Food Facts" ? "From Open Food Facts (crowd-sourced, may contain errors)." : "From the label data the manufacturer sent USDA FoodData Central."}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Slate chip for the top High nutrient: "High sugar" on cards, "High in added sugar" in the hero. */
export function NutritionChip({ text, onDark = false }: { text: string; onDark?: boolean }) {
  return onDark
    ? <span className="text-nano font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">{text}</span>
    : <span className="text-nano font-bold px-1.5 py-0.5 rounded-full border" style={{ background: SLATE.bg, borderColor: SLATE.border, color: SLATE.text }}>{text}</span>;
}

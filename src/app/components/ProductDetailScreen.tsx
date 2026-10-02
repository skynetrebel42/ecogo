// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailScreen.tsx — product page
//
// Concern level from the safety engine (src/lib/safety): the strongest official
// finding among the ingredients (additives), the food itself (processed meat) and
// what forms when it's cooked (acrylamide, a marker only). Every finding shows its
// sources. Also: same-category alternatives with fewer concerns.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  ArrowLeft, Bookmark, ShoppingBag,
  TrendingUp, ChevronDown, ExternalLink, FlaskConical, Flame,
} from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { offEditUrl } from "../../lib/lookup";
import { VERDICT_RANK, escapeRegExp, type Flag } from "../../lib/safety/analyze";
import type { Severity, Source } from "../../lib/safety/library";
import type { Assessment } from "../../lib/safety/assess";
import { VERDICT_STYLE, safeAnalyze, verdictHeadline, formsWhenCooked } from "./verdict";
import NutritionPanel, { NutritionChip, useNutrition } from "./NutritionPanel";
import { topHigh } from "../../lib/nutrition";

/** "fr" → "French" (native Intl; falls back to the code). */
const languageName = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
};

const SMALL_PRINT: Record<Assessment["verdict"], string> = {
  known:      "Tap a finding to see its official sources.",
  high:       "Tap a finding to see its official sources.",
  some:       "Tap a finding to see its official sources.",
  none:       "No hazard flags from IARC, EU or FDA.",
  "no-data":  "This product has no ingredient list yet.",
  "non-food": "EcoGo checks food and drinks only for now.",
};
// "Nothing flagged" with the 🔥 marker: scoped, so it doesn't contradict the IARC finding in "Formed when cooked".
const NONE_BUT_COOKED = "No hazard flags from IARC, EU or FDA in the ingredients or the food itself; see what forms when it's cooked below.";
// Point to the Nutrition section only when the page has one (no data, e.g. no verified barcode → no section).
const nutritionNote = (hasSection: boolean) => ` This badge doesn't rate nutrition${hasSection ? "; see the Nutrition section" : ""}.`;

/** One row on the product page: an additive flag or a food-level concern. */
interface Finding { id: string; name: string; severity?: Severity; concern: string; detail: string; context?: string; sources: Source[] }

/** Findings grouped by where they come from; empty groups are dropped. */
function findingGroups(a: Assessment): { title: string; findings: Finding[] }[] {
  const fromConcerns = (kind: "food" | "cooking") => a.concerns.filter(c => c.kind === kind).map(c => ({
    id: c.id, name: c.name, severity: c.severity, concern: c.concern, detail: c.reason, context: c.context, sources: c.sources,
  }));
  return [
    { title: "In the ingredients", findings: a.flags.map(({ entry, matchedText }) => ({
      id: entry.id, name: entry.name, severity: entry.severity, concern: entry.concern,
      detail: `Listed as “${matchedText}”`, context: entry.context, sources: entry.sources,
    })) },
    { title: "The food itself", findings: fromConcerns("food") },
    { title: "Formed when cooked", findings: fromConcerns("cooking") },
  ].filter(g => g.findings.length > 0);
}

const COOKING_LOOK = { short: "Forms when cooked", color: "#4B5563", bg: "#F3F4F6", Icon: Flame };

/** The full ingredient text with the label phrases that triggered flags highlighted. */
function HighlightedIngredients({ text, flags }: { text: string; flags: Flag[] }) {
  const terms = [...new Set(flags.map(f => f.matchedText))].filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) => i % 2 === 1
        ? <mark key={i} className="bg-red-100 text-red-800 rounded px-0.5 font-semibold">{part}</mark>
        : <span key={i}>{part}</span>)}
    </>
  );
}

function FindingRow({ finding: entry, open, onToggle }: { finding: Finding; open: boolean; onToggle: () => void }) {
  const look = entry.severity ? VERDICT_STYLE[entry.severity] : COOKING_LOOK;
  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <look.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: look.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{entry.name}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: look.bg, color: look.color }}>{look.short}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{entry.concern}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{entry.detail}</p>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 ml-7 space-y-2">
          {entry.context && (
            <p className="text-[11px] text-gray-600 bg-gray-50 rounded-xl p-2.5 leading-snug">
              <strong>Regulator context:</strong> {entry.context}
            </p>
          )}
          {entry.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-[11px] leading-snug text-primary">
              <span className="font-bold">{s.body}:</span> {s.finding} <ExternalLink size={9} className="inline" />
              <span className="block text-[9px] text-gray-400">Source checked {s.checkedOn}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductDetailScreenProps {
  product: Product; onBack: () => void; saved: boolean; onToggleSave: () => void;
  products: Product[]; onSelectProduct: (p: Product) => void;
}

export default function ProductDetailScreen({ product, onBack, saved, onToggleSave, products, onSelectProduct }: ProductDetailScreenProps) {
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const analysis = useMemo(() => safeAnalyze(product), [product]);
  const look = VERDICT_STYLE[analysis.verdict];
  const nutrition = useNutrition(product);
  const highNutrient = topHigh(nutrition.status === "ready" ? nutrition.nutrition : null);

  // Same category, strictly better verdict; only offered when this product has concerns.
  const alternatives = useMemo(() => {
    if (analysis.verdict !== "known" && analysis.verdict !== "high" && analysis.verdict !== "some") return [];
    const mine = VERDICT_RANK[analysis.verdict];
    return products
      .filter(p => p.id !== product.id && p.category === product.category)
      .map(p => ({ p, a: safeAnalyze(p) }))
      .filter(({ a }) => VERDICT_RANK[a.verdict] < mine)
      .sort((x, y) => VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict]
        || x.a.flags.length - y.a.flags.length
        || x.p.name.localeCompare(y.p.name))
      .slice(0, 3);
  }, [products, product, analysis]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ── */}
      <div className="flex-shrink-0 relative" style={{ background: look.gradient, minHeight: 268 }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft size={18} color="white" />
          </button>
          <button onClick={onToggleSave} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <Bookmark size={16} fill={saved ? "white" : "none"} color="white" />
          </button>
        </div>

        <div className="pt-16 pb-5 px-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xl">
            <ShoppingBag size={36} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.brand}</span>
              {product.category && (<>
                <span className="text-white/30">·</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
              </>)}
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight mb-2">{product.name}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {formsWhenCooked(analysis) && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">🔥 Forms when cooked</span>
              )}
              {highNutrient && <NutritionChip onDark text={`High in ${highNutrient.label.toLowerCase()}`} />}
            </div>
          </div>
          <div className="flex-shrink-0 w-[84px] flex flex-col items-center gap-1.5 text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl">
              <look.Icon size={30} style={{ color: look.color }} />
            </div>
            <span className="text-[10px] font-extrabold text-white leading-tight">{look.short}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
        <div className="px-4 py-4 space-y-3 pb-10">

          {product.source && (
            <div className={`rounded-2xl p-3 text-[11px] leading-snug border ${product.source.crowdSourced
              ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-white border-gray-100 text-gray-600 shadow-sm"}`}>
              {product.source.crowdSourced
                ? "Product data from Open Food Facts (crowd-sourced, may contain errors)."
                : "Label data from USDA FoodData Central, supplied by the manufacturer."}{" "}
              <a href={product.source.url} target="_blank" rel="noreferrer" className="font-bold underline">
                {product.source.crowdSourced ? "View on Open Food Facts" : "View record"}
              </a>
              {product.source.ingredientsLang !== "en" && (
                <span className="block mt-1">
                  Ingredients are listed in {languageName(product.source.ingredientsLang)}; additive codes were checked, ingredient names may be missed.
                </span>
              )}
              {product.source.crowdSourced && <span className="block mt-1 opacity-70">Data © Open Food Facts contributors, ODbL.</span>}
              {product.source.crowdSourced && (
                <span className="block mt-2">
                  <a href={offEditUrl(product.barcode)} target="_blank" rel="noreferrer" className="font-bold underline">
                    Looks wrong? Fix it on Open Food Facts
                  </a>
                  <span className="block mt-0.5 opacity-80">
                    Sign in there to correct the values or add a photo of the label (their AI suggests nutrition values from it). Fixes
                    show here after you reload EcoGo.
                  </span>
                </span>
              )}
            </div>
          )}

          {/* ── Verdict ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: `4px solid ${look.color}` }}>
            <div className="flex items-center gap-2">
              <look.Icon size={18} style={{ color: look.color }} />
              <span className="font-extrabold text-sm" style={{ color: look.color }}>{verdictHeadline(analysis)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{analysis.verdict === "none"
              ? (formsWhenCooked(analysis) ? NONE_BUT_COOKED : SMALL_PRINT.none) + nutritionNote(nutrition.status !== "none")
              : SMALL_PRINT[analysis.verdict]}</p>
          </div>

          {/* ── Findings, grouped by where they come from ── */}
          {findingGroups(analysis).map(g => (
            <div key={g.title} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">{g.title}</div>
              <div className="divide-y divide-gray-50">
                {g.findings.map(f => (
                  <FindingRow key={f.id} finding={f} open={openFlag === f.id}
                    onToggle={() => setOpenFlag(openFlag === f.id ? null : f.id)} />
                ))}
              </div>
            </div>
          ))}

          <NutritionPanel state={nutrition} />

          {/* ── Full ingredient list ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={15} className="text-primary" />
              <span className="font-bold text-sm">Ingredients</span>
            </div>
            {product.ingredients.trim()
              ? <p className="text-xs text-gray-600 leading-relaxed"><HighlightedIngredients text={product.ingredients} flags={analysis.flags} /></p>
              : <p className="text-xs text-gray-400 italic">No ingredient list available.</p>}
            <p className="text-[10px] text-gray-400 mt-3 leading-snug">
              Findings are matched against official sources (IARC, EU, FDA, EFSA, WHO), linked on each finding.
              Classifications describe potential hazards; this is not medical advice.
            </p>
          </div>

          {/* ── Alternatives with fewer concerns ── */}
          {alternatives.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <TrendingUp size={15} className="text-green-600" />
                <span className="font-bold text-sm">Alternatives with fewer concerns</span>
              </div>
              <div className="divide-y divide-gray-50">
                {alternatives.map(({ p, a }) => {
                  const altLook = VERDICT_STYLE[a.verdict];
                  return (
                    <button key={p.id} onClick={() => onSelectProduct(p)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: altLook.bg }}>
                        <ShoppingBag size={20} style={{ color: altLook.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">{p.brand}</p>
                        <p className="text-sm font-semibold leading-tight">{p.name}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: altLook.bg, color: altLook.color }}>{altLook.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

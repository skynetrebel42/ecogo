// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailScreen.tsx — product page
//
// Ingredient safety verdict from the safety engine (src/lib/safety): only
// ingredients with an official health concern are flagged, and every flag shows
// its sources. Also: price comparison and same-category alternatives.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  ArrowLeft, Bookmark, Share2, ShoppingBag, DollarSign, Star,
  TrendingUp, ChevronDown, ExternalLink, FlaskConical,
} from "lucide-react";
import { bestPrice, type Product } from "../../lib/productImporter";
import { VERDICT_RANK, escapeRegExp, type Analysis, type Flag } from "../../lib/safety/analyze";
import { VERDICT_STYLE, safeAnalyze, verdictHeadline } from "./verdict";

const SMALL_PRINT: Record<Analysis["verdict"], (a: Analysis) => string> = {
  high:       () => "Tap an ingredient to see its official sources.",
  some:       () => "Tap an ingredient to see its official sources.",
  none:       () => "This checks additives with an official health concern (IARC, EU, FDA). It doesn't yet rate nutrition or substances formed by cooking.",
  "no-data":  () => "This product has no ingredient list yet.",
  "non-food": () => "Checks for cleaning, personal-care and other products are coming later.",
};

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

function FlagRow({ flag, open, onToggle }: { flag: Flag; open: boolean; onToggle: () => void }) {
  const { entry, matchedText } = flag;
  const look = VERDICT_STYLE[entry.severity];
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
          <p className="text-[10px] text-gray-400 mt-0.5">Listed as “{matchedText}”</p>
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
  const best = bestPrice(product);

  // Same category, strictly better verdict; only offered when this product has concerns.
  const alternatives = useMemo(() => {
    if (analysis.verdict !== "high" && analysis.verdict !== "some") return [];
    const mine = VERDICT_RANK[analysis.verdict];
    return products
      .filter(p => p.id !== product.id && p.category === product.category)
      .map(p => ({ p, a: safeAnalyze(p) }))
      .filter(({ a }) => VERDICT_RANK[a.verdict] < mine)
      .sort((x, y) => VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict]
        || x.a.flags.length - y.a.flags.length
        || bestPrice(x.p) - bestPrice(y.p))
      .slice(0, 3);
  }, [products, product, analysis]);

  const stores = [
    product.amazon   ? { name: "Amazon",         icon: "📦", price: product.amazon.price,   color: "#FF9900", rating: product.amazon.rating,  condition: "" } : null,
    product.walmart  ? { name: "Walmart",        icon: "🛒", price: product.walmart.price,  color: "#0071CE", rating: product.walmart.rating, condition: "" } : null,
    product.facebook ? { name: "FB Marketplace", icon: "👥", price: product.facebook.price, color: "#1877F2", rating: 0, condition: product.facebook.condition } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ── */}
      <div className="flex-shrink-0 relative" style={{ background: look.gradient, minHeight: 268 }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft size={18} color="white" />
          </button>
          <div className="flex gap-2">
            <button onClick={onToggleSave} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Bookmark size={16} fill={saved ? "white" : "none"} color="white" />
            </button>
            <button aria-label="Share" className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Share2 size={16} color="white" />
            </button>
          </div>
        </div>

        <div className="pt-16 pb-5 px-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xl">
            <ShoppingBag size={36} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.brand}</span>
              <span className="text-white/30">·</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight mb-2">{product.name}</h1>
            {Number.isFinite(best) && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-extrabold text-white">${best.toFixed(2)}</span>
                <span className="text-sm text-white/60">best price</span>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {stores.map(s => (
                <span key={s.name} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {s.icon} {s.name === "FB Marketplace" ? "FB" : s.name}
                </span>
              ))}
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

          {/* ── Verdict ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: `4px solid ${look.color}` }}>
            <div className="flex items-center gap-2">
              <look.Icon size={18} style={{ color: look.color }} />
              <span className="font-extrabold text-sm" style={{ color: look.color }}>{verdictHeadline(analysis)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{SMALL_PRINT[analysis.verdict](analysis)}</p>
          </div>

          {/* ── Flagged ingredients ── */}
          {analysis.flags.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">Ingredients of concern</div>
              <div className="divide-y divide-gray-50">
                {analysis.flags.map(f => (
                  <FlagRow key={f.entry.id} flag={f} open={openFlag === f.entry.id}
                    onToggle={() => setOpenFlag(openFlag === f.entry.id ? null : f.entry.id)} />
                ))}
              </div>
            </div>
          )}

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
              Ingredient profiles researched with AI and verified against IARC, EU and FDA sources.
              Classifications describe potential hazards; this is not medical advice.
            </p>
          </div>

          {/* ── Price Comparison ── */}
          {stores.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <DollarSign size={15} className="text-primary" />
                <span className="font-bold text-sm">Price Comparison</span>
                <span className="ml-auto text-primary font-extrabold text-sm">${best.toFixed(2)} best</span>
              </div>
              {stores.map(store => (
                <div key={store.name} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{store.icon}</span>
                    <div>
                      <p className="text-[11px] font-bold leading-tight">{store.name}</p>
                      {store.rating
                        ? <div className="flex items-center gap-0.5 mt-0.5"><Star size={8} className="fill-amber-400 text-amber-400" /><span className="text-[9px] text-gray-400">{store.rating}</span></div>
                        : store.condition && <p className="text-[9px] text-gray-400 mt-0.5">{store.condition}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: store.color }}>${store.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

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
                  const altPrice = bestPrice(p);
                  return (
                    <button key={p.id} onClick={() => onSelectProduct(p)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: altLook.bg }}>
                        <ShoppingBag size={20} style={{ color: altLook.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">{p.brand}</p>
                        <p className="text-sm font-semibold leading-tight">{p.name}</p>
                        {Number.isFinite(altPrice) && <p className="text-xs text-gray-500 mt-0.5">from ${altPrice.toFixed(2)}</p>}
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

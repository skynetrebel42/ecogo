import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import { loadCatalog, type ResourceRow } from "../lib/catalog";
import MapTab from "./components/MapTab";
import ProductDetailScreen from "./components/ProductDetailScreen";
import ScanTab from "./components/ScanTab";
import csvText from "../data/products.csv?raw";
import { parseProductsCSV, type Product } from "../lib/productImporter";
import { VERDICT_STYLE, safeAnalyze, formsWhenCooked, fewestConcerns } from "./components/verdict";
import { foodIcon } from "../lib/foodIcon";
import { TEXT_SIZES, applySettings, loadSettings, saveSettings, type Settings } from "../lib/settings";
import { NutritionChip } from "./components/NutritionPanel";
import { topHigh } from "../lib/nutrition";
import { knownNutrition, searchFoods, isPersonalCare } from "../lib/lookup";
import { supabaseFoods } from "../lib/foodsDb";
import { searchCatalog } from "../lib/search";
import { addRecent, resolveRecent, loadRecent, saveRecent, type RecentEntry } from "../lib/recent";
import { refreshSnapshot, resolveSaved, loadSaved, saveSaved, type SavedStore } from "../lib/saved";
import Explainer, { EXPLAINERS, type ExplainerId } from "./components/Explainer";
import IngredientCheck, { type CheckKind } from "./components/IngredientCheck";
import AddProductFlow, { type AddMode } from "./components/AddProductFlow";
import ListScreen from "./components/ListScreen";
import { BADGES, milestones, productCount, readContributions } from "../lib/contributions";
import { supabase } from "../lib/supabase";
import mascotUrl from "../assets/welcome-mascot.webp";
import {
  Home, Map as MapIcon, Camera, Heart, User, Search, ArrowLeft, ChevronDown, ChevronRight,
  Bookmark, Wifi, QrCode
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type AppState = "welcome" | "main";
// The Map is back with real Los Angeles places from OpenStreetMap (M9).
type Tab = "home" | "map" | "scan" | "saved" | "profile";
type SubScreen = "search-results" | "product-detail" | "check-ingredients" | "add-product" | null;

// ── Data ─────────────────────────────────────────────────────────────────────
// Bundled CSV catalog: shown until Supabase answers, and kept as the offline
// fallback. The live catalog comes from the database (src/lib/catalog.ts).
const PRODUCTS: Product[] = parseProductsCSV(csvText);

/** Phones get the app full-screen; desktop keeps the phone frame (M6 spec §4.5).
 *  ponytail: decided once at load; a window resized across 500 px keeps its layout until reload. */
const IS_PHONE = typeof window !== "undefined" && window.matchMedia("(max-width: 499px)").matches;

// ── Status Bar ────────────────────────────────────────────────────────────────
function StatusBar({ light = false }: { light?: boolean }) {
  // On a real phone the device draws its own status bar: keep only the notch's safe area.
  if (IS_PHONE) return <div className="flex-shrink-0" style={{ height: "env(safe-area-inset-top)" }} />;
  const cls = light ? "text-white" : "text-foreground";
  return (
    <div className={`flex items-center justify-between px-7 pt-3 pb-1 text-mini font-bold flex-shrink-0 ${cls}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-end gap-0.5">
          {[2, 3, 4, 5].map((h, i) => <div key={i} className="w-[3px] rounded-sm" style={{ height: h, background: "currentColor" }} />)}
        </div>
        <Wifi size={11} />
        <div className="flex items-center">
          <div className="w-5 h-2.5 rounded-[3px] border border-current flex items-center px-0.5 gap-0.5">
            <div className="flex-1 h-full rounded-sm" style={{ background: "currentColor", opacity: 0.9 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m73-welcome-cleanup-design.md. Shown once per device; promises only what
// EcoGo does today.
const WELCOMED_KEY = "ecogo.welcomed.v1";
const wasWelcomed = () => { try { return localStorage.getItem(WELCOMED_KEY) === "1"; } catch { return false; } };
const markWelcomed = () => { try { localStorage.setItem(WELCOMED_KEY, "1"); } catch { /* shows again next visit */ } };

// The lens logo, redrawn from the approved brand art: cream ring and handle, golden crescent, cream dot.
function LensLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="12 9 155 151" className={className} aria-hidden="true">
      <circle cx="81" cy="78" r="58" fill="none" stroke="#F8F7F2" strokeWidth="18" />
      <path d="M122 120 L153 149" stroke="#F8F7F2" strokeWidth="20" strokeLinecap="round" />
      <path d="M85.4 54.2 A28 28 0 1 0 78.1 109.6" fill="none" stroke="#FDB20E" strokeWidth="22" strokeLinecap="round" />
      <circle cx="107" cy="85" r="11" fill="#F8F7F2" />
    </svg>
  );
}

function WelcomeScreen({ onScan, onLookAround }: { onScan: () => void; onLookAround: () => void }) {
  // The page scrolls as one piece: with large text on a short phone the hero stops shrinking at its minimum and the
  // buttons stay reachable by scrolling.
  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto" style={{ background: "#1A5C39" }}>
      <StatusBar light />
      <div className="flex-1 min-h-[200px] flex flex-col relative overflow-hidden">
        <div aria-hidden="true">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white/[0.06]" style={{ transform: "translate(35%, -40%)" }} />
          <div className="absolute top-1/3 left-0 w-44 h-44 rounded-full bg-white/[0.05]" style={{ transform: "translate(-55%, 0)" }} />
          <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-white/[0.05]" style={{ transform: "translate(45%, 10%)" }} />
          <div className="absolute left-1/2 bottom-0 w-[78%] max-w-[340px] aspect-square rounded-full bg-white/[0.07]" style={{ transform: "translate(-50%, 22%)" }} />
        </div>
        <p className="relative flex items-center justify-center gap-2 pt-5 text-white font-extrabold text-[calc(30px*var(--text-scale,1))] leading-none">
          <LensLogo className="w-10 h-10" />
          EcoGo
        </p>
        <div className="relative flex-1 min-h-0 mt-3">
          <div aria-hidden="true" className="absolute left-1/2 bottom-2 w-[72%] max-w-[320px] h-5 rounded-[50%] bg-black/[0.12]" style={{ transform: "translateX(-50%)" }} />
          <img src={mascotUrl} alt="" className="absolute left-[6%] top-0 w-[88%] h-[calc(100%-12px)] object-contain object-bottom" />
        </div>
      </div>
      <div className="bg-background rounded-t-[36px] -mt-2 relative px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex-shrink-0 text-center">
        <h1 className="text-[calc(34px*var(--text-scale,1))] font-extrabold text-foreground leading-[1.05] tracking-tight mb-3">
          Scan. Learn. Decide.
        </h1>
        <p className="text-foreground text-base mb-6 leading-snug">
          Explore ingredients in food and personal care, with sources behind each flag.
        </p>
        <button onClick={onScan} className="w-full py-4 bg-primary text-white rounded-full font-bold text-lg shadow-lg active:scale-98 transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 ring-primary">
          Start scanning
        </button>
        <button onClick={onLookAround} className="w-full text-primary font-bold text-base py-3 mt-1 rounded-full focus-visible:ring-2 ring-primary">
          Look around first
        </button>
        <div className="flex items-start gap-3 text-left border-t border-border mt-3 pt-4">
          <svg viewBox="0 0 24 24" className="w-7 h-7 flex-shrink-0 text-foreground" aria-hidden="true">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="3" fill="#FDB20E" />
          </svg>
          <div>
            <h2 className="text-sm font-bold text-foreground">Help the collection grow.</h2>
            <p className="text-sm text-muted-foreground leading-snug">Add missing products or suggest local food resources.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Free to explore. No account needed.</p>
      </div>
    </div>
  );
}

// ── Product Card (mini) ───────────────────────────────────────────────────────
// 056 R2-03: search rows add a grey line to tell look-alikes apart. No record carries a package size, so it's the barcode.
function ProductCard({ product, onSelect, barcodeLine = false }: { product: Product; onSelect: (p: Product) => void; barcodeLine?: boolean }) {
  const a = safeAnalyze(product);
  const look = VERDICT_STYLE[a.verdict];
  // Only nutrition already known this session: a list never triggers lookups (USDA rate limit).
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
  return (
    <button onClick={() => onSelect(product)}
      className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3 active:scale-98 transition-transform">
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-2xl" aria-hidden="true">
        {foodIcon(product)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-micro text-muted-foreground font-medium">{product.brand}</p>
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
        {barcodeLine && product.barcode && <p className="text-micro text-muted-foreground mt-0.5">Barcode {product.barcode}</p>}
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="flex items-center gap-1 text-micro font-bold" style={{ color: look.color }}>
          <look.Icon size={12} /> {look.short}
        </span>
        {formsWhenCooked(a) && <span className="text-nano text-muted-foreground">🔥 forms when cooked</span>}
        {high && <NutritionChip text={high.short} />}
      </div>
    </button>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.2 (layout A, real content only).
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

function RecentCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const look = VERDICT_STYLE[safeAnalyze(product).verdict];
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
  return (
    <button onClick={() => onSelect(product)}
      className="flex-shrink-0 w-28 bg-card border border-border rounded-2xl p-2.5 text-left shadow-sm flex flex-col gap-1.5">
      <span className="text-xs font-bold leading-tight line-clamp-2">{product.name}</span>
      <span className="flex items-center gap-1 text-micro font-bold" style={{ color: look.color }}>
        <look.Icon size={10} /> {look.short}
      </span>
      {high && <NutritionChip text={high.short} />}
    </button>
  );
}

function HomeTab({ onSearch, onSelectProduct, onGoScan, onSeeAllRecent, onClearRecent, onOpenExplainer, recent }: {
  onSearch: (q: string) => void; onSelectProduct: (p: Product) => void; onGoScan: () => void;
  onSeeAllRecent: () => void; onClearRecent: () => void; onOpenExplainer: (id: ExplainerId, from: HTMLElement) => void; recent: Product[];
}) {
  const [q, setQ] = useState("");
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-4" style={{ scrollbarWidth: "none" }}>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{greeting()}</p>
        <h1 className="text-xl font-extrabold leading-tight text-primary">What are you checking?</h1>
      </div>

      <button onClick={onGoScan} className="w-full flex items-center gap-3.5 p-4 rounded-3xl bg-primary text-white text-left shadow-md active:scale-98 transition-transform">
        <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0"><QrCode size={24} /></span>
        <span className="flex flex-col">
          <span className="text-base font-extrabold">Scan a product</span>
          <span className="text-xs text-white/85">Point your camera at the barcode</span>
        </span>
      </button>

      <div className="flex items-center gap-2.5 bg-muted rounded-2xl px-4 py-3">
        <Search size={15} className="text-muted-foreground flex-shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          placeholder="Search products, brands…"
          aria-label="Search products"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && q.trim() && onSearch(q)}
        />
      </div>

      {recent.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-bold text-base">Recently viewed</h2>
            <span className="flex gap-3">
              <button onClick={onClearRecent} aria-label="Clear recently viewed" className="text-xs font-semibold text-muted-foreground">Clear</button>
              <button onClick={onSeeAllRecent} className="text-xs font-bold text-primary">See all</button>
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
            {recent.map(p => <RecentCard key={p.id} product={p} onSelect={onSelectProduct} />)}
          </div>
        </div>
      )}

      {/* M12 (decision 035): the Learn tiles, two per row (an odd last one spans the row, 064 G4); each opens its page and is
          named by the page's full title, which must contain the visible label (D3, WCAG 2.5.3 for voice control), so a title
          without it gets the label first. */}
      <div>
        <h2 className="font-bold text-base mb-2">Learn</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {(Object.keys(EXPLAINERS) as ExplainerId[]).map(id => {
            const { title, label, tile, Icon } = EXPLAINERS[id];
            const name = title.toLowerCase().includes(label.toLowerCase()) ? title : `${label}: ${title}`;
            return (
              <button key={id} onClick={e => onOpenExplainer(id, e.currentTarget)} aria-label={name} style={{ background: tile }}
                className="odd:last:col-span-2 min-h-[88px] rounded-2xl p-3.5 text-left text-white flex flex-col justify-between gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 ring-primary">
                <Icon size={24} aria-hidden="true" />
                <span className="text-sm font-extrabold leading-tight break-words hyphens-auto">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Search Results ────────────────────────────────────────────────────────────
function SearchResultsScreen({ query, onBack, onSelectProduct, products }: {
  query: string; onBack: () => void; onSelectProduct: (p: Product) => void; products: Product[];
}) {
  // "More from USDA": real products beyond our catalog, from EcoGo's copy of USDA FoodData Central (one request per search text per session).
  const [usda, setUsda] = useState<{ status: "loading" | "ok" | "error"; products: Product[] }>({ status: "loading", products: [] });
  useEffect(() => {
    let live = true;
    setUsda({ status: "loading", products: [] });
    searchFoods(query, { foods: supabaseFoods }).then(r => {
      if (live) setUsda(r.status === "ok" ? { status: "ok", products: r.products } : { status: "error", products: [] });
    });
    return () => { live = false; };
  }, [query]);
  const raw = searchCatalog(products, query);
  const results = raw
    .map(p => ({ p, a: safeAnalyze(p) }))
    .sort((x, y) => fewestConcerns(x.a, y.a))
    .map(({ p }) => p);
  const isEmpty = results.length === 0 && usda.status !== "loading" && usda.products.length === 0;
  // 063 F8: a search that found only personal care shows no food (USDA) section unless USDA found something.
  const showUsda = usda.products.length > 0 || !results.length || !results.every(isPersonalCare);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      {/* No inner StatusBar — outer one persists */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <Search size={13} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{query}</span>
        </div>
      </div>
      {results.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
          <span className="text-xs text-muted-foreground font-medium">Sorted by fewest concerns</span>
          <span className="ml-auto text-xs text-muted-foreground">{results.length} found</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center pb-12">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search size={28} className="text-muted-foreground opacity-40" />
            </div>
            <p className="font-bold text-base text-foreground mb-1">No results for "{query}"</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Try a product name, brand, or category like "snacks", "shampoo", or "sunscreen".</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">Or scan its barcode.</p>
            <button onClick={onBack} className="px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-bold">
              Back to Home
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            {results.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} barcodeLine />)}
            {showUsda && <div className="pt-2">
              <p className="text-xs font-bold text-foreground">More from USDA FoodData Central</p>
              <p className="text-micro text-muted-foreground mb-2">Label data supplied by manufacturers · not in our catalog</p>
              {usda.status === "loading" && <p className="text-xs text-muted-foreground">Searching USDA…</p>}
              {usda.status === "error" && <p className="text-xs text-muted-foreground">Couldn't search right now.</p>}
              {usda.status === "ok" && usda.products.length === 0 && <p className="text-xs text-muted-foreground">No USDA matches.</p>}
              <div className="space-y-3">
                {usda.products.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} barcodeLine />)}
              </div>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Saved Tab ────────────────────────────────────────────────────────────────
function SavedTab({ saved, scanned, tab, onTab, onSelectProduct, products, openList, onOpenList, onChangeSaved }: {
  saved: SavedStore; scanned: Product[]; tab: "favorites" | "scanned"; onTab: (t: "favorites" | "scanned") => void;
  onSelectProduct: (p: Product) => void; products: Product[];
  openList: string | null; onOpenList: (id: string | null) => void; onChangeSaved: (s: SavedStore, undoText?: string) => void;
}) {
  const favs = resolveSaved(saved, products);
  const card = (p: Product) => <ProductCard product={p} onSelect={onSelectProduct} />;
  // M14 part 3: with lists, Favorites shows folders ("All saved", then each list, oldest first); a row opens its screen.
  const list = saved.lists.find(l => l.id === openList) ?? null;
  if (openList === "all" || list) {
    return <ListScreen list={list} products={list ? resolveSaved(saved, products, list.ids) : favs} store={saved}
      onChangeSaved={onChangeSaved} onBack={() => onOpenList(null)} card={card} />;
  }
  const row = (id: string, name: string, n: number) => (
    <button key={id} onClick={() => onOpenList(id)} aria-label={`${name}, ${n} product${n === 1 ? "" : "s"}`} className="w-full min-h-[56px] bg-card border border-border rounded-2xl px-4 flex items-center gap-3 text-left">
      <span className="flex-1 min-w-0 font-bold truncate">{name}</span>
      <span className="text-sm text-muted-foreground">{n}</span>
      <ChevronRight size={18} aria-hidden="true" className="text-muted-foreground" />
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="px-5 pt-4">
        <h1 className="text-xl font-extrabold mb-4">Saved</h1>
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {(["favorites", "scanned"] as const).map(t => (
            <button key={t} onClick={() => onTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t ? "bg-white shadow text-foreground" : "text-muted-foreground"}`}>
              {t === "favorites" ? "Favorites" : "Viewed" /* 056 R2-04: label only; the stored key stays "scanned" */}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-8 space-y-3">
        {tab === "favorites" && (
          favs.length === 0 ? (
            <div className="text-center py-16">
              <Bookmark size={44} className="mx-auto text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-foreground">No saved items</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the bookmark on any product to save it</p>
            </div>
          ) : saved.lists.length === 0 ? favs.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />)
          : [row("all", "All saved", favs.length), ...saved.lists.map(l => row(l.id, l.name, resolveSaved(saved, products, l.ids).length))]
        )}
        {tab === "scanned" && (
          scanned.length === 0 ? (
            <div className="text-center py-16">
              <QrCode size={44} className="mx-auto text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-foreground">No viewed products yet</p>
            </div>
          ) : scanned.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />)
        )}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m72-profile-cleanup-design.md (layout A). Only true things; no account yet.
const SOURCES_INFO = [
  { name: "USDA FoodData Central", text: "Label data supplied by the makers, copied into EcoGo's database about twice a year (each product page shows its snapshot date). Checked first. Source: U.S. Department of Agriculture, Agricultural Research Service, FoodData Central, fdc.nal.usda.gov." },
  { name: "Open Food Facts", text: "Crowd-sourced, used when USDA has no match, and always marked." },
  { name: "IARC, EU, FDA, EFSA, WHO", text: "The official findings behind every badge, each linked on the product page." },
  { name: "FDA % Daily Value", text: "Sugar, saturated fat and salt per serving, by the FDA's 5/20 rule." },
  { name: "OpenStreetMap", text: "Map places, community-edited. Hours can change." },
];

/** M11 3.3: one expandable Profile row; closed by default, independent, open state not remembered (D7). */
function Accordion({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="bg-card border border-border rounded-2xl">
      <h2>
        <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}
          className="w-full min-h-[56px] px-3.5 py-2.5 flex items-center gap-3 text-left">
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-base">{title}</span>
            {!open && <span className="block text-xs text-muted-foreground truncate">{summary}</span>}
          </span>
          <ChevronDown size={18} aria-hidden="true" className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <div id={id} role="region" aria-label={title} hidden={!open} className="px-3.5 pb-3.5 space-y-2.5">{children}</div>
    </section>
  );
}

/** M11 3.4 (D4-D6): text size and high contrast, always visible, applied at once and kept on this device. */
function DisplayCard() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const change = (s: Settings) => { setSettings(s); applySettings(document.documentElement, s); saveSettings(s); };
  const high = settings.contrast === "high";
  return (
    <section className="bg-card border border-border rounded-2xl p-3.5 space-y-3">
      <h2 className="font-bold text-base">Display</h2>
      <div>
        <p id="text-size-label" className="text-sm font-bold">Text size</p>
        <p className="text-xs text-muted-foreground mb-2">Makes the words bigger; the layout stays the same.</p>
        {/* Native radios: arrow keys and one tab stop come free; the label is the 44 px button. */}
        <div role="radiogroup" aria-labelledby="text-size-label" className="grid grid-cols-3 gap-2">
          {TEXT_SIZES.map(t => (
            <label key={t.id} className="min-h-[44px] flex items-center justify-center rounded-xl border border-border text-sm font-bold cursor-pointer has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring">
              <input type="radio" name="text-size" value={t.id} checked={settings.textSize === t.id} className="sr-only"
                onChange={() => change({ ...settings, textSize: t.id })} />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <button role="switch" aria-checked={high} onClick={() => change({ ...settings, contrast: high ? "normal" : "high" })}
        className="w-full min-h-[44px] flex items-center gap-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold">High contrast</span>
          <span className="block text-xs text-muted-foreground">Darker text and borders. Starts from your phone's contrast setting.</span>
        </span>
        <span aria-hidden="true" className={`w-11 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors ${high ? "bg-primary" : "bg-gray-500"}`}>
          <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${high ? "translate-x-5" : ""}`} />
        </span>
      </button>
    </section>
  );
}

/** M15 C1–C4: counts from the person's own server rows, read each time Profile opens; never signs anyone in. */
function ContributionsCard() {
  const [read, setRead] = useState<Awaited<ReturnType<typeof readContributions>> | "loading">("loading");
  useEffect(() => {
    let live = true;
    readContributions(supabase).catch(() => null).then(r => { if (live) setRead(r); });
    return () => { live = false; };
  }, []);
  const counts = read === "none" ? { products: 0, places: 0 }
    : read && read !== "loading" ? { products: productCount(read.barcodes), places: read.places } : undefined;
  const m = counts && milestones(counts.products + counts.places);
  return (
    <section aria-labelledby="contributions-title" aria-busy={read === "loading"} className="bg-card border border-border rounded-2xl p-3.5 space-y-3">
      <h2 id="contributions-title" className="font-bold text-base">Your contributions</h2>
      {read === null && <p role="alert" className="text-sm font-bold">Couldn't load your contributions.</p>}
      {counts && (
        <dl className="grid grid-cols-2 gap-2">
          {([["Products sent to Open Food Facts", counts.products], ["Map fixes EcoGo approved", counts.places]] as const).map(([label, n]) => (
            <div key={label} className="rounded-xl bg-muted p-2.5 flex flex-col-reverse justify-end">
              <dt className="text-xs text-gray-700 leading-snug">{label}</dt>{/* 063 F11: 4.5:1 on the muted tile */}
              <dd className="text-2xl font-extrabold text-primary">{n}</dd>
            </div>
          ))}
        </dl>
      )}
      {m && (
        <ul aria-label="Milestones" className="flex flex-wrap gap-1.5">
          {BADGES.map(b => m.reached.includes(b)
            ? <li key={b} className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">{b}<span className="sr-only">, reached</span></li>
            : m.next?.badge === b
              ? <li key={b} className="px-2.5 py-1 rounded-full border-2 border-primary text-primary text-xs font-bold">{b}<span className="font-semibold">: {m.next.toGo} more to go</span></li>
              : <li key={b} className="px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground text-xs font-bold">{b}</li>)}
        </ul>
      )}
      {read === "none" && <p className="text-sm">Send a product or a map fix to start counting.</p>}
      <p className="text-xs text-muted-foreground leading-relaxed">Counted from what Open Food Facts took and what EcoGo approved. Kept with this device's anonymous sign-in: clearing site data or a new phone starts from zero.</p>
    </section>
  );
}

function ProfileTab({ recentCount, onClearRecent }: { recentCount: number; onClearRecent: () => void }) {
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-3.5" style={{ scrollbarWidth: "none" }}>
      <div>
        <h1 className="text-xl font-extrabold leading-tight text-primary">Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">No account. Your saved products, lists and history stay in this browser. Privacy, below, lists what's sent.</p>
      </div>

      <ContributionsCard />

      <DisplayCard />

      <Accordion title="Your data"
        summary={recentCount === 0 ? "Nothing viewed yet, on this device" : `${recentCount} recent product${recentCount === 1 ? "" : "s"}, on this device`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Recently viewed</p>
            <p className="text-xs text-muted-foreground">
              {recentCount === 0 ? "Nothing viewed yet" : `${recentCount} product${recentCount === 1 ? "" : "s"}, saved in this browser only`}
            </p>
          </div>
          {recentCount > 0 && (
            <button onClick={onClearRecent} aria-label="Clear recently viewed"
              className="px-3.5 rounded-xl border border-border text-xs font-bold flex-shrink-0" style={{ minHeight: 44 }}>Clear</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">Saved products and lists stay in this browser. Clearing site data removes them.</p>
      </Accordion>

      <Accordion title="Where results come from" summary="USDA, Open Food Facts, IARC and more">
        {SOURCES_INFO.map(s => (
          <div key={s.name}>
            <p className="text-sm font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
          </div>
        ))}
      </Accordion>

      <Accordion title="Privacy" summary="What leaves your phone">
        <p className="text-xs text-foreground/80 leading-relaxed">The camera reads barcodes on your phone. Ingredient photos are read on your phone too; checking a list without a barcode sends nothing.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">If you add a product, what you send goes to Open Food Facts and is public there: the photos, the ingredients you checked, the barcode and the name. EcoGo keeps an anonymous ID and a log of your submissions (barcode, time, result). At your first Send, Cloudflare runs a human check.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">To find a product, its barcode or search words are sent to EcoGo's database (hosted on Supabase) and, if it isn't there, to Open Food Facts.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">The product catalog loads from EcoGo's database. Your recently viewed list stays in this browser.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">The map asks for your location only when you tap My location. Your location stays on your phone. Map images load from OpenStreetMap's servers, which see the map area you're viewing, as with any web map.</p>
      </Accordion>

      <p className="text-mini text-muted-foreground text-center leading-relaxed">
        A student project. Not medical advice.{" "}
        <a href="https://github.com/skynetrebel42/ecogo" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Source code and updates</a>
      </p>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
/** locked: a form over the tab (M8.1's PlaceForm) is open, so the tabs can't be reached until it closes. */
function BottomNav({ activeTab, onTabChange, locked }: { activeTab: Tab; onTabChange: (t: Tab) => void; locked: boolean }) {
  const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
    { id: "home",    Icon: Home,   label: "Home"    },
    { id: "map",     Icon: MapIcon, label: "Map"    },
    { id: "scan",    Icon: Camera, label: "Scan"    },
    { id: "saved",   Icon: Heart,  label: "Saved"   },
    { id: "profile", Icon: User,   label: "Profile" },
  ];
  return (
    <div className="flex-shrink-0 bg-card border-t border-border flex items-center justify-around px-3 pt-2 pb-4" {...(locked ? { inert: "" } : {})}
      style={IS_PHONE ? { paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" } : undefined}>
      {TABS.map(({ id, Icon, label }) => {
        const active = activeTab === id;
        const isScan = id === "scan";
        return (
          <button key={id} onClick={() => onTabChange(id)} className="flex flex-col items-center gap-0.5 relative">
            {isScan ? (
              <div className="w-13 h-13 -mt-7 rounded-full shadow-xl flex items-center justify-center" style={{ width: 52, height: 52, marginTop: -28, background: "linear-gradient(160deg, #1A5C39, #10B981)" }}>
                <Icon size={22} color="white" />
              </div>
            ) : (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${active ? "bg-primary/10" : ""}`}>
                <Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} fill={active && id === "saved" ? "currentColor" : "none"} />
              </div>
            )}
            <span className={`text-nano font-bold mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState<AppState>(() => wasWelcomed() ? "main" : "welcome");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addCode, setAddCode] = useState(""); // the not-found barcode being added (M8)
  const [addMode, setAddMode] = useState<AddMode>("new"); // follow-up 5: or an OFF product's missing ingredients / new photos
  const [addPhoto, setAddPhoto] = useState<Blob>(); // 058 L2: the label photo from "Check the label yourself"
  const [checkKind, setCheckKind] = useState<CheckKind>("food"); // M16 N6: the check's starting "What is it?" answer
  const [searchQuery, setSearchQuery] = useState("");
  // Saved products and lists, and Recently scanned: on this device only (M14 part 1, M7 spec §4.1).
  const [saved, setSaved] = useState<SavedStore>(loadSaved);
  const [savedOk, setSavedOk] = useState(true);
  useEffect(() => setSavedOk(saveSaved(saved)), [saved]);
  // D6: "Removed · Undo" / "Deleted · Undo" for 5 s. Undo restores the store as it was; any other change drops the offer,
  // so restoring never loses a later edit.
  const [undo, setUndo] = useState<{ text: string; prev: SavedStore } | null>(null);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 5000); return () => clearTimeout(t); }, [undo]);
  // Writing here too means the sheet opens with the right title when this very write fails.
  const changeSaved = (next: SavedStore, undoText?: string) => { setSavedOk(saveSaved(next)); setUndo(undoText ? { text: undoText, prev: saved } : null); setSaved(next); };
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  useEffect(() => saveRecent(recent), [recent]);
  // Kept here, like openList, so Back from a product returns to the same Saved sub-tab (054 K-19).
  const [savedTab, setSavedTab] = useState<"favorites" | "scanned">("favorites");
  const [openList, setOpenList] = useState<string | null>(null); // kept here so Back from a product returns to the list
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);
  const [mapForm, setMapForm] = useState(false); // M8.1: Suggest / Report open on the Map, so the tabs are locked
  // 054 ACCESS-01: Back from an article returns focus to the tile that opened it (the screen behind stays mounted, inert).
  // The tile comes from the click: Safari doesn't focus a tapped button.
  const explainerOpener = useRef<HTMLElement | null>(null);
  const openExplainer = (id: ExplainerId, from: HTMLElement) => { explainerOpener.current = from; setExplainer(id); };
  useEffect(() => { if (!explainer) explainerOpener.current?.focus(); }, [explainer]);


  // ── Live data from Supabase ──────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  // The Map's places come only from the database: no bundled copy (M9 spec D11).
  const [places, setPlaces] = useState<ResourceRow[]>([]);
  const [dbStatus, setDbStatus] = useState<"loading" | "live" | "offline">("loading");

  // The catalog is read-only for visitors, so one load per visit is enough (no realtime channel).
  useEffect(() => {
    loadCatalog().then(catalog => {
      // An empty catalog means a misconfigured DB, not "live" data: keep the bundled copy.
      if (catalog.products.length === 0) throw new Error("catalog is empty");
      setProducts(catalog.products);
      setPlaces(catalog.resources);
      setDbStatus("live");
    }).catch(err => {
      console.warn("[catalog] using bundled data:", err);
      setDbStatus("offline");
    });
  }, []);

  // Every product opened counts as "looked at": Scan, search (catalog or USDA), Saved and Recently scanned.
  // 054 K-19: a product opened from search goes Back to the same results (kept mounted underneath, scroll and all);
  // one opened from another product (alternatives) keeps where that one came from.
  const [productFrom, setProductFrom] = useState<SubScreen>(null);
  const openProduct = (p: Product) => {
    setRecent(prev => addRecent(prev, p));
    setSaved(prev => refreshSnapshot(prev, p));
    if (subScreen !== "product-detail") setProductFrom(subScreen === "search-results" ? "search-results" : null);
    setSelectedProduct(p); setSubScreen("product-detail");
  };
  const recentProducts = resolveRecent(recent, products);
  const openSearch = (q: string) => { setSearchQuery(q); setSubScreen("search-results"); };

  return (
    <div className={IS_PHONE ? "fixed inset-0" : "min-h-screen flex items-center justify-center p-4"}
      style={IS_PHONE ? undefined : { background: "linear-gradient(135deg, #0a1a0f 0%, #1A5C39 50%, #0d3d2b 100%)" }}>
      <div className={IS_PHONE ? "absolute inset-0 overflow-hidden" : "relative overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.7)] flex-shrink-0"}
        style={IS_PHONE
          ? { background: "#F8F7F2", fontFamily: "'Plus Jakarta Sans', sans-serif" }
          : { width: 390, height: 844, borderRadius: 44, background: "#F8F7F2", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Welcome: first visit on this device only */}
        {appState === "welcome" && (
          <WelcomeScreen
            onScan={() => { markWelcomed(); setActiveTab("scan"); setAppState("main"); }}
            onLookAround={() => { markWelcomed(); setAppState("main"); }}
          />
        )}

        {/* Main app */}
        {appState === "main" && (
          <div className="absolute inset-0 flex flex-col bg-background">
            <style>{`@keyframes ft{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <StatusBar />

            {/* Offline banner — sits below status bar, non-scrolling */}
            {dbStatus === "offline" && (
              <div className="flex items-center justify-center gap-1.5 py-1 bg-amber-50 border-b border-amber-100 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-nano font-bold text-amber-700 tracking-wide">Offline — showing the built-in catalog</span>
              </div>
            )}

            <div className="flex-1 overflow-hidden relative">
              {/* Tab content — animated on switch, hidden when sub-screen is open */}
              {!subScreen && (
                <div key={activeTab} {...(explainer ? { inert: "" } : {})} style={{ animation: "ft 0.16s ease-out", height: "100%", overflow: "hidden", position: "relative" }}>
                  {activeTab === "home" && (
                    <HomeTab
                      onSearch={openSearch}
                      onSelectProduct={openProduct}
                      onGoScan={() => setActiveTab("scan")}
                      onSeeAllRecent={() => { setSavedTab("scanned"); setOpenList(null); setActiveTab("saved"); }}
                      onClearRecent={() => setRecent([])}
                      onOpenExplainer={openExplainer}
                      recent={recentProducts}
                    />
                  )}
                  {activeTab === "map"     && <MapTab places={places} status={dbStatus} onFormOpen={setMapForm} />}
                  {activeTab === "scan"    && (
                    <ScanTab products={products} onScanResult={openProduct} onCheckIngredients={kind => { setCheckKind(kind); setSubScreen("check-ingredients"); }}
                      onAdd={(code) => { setAddCode(code); setAddMode("new"); setAddPhoto(undefined); setSubScreen("add-product"); }} />
                  )}
                  {activeTab === "saved"   && <SavedTab saved={saved} scanned={recentProducts} tab={savedTab} onTab={setSavedTab} onSelectProduct={openProduct} products={products}
                    openList={openList} onOpenList={setOpenList} onChangeSaved={changeSaved} />}
                  {activeTab === "profile" && <ProfileTab recentCount={recentProducts.length} onClearRecent={() => setRecent([])} />}
                </div>
              )}

              {/* Sub-screen overlays — fill content area, slide over tab content */}
              {explainer && !subScreen && <Explainer id={explainer} onBack={() => setExplainer(null)} />}
              {subScreen === "check-ingredients" && <IngredientCheck kind={checkKind} onClose={() => setSubScreen(null)} />}
              {/* Follow-up 5: opened from a product page, Close goes back to it; "Scan another product" goes to Scan. */}
              {subScreen === "add-product" && <AddProductFlow code={addCode} mode={addMode} ingredientsPhoto={addPhoto} onDone={() => { setSubScreen(null); setActiveTab("scan"); }}
                onClose={() => setSubScreen(addMode === "new" ? null : "product-detail")} />}
              {subScreen === "product-detail" && selectedProduct && (
                <ProductDetailScreen
                  key={selectedProduct.id}
                  product={selectedProduct}
                  onBack={() => setSubScreen(productFrom)}
                  store={saved}
                  savedOk={savedOk}
                  onChangeSaved={changeSaved}
                  onSelectProduct={openProduct}
                  onAddToOff={(mode, photo) => { setAddCode(selectedProduct.barcode); setAddMode(mode); setAddPhoto(photo); setSubScreen("add-product"); }}
                />
              )}

              {/* After the product, so the product's Back comes first; hidden (not unmounted) while a product from it is open */}
              {(subScreen === "search-results" || (subScreen === "product-detail" && productFrom === "search-results")) && (
                <div style={subScreen === "search-results" ? undefined : { visibility: "hidden" }}>
                  <SearchResultsScreen
                    query={searchQuery}
                    onBack={() => setSubScreen(null)}
                    onSelectProduct={openProduct}
                    products={products}
                  />
                </div>
              )}

              <div role="status" className="absolute bottom-4 inset-x-4 z-[70] pointer-events-none flex justify-center">
                {undo && (
                  <div className="pointer-events-auto flex items-center gap-3 bg-foreground text-background rounded-xl pl-4 pr-1 shadow-lg text-sm font-bold">
                    <span>{undo.text}</span><span aria-hidden="true">·</span>
                    <button onClick={() => changeSaved(undo.prev)} className="min-h-[44px] px-3 underline">Undo</button>
                  </div>
                )}
              </div>
            </div>

            {!subScreen && !explainer && <BottomNav activeTab={activeTab} locked={mapForm} onTabChange={(t) => { setSavedTab("favorites"); setOpenList(null); setActiveTab(t); }} />}
          </div>
        )}
      </div>
    </div>
  );
}

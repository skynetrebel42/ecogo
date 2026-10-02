import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { loadCatalog } from "../lib/catalog";
import ProductDetailScreen from "./components/ProductDetailScreen";
import ScanTab from "./components/ScanTab";
import csvText from "../data/products.csv?raw";
import { parseProductsCSV, type Product as CsvProduct } from "../lib/productImporter";
import { VERDICT_RANK } from "../lib/safety/analyze";
import { VERDICT_STYLE, safeAnalyze, formsWhenCooked, categoryIcon } from "./components/verdict";
import { NutritionChip } from "./components/NutritionPanel";
import { topHigh } from "../lib/nutrition";
import { knownNutrition, searchUsda } from "../lib/lookup";
import { searchCatalog } from "../lib/search";
import { addRecent, resolveRecent, loadRecent, saveRecent, type RecentEntry } from "../lib/recent";
import Explainer, { EXPLAINERS, type ExplainerId } from "./components/Explainer";
import {
  Home, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Bookmark, Wifi, QrCode
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type AppState = "welcome" | "main";
// The Map tab is hidden until it shows real places (M7.4 spec M1); MapTab.tsx stays in the repo, unimported.
type Tab = "home" | "scan" | "saved" | "profile";
type SubScreen = "search-results" | "product-detail" | null;

// Re-export the canonical Product type from the import pipeline so the rest of
// the file can use it without a separate import statement.
type Product = CsvProduct;

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
    <div className={`flex items-center justify-between px-7 pt-3 pb-1 text-[11px] font-bold flex-shrink-0 ${cls}`}>
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

function WelcomeScreen({ onScan, onLookAround }: { onScan: () => void; onLookAround: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#1A5C39" }}>
      <StatusBar light />
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10" style={{ background: "white", transform: "translate(-30%, 30%)" }} />
        <svg viewBox="0 0 280 240" className="w-72" aria-hidden="true">
          <circle cx="140" cy="115" r="105" fill="rgba(255,255,255,0.08)" />
          <circle cx="140" cy="115" r="75" fill="rgba(255,255,255,0.06)" />
          <rect x="90" y="95" width="100" height="90" rx="14" fill="white" opacity="0.95" />
          <path d="M112 95 Q112 72 140 72 Q168 72 168 95" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.95" />
          <rect x="105" y="122" width="70" height="5" rx="2.5" fill="#1A5C39" opacity="0.3" />
          <rect x="105" y="133" width="50" height="5" rx="2.5" fill="#1A5C39" opacity="0.2" />
          <rect x="105" y="144" width="60" height="5" rx="2.5" fill="#1A5C39" opacity="0.2" />
          <ellipse cx="72" cy="88" rx="18" ry="26" fill="#34D399" opacity="0.8" transform="rotate(-28 72 88)" />
          <ellipse cx="72" cy="78" rx="8" ry="4" fill="#6EE7B7" opacity="0.5" transform="rotate(-28 72 78)" />
          <ellipse cx="210" cy="100" rx="15" ry="22" fill="#6EE7B7" opacity="0.65" transform="rotate(22 210 100)" />
          <circle cx="60" cy="145" r="6" fill="#10B981" opacity="0.7" />
          <circle cx="220" cy="75" r="5" fill="#34D399" opacity="0.6" />
          <circle cx="205" cy="155" r="4" fill="#6EE7B7" opacity="0.5" />
        </svg>
      </div>
      <div className="bg-background rounded-t-[36px] px-6 pt-7 pb-10 flex-shrink-0">
        <h1 className="text-[26px] font-extrabold text-foreground leading-tight text-center mb-2">
          Know what's in your food
        </h1>
        <p className="text-muted-foreground text-sm text-center mb-7 leading-relaxed">
          Scan a barcode. See official health findings, with sources.
        </p>
        <button onClick={onScan} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base mb-3 shadow-lg active:scale-98 transition-transform">
          Start scanning
        </button>
        <button onClick={onLookAround} className="w-full text-muted-foreground text-sm py-3">
          Look around first
        </button>
      </div>
    </div>
  );
}

// ── Product Card (mini) ───────────────────────────────────────────────────────
function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const a = safeAnalyze(product);
  const look = VERDICT_STYLE[a.verdict];
  // Only nutrition already known this session: a list never triggers lookups (USDA rate limit).
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
  return (
    <button onClick={() => onSelect(product)}
      className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3 active:scale-98 transition-transform">
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-2xl" aria-hidden="true">
        {categoryIcon(product.category)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium">{product.brand}</p>
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: look.color }}>
          <look.Icon size={12} /> {look.short}
        </span>
        {formsWhenCooked(a) && <span className="text-[9px] text-muted-foreground">🔥 forms when cooked</span>}
        {high && <NutritionChip text={high.short} />}
      </div>
    </button>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.2 (layout A, real content only).
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

const HOW_STEPS = [
  "Reads the real label from USDA (the maker's own data), or Open Food Facts, clearly marked crowd-sourced.",
  "Checks ingredients and the food itself against official findings from IARC, the EU and the FDA.",
  "Shows the strongest finding, with its source, plus sugar, fat and salt per serving.",
];

function RecentCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const look = VERDICT_STYLE[safeAnalyze(product).verdict];
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
  return (
    <button onClick={() => onSelect(product)}
      className="flex-shrink-0 w-28 bg-card border border-border rounded-2xl p-2.5 text-left shadow-sm flex flex-col gap-1.5">
      <span className="text-xs font-bold leading-tight line-clamp-2">{product.name}</span>
      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: look.color }}>
        <look.Icon size={10} /> {look.short}
      </span>
      {high && <NutritionChip text={high.short} />}
    </button>
  );
}

function HomeTab({ onSearch, onSelectProduct, onGoScan, onSeeAllRecent, onClearRecent, onOpenExplainer, recent }: {
  onSearch: (q: string) => void; onSelectProduct: (p: Product) => void; onGoScan: () => void;
  onSeeAllRecent: () => void; onClearRecent: () => void; onOpenExplainer: (id: ExplainerId) => void; recent: Product[];
}) {
  const [q, setQ] = useState("");
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-4" style={{ scrollbarWidth: "none" }}>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{greeting()}</p>
        <h1 className="text-xl font-extrabold leading-tight text-primary">What are you eating?</h1>
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

      {recent.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-bold text-base">Recently scanned</h2>
            <span className="flex gap-3">
              <button onClick={onClearRecent} aria-label="Clear recently scanned" className="text-xs font-semibold text-muted-foreground">Clear</button>
              <button onClick={onSeeAllRecent} className="text-xs font-bold text-primary">See all</button>
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
            {recent.map(p => <RecentCard key={p.id} product={p} onSelect={onSelectProduct} />)}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5">
          <h2 className="font-bold text-base">How EcoGo checks a product</h2>
          {HOW_STEPS.map((s, i) => (
            <div key={i} className="flex gap-2.5 items-start text-xs leading-relaxed text-foreground/80">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-bold text-base mb-2">Hidden risks, explained</h2>
        <div className="space-y-2.5">
          {(Object.keys(EXPLAINERS) as ExplainerId[]).map(id => (
            <button key={id} onClick={() => onOpenExplainer(id)}
              className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3">
              <span className="flex-1">
                <span className="block text-sm font-extrabold">{EXPLAINERS[id].title}</span>
                <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{EXPLAINERS[id].teaser}</span>
              </span>
              <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Search Results ────────────────────────────────────────────────────────────
function SearchResultsScreen({ query, onBack, onSelectProduct, products }: {
  query: string; onBack: () => void; onSelectProduct: (p: Product) => void; products: Product[];
}) {
  // "More from USDA": real products beyond our catalog (one request per search text per session).
  const [usda, setUsda] = useState<{ status: "loading" | "ok" | "error"; products: Product[] }>({ status: "loading", products: [] });
  useEffect(() => {
    let live = true;
    setUsda({ status: "loading", products: [] });
    searchUsda(query, { fdcKey: import.meta.env.VITE_FDC_API_KEY }).then(r => {
      if (live) setUsda(r.status === "ok" ? { status: "ok", products: r.products } : { status: "error", products: [] });
    });
    return () => { live = false; };
  }, [query]);
  const raw = searchCatalog(products, query);
  const results = raw
    .map(p => ({ p, a: safeAnalyze(p) }))
    .sort((x, y) => VERDICT_RANK[x.a.verdict] - VERDICT_RANK[y.a.verdict] || x.a.flags.length - y.a.flags.length)
    .map(({ p }) => p);
  const isEmpty = results.length === 0 && usda.status !== "loading" && usda.products.length === 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      {/* No inner StatusBar — outer one persists */}
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
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
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">Try a product name, brand, or category like "snacks", "cleaning", or "beverages"</p>
            <button onClick={onBack} className="px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-bold">
              Back to Home
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            {results.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />)}
            <div className="pt-2">
              <p className="text-xs font-bold text-foreground">More from USDA FoodData Central</p>
              <p className="text-[10px] text-muted-foreground mb-2">Label data supplied by manufacturers · not in our catalog</p>
              {usda.status === "loading" && <p className="text-xs text-muted-foreground">Searching USDA…</p>}
              {usda.status === "error" && <p className="text-xs text-muted-foreground">Couldn't reach USDA right now.</p>}
              {usda.status === "ok" && usda.products.length === 0 && <p className="text-xs text-muted-foreground">No USDA matches.</p>}
              <div className="space-y-3">
                {usda.products.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Saved Tab ────────────────────────────────────────────────────────────────
function SavedTab({ savedIds, scanned, initialTab = "favorites", onSelectProduct, products }: {
  savedIds: number[]; scanned: Product[]; initialTab?: "favorites" | "scanned";
  onSelectProduct: (p: Product) => void; products: Product[];
}) {
  const [tab, setTab] = useState<"favorites" | "scanned">(initialTab);
  const favs = products.filter(p => savedIds.includes(p.id));

  return (
    <div className="h-full overflow-y-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="px-5 pt-4">
        <h1 className="text-xl font-extrabold mb-4">Saved</h1>
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {(["favorites", "scanned"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t ? "bg-white shadow text-foreground" : "text-muted-foreground"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
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
          ) : favs.map(p => <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />)
        )}
        {tab === "scanned" && (
          scanned.length === 0 ? (
            <div className="text-center py-16">
              <QrCode size={44} className="mx-auto text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-foreground">No scanned products yet</p>
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
  { name: "USDA FoodData Central", text: "Label data supplied by the makers. Checked first." },
  { name: "Open Food Facts", text: "Crowd-sourced, used when USDA has no match, and always marked." },
  { name: "IARC, EU, FDA, EFSA, WHO", text: "The official findings behind every badge, each linked on the product page." },
  { name: "FDA % Daily Value", text: "Sugar, saturated fat and salt per serving, by the FDA's 5/20 rule." },
];

function ProfileTab({ recentCount, onClearRecent }: { recentCount: number; onClearRecent: () => void }) {
  const card = "bg-card border border-border rounded-2xl p-3.5 space-y-2.5";
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-3.5" style={{ scrollbarWidth: "none" }}>
      <div>
        <h1 className="text-xl font-extrabold leading-tight text-primary">Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">No account yet. What you do stays on this device.</p>
      </div>

      <section className={card}>
        <h2 className="font-bold text-base">Your data</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Recently scanned</p>
            <p className="text-xs text-muted-foreground">
              {recentCount === 0 ? "Nothing scanned yet" : `${recentCount} product${recentCount === 1 ? "" : "s"}, saved in this browser only`}
            </p>
          </div>
          {recentCount > 0 && (
            <button onClick={onClearRecent} aria-label="Clear recently scanned"
              className="px-3.5 rounded-xl border border-border text-xs font-bold flex-shrink-0" style={{ minHeight: 44 }}>Clear</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">Favorites are kept until you close EcoGo. Saving them for good comes with accounts.</p>
      </section>

      <section className={card}>
        <h2 className="font-bold text-base">Where results come from</h2>
        {SOURCES_INFO.map(s => (
          <div key={s.name}>
            <p className="text-sm font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
          </div>
        ))}
      </section>

      <section className={card}>
        <h2 className="font-bold text-base">Privacy</h2>
        <p className="text-xs text-foreground/80 leading-relaxed">The camera reads barcodes on your phone. No images are uploaded.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">To find a product, its barcode or search words are sent to USDA or Open Food Facts.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">The product catalog loads from EcoGo's database. Your recently scanned list stays in this browser.</p>
      </section>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        A student project. Not medical advice.{" "}
        <a href="https://github.com/skynetrebel42/ecogo" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Source code and updates</a>
      </p>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
    { id: "home",    Icon: Home,   label: "Home"    },
    { id: "scan",    Icon: Camera, label: "Scan"    },
    { id: "saved",   Icon: Heart,  label: "Saved"   },
    { id: "profile", Icon: User,   label: "Profile" },
  ];
  return (
    <div className="flex-shrink-0 bg-card border-t border-border flex items-center justify-around px-3 pt-2 pb-4"
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
            <span className={`text-[9px] font-bold mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  // Recently scanned / looked at: on this device only (M7 spec §4.1).
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  useEffect(() => saveRecent(recent), [recent]);
  const [savedInitialTab, setSavedInitialTab] = useState<"favorites" | "scanned">("favorites");
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);
  // Products looked up in USDA / Open Food Facts this session (not in the catalog; negative ids).
  const [lookedUp, setLookedUp] = useState<Product[]>([]);


  // ── Live data from Supabase ──────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [dbStatus, setDbStatus] = useState<"loading" | "live" | "offline">("loading");

  const loadData = useCallback(async () => {
    try {
      const catalog = await loadCatalog();
      // An empty catalog means a misconfigured DB, not "live" data: keep the bundled copy.
      if (catalog.products.length === 0) throw new Error("catalog is empty");
      setProducts(catalog.products);
      setDbStatus("live");
    } catch (err) {
      console.warn("[catalog] using bundled data:", err);
      setDbStatus("offline");
    }
  }, []);

  useEffect(() => {
    loadData();

    // Realtime: any catalog change is a signal to re-fetch (events can be missed,
    // so we never patch state from the payload itself).
    const channel = supabase.channel("catalog-realtime");
    for (const table of ["products", "product_prices", "resources"]) {
      channel.on("postgres_changes" as any, { event: "*", schema: "public", table }, () => loadData());
    }
    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // Every product opened counts as "looked at": Scan, search (catalog or USDA), and the lists. A looked-up product
  // (negative id) joins lookedUp however it was opened, so bookmarking it shows it in Saved › Favorites.
  const openProduct = (p: Product) => {
    setRecent(prev => addRecent(prev, p));
    if (p.id < 0) setLookedUp(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p]);
    setSelectedProduct(p); setSubScreen("product-detail");
  };
  const recentProducts = resolveRecent(recent, products);
  const openSearch = (q: string) => { setSearchQuery(q); setSubScreen("search-results"); };

  const toggleSave = () => {
    if (!selectedProduct) return;
    setSavedIds(prev => prev.includes(selectedProduct.id) ? prev.filter(id => id !== selectedProduct.id) : [...prev, selectedProduct.id]);
  };

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
                <span className="text-[9px] font-bold text-amber-700 tracking-wide">Offline — showing the built-in catalog</span>
              </div>
            )}
            {dbStatus === "live" && (
              <div className="flex items-center justify-center gap-1.5 py-0.5 bg-green-50 border-b border-green-100 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[9px] font-bold text-green-700 tracking-wide">Live data</span>
              </div>
            )}

            <div className="flex-1 overflow-hidden relative">
              {/* Tab content — animated on switch, hidden when sub-screen is open */}
              {!subScreen && (
                <div key={activeTab} style={{ animation: "ft 0.16s ease-out", height: "100%", overflow: "hidden", position: "relative" }}>
                  {activeTab === "home" && (
                    <HomeTab
                      onSearch={openSearch}
                      onSelectProduct={openProduct}
                      onGoScan={() => setActiveTab("scan")}
                      onSeeAllRecent={() => { setSavedInitialTab("scanned"); setActiveTab("saved"); }}
                      onClearRecent={() => setRecent([])}
                      onOpenExplainer={setExplainer}
                      recent={recentProducts}
                    />
                  )}
                  {activeTab === "scan"    && (
                    <ScanTab products={products} onScanResult={openProduct} />
                  )}
                  {activeTab === "saved"   && <SavedTab savedIds={savedIds} scanned={recentProducts} initialTab={savedInitialTab} onSelectProduct={openProduct} products={[...products, ...lookedUp]} />}
                  {activeTab === "profile" && <ProfileTab recentCount={recentProducts.length} onClearRecent={() => setRecent([])} />}
                </div>
              )}

              {/* Sub-screen overlays — fill content area, slide over tab content */}
              {explainer && !subScreen && <Explainer id={explainer} onBack={() => setExplainer(null)} />}
              {subScreen === "search-results" && (
                <SearchResultsScreen
                  query={searchQuery}
                  onBack={() => setSubScreen(null)}
                  onSelectProduct={openProduct}
                  products={products}
                />
              )}
              {subScreen === "product-detail" && selectedProduct && (
                <ProductDetailScreen
                  key={selectedProduct.id}
                  product={selectedProduct}
                  onBack={() => setSubScreen(null)}
                  saved={savedIds.includes(selectedProduct.id)}
                  onToggleSave={toggleSave}
                  products={products}
                  onSelectProduct={openProduct}
                />
              )}
            </div>

            {!subScreen && !explainer && <BottomNav activeTab={activeTab} onTabChange={(t) => { setSavedInitialTab("favorites"); setActiveTab(t); }} />}
          </div>
        )}
      </div>
    </div>
  );
}

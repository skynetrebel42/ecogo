import { useState, useEffect, useCallback } from "react";
import { supabase, SERVER } from "../lib/supabase";
import NewMapTab from "./components/MapTab";
import NewProductDetailScreen from "./components/ProductDetailScreen";
import NewScanTab from "./components/ScanTab";
import { PRODUCTS as CSV_PRODUCTS, type Product as CsvProduct } from "../lib/productImporter";
import { scoreColorHex, gradeBadgeClass, gradeToVerdict } from "../lib/scoring";
import {
  Home, Map, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Share2, Bookmark, Shield, DollarSign, Star, AlertTriangle, CheckCircle,
  ShoppingBag, Leaf, Zap, Package, Shirt, Bike, Building2, Wifi, Utensils,
  Clock, Phone, X, Plus, Bell, Moon, QrCode, Award, Settings, Sparkles,
  TrendingUp, MapPin
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type AppState = "welcome" | "onboarding" | "main";
type Tab = "home" | "map" | "scan" | "saved" | "profile";
type ResourceType = "food-bank" | "donation" | "clothing" | "bike-repair" | "restroom" | "wifi";
type SubScreen = "search-results" | "product-detail" | null;

interface Resource {
  id: number; name: string; type: ResourceType; address: string;
  hours: string; phone?: string | null; description: string; x: number; y: number;
}
// Re-export the canonical Product type from the import pipeline so the rest of
// the file can use it without a separate import statement.
type Product = CsvProduct;

// ── Category Config ──────────────────────────────────────────────────────────
const CAT: Record<ResourceType, { label: string; fill: string; bg: string; text: string; letter: string; Icon: React.ElementType }> = {
  "food-bank":   { label: "Food Banks",       fill: "#166534", bg: "bg-green-800",  text: "text-white", letter: "F", Icon: Utensils  },
  "donation":    { label: "Donation Centers", fill: "#1e40af", bg: "bg-blue-800",   text: "text-white", letter: "D", Icon: Package   },
  "clothing":    { label: "Cloth Drives",     fill: "#6b21a8", bg: "bg-purple-800", text: "text-white", letter: "C", Icon: Shirt     },
  "bike-repair": { label: "Bike Repair",      fill: "#9a3412", bg: "bg-orange-800", text: "text-white", letter: "B", Icon: Bike      },
  "restroom":    { label: "Restrooms",        fill: "#115e59", bg: "bg-teal-800",   text: "text-white", letter: "R", Icon: Building2 },
  "wifi":        { label: "Free WiFi",        fill: "#78350f", bg: "bg-amber-900",  text: "text-white", letter: "W", Icon: Wifi      },
};

// ── Data ─────────────────────────────────────────────────────────────────────
const RESOURCES: Resource[] = [
  { id: 1,  name: "Community Food Pantry",   type: "food-bank",   address: "142 Oak Street",       hours: "Mon–Fri 9am–5pm",      phone: "(555) 234-5678", description: "Hot meals and dry goods. No ID required.", x: 78,  y: 144 },
  { id: 2,  name: "Second Harvest Hub",      type: "food-bank",   address: "389 Maple Avenue",     hours: "Daily 8am–7pm",        phone: "(555) 876-5432", description: "Fresh produce and pantry staples. 200+ families weekly.", x: 568, y: 222 },
  { id: 3,  name: "Goodwill Drop-Off",       type: "donation",    address: "55 Central Boulevard", hours: "Mon–Sat 8am–8pm",      phone: "(555) 345-6789", description: "Clothing, furniture, electronics. Tax receipt provided.", x: 372, y: 66  },
  { id: 4,  name: "Habitat ReStore",         type: "donation",    address: "201 Pine Road",        hours: "Tue–Sat 9am–6pm",      phone: "(555) 456-7890", description: "Home improvement items and appliances.", x: 176, y: 378 },
  { id: 5,  name: "Winter Warmth Drive",     type: "clothing",    address: "78 Elm Street",        hours: "Wed–Sun 10am–4pm",     phone: "(555) 567-8901", description: "Coats, hats, and warm clothing for all ages.", x: 470, y: 144 },
  { id: 6,  name: "Thread & Share Co-op",    type: "clothing",    address: "315 Birch Way",        hours: "Mon, Wed, Fri 12–6pm", phone: "(555) 678-9012", description: "Free clothing exchange — take what you need.", x: 666, y: 66  },
  { id: 7,  name: "Community Bike Shop",     type: "bike-repair", address: "92 River Drive",       hours: "Sat–Sun 10am–3pm",     phone: "(555) 789-0123", description: "Free repairs, tire changes, and safety checks.", x: 78,  y: 222 },
  { id: 8,  name: "Pedal Forward Workshop",  type: "bike-repair", address: "420 Lake Avenue",      hours: "Tue, Thu 4pm–8pm",     phone: "(555) 890-1234", description: "DIY repair station with tools and spare parts.", x: 470, y: 300 },
  { id: 9,  name: "City Hall Restrooms",     type: "restroom",    address: "1 Civic Plaza",        hours: "Mon–Fri 7am–9pm",      phone: null,             description: "Clean, accessible public restrooms. ADA compliant.", x: 372, y: 222 },
  { id: 10, name: "Central Park Facilities", type: "restroom",    address: "Park Boulevard",       hours: "Daily 6am–10pm",       phone: null,             description: "Restrooms and water fountains throughout the park.", x: 225, y: 261 },
  { id: 11, name: "Public Library WiFi",     type: "wifi",        address: "250 Knowledge Drive",  hours: "Mon–Sat 8am–8pm",      phone: "(555) 901-2345", description: "High-speed internet. Computers available.", x: 666, y: 222 },
  { id: 12, name: "Community Center WiFi",   type: "wifi",        address: "88 Unity Avenue",      hours: "Daily 7am–11pm",       phone: "(555) 012-3456", description: "Free WiFi, charging stations, and computer terminals.", x: 470, y: 222 },
];

// Products are loaded once from src/data/products.csv via the import pipeline.
// To add or edit a product, update the CSV — no code changes needed.
// To migrate to Supabase, replace loadProductsFromCSV() in productImporter.ts.
const PRODUCTS: Product[] = CSV_PRODUCTS;

// ── DB row → app type mappers ─────────────────────────────────────────────────
function rowToResource(r: any) {
  return { id: r.id, name: r.name, type: r.type as ResourceType, address: r.address ?? "", hours: r.hours ?? "", phone: r.phone ?? null, description: r.description ?? "", x: r.x ?? 0, y: r.y ?? 0 };
}
function rowToProduct(r: any): Product {
  const dims = {
    health:       r.health_score      ?? r.safety_score ?? 50,
    environment:  r.environment_score ?? 50,
    ethics:       r.ethics_score      ?? 50,
    transparency: r.transparency_score ?? 50,
  };
  return {
    id: r.id, name: r.name, brand: r.brand ?? "", category: r.category ?? "",
    barcode: r.barcode ?? "", description: r.description ?? "", imageUrl: r.image_url ?? "",
    amazon:  r.amazon_price  != null ? { price: r.amazon_price,  rating: r.amazon_rating  } : undefined,
    walmart: r.walmart_price != null ? { price: r.walmart_price, rating: r.walmart_rating } : undefined,
    facebook:r.fb_price      != null ? { price: r.fb_price,      condition: r.fb_condition ?? "" } : undefined,
    ethicalScore: r.ethical_score ?? "C", safetyScore: dims.health,
    flaggedIngredients: r.flagged_ingredients ?? [], ingredients: r.ingredients ?? "",
    keywords: Array.isArray(r.keywords) ? r.keywords : (r.keywords ?? "").split("|").filter(Boolean),
    healthScore: dims.health, environmentScore: dims.environment,
    ethicsScore: dims.ethics, transparencyScore: dims.transparency,
    overallScore: r.overall_score ?? Math.round(dims.health*0.3 + dims.environment*0.25 + dims.ethics*0.25 + dims.transparency*0.2),
  };
}

const DEFAULT_PARTNERS = [
  { id: 1, name: "GreenLeaf Organic Market",  type: "Grocery",         ethical_score: "A", emoji: "🌿", services: ["10% community discount","Weekly produce drives","Local sourcing within 150mi"],        offer: "15% off + free reusable bag for community card holders", since: "2019" },
  { id: 2, name: "City Cycles Cooperative",    type: "Transportation",  ethical_score: "A", emoji: "🚲", services: ["Free safety inspections","Pay-what-you-can repairs","30-day bike lending library"],   offer: "Free inner tube + patch kit with any visit",             since: "2021" },
  { id: 3, name: "ReThreaded Clothing Co.",    type: "Retail",          ethical_score: "B", emoji: "👕", services: ["100% second-hand inventory","Living wage certified","Clothing vouchers for families"], offer: "Buy-one-get-one on all thrifted items Saturdays",        since: "2020" },
  { id: 4, name: "Sunrise Community Health",   type: "Healthcare",      ethical_score: "A", emoji: "🏥", services: ["Sliding-scale fees","Free quarterly screenings","Multilingual staff (12 languages)"], offer: "Free 30-min initial consultation, no referral needed",   since: "2018" },
  { id: 5, name: "Fair Ground Coffee",         type: "Food & Beverage", ethical_score: "A", emoji: "☕", services: ["Direct-trade beans","10% profits to community fund","Free workspace Mon–Thu"],        offer: "Free drip coffee during job-search hours (10am–2pm)",   since: "2022" },
  { id: 6, name: "MegaMart Retail",            type: "Big Box Retail",  ethical_score: "D", emoji: "🏪", services: ["Price match guarantee","Curbside pickup"],                                             offer: "5% off select items with community card",               since: "2023" },
];


const ONBOARDING = [
  { color: "#1A5C39", bg: "#E6F2EC", Icon: DollarSign, title: "Find the Best Price", body: "Compare Amazon, Walmart, local stores & Facebook Marketplace instantly. See who has the best deal near you." },
  { color: "#0EA5E9", bg: "#E0F2FE", Icon: Leaf,       title: "Shop Healthier",      body: "Scan any barcode to check ingredients against the IARC carcinogen database and get a full SafetyScore." },
  { color: "#8B5CF6", bg: "#EDE9FE", Icon: Heart,      title: "Support Your Community", body: "Find food banks, free WiFi, bike repair, donation centers, and ethical local businesses near you." },
];

const DEALS = [
  { name: "Oat Milk Original", brand: "Oatly", price: "$3.99", was: "$5.49", score: 88, gradient: "#E6F2EC" },
  { name: "Bamboo Toothbrush Set", brand: "Brush Green", price: "$8.99", was: "$12.00", score: 95, gradient: "#FEF3C7" },
  { name: "Free & Clear Detergent", brand: "Seventh Gen.", price: "$12.99", was: "$18.49", score: 92, gradient: "#E0F2FE" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Score helpers (delegate to scoring.ts) ────────────────────────────────────
const scoreColor  = (s: number) => scoreColorHex(s);
const ethicalBadge = (g: string) => gradeBadgeClass(g);
const ethicalLabel  = (g: string) => gradeToVerdict(g);
const bestPrice     = (p: Product) => Math.min(p.amazon?.price ?? 9999, p.walmart?.price ?? 9999, p.facebook?.price ?? 9999);

// ── SVG City Map ─────────────────────────────────────────────────────────────
const BW = 90, BH = 70, SG = 8, OX = 33, OY = 31;
const PARKS = new Set(["1-2", "1-3", "2-2", "2-3"]);
const WATER = new Set(["5-3", "6-3", "6-4"]);
const CIVIC = new Set(["3-2"]);

function CityMap({ resources, filters, selectedId, onSelect }: {
  resources: Resource[]; filters: ResourceType[]; selectedId: number | null; onSelect: (id: number) => void;
}) {
  return (
    <svg viewBox="0 0 760 460" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect width="760" height="460" fill="#C4B89E" />
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 7 }, (_, c) => {
        const key = `${c}-${r}`;
        return <rect key={key} x={OX + c * (BW + SG)} y={OY + r * (BH + SG)} width={BW} height={BH}
          fill={WATER.has(key) ? "#8BBDD4" : PARKS.has(key) ? "#8DB87A" : CIVIC.has(key) ? "#C4B08C" : "#D6CABB"} rx={1} />;
      }))}
      <text x="225" y="265" textAnchor="middle" fontSize="7" fill="#4A6741" fontStyle="italic" letterSpacing="1" fontFamily="DM Mono, monospace">GREENWAY PARK</text>
      <text x="625" y="345" textAnchor="middle" fontSize="7" fill="#3A7CA5" fontStyle="italic" letterSpacing="1" fontFamily="DM Mono, monospace">RIVER</text>
      <text x={OX + 3 * (BW + SG) + BW / 2} y={OY + 2 * (BH + SG) + BH / 2 + 3} textAnchor="middle" fontSize="6.5" fill="#6B5B3A" letterSpacing="1" fontFamily="DM Mono, monospace">CITY HALL</text>
      {resources.filter(r => filters.includes(r.type)).map(r => {
        const cat = CAT[r.type];
        const sel = selectedId === r.id;
        return (
          <g key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: "pointer" }}>
            {sel && <circle cx={r.x} cy={r.y} r={20} fill={cat.fill} opacity={0.25} />}
            <circle cx={r.x} cy={r.y} r={sel ? 13 : 10} fill={cat.fill} stroke="white" strokeWidth={sel ? 3 : 1.5} />
            <text x={r.x} y={r.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={sel ? 8 : 7} fill="white" fontWeight="700" fontFamily="sans-serif">{cat.letter}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size * 0.24} fontWeight="800" fill={color} fontFamily="DM Mono, monospace">{score}</text>
    </svg>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-24 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold w-6 text-right font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Status Bar ────────────────────────────────────────────────────────────────
function StatusBar({ light = false }: { light?: boolean }) {
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
function WelcomeScreen({ onStart, onGuest }: { onStart: () => void; onGuest: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#1A5C39" }}>
      <StatusBar light />
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10" style={{ background: "white", transform: "translate(-30%, 30%)" }} />
        <svg viewBox="0 0 280 240" className="w-72">
          <circle cx="140" cy="115" r="105" fill="rgba(255,255,255,0.08)" />
          <circle cx="140" cy="115" r="75" fill="rgba(255,255,255,0.06)" />
          <rect x="90" y="95" width="100" height="90" rx="14" fill="white" opacity="0.95" />
          <path d="M112 95 Q112 72 140 72 Q168 72 168 95" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.95" />
          <rect x="105" y="122" width="70" height="5" rx="2.5" fill="#1A5C39" opacity="0.3" />
          <rect x="105" y="133" width="50" height="5" rx="2.5" fill="#1A5C39" opacity="0.2" />
          {[0, 1, 2, 3, 4].map(i => (
            <polygon key={i} fill="#F59E0B" transform={`translate(${116 + i * 10}, 154) scale(0.55)`}
              points="0,-9 2.1,-3 8.6,-3 3.5,1.2 5.3,7.8 0,4.2 -5.3,7.8 -3.5,1.2 -8.6,-3 -2.1,-3" />
          ))}
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
          Shop Smarter.<br />Save Money. Live Better.
        </h1>
        <p className="text-muted-foreground text-sm text-center mb-7 leading-relaxed">
          Healthier choices, better prices, and community resources — all in one place.
        </p>
        <button onClick={onStart} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base mb-3 shadow-lg active:scale-98 transition-transform">
          Get Started
        </button>
        <button className="w-full py-4 border border-border text-foreground rounded-2xl font-semibold text-base mb-3 active:scale-[0.98] transition-transform">
          Sign In
        </button>
        <button onClick={onGuest} className="w-full text-muted-foreground text-sm py-1">
          Continue as Guest
        </button>
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function OnboardingScreen({ slide, onNext, onBack, onSkip }: { slide: number; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const s = ONBOARDING[slide];
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: s.bg }}>
      <StatusBar />
      <div className="flex justify-end px-6 pt-1">
        <button onClick={onSkip} className="text-sm font-semibold" style={{ color: s.color, opacity: 0.6 }}>Skip</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-28 h-28 rounded-[32px] flex items-center justify-center shadow-xl mb-8" style={{ background: s.color }}>
          <s.Icon size={52} color="white" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground leading-tight mb-4">{s.title}</h2>
        <p className="text-muted-foreground text-base leading-relaxed max-w-xs">{s.body}</p>
      </div>
      <div className="px-6 pb-10 flex-shrink-0">
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-2 rounded-full transition-all duration-300"
              style={{ width: i === slide ? 28 : 8, background: i === slide ? s.color : "#D1D5DB" }} />
          ))}
        </div>
        <button onClick={onNext} className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-lg mb-3"
          style={{ background: s.color }}>
          {slide === 2 ? "Start Exploring" : "Next →"}
        </button>
        {slide > 0 && (
          <button onClick={onBack} className="w-full text-muted-foreground text-sm">← Back</button>
        )}
      </div>
    </div>
  );
}

// ── Recommendation data ───────────────────────────────────────────────────────
interface Recommendation {
  id: number;
  name: string;
  category: string;
  section: "near-you" | "healthy-food" | "farmers-market" | "sustainable" | "community";
  smartScore: number;
  distance: number;
  photo: string; // Unsplash photo ID
  isOpen: boolean;
  priceLevel: string;
  shortReason: string;
  whyReasons: string[];
}

// Minimum SmartScore for a recommendation to surface (configurable in HomeTab)
const DEFAULT_SCORE_THRESHOLD = 70;

const RECOMMENDATIONS: Recommendation[] = [
  // ── Recommended Near You
  { id: 1,  section: "near-you",       name: "GreenLeaf Organic Market",   category: "Organic Grocery",           smartScore: 94, distance: 0.3, isOpen: true,  priceLevel: "$$",   photo: "1681276145283-dc19e0ffb8d1", shortReason: "Top-rated organic grocer. 100% local sourcing, zero-waste packaging, and living-wage staff.", whyReasons: ["Sources 100% of produce within 150 miles — supports local farms and cuts carbon footprint", "Zero-waste packaging across all store-brand items since 2021", "Certified living-wage employer — all staff paid above market rate", "Surplus donated to the Community Food Pantry every Friday", "SmartScore 94/100 — highest-rated grocery in your area"] },
  { id: 2,  section: "near-you",       name: "Fair Ground Coffee",          category: "Café",                      smartScore: 88, distance: 0.7, isOpen: true,  priceLevel: "$",    photo: "1766848605292-06f971164f51", shortReason: "Direct-trade café donating 10% of profits to the community fund. Free workspace Mon–Thu.", whyReasons: ["Direct-trade certified — farmers receive 40% above commodity price", "10% of all revenue donated to local community programs", "Free high-speed WiFi and workspace every Monday through Thursday", "Compostable cups and packaging — zero single-use plastic policy", "SmartScore 88 — outstanding ethics and community investment score"] },
  { id: 3,  section: "near-you",       name: "City Cycles Cooperative",     category: "Bike Shop",                 smartScore: 91, distance: 1.2, isOpen: true,  priceLevel: "$",    photo: "1628243989859-db92e2de1340", shortReason: "Worker-owned co-op with pay-what-you-can repairs and a 30-day free bike lending library.", whyReasons: ["Worker-owned cooperative — all profits distributed equally to employees", "Pay-what-you-can repair rates ensure access regardless of income", "30-day bike lending library free for community card holders", "Diverts 200+ bikes from landfill per year through refurbishment program", "SmartScore 91 — exceptional community and sustainability rating"] },
  // ── Healthy Places to Eat
  { id: 4,  section: "healthy-food",   name: "Roots Kitchen & Bar",         category: "Farm-to-Table Restaurant",  smartScore: 87, distance: 0.4, isOpen: true,  priceLevel: "$$",   photo: "1560055932-595dab110124",    shortReason: "90% of ingredients sourced within 50 miles. No synthetic preservatives. Full farm-origin traceability.", whyReasons: ["90% of all ingredients sourced within a 50-mile radius — verified monthly", "Menu changes seasonally to eliminate out-of-season imports", "No synthetic preservatives or artificial coloring in any dish", "Scan any dish to see its exact farm origin and harvest date", "SmartScore 87 — top farm-to-table in the neighborhood"] },
  { id: 5,  section: "healthy-food",   name: "The Green Bowl",              category: "Vegan & Vegetarian",        smartScore: 92, distance: 0.8, isOpen: true,  priceLevel: "$",    photo: "1543393786-6b9844cc148d",    shortReason: "100% plant-based. Zero IARC-flagged ingredients. Composts 98% of food waste.", whyReasons: ["100% plant-based menu — independently verified zero IARC Group 1/2A substances", "All proteins sourced from certified organic, non-GMO suppliers", "Composting program diverts 98% of food waste from landfill", "Free full nutrition breakdown available for every single menu item", "SmartScore 92 — highest-rated healthy restaurant near you"] },
  { id: 6,  section: "healthy-food",   name: "Sunrise Health Café",         category: "Juice Bar & Café",          smartScore: 89, distance: 1.1, isOpen: false, priceLevel: "$",    photo: "1776659214764-19684cf77e0d", shortReason: "Cold-pressed juices made every 4 hours. No preservatives. Sliding-scale pricing for community members.", whyReasons: ["All juices cold-pressed within 4 hours of serving — no preservatives added", "Every item includes a full ingredient list and allergen breakdown", "Glass bottles only — zero single-use plastic in the entire operation", "Sliding-scale pricing for community card holders — no one turned away", "SmartScore 89 — excellent nutrition and transparency scores"] },
  // ── Local Farmers Markets
  { id: 7,  section: "farmers-market", name: "Lincoln Park Farmers Market", category: "Outdoor Market",            smartScore: 96, distance: 2.1, isOpen: true,  priceLevel: "$",    photo: "1506484381205-f7945653044d", shortReason: "Award-winning market. 40+ certified organic vendors. SNAP/EBT accepted at every stall.", whyReasons: ["40+ vendors — all certified organic or practicing verified sustainable agriculture", "Zero pesticide residue testing on all produce before the market opens each week", "SNAP/EBT accepted at all vendor stalls — accessible to all income levels", "Voted #1 farmers market in the region for 3 consecutive years", "SmartScore 96 — near-perfect rating for freshness, ethics, and community impact"] },
  { id: 8,  section: "farmers-market", name: "Green City Market",           category: "Year-Round Market",         smartScore: 91, distance: 1.8, isOpen: true,  priceLevel: "$",    photo: "1774887679529-7fb933596f37", shortReason: "Year-round covered pavilion. Only regenerative farms admitted. Free Saturday cooking demos.", whyReasons: ["Year-round operation in a covered pavilion — accessible in all weather", "Strict vendor vetting: only regenerative and sustainable farms admitted", "Free cooking demonstrations every Saturday using locally sourced ingredients", "20% of vendor fees fund food access programs for low-income families", "SmartScore 91 — consistent quality and strong vendor accountability"] },
  { id: 9,  section: "farmers-market", name: "Logan Square Market",         category: "Neighborhood Market",       smartScore: 83, distance: 3.4, isOpen: false, priceLevel: "$",    photo: "1687199129802-3e4cc27baac0", shortReason: "Specializes in heirloom varieties and small-batch preserves. All 22 vendors within 100 miles.", whyReasons: ["Specializes in heirloom and heritage crop varieties unavailable in grocery stores", "All 22 vendors are sourced from within 100 miles — ultra-local supply chain", "Free market bag provided to every first-time visitor", "Partners with local schools for educational farm visits each semester", "SmartScore 83 — strong ethics and freshness, good community engagement"] },
  // ── Sustainable Businesses
  { id: 10, section: "sustainable",    name: "ReThreaded Clothing Co.",     category: "Second-Hand Retail",        smartScore: 84, distance: 0.9, isOpen: true,  priceLevel: "$",    photo: "1651449815984-a2387dd0fcf4", shortReason: "Living-wage employer. 100% second-hand inventory. Diverts 15,000+ garments from landfill annually.", whyReasons: ["100% second-hand inventory — extends garment lifecycle and reduces textile waste", "Living-wage certified: all employees paid at or above $22/hr", "Diverts an estimated 15,000+ garments from landfill each year", "Clothing vouchers available for community members experiencing hardship", "SmartScore 84 — excellent sustainability and labor ethics rating"] },
  { id: 11, section: "sustainable",    name: "Zero Waste Supply Co.",       category: "Eco Products Store",        smartScore: 90, distance: 1.5, isOpen: true,  priceLevel: "$$",   photo: "1651449816008-2cbdcf626b1f", shortReason: "Every product vetted against 200+ restricted chemicals. Bulk refill station. B Corp certified.", whyReasons: ["All products vetted against a 200+ restricted substance list — no IARC Group 1 chemicals", "Bulk refill station eliminates packaging waste for 80+ household products", "Carbon-neutral delivery via electric cargo bike within a 3-mile radius", "B Corp certified — independently verified for social and environmental performance", "SmartScore 90 — outstanding product safety and environmental score"] },
  { id: 12, section: "sustainable",    name: "Sunrise Community Health",    category: "Community Healthcare",      smartScore: 95, distance: 0.6, isOpen: true,  priceLevel: "$",    photo: "1781785273371-a959f34bfab0", shortReason: "Sliding-scale clinic. Multilingual staff across 12 languages. Free quarterly screenings.", whyReasons: ["Sliding-scale fees ensure healthcare access regardless of income level", "Multilingual staff across 12 languages — highest language accessibility in the area", "Free health screenings every quarter for all community card holders", "Prescribes generic alternatives — independently verified ethical prescribing practices", "SmartScore 95 — highest-rated healthcare provider in the community"] },
  // ── Community Resources
  { id: 13, section: "community",      name: "Community Food Pantry",       category: "Food Bank",                 smartScore: 88, distance: 0.3, isOpen: true,  priceLevel: "Free", photo: "1506484381205-f7945653044d", shortReason: "No ID required. Serves 200+ families weekly with fresh produce, dry goods, and hot meals.", whyReasons: ["No ID required — removes barriers to access for all community members", "Fresh produce donated by GreenLeaf Market and local farms available daily", "Hot meals served Monday, Wednesday, and Friday from 11am–2pm", "Multilingual volunteers — assistance available in 8 languages", "SmartScore 88 — highly rated for accessibility, dignity, and food quality"] },
  { id: 14, section: "community",      name: "Public Library & WiFi Hub",   category: "Public Resource",           smartScore: 86, distance: 1.1, isOpen: true,  priceLevel: "Free", photo: "1651449815984-a2387dd0fcf4", shortReason: "Free high-speed WiFi and 20 computers. No library card required for internet access.", whyReasons: ["High-speed internet access — no library card required to use WiFi or computers", "20 public computers available on a first-come, first-served basis", "Free printing up to 20 pages per day per visitor", "Quiet study rooms bookable online in 2-hour blocks at no cost", "SmartScore 86 — excellent digital equity and public access resource"] },
  { id: 15, section: "community",      name: "Community Garden & Kitchen",  category: "Garden & Workshop",         smartScore: 82, distance: 0.5, isOpen: true,  priceLevel: "Free", photo: "1781785273371-a959f34bfab0", shortReason: "Free garden plot allocation. Community kitchen open weekends. 150-variety seed library.", whyReasons: ["Free 4×8 garden plot allocation for community members — waitlist under 2 weeks", "Community kitchen available for food preservation workshops every weekend", "Seed library open to all — 150+ varieties of vegetables and herbs free to borrow", "Composting program accepts household food scraps year-round", "SmartScore 82 — strong community engagement and environmental contribution"] },
];

// ── Recommendation Card ───────────────────────────────────────────────────────
function RecommendationCard({ rec, onWhyClick }: { rec: Recommendation; onWhyClick: () => void }) {
  const color = scoreColor(rec.smartScore);
  return (
    <div className="flex-shrink-0 w-52 bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
      {/* Image */}
      <div className="relative h-[110px] bg-muted overflow-hidden">
        <img
          src={`https://images.unsplash.com/photo-${rec.photo}?w=420&h=220&fit=crop&auto=format&q=80`}
          alt={rec.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Open / Closed pill */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-bold backdrop-blur-sm ${rec.isOpen ? "bg-green-500/90 text-white" : "bg-black/60 text-white/80"}`}>
          {rec.isOpen ? "Open Now" : "Closed"}
        </div>
        {/* Distance pill */}
        <div className="absolute top-2 right-2 bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full text-[8px] text-white font-semibold flex items-center gap-0.5">
          <MapPin size={7} /> {rec.distance} mi
        </div>
        {/* SmartScore badge */}
        <div className="absolute bottom-[-14px] right-3 w-[38px] h-[38px] rounded-full bg-white shadow-lg border-2 flex items-center justify-center" style={{ borderColor: color }}>
          <span className="text-[11px] font-extrabold leading-none" style={{ color }}>{rec.smartScore}</span>
        </div>
      </div>

      {/* Body */}
      <div className="pt-5 px-3 pb-3">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{rec.category}</span>
        <h3 className="font-bold text-[13px] leading-tight mt-0.5 mb-1.5 line-clamp-1">{rec.name}</h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mb-2.5">{rec.shortReason}</p>
        <button
          onClick={onWhyClick}
          className="w-full py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
          style={{ background: "rgba(26,92,57,0.08)", color: "#1A5C39" }}
        >
          <Sparkles size={9} /> Why Recommended?
        </button>
      </div>
    </div>
  );
}

// ── Why Recommended Modal ─────────────────────────────────────────────────────
function WhyModal({ rec, onClose, threshold }: { rec: Recommendation; onClose: () => void; threshold: number }) {
  const color = scoreColor(rec.smartScore);
  return (
    <div
      className="absolute inset-0 z-[60] flex items-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-3xl w-full px-5 pt-4 pb-8 overflow-y-auto"
        style={{ maxHeight: "78%", scrollbarWidth: "none" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{rec.category}</span>
            <h2 className="text-lg font-extrabold leading-tight">{rec.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <MapPin size={10} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{rec.distance} mi away</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${rec.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {rec.isOpen ? "Open Now" : "Closed"}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-extrabold leading-none" style={{ color }}>{rec.smartScore}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">SmartScore™</div>
            <div className="w-16 h-1.5 rounded-full mt-1.5 overflow-hidden bg-muted">
              <div className="h-full rounded-full" style={{ width: `${rec.smartScore}%`, background: color }} />
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="rounded-2xl overflow-hidden h-32 mb-4 bg-muted">
          <img
            src={`https://images.unsplash.com/photo-${rec.photo}?w=600&h=250&fit=crop&auto=format&q=80`}
            alt={rec.name} className="w-full h-full object-cover"
          />
        </div>

        {/* Why reasons */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(26,92,57,0.06)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} style={{ color: "#1A5C39" }} />
            <span className="text-xs font-bold" style={{ color: "#1A5C39" }}>Why We Recommend This</span>
          </div>
          <ul className="space-y-2.5">
            {rec.whyReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
                <CheckCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#1A5C39" }} />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Price level */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-1">
          <span>Price level: <strong className="text-foreground">{rec.priceLevel}</strong></span>
          <span>SmartScore threshold passed: <strong style={{ color }}>✓ {rec.smartScore} ≥ {threshold}</strong></span>
        </div>

        <button onClick={onClose} className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm">
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Recommendation Section Row ────────────────────────────────────────────────
function RecommendationSection({ title, emoji, items, threshold, onWhyClick }: {
  title: string; emoji: string; items: Recommendation[]; threshold: number;
  onWhyClick: (r: Recommendation) => void;
}) {
  const filtered = items.filter(r => r.smartScore >= threshold);
  if (filtered.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="font-bold text-base">{emoji} {title}</h2>
        <span className="text-[10px] text-muted-foreground font-medium">{filtered.length} nearby</span>
      </div>
      <div className="flex gap-3 px-5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {filtered.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} onWhyClick={() => onWhyClick(rec)} />
        ))}
      </div>
    </div>
  );
}

// ── Product Card (mini) ───────────────────────────────────────────────────────
function ProductCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const bp = bestPrice(product);
  const bg = product.safetyScore >= 80 ? "#DCFCE7" : product.safetyScore >= 60 ? "#FEF3C7" : "#FEE2E2";
  const ic = product.safetyScore >= 80 ? "#15803D" : product.safetyScore >= 60 ? "#D97706" : "#DC2626";
  return (
    <button onClick={() => onSelect(product)}
      className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3 active:scale-98 transition-transform">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <ShoppingBag size={24} style={{ color: ic }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium">{product.brand}</p>
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-primary font-bold">${bp.toFixed(2)}</span>
          <span className="text-[10px] text-muted-foreground">best price</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${ethicalBadge(product.ethicalScore)}`}>{product.ethicalScore}</span>
        <span className="text-xs font-bold font-mono" style={{ color: scoreColor(product.safetyScore) }}>{product.safetyScore}%</span>
        {product.flaggedIngredients.length > 0 && <AlertTriangle size={11} className="text-red-500" />}
      </div>
    </button>
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────
function HomeTab({ onSearch, onSelectProduct, onGoMap, products, resources }: {
  onSearch: (q: string) => void; onSelectProduct: (p: Product) => void; onGoMap: () => void;
  products: Product[]; resources: Resource[];
}) {
  const [q, setQ] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_SCORE_THRESHOLD);
  const [whyRec, setWhyRec] = useState<Recommendation | null>(null);
  const [locationLabel, setLocationLabel] = useState("Detecting location…");
  const [locating, setLocating] = useState(true);

  // Attempt real geolocation; fall back to a friendly default
  useEffect(() => {
    if (!navigator.geolocation) { setLocationLabel("Your Neighborhood"); setLocating(false); return; }
    const id = navigator.geolocation.watchPosition(
      () => { setLocationLabel("Your Neighborhood"); setLocating(false); },
      () => { setLocationLabel("Chicago, IL (default)"); setLocating(false); },
      { timeout: 6000, maximumAge: 60000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const refreshLocation = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      () => { setLocationLabel("Your Neighborhood"); setLocating(false); },
      () => { setLocationLabel("Chicago, IL (default)"); setLocating(false); },
      { timeout: 5000 }
    );
  };

  const bySection = (section: Recommendation["section"]) =>
    RECOMMENDATIONS.filter(r => r.section === section);

  const SECTIONS: { section: Recommendation["section"]; title: string; emoji: string }[] = [
    { section: "near-you",       title: "Recommended Near You",    emoji: "📍" },
    { section: "healthy-food",   title: "Healthy Places to Eat",   emoji: "🥗" },
    { section: "farmers-market", title: "Local Farmers Markets",   emoji: "🌽" },
    { section: "sustainable",    title: "Sustainable Businesses",  emoji: "🌿" },
    { section: "community",      title: "Community Resources",     emoji: "🤝" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background relative" style={{ scrollbarWidth: "none" }}>
      {/* Why Recommended modal — rendered inside the phone frame */}
      {whyRec && <WhyModal rec={whyRec} onClose={() => setWhyRec(null)} threshold={threshold} />}

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Good morning,</p>
            <h1 className="text-xl font-extrabold leading-tight">Alex 👋</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">A</div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2.5 bg-muted rounded-2xl px-4 py-3">
            <Search size={15} className="text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              placeholder="Search products, brands…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && q.trim() && onSearch(q)}
            />
          </div>
          <button onClick={() => q.trim() && onSearch(q)}
            className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
            <QrCode size={18} color="white" />
          </button>
        </div>

        {/* Location pill */}
        <div className="flex items-center justify-between bg-muted rounded-2xl px-4 py-2.5 mb-1">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${locating ? "bg-yellow-400 animate-pulse" : "bg-green-500"}`} />
            <MapPin size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{locationLabel}</span>
          </div>
          <button onClick={refreshLocation} className="text-[10px] text-primary font-bold">
            {locating ? "Locating…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Score Threshold Filter ── */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={11} className="text-primary" />
          <span className="text-[10px] font-bold text-primary tracking-wider uppercase">SmartScore™ Filter</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {RECOMMENDATIONS.filter(r => r.smartScore >= threshold).length} places qualify
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {([0, 70, 80, 90] as const).map(t => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                threshold === t ? "bg-primary text-white shadow-sm" : "bg-muted text-muted-foreground"
              }`}
            >
              {t === 0 ? "All" : `${t}+ Score`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recommendation Sections ── */}
      {SECTIONS.map(({ section, title, emoji }) => (
        <RecommendationSection
          key={section}
          title={title}
          emoji={emoji}
          items={bySection(section)}
          threshold={threshold}
          onWhyClick={setWhyRec}
        />
      ))}

      {/* ── Today's Deals (kept for product discovery) ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="font-bold text-base">🏷️ Today's Deals</h2>
          <button onClick={() => onSearch("deals")} className="text-primary text-sm font-semibold">See all</button>
        </div>
        <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {DEALS.map((d, i) => (
            <button key={i} onClick={() => products[i] && onSelectProduct(products[i])}
              className="flex-shrink-0 w-36 rounded-2xl border border-border overflow-hidden text-left bg-card shadow-sm">
              <div className="h-20 flex items-center justify-center" style={{ background: d.gradient }}>
                <ShoppingBag size={28} style={{ color: "#1A5C39" }} />
              </div>
              <div className="p-2.5">
                <p className="text-[9px] text-muted-foreground font-medium">{d.brand}</p>
                <p className="text-[11px] font-semibold leading-tight">{d.name}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-primary font-bold text-sm">{d.price}</span>
                  <span className="text-muted-foreground text-[10px] line-through">{d.was}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: scoreColor(d.score) }} />
                  <span className="text-[10px] text-muted-foreground">Score {d.score}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Nearby Resources shortcut ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="font-bold text-base">🗺️ Nearby Resources</h2>
          <button onClick={onGoMap} className="text-primary text-sm font-semibold">View Map</button>
        </div>
        <div className="flex gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {resources.slice(0, 5).map(r => {
            const cat = CAT[r.type];
            return (
              <button key={r.id} onClick={onGoMap} className="flex-shrink-0 w-44 bg-card rounded-2xl border border-border p-3 text-left shadow-sm active:opacity-70 transition-opacity">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${cat.bg} flex items-center justify-center`}>
                    <cat.Icon size={13} className={cat.text} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
                </div>
                <p className="text-xs font-semibold leading-tight">{r.name}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{r.address}</p>
                <p className="text-[10px] text-primary mt-1 font-medium">{r.hours.split(",")[0]}</p>
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
  const [sortBy, setSortBy] = useState<"health" | "price" | "ethics">("health");
  const q = query.toLowerCase();
  const raw = products.filter(p =>
    p.keywords.some(k => q.includes(k) || k.includes(q.split(" ")[0])) ||
    p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );
  const results = [...raw].sort((a, b) => {
    if (sortBy === "price") return bestPrice(a) - bestPrice(b);
    if (sortBy === "health") return b.safetyScore - a.safetyScore;
    return a.ethicalScore.localeCompare(b.ethicalScore);
  });
  const isEmpty = results.length === 0;

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
      {!isEmpty && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
          <span className="text-xs text-muted-foreground font-medium">Sort:</span>
          {(["health", "price", "ethics"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${sortBy === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
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
          </div>
        )}
      </div>
    </div>
  );
}

// ProductDetailScreen is now in ./components/ProductDetailScreen.tsx
const ProductDetailScreen = NewProductDetailScreen;

// ── Map Tab ───────────────────────────────────────────────────────────────────
function MapTab({ selectedId, setSelectedId, filters, setFilters, resources }: {
  selectedId: number | null; setSelectedId: (id: number | null) => void;
  filters: ResourceType[]; setFilters: (fn: (p: ResourceType[]) => ResourceType[]) => void;
  resources: Resource[];
}) {
  const sel = resources.find(r => r.id === selectedId);
  const visible = resources.filter(r => filters.includes(r.type));

  return (
    <div className="h-full relative overflow-hidden">
      <div className="absolute inset-0">
        <CityMap resources={resources} filters={filters} selectedId={selectedId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} />
      </div>

      {/* Filter chips */}
      <div className="absolute top-3 left-0 right-0 px-3">
        <div className="flex gap-2 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
          {(Object.entries(CAT) as [ResourceType, typeof CAT[ResourceType]][]).map(([type, cfg]) => {
            const active = filters.includes(type);
            return (
              <button key={type}
                onClick={() => setFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-sm transition-all ${active ? `${cfg.bg} ${cfg.text}` : "bg-white/90 text-gray-600"}`}>
                <cfg.Icon size={9} />
                {cfg.label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl">
        {sel ? (
          <div className="p-4">
            <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <div className="flex items-start gap-3">
              {(() => { const SelIcon = CAT[sel.type].Icon; return (
              <div className={`w-10 h-10 rounded-xl ${CAT[sel.type].bg} flex items-center justify-center flex-shrink-0`}>
                <SelIcon size={16} className={CAT[sel.type].text} />
              </div>
              ); })()}
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{CAT[sel.type].label}</span>
                <h3 className="font-bold text-base leading-tight">{sel.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sel.address}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Clock size={9} />{sel.hours}</p>
                <p className="text-xs text-foreground mt-1.5 leading-snug">{sel.description}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <X size={12} />
              </button>
            </div>
            {sel.phone && (
              <button className="w-full mt-3 py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Phone size={13} /> Call {sel.phone}
              </button>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <h3 className="font-bold text-sm mb-2.5">{visible.length} Nearby Resources</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {visible.slice(0, 5).map(r => (
                <button key={r.id} onClick={() => setSelectedId(r.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                  {(() => { const RIcon = CAT[r.type].Icon; return (
                  <div className={`w-8 h-8 rounded-xl ${CAT[r.type].bg} flex items-center justify-center flex-shrink-0`}>
                    <RIcon size={13} className={CAT[r.type].text} />
                  </div>
                  ); })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.address}</p>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ScanTab is now in ./components/ScanTab.tsx
const ScanTab = NewScanTab;

// ── Saved Tab ────────────────────────────────────────────────────────────────
function SavedTab({ savedIds, scannedIds, onSelectProduct, products }: {
  savedIds: number[]; scannedIds: number[]; onSelectProduct: (p: Product) => void; products: Product[];
}) {
  const [tab, setTab] = useState<"favorites" | "scanned" | "lists">("favorites");
  const favs = products.filter(p => savedIds.includes(p.id));
  const scanned = products.filter(p => scannedIds.includes(p.id));

  return (
    <div className="h-full overflow-y-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="px-5 pt-4">
        <h1 className="text-xl font-extrabold mb-4">Saved</h1>
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {(["favorites", "scanned", "lists"] as const).map(t => (
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
        {tab === "lists" && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">Shopping Lists</p>
              <button className="text-primary text-sm font-semibold flex items-center gap-1"><Plus size={13} /> New</button>
            </div>
            {[{ name: "Weekly Groceries", count: 6, emoji: "🛒" }, { name: "Eco Products", count: 3, emoji: "🌿" }, { name: "Medicine Cabinet", count: 2, emoji: "💊" }].map(l => (
              <div key={l.name} className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-2xl shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-xl">{l.emoji}</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.count} items</p>
                </div>
                <ChevronRight size={15} className="text-muted-foreground" />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const STATS = [
    { label: "Money Saved",       value: "$47.80", Icon: DollarSign, color: "#10B981", bg: "#DCFCE7" },
    { label: "CO₂ Reduced",       value: "12.4 kg", Icon: Leaf,       color: "#0EA5E9", bg: "#E0F2FE" },
    { label: "Products Scanned",  value: "34",      Icon: QrCode,     color: "#8B5CF6", bg: "#EDE9FE" },
    { label: "Ethical Purchases", value: "21",      Icon: Shield,     color: "#F59E0B", bg: "#FEF3C7" },
  ];
  const BADGES = [
    { name: "Eco Warrior",     emoji: "🌿", earned: true },
    { name: "Budget Pro",      emoji: "💰", earned: true },
    { name: "Community Hero",  emoji: "🤝", earned: false },
    { name: "Clean Eater",     emoji: "🥗", earned: true },
    { name: "Label Reader",    emoji: "🔍", earned: false },
    { name: "Ethical Shopper", emoji: "⭐", earned: true },
  ];
  return (
    <div className="h-full overflow-y-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="px-5 pt-4 pb-6" style={{ background: "linear-gradient(160deg, #1A5C39, #10B981)" }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg">A</div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Alex Johnson</h1>
            <p className="text-white/60 text-sm">alex@email.com</p>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex items-center gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} size={10} className={i < 4 ? "fill-yellow-300 text-yellow-300" : "text-white/30"} />)}</div>
              <span className="text-xs text-white/80 font-medium">Level 4 · Conscious Shopper</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 -mt-4 mb-5">
          {STATS.map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                  <s.Icon size={13} style={{ color: s.color }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium leading-tight">{s.label}</span>
              </div>
              <p className="text-xl font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>

        <h2 className="font-bold text-base mb-3">Achievements</h2>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {BADGES.map(b => (
            <div key={b.name} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center ${b.earned ? "bg-card border-border shadow-sm" : "bg-muted/50 border-border/50 opacity-50"}`}>
              <span className="text-2xl">{b.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight">{b.name}</span>
              {b.earned && <span className="text-[9px] text-primary font-bold">Earned</span>}
            </div>
          ))}
        </div>

        <h2 className="font-bold text-base mb-3">Settings</h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-8">
          {[
            { Icon: Bell, label: "Notifications" },
            { Icon: Moon, label: "Dark Mode" },
            { Icon: Shield, label: "Privacy" },
            { Icon: Award, label: "Achievements" },
            { Icon: Settings, label: "App Settings" },
          ].map(({ Icon, label }, i, arr) => (
            <button key={label} className={`w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-muted transition-colors ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <Icon size={15} className="text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
    { id: "home",    Icon: Home,   label: "Home"    },
    { id: "map",     Icon: Map,    label: "Map"     },
    { id: "scan",    Icon: Camera, label: "Scan"    },
    { id: "saved",   Icon: Heart,  label: "Saved"   },
    { id: "profile", Icon: User,   label: "Profile" },
  ];
  return (
    <div className="flex-shrink-0 bg-card border-t border-border flex items-center justify-around px-3 pt-2 pb-4">
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
  const [appState, setAppState] = useState<AppState>("welcome");
  const [onbSlide, setOnbSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedIds, setSavedIds] = useState<number[]>([3, 5]);
  const [scannedIds, setScannedIds] = useState<number[]>([2, 6]);


  // ── Live data from Supabase ──────────────────────────────────────────────
  const [resources, setResources] = useState<Resource[]>(RESOURCES);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [dbStatus, setDbStatus] = useState<"loading" | "live" | "offline">("loading");

  const loadData = useCallback(async () => {
    try {
      // Read current db state
      const { data: rows, error } = await supabase
        .from("kv_store_504b3bba")
        .select("key, value")
        .in("key", ["commons_resources", "commons_products", "commons_partners"]);

      if (error) throw error;

      const rRow = rows?.find(r => r.key === "commons_resources");
      const pRow = rows?.find(r => r.key === "commons_products");

      // Seed any missing keys
      const upserts: { key: string; value: any }[] = [];
      if (!rRow?.value || (Array.isArray(rRow.value) && rRow.value.length === 0))
        upserts.push({ key: "commons_resources", value: RESOURCES });
      if (!pRow?.value || (Array.isArray(pRow.value) && pRow.value.length === 0))
        upserts.push({ key: "commons_products", value: PRODUCTS });
      if (!rows?.find(r => r.key === "commons_partners"))
        upserts.push({ key: "commons_partners", value: DEFAULT_PARTNERS });
      if (upserts.length > 0) {
        const { error: seedErr } = await supabase.from("kv_store_504b3bba").upsert(upserts);
        if (seedErr) console.warn("Seed error:", seedErr.message);
      }

      // Set state from db (or keep defaults if just seeded)
      const finalR = rRow?.value ?? RESOURCES;
      const finalP = pRow?.value ?? PRODUCTS;
      if (Array.isArray(finalR) && finalR.length > 0) setResources(finalR.map(rowToResource));
      if (Array.isArray(finalP) && finalP.length > 0) setProducts(finalP.map(rowToProduct));
      setDbStatus("live");
    } catch {
      setDbStatus("offline");
    }
  }, []);

  useEffect(() => {
    loadData();

    // Real-time: subscribe to kv_store table changes
    const channel = supabase
      .channel("commons-realtime")
      .on("postgres_changes" as any, {
        event: "UPDATE", schema: "public", table: "kv_store_504b3bba",
      }, (payload: any) => {
        const key = payload.new?.key;
        const value = payload.new?.value;
        if (key === "commons_resources" && Array.isArray(value)) setResources(value.map(rowToResource));
        if (key === "commons_products" && Array.isArray(value)) setProducts(value.map(rowToProduct));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const openProduct = (p: Product) => { setSelectedProduct(p); setSubScreen("product-detail"); };
  const openSearch = (q: string) => { setSearchQuery(q); setSubScreen("search-results"); };

  const toggleSave = () => {
    if (!selectedProduct) return;
    setSavedIds(prev => prev.includes(selectedProduct.id) ? prev.filter(id => id !== selectedProduct.id) : [...prev, selectedProduct.id]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0a1a0f 0%, #1A5C39 50%, #0d3d2b 100%)" }}>
      <div className="relative overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.7)] flex-shrink-0"
        style={{ width: 390, height: 844, borderRadius: 44, background: "#F8F7F2", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Welcome */}
        {appState === "welcome" && (
          <WelcomeScreen onStart={() => setAppState("onboarding")} onGuest={() => setAppState("main")} />
        )}

        {/* Onboarding */}
        {appState === "onboarding" && (
          <OnboardingScreen
            slide={onbSlide}
            onNext={() => onbSlide < 2 ? setOnbSlide(s => s + 1) : setAppState("main")}
            onBack={() => setOnbSlide(s => Math.max(0, s - 1))}
            onSkip={() => setAppState("main")}
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
                <span className="text-[9px] font-bold text-amber-700 tracking-wide">Offline — showing cached data</span>
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
                      onGoMap={() => setActiveTab("map")}
                      products={products}
                      resources={resources}
                    />
                  )}
                  {activeTab === "map"     && <NewMapTab resources={resources} />}
                  {activeTab === "scan"    && (
                    <ScanTab
                      products={products}
                      onScanResult={(p) => { setScannedIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]); openProduct(p); }}
                    />
                  )}
                  {activeTab === "saved"   && <SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct={openProduct} products={products} />}
                  {activeTab === "profile" && <ProfileTab />}
                </div>
              )}

              {/* Sub-screen overlays — fill content area, slide over tab content */}
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
                  product={selectedProduct}
                  onBack={() => setSubScreen(null)}
                  saved={savedIds.includes(selectedProduct.id)}
                  onToggleSave={toggleSave}
                  products={products}
                />
              )}
            </div>

            {!subScreen && <BottomNav activeTab={activeTab} onTabChange={(t) => { setActiveTab(t); }} />}
          </div>
        )}
      </div>
    </div>
  );
}

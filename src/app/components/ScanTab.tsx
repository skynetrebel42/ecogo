// ─────────────────────────────────────────────────────────────────────────────
// ScanTab.tsx — barcode scan pipeline
//
//   1. The user taps "Scan" (demo barcode) or types a barcode.
//   2. Look up our catalog, then USDA FoodData Central, then Open Food Facts (lib/lookup.ts).
//      • Catalog product    → scan recorded with its id, product page opens.
//      • Found by lookup    → scan recorded as an unknown barcode (no catalog id), product page opens.
//      • Found nowhere      → scan recorded, honest "not found" screen.
//      • Lookup unreachable → "Couldn't reach…" with Try again; nothing recorded.
//
// There is no camera yet (M4): the "Demo" panel picks which barcode to simulate.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { CheckCircle, QrCode, ChevronUp, ChevronDown, MapPin, Clock, Database, X, WifiOff, ExternalLink } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { lookupBarcode, normalizeBarcode, isBarcode } from "../../lib/lookup";
import { findProductByBarcode, recordProductScan, createPlaceholder, getCurrentLocation, type ScanEvent } from "../../lib/scanService";

interface DemoBarcode { barcode: string; label: string; category: string }

const DEMO_BARCODES: DemoBarcode[] = [
  { barcode: "028400315035",  label: "Lay's Classic Chips",        category: "Snacks"          },
  { barcode: "049000006421",  label: "Diet Coke 12-Pack",          category: "Beverages"       },
  { barcode: "049000028905",  label: "Coca-Cola Classic 12-Pack",  category: "Beverages"       },
  { barcode: "028400335799",  label: "Doritos Nacho Cheese",       category: "Snacks"          },
  { barcode: "044000032029",  label: "Oreo Original Cookies",      category: "Snacks"          },
  { barcode: "016000280939",  label: "Nature Valley Granola Bars", category: "Snacks"          },
  { barcode: "070847011443",  label: "Monster Energy Original",    category: "Beverages"       },
  { barcode: "044700032085",  label: "Oscar Mayer Hot Dogs",       category: "Meat"            },
  { barcode: "017800185165",  label: "Purina ONE Dog Food",        category: "Pet Food"        },
  { barcode: "742365003009",  label: "Horizon Organic Milk",       category: "Dairy"           },
  { barcode: "041500058069",  label: "French's Yellow Mustard",    category: "Condiments"      },
  { barcode: "732913222019",  label: "Seventh Generation Laundry", category: "Cleaning"        },
  { barcode: "037000869870",  label: "Tide PODS 42ct",             category: "Cleaning"        },
  { barcode: "300450449989",  label: "Tylenol Extra Strength",     category: "Medicine"        },
  { barcode: "049000042566",  label: "Coca-Cola Zero Sugar",       category: "USDA"            },
  { barcode: "028400064057",  label: "Tostitos Bite Size",         category: "USDA"            },
  { barcode: "3017620422003", label: "Nutella",                    category: "Open Food Facts" },
  { barcode: "3017620429996", label: "Unlisted product",           category: "Not found"       },
];

type ScanState = "idle" | "scanning" | "found" | "not_found" | "error";

interface ScanTabProps {
  /** Called with the product (catalog or looked up) so App.tsx can open the product page. */
  onScanResult: (product: Product) => void;
  products: Product[];
}

export default function ScanTab({ onScanResult, products }: ScanTabProps) {
  const [scanState, setScanState]             = useState<ScanState>("idle");
  const [selectedBarcode, setSelectedBarcode] = useState<DemoBarcode>(DEMO_BARCODES[0]);
  const [selectorOpen, setSelectorOpen]       = useState(false);
  const [typed, setTyped]                     = useState("");
  const [scannedCode, setScannedCode]         = useState("");
  const [lastScanEvent, setLastScanEvent]     = useState<ScanEvent | null>(null);
  const [locationStatus, setLocationStatus]   = useState<"pending" | "granted" | "denied" | null>(null);

  const handleScan = useCallback(async (raw: string, simulateCamera: boolean) => {
    if (scanState === "scanning" || scanState === "found") return;
    const barcode = normalizeBarcode(raw);
    setScanState("scanning");
    setScannedCode(barcode);
    setLastScanEvent(null);
    setSelectorOpen(false);
    setLocationStatus("pending");

    const locationPromise = getCurrentLocation().then((loc) => { setLocationStatus(loc ? "granted" : "denied"); return loc; });
    if (simulateCamera) await new Promise<void>((resolve) => setTimeout(resolve, 2200));

    const catalogProduct = findProductByBarcode(barcode, products);
    let product: Product | null = catalogProduct;
    if (!product) {
      const found = await lookupBarcode(barcode, { fdcKey: import.meta.env.VITE_FDC_API_KEY });
      if (found.status === "error") { setScanState("error"); return; }
      if (found.status === "found") product = found.product;
    }
    const location = await locationPromise;

    if (product) {
      setScanState("found");
      // Only catalog products have a database id; looked-up products are logged as unknown barcodes.
      const event = catalogProduct ? await recordProductScan(catalogProduct, location) : await createPlaceholder(barcode, location);
      if (event) setLastScanEvent(event);
      await new Promise<void>((resolve) => setTimeout(resolve, 900));
      setScanState("idle");
      onScanResult(product);
    } else {
      setScanState("not_found");
      const event = await createPlaceholder(barcode, location);
      if (event) setLastScanEvent(event);
    }
  }, [scanState, products, onScanResult]);

  const resetToIdle = useCallback(() => {
    setScanState("idle");
    setLastScanEvent(null);
    setLocationStatus(null);
  }, []);

  const typedCode   = normalizeBarcode(typed);
  const typedValid  = isBarcode(typedCode);
  const busy        = scanState === "scanning" || scanState === "found";
  const scanBgColor = scanState === "found" ? "#10B981" : scanState === "error" ? "#B45309" : "#1A5C39";

  // ── Not found anywhere ─────────────────────────────────────────────────────
  if (scanState === "not_found") {
    return (
      <div className="h-full flex flex-col" style={{ background: "#1a1200" }}>
        <div className="px-5 pt-5 pb-0 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-bold tracking-widest uppercase">Not found</span>
          <button onClick={resetToIdle} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X size={14} color="white" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mb-5">
            <Database size={40} className="text-amber-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">We couldn't find this barcode yet</h2>
          <p className="text-white/60 text-sm mb-3 leading-relaxed max-w-xs">
            It isn't in our catalog, USDA FoodData Central or Open Food Facts. You can add it to Open Food Facts,
            the free product database, so everyone can see its ingredients.
          </p>
          <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer"
            className="text-amber-300 text-xs font-bold mb-5 inline-flex items-center gap-1">
            Add it at openfoodfacts.org <ExternalLink size={11} />
          </a>
          <div className="bg-white/8 border border-white/15 rounded-2xl px-5 py-3 w-full max-w-xs">
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Scanned Barcode</p>
            <p className="text-white font-mono font-bold text-sm tracking-wider">{scannedCode}</p>
          </div>
          {lastScanEvent && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-300/60">
              <Clock size={11} />
              <span>Scan saved at {new Date(lastScanEvent.scanned_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-8 flex-shrink-0">
          <button onClick={resetToIdle} className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl" style={{ background: "#F59E0B" }}>
            Scan Another Product
          </button>
        </div>
      </div>
    );
  }

  // ── Scanner ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ background: "#0F1F16" }}>
      <style>{`
        @keyframes scanBeam { 0%, 100% { top: 12%; opacity: 1; } 50% { top: 82%; opacity: 0.8; } }
        @keyframes pulseRing { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <div className="mb-4 text-center" style={{ animation: "fadeInUp 0.3s ease" }}>
          <p className="text-white/40 text-[10px] mb-1 font-medium tracking-widest uppercase">Selected barcode</p>
          <p className="text-sm font-bold text-white/80">{selectedBarcode.label}</p>
          <p className="text-white/30 text-[10px] font-mono mt-0.5">{selectedBarcode.barcode}</p>
        </div>

        <div className="relative w-56 h-56 mx-auto mb-4">
          {(["top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
             "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
             "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
             "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl"] as const).map((cls, i) => (
            <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
          ))}
          <div className="absolute inset-6 flex items-end justify-center gap-0.5 pb-3">
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} className="bg-white/15 rounded-sm" style={{ width: i % 4 === 0 ? 3 : 2, height: 30 + Math.abs(Math.sin(i * 1.3)) * 16 }} />
            ))}
          </div>
          {scanState === "scanning" && (
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
              style={{ animation: "scanBeam 1.5s ease-in-out infinite" }} />
          )}
          {scanState === "found" && (
            <>
              <div className="absolute inset-0 rounded-2xl border-2 border-green-400" style={{ animation: "pulseRing 0.6s ease-out" }} />
              <div className="absolute inset-0 flex items-center justify-center"><CheckCircle size={48} className="text-green-400" /></div>
            </>
          )}
          {scanState === "error" && (
            <div className="absolute inset-0 flex items-center justify-center"><WifiOff size={44} className="text-amber-400" /></div>
          )}
        </div>

        <p className="text-white/50 text-sm text-center px-6">
          {scanState === "scanning" ? "Looking up…"
            : scanState === "found" ? "✓ Product found!"
            : scanState === "error" ? "Couldn't reach the product databases. Check your connection and try again."
            : "Tap to scan"}
        </p>

        {scanState === "scanning" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
            <MapPin size={10} />
            <span>{locationStatus === "pending" ? "Getting location…" : locationStatus === "granted" ? "Location captured" : "Location unavailable"}</span>
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex-shrink-0 space-y-3">
        <button onClick={() => setSelectorOpen((o) => !o)} disabled={busy}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 disabled:opacity-40 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <QrCode size={14} className="text-white/50 flex-shrink-0" />
            <span className="text-white/70 text-xs font-medium truncate">Demo: {selectedBarcode.label}</span>
          </div>
          {selectorOpen ? <ChevronDown size={14} className="text-white/40 flex-shrink-0" /> : <ChevronUp size={14} className="text-white/40 flex-shrink-0" />}
        </button>

        {selectorOpen && (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {DEMO_BARCODES.map((demo) => {
              const active = demo.barcode === selectedBarcode.barcode;
              return (
                <button key={demo.barcode} onClick={() => {
                    setSelectedBarcode(demo);
                    setSelectorOpen(false);
                    // A new pick replaces a failed lookup, so the big button scans it instead of retrying the old code.
                    if (scanState === "error") setScanState("idle");
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors"
                  style={{ background: active ? "rgba(255,255,255,0.10)" : "transparent" }}>
                  <div>
                    <p className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-white/70"}`}>{demo.label}</p>
                    <p className="text-[9px] text-white/30 font-mono">{demo.barcode}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${demo.category === "Not found" ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-white/50"}`}>
                    {demo.category}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (typedValid && !busy) handleScan(typedCode, false); }} className="flex gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" aria-label="Barcode number"
            placeholder="Or type a barcode (8–14 digits)"
            className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 text-white text-xs placeholder:text-white/30 outline-none focus:border-green-400" />
          <button type="submit" disabled={!typedValid || busy} className="px-4 rounded-2xl bg-white/10 text-white text-xs font-bold disabled:opacity-40">
            Look up
          </button>
        </form>
        {typed.trim() !== "" && !typedValid && (
          <p className="text-[10px] text-amber-300/80 -mt-1 px-1">Enter the 8–14 digits under the barcode.</p>
        )}

        <button onClick={() => (scanState === "error" ? handleScan(scannedCode, false) : handleScan(selectedBarcode.barcode, true))}
          disabled={busy}
          className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl transition-all disabled:opacity-50"
          style={{ background: scanBgColor }}>
          {scanState === "error" ? "Try again" : scanState === "scanning" ? "Looking up…" : scanState === "found" ? "✓ Product Found" : "📷 Tap to Scan"}
        </button>

        <p className="text-center text-white/25 text-[10px]">
          {products.length} catalog products · others looked up in USDA FoodData Central, then Open Food Facts
        </p>
      </div>
    </div>
  );
}

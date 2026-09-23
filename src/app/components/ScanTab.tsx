// ─────────────────────────────────────────────────────────────────────────────
// ScanTab.tsx — Barcode scanner with full scan pipeline
//
// Flow:
//   1. User taps "Scan" (or picks a demo barcode from the selector panel).
//   2. Geolocation is requested in parallel with the scan animation.
//   3. On scan complete, the barcode is looked up in the product database.
//      • Found   → records a ScanEvent, fires onScanResult (opens product detail).
//      • Unknown → records a placeholder, shows the "New Product Detected" screen.
//   4. Scan events are persisted via scanService → Supabase `scan_events` table.
//
// Demo mode: since a real camera API isn't available in Make, a slide-up
// "Demo Barcodes" panel lets the user pick which barcode to simulate scanning.
// One entry is intentionally an unknown barcode to demonstrate the placeholder flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import {
  CheckCircle, AlertCircle, QrCode, ChevronUp, ChevronDown,
  MapPin, Clock, Database, Info, X,
} from "lucide-react";
import type { Product } from "../../lib/productImporter";
import {
  findProductByBarcode,
  recordProductScan,
  createPlaceholder,
  getCurrentLocation,
  type ScanEvent,
} from "../../lib/scanService";

// ─── Demo barcode catalogue ───────────────────────────────────────────────────
// Each entry represents a barcode a user might physically scan.
// The "UNKNOWN-*" entries simulate barcodes not in the database.

interface DemoBarcode {
  barcode: string;
  label: string;
  category: string;
}

const DEMO_BARCODES: DemoBarcode[] = [
  { barcode: "028400315035", label: "Lay's Classic Chips",         category: "Snacks"        },
  { barcode: "049000006421", label: "Diet Coke 12-Pack",           category: "Beverages"     },
  { barcode: "049000028905", label: "Coca-Cola Classic 12-Pack",   category: "Beverages"     },
  { barcode: "028400064057", label: "Doritos Nacho Cheese",        category: "Snacks"        },
  { barcode: "044000030438", label: "Oreo Original Cookies",       category: "Snacks"        },
  { barcode: "016000280939", label: "Nature Valley Granola Bars",  category: "Snacks"        },
  { barcode: "070847011443", label: "Monster Energy Original",     category: "Beverages"     },
  { barcode: "044700032085", label: "Oscar Mayer Hot Dogs",        category: "Meat"          },
  { barcode: "017800185165", label: "Purina ONE Dog Food",         category: "Pet Food"      },
  { barcode: "742365003009", label: "Horizon Organic Milk",        category: "Dairy"         },
  { barcode: "041500058069", label: "French's Yellow Mustard",     category: "Condiments"    },
  { barcode: "732913222019", label: "Seventh Generation Laundry",  category: "Cleaning"      },
  { barcode: "037000869870", label: "Tide PODS 42ct",              category: "Cleaning"      },
  { barcode: "300450449989", label: "Tylenol Extra Strength",      category: "Medicine"      },
  { barcode: "UNKNOWN-78234982", label: "New Product (Demo)",      category: "Unknown"       },
  { barcode: "UNKNOWN-00129384", label: "New Product (Demo)",      category: "Unknown"       },
];

// ─── ScanState machine ────────────────────────────────────────────────────────

type ScanState =
  | "idle"           // viewfinder showing, waiting for user tap
  | "scanning"       // beam animation running, getting location
  | "found"          // matched product — green flash
  | "not_found"      // unrecognised barcode — yellow flash
  | "error";         // something went wrong — red indicator

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScanTabProps {
  /** Called with the matched product so App.tsx can open ProductDetailScreen. */
  onScanResult: (product: Product) => void;
  /** Current product database for barcode lookup. */
  products: Product[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScanTab({ onScanResult, products }: ScanTabProps) {
  const [scanState, setScanState]               = useState<ScanState>("idle");
  const [selectedBarcode, setSelectedBarcode]   = useState<DemoBarcode>(DEMO_BARCODES[0]);
  const [selectorOpen, setSelectorOpen]         = useState(false);
  const [lastScanEvent, setLastScanEvent]       = useState<ScanEvent | null>(null);
  const [locationStatus, setLocationStatus]     = useState<"pending" | "granted" | "denied" | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  // ── Core scan pipeline ─────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    if (scanState !== "idle") return;

    setScanState("scanning");
    setLastScanEvent(null);
    setSelectorOpen(false);
    setLocationStatus("pending");

    // Request location in parallel with the 2-second scan animation
    const locationPromise = getCurrentLocation().then((loc) => {
      locationRef.current = loc;
      setLocationStatus(loc ? "granted" : "denied");
      return loc;
    });

    // Simulate barcode read delay
    await new Promise<void>((resolve) => setTimeout(resolve, 2200));

    const location = await locationPromise;
    const barcode  = selectedBarcode.barcode;
    const product  = findProductByBarcode(barcode, products);

    if (product) {
      // ── Product found ────────────────────────────────────────────────────
      setScanState("found");
      const event = await recordProductScan(product, location);
      if (event) setLastScanEvent(event);

      // Let the success animation run, then open product detail
      await new Promise<void>((resolve) => setTimeout(resolve, 900));
      setScanState("idle");
      onScanResult(product);
    } else {
      // ── Unknown barcode ──────────────────────────────────────────────────
      setScanState("not_found");
      const event = await createPlaceholder(barcode, location);
      if (event) setLastScanEvent(event);
      // Stay on not_found screen until user taps "Scan Again"
    }
  }, [scanState, selectedBarcode, products, onScanResult]);

  const resetToIdle = useCallback(() => {
    setScanState("idle");
    setLastScanEvent(null);
    setLocationStatus(null);
  }, []);

  // ── Derived UI state ───────────────────────────────────────────────────────
  const isUnknown  = selectedBarcode.barcode.startsWith("UNKNOWN-");
  const scanLabel  = isUnknown ? "Unknown Product" : selectedBarcode.label;
  const scanBgColor = scanState === "found"
    ? "#10B981"
    : scanState === "not_found"
    ? "#F59E0B"
    : "#1A5C39";

  // ── Not-found / Placeholder screen ────────────────────────────────────────
  if (scanState === "not_found") {
    return (
      <div className="h-full flex flex-col" style={{ background: "#1a1200" }}>
        <style>{`
          @keyframes unknownPulse {
            0% { opacity: 0.6; transform: scale(0.97); }
            50% { opacity: 1; transform: scale(1.03); }
            100% { opacity: 0.6; transform: scale(0.97); }
          }
        `}</style>

        {/* Header */}
        <div className="px-5 pt-5 pb-0 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-bold tracking-widest uppercase">New Barcode Detected</span>
          <button onClick={resetToIdle} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X size={14} color="white" />
          </button>
        </div>

        {/* Icon + barcode */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mb-5"
            style={{ animation: "unknownPulse 2s ease-in-out infinite" }}>
            <Database size={40} className="text-amber-400" />
          </div>

          <h2 className="text-2xl font-extrabold text-white mb-2">Not in Database</h2>
          <p className="text-white/60 text-sm mb-4 leading-relaxed max-w-xs">
            This barcode wasn't found in our product database. We've saved it for review — each scan
            helps us prioritise which products to add next.
          </p>

          {/* Barcode display */}
          <div className="bg-white/8 border border-white/15 rounded-2xl px-5 py-3 mb-4 w-full max-w-xs">
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Scanned Barcode</p>
            <p className="text-white font-mono font-bold text-sm tracking-wider">
              {selectedBarcode.barcode}
            </p>
          </div>

          {/* Location status */}
          <div className="flex items-center gap-2 text-xs">
            <MapPin size={12} className={locationStatus === "granted" ? "text-green-400" : "text-white/30"} />
            <span className={locationStatus === "granted" ? "text-green-400" : "text-white/30"}>
              {locationStatus === "granted" ? "Location recorded" : "Location unavailable"}
            </span>
          </div>

          {lastScanEvent && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-300/60">
              <Clock size={11} />
              <span>Scan saved at {new Date(lastScanEvent.scanned_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* How it helps */}
        <div className="px-5 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">How this helps</span>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              Every unknown scan is queued for review. Products scanned most frequently
              are added to the database first — so the more people scan an item,
              the faster it gets analysed and published for everyone.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-8 flex-shrink-0">
          <button onClick={resetToIdle}
            className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl"
            style={{ background: "#F59E0B" }}>
            Scan Another Product
          </button>
        </div>
      </div>
    );
  }

  // ── Main scanner view ─────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ background: "#0F1F16" }}>
      <style>{`
        @keyframes scanBeam {
          0%, 100% { top: 12%; opacity: 1; }
          50% { top: 82%; opacity: 0.8; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Viewfinder area */}
      <div className="flex-1 relative flex flex-col items-center justify-center">

        {/* Selected barcode label */}
        <div className="mb-4 text-center" style={{ animation: "fadeInUp 0.3s ease" }}>
          <p className="text-white/40 text-[10px] mb-1 font-medium tracking-widest uppercase">
            Selected barcode
          </p>
          <p className={`text-sm font-bold ${isUnknown ? "text-amber-400" : "text-white/80"}`}>
            {scanLabel}
          </p>
          <p className="text-white/30 text-[10px] font-mono mt-0.5">{selectedBarcode.barcode}</p>
        </div>

        {/* Scanner frame */}
        <div className="relative w-56 h-56 mx-auto mb-4">
          {/* Corner brackets */}
          {(["top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
             "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
             "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
             "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl"] as const).map((cls, i) => (
            <div key={i} className={`absolute w-8 h-8 border-green-400 ${cls}`} />
          ))}

          {/* Simulated barcode lines */}
          <div className="absolute inset-6 flex items-end justify-center gap-0.5 pb-3">
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} className="bg-white/15 rounded-sm"
                style={{ width: i % 4 === 0 ? 3 : 2, height: 30 + Math.abs(Math.sin(i * 1.3)) * 16 }} />
            ))}
          </div>

          {/* Scan beam */}
          {scanState === "scanning" && (
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
              style={{ animation: "scanBeam 1.5s ease-in-out infinite" }} />
          )}

          {/* Success overlay */}
          {scanState === "found" && (
            <>
              <div className="absolute inset-0 rounded-2xl border-2 border-green-400"
                style={{ animation: "pulseRing 0.6s ease-out" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle size={48} className="text-green-400" />
              </div>
            </>
          )}
        </div>

        {/* Status message */}
        <p className="text-white/50 text-sm">
          {scanState === "scanning"
            ? "Scanning…"
            : scanState === "found"
            ? "✓ Product found!"
            : "Tap to scan"}
        </p>

        {/* Location indicator */}
        {scanState === "scanning" && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
            <MapPin size={10} />
            <span>
              {locationStatus === "pending"  ? "Getting location…"
               : locationStatus === "granted" ? "Location captured"
               : "Location unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-5 pb-4 flex-shrink-0 space-y-3">

        {/* Demo barcode selector toggle */}
        <button
          onClick={() => setSelectorOpen((o) => !o)}
          disabled={scanState !== "idle"}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 disabled:opacity-40 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <QrCode size={14} className="text-white/50 flex-shrink-0" />
            <span className="text-white/70 text-xs font-medium truncate">
              Demo: {scanLabel}
            </span>
          </div>
          {selectorOpen
            ? <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
            : <ChevronUp   size={14} className="text-white/40 flex-shrink-0" />}
        </button>

        {/* Selector list */}
        {selectorOpen && (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-h-48 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}>
            {DEMO_BARCODES.map((demo) => {
              const active = demo.barcode === selectedBarcode.barcode;
              const unknown = demo.barcode.startsWith("UNKNOWN-");
              return (
                <button
                  key={demo.barcode}
                  onClick={() => { setSelectedBarcode(demo); setSelectorOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 transition-colors"
                  style={{ background: active ? "rgba(255,255,255,0.10)" : "transparent" }}
                >
                  <div>
                    <p className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-white/70"}`}>
                      {demo.label}
                    </p>
                    <p className="text-[9px] text-white/30 font-mono">{demo.barcode}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                    unknown
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/10 text-white/50"
                  }`}>
                    {demo.category}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Scan button */}
        <button
          onClick={handleScan}
          disabled={scanState !== "idle"}
          className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl transition-all disabled:opacity-50"
          style={{ background: scanBgColor }}
        >
          {scanState === "idle"
            ? "📷 Tap to Scan"
            : scanState === "scanning"
            ? "Scanning…"
            : "✓ Product Found"}
        </button>

        <p className="text-center text-white/25 text-[10px]">
          {DEMO_BARCODES.length} demo barcodes · {products.length} products in database
        </p>
      </div>
    </div>
  );
}

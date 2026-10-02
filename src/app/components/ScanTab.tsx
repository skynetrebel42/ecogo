// ─────────────────────────────────────────────────────────────────────────────
// ScanTab.tsx — barcode scan pipeline
//
//   1. The Scan tab opens the live camera (CameraScanner), which reads a barcode on its own. Typing a barcode or
//      tapping a demo barcode does the same without a camera (M6 spec §4.3, §4.4).
//   2. Look up our catalog, then USDA FoodData Central, then Open Food Facts (lib/lookup.ts).
//      • Catalog product    → product page opens.
//      • Found by lookup    → product page opens.
//      • Found nowhere      → honest "not found" screen.
//      • Lookup unreachable → "Couldn't reach…" with Try again.
//   Scans are not saved (owner decision M3-4, 2026-09-29).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { CheckCircle, QrCode, ChevronUp, ChevronDown, Database, X, WifiOff, ExternalLink } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { lookupBarcode, normalizeBarcode, isBarcode, sameBarcode, offAddUrl } from "../../lib/lookup";
import { USDA_RELAY_URL } from "../../lib/supabase";
import CameraScanner from "./CameraScanner";

interface DemoBarcode { barcode: string; label: string; category: string }

// Real codes only: catalog foods verified against USDA (src/data/verified-barcodes.json) plus looked-up examples.
const DEMO_BARCODES: DemoBarcode[] = [
  { barcode: "028400199148",  label: "Lay's Classic Chips",        category: "Snacks"          },
  { barcode: "049000006582",  label: "Diet Coke 12 fl oz",         category: "Beverages"       },
  { barcode: "049000006346",  label: "Coca-Cola 12 fl oz",         category: "Beverages"       },
  { barcode: "028400335799",  label: "Doritos Nacho Cheese",       category: "Snacks"          },
  { barcode: "044000032029",  label: "Oreo Original Cookies",      category: "Snacks"          },
  { barcode: "016000115828",  label: "Nature Valley Granola Bars", category: "Snacks"          },
  { barcode: "070847024446",  label: "Monster Energy Original",    category: "Beverages"       },
  { barcode: "044700075050",  label: "Oscar Mayer Beef Franks",    category: "Meat"            },
  { barcode: "742365228407",  label: "Horizon Organic Milk",       category: "Dairy"           },
  { barcode: "041500000251",  label: "French's Yellow Mustard",    category: "Condiments"      },
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
  const [scanState, setScanState]       = useState<ScanState>("idle");
  const [cameraOpen, setCameraOpen]     = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [typed, setTyped]               = useState("");
  const [scannedCode, setScannedCode]   = useState("");

  const handleScan = useCallback(async (raw: string) => {
    if (scanState === "scanning" || scanState === "found") return;
    const barcode = normalizeBarcode(raw);
    setCameraOpen(false);
    setScanState("scanning");
    setScannedCode(barcode);
    setSelectorOpen(false);

    const catalogProduct = products.find((p) => sameBarcode(p.barcode, barcode)) ?? null;
    let product: Product | null = catalogProduct;
    if (!product) {
      const found = await lookupBarcode(barcode, { relayUrl: USDA_RELAY_URL });
      if (found.status === "error") { setScanState("error"); return; }
      if (found.status === "found") product = found.product;
    }

    if (product) {
      setScanState("found");
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      setScanState("idle");
      onScanResult(product);
    } else {
      setScanState("not_found");
    }
  }, [scanState, products, onScanResult]);

  /** "Scan Another Product": straight back to the camera. */
  const scanAgain = useCallback(() => { setScanState("idle"); setCameraOpen(true); }, []);

  const typedCode  = normalizeBarcode(typed);
  const typedValid = isBarcode(typedCode);
  const busy       = scanState === "scanning" || scanState === "found";

  // Type-a-barcode and the demo list: inside the camera's drawer, and on the manual view.
  const manualEntry = (
    <>
      <form onSubmit={(e) => { e.preventDefault(); if (typedValid && !busy) handleScan(typedCode); }} className="flex gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="numeric" aria-label="Barcode number"
          placeholder="Type a barcode (8–14 digits)"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 text-white text-xs placeholder:text-white/40 outline-none focus:border-green-400" />
        <button type="submit" disabled={!typedValid || busy} className="px-4 rounded-2xl bg-white/10 text-white text-xs font-bold disabled:opacity-40">
          Look up
        </button>
      </form>
      {typed.trim() !== "" && !typedValid && (
        <p className="text-[10px] text-amber-300/80 -mt-1 px-1">Enter the 8–14 digits under the barcode.</p>
      )}
      <button onClick={() => setSelectorOpen((o) => !o)} disabled={busy} aria-expanded={selectorOpen}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 disabled:opacity-40">
        <span className="flex items-center gap-2 text-white/70 text-xs font-medium"><QrCode size={14} className="text-white/50" />Demo barcodes</span>
        {selectorOpen ? <ChevronDown size={14} className="text-white/40" /> : <ChevronUp size={14} className="text-white/40" />}
      </button>
      {selectorOpen && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {DEMO_BARCODES.map((demo) => (
            <button key={demo.barcode} onClick={() => handleScan(demo.barcode)} disabled={busy}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0">
              <span>
                <span className="block text-xs font-semibold leading-tight text-white/80">{demo.label}</span>
                <span className="block text-[9px] text-white/40 font-mono">{demo.barcode}</span>
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${demo.category === "Not found" ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-white/60"}`}>
                {demo.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  // ── Not found anywhere ─────────────────────────────────────────────────────
  if (scanState === "not_found") {
    return (
      <div className="h-full flex flex-col" style={{ background: "#1a1200" }}>
        <div className="px-5 pt-5 pb-0 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-bold tracking-widest uppercase">Not found</span>
          <button onClick={scanAgain} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
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
            the free product database, so everyone can see its ingredients. You can add photos of the label: their AI
            suggests the nutrition values from them.
          </p>
          <a href={offAddUrl(scannedCode)} target="_blank" rel="noreferrer"
            className="text-amber-300 text-xs font-bold mb-5 inline-flex items-center gap-1">
            Add it to Open Food Facts (barcode filled in) <ExternalLink size={11} />
          </a>
          <div className="bg-white/8 border border-white/15 rounded-2xl px-5 py-3 w-full max-w-xs">
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Scanned Barcode</p>
            <p className="text-white font-mono font-bold text-sm tracking-wider">{scannedCode}</p>
          </div>
        </div>

        <div className="px-5 pb-8 flex-shrink-0">
          <button onClick={scanAgain} className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl" style={{ background: "#F59E0B" }}>
            Scan Another Product
          </button>
        </div>
      </div>
    );
  }

  // ── Live camera ────────────────────────────────────────────────────────────
  if (scanState === "idle" && cameraOpen) {
    return <CameraScanner onCode={handleScan} onClose={() => setCameraOpen(false)}>{manualEntry}</CameraScanner>;
  }

  // ── Looking up, error, or camera closed ────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ background: "#0F1F16" }}>
      <style>{`@keyframes pulseRing { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }`}</style>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative w-40 h-40 mb-4 flex items-center justify-center">
          {scanState === "found" && (
            <>
              <div className="absolute inset-0 rounded-2xl border-2 border-green-400" style={{ animation: "pulseRing 0.6s ease-out" }} />
              <CheckCircle size={48} className="text-green-400" />
            </>
          )}
          {scanState === "error" && <WifiOff size={44} className="text-amber-400" />}
          {scanState === "scanning" && <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-green-400 animate-spin" aria-hidden="true" />}
          {scanState === "idle" && <QrCode size={56} className="text-white/30" />}
        </div>
        <p className="text-white/70 text-sm text-center" role="status">
          {scanState === "scanning" ? `Looking up ${scannedCode}…`
            : scanState === "found" ? "✓ Product found!"
            : scanState === "error" ? "Couldn't reach the product databases. Check your connection and try again."
            : "Camera closed."}
        </p>
      </div>

      <div className="px-5 pb-4 flex-shrink-0 space-y-3">
        {manualEntry}
        <button onClick={() => (scanState === "error" ? handleScan(scannedCode) : setCameraOpen(true))} disabled={busy}
          className="w-full py-4 rounded-2xl font-bold text-base text-white shadow-xl disabled:opacity-50"
          style={{ background: scanState === "error" ? "#B45309" : "#1A5C39" }}>
          {scanState === "error" ? "Try again" : busy ? "Looking up…" : "📷 Open camera"}
        </button>
        <p className="text-center text-white/40 text-[10px]">
          {products.length} catalog products · others looked up in USDA FoodData Central, then Open Food Facts
        </p>
      </div>
    </div>
  );
}

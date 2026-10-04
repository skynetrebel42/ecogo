# M6 Camera Scanning + Phone Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pointing a phone or laptop camera at a grocery barcode opens its product page, the app fills the phone
screen, and no catalog product carries an invented barcode.

**Architecture:**
- **Pure logic** (`scanner.ts`: the misread guard and code cleanup) is tested in Node, including a round trip that
  draws real barcodes with ZXing and reads them back.
- **The reader** (`barcodeReader.ts`) is the native BarcodeDetector where it supports grocery formats, otherwise the
  `barcode-detector` ponyfill with its `.wasm` bundled by Vite.
- **The camera screen** (`CameraScanner.tsx`) runs a detect loop on the live video and hands a confirmed code to the
  existing `ScanTab` lookup flow.
- **Phone layout:** a load-time `matchMedia` switch in `App.tsx` drops the phone frame on phones.

**Tech Stack:** React 18 + Vite 6, new dependencies `barcode-detector` 3.2.2 and `zxing-wasm` 3.1.3 (both MIT,
pinned exactly so there's one copy), Node `node --test` (141 tests now, 144 after), and the Supabase MCP for one data
migration.

**Spec:** `docs/superpowers/specs/2026-10-01-m6-camera-mobile-design.md`. Read it first.

**How this plan was checked:** every code block below was applied to a clean copy of `main` (`9659fc2`) on
2026-10-01, with the two packages installed. The suite passed 144/144 and `vite build` succeeded; the reader ships as
`assets/zxing_reader-*.wasm` (1.09 MB, 461 kB gzip). In a dev server:
- **A fake camera** (a canvas stream showing a ZXing-drawn Oreo UPC-A) opened Oreo's product page about 1 s after
  tapping Scan.
- **The `.wasm` came from our own server.** The only outside hosts were Google Fonts, Supabase and USDA, and there was
  no jsDelivr request.
- **A denied camera** showed "Camera blocked. Allow it in your browser's site settings, or type the barcode below.",
  with the type box open.

**Assets** in `docs/superpowers/plans/2026-10-01-m6-assets/`:
- `verified-barcodes.json`: M5's file plus 17 non-food products in `removed`, 20 removed in all;
- `oreo-044000032029.png`: a ZXing-drawn UPC-A for the fake-camera check.

## Global Constraints

- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Line endings:** repo files have CRLF. Use one-line `old_string`s or the exact blocks below; replace whole files
  where this plan says so.
- **Dependencies:** exactly `barcode-detector` 3.2.2 and `zxing-wasm` 3.1.3, as exact versions with no `^`. Nothing
  else.
- **Privacy:**
  - Frames are read on the device and never sent anywhere.
  - No CDN: the `.wasm` loads from our bundle.
  - The camera stops on ✕, on unmount, and when the page is hidden.
  - The screen says "Scanning happens on your phone. No images are uploaded."
- **Trust:** a code counts only after two identical reads in a row. No catalog product may carry an unverified barcode.
- **Migrations:** apply new ones with the Supabase MCP `apply_migration` on `gippyavmxxzqxjkuahpt`, then run
  `get_advisors`. The owner approved removing the non-food barcodes (M6 spec C1), so approving this plan approves that
  live change.
- **Commits:** commit per task on `main`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Ask the owner before any push: it redeploys the live site.
- **Suite:** `npm test` and `npm run build` stay green after every task.

## Review Focus

1. **Misreads:** a single wrong read must never open a product. Pinned by Task 2's `confirmReads` test.
2. **UPC-A read as 13-digit EAN** ("0044000032029") must still open the catalog Oreo. Pinned by Task 2's round-trip
   test and Task 4's fake-camera check.
3. **Camera left running** after leaving Scan or locking the phone (battery, privacy). Pinned by Task 4 Step 5's
   track-state check.
4. **Denied or no camera** must leave a usable path (type a barcode). Pinned by Task 4 Step 5's denied check.
5. **Wrong-product scans** from invented non-food codes. Pinned by Task 1's widened `verified-barcodes.test.ts`.

---

## File structure

| File | Change |
|---|---|
| `src/data/verified-barcodes.json`, `src/data/products.csv`, migration | Non-food barcodes removed |
| `src/lib/safety/verified-barcodes.test.ts` | Guard covers every product |
| `package.json` / `package-lock.json` | `barcode-detector` 3.2.2, `zxing-wasm` 3.1.3 |
| `src/lib/scanner.ts` (new) + `scanner.test.ts` (new) | `SCAN_FORMATS`, `normalizeScanned`, `confirmReads` |
| `src/lib/barcodeReader.ts` (new) | `createDetector()` |
| `src/app/components/CameraScanner.tsx` (new) | The live camera screen |
| `src/app/components/ScanTab.tsx` | Replaced: camera first, manual entry in the drawer |
| `src/app/App.tsx`, `index.html` | Phone layout |

---

### Task 1: No invented barcodes anywhere (non-food removed)

**Files:** Modify `src/data/verified-barcodes.json` (copied from assets), `src/data/products.csv` (by the script),
`src/lib/safety/verified-barcodes.test.ts`. Create `supabase/migrations/<version>_remove_nonfood_barcodes.sql`.

- [ ] **Step 1: Widen the guard (failing test).** In `verified-barcodes.test.ts`:
  - delete the line `import { FOOD_CATEGORIES } from "./analyze.ts";`;
  - rename the first test to `"every catalog product (food and non-food) has a verified barcode or none"`;
  - change its loop `for (const p of catalog.filter(p => FOOD_CATEGORIES.has(p.category))) {` to
    `for (const p of catalog) {`.
- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL. `#2 Tide PODS…: barcode 037000869870 is not verified`.
- [ ] **Step 3: Apply the data.**
```bash
cp docs/superpowers/plans/2026-10-01-m6-assets/verified-barcodes.json src/data/verified-barcodes.json
node scripts/apply-verified-barcodes.mjs > "$SCRATCH/m6-barcodes.sql"
```
  Expected: `products.csv: 112 rows updated`. The 31 verified rows are unchanged; 20 products now have an empty
  barcode.
- [ ] **Step 4: Run.** Run: `npm test`. Expected: 141 pass, 0 fail.
- [ ] **Step 5: Live DB.** Call `apply_migration` (name `remove_nonfood_barcodes`) with only the non-food change:
```sql
-- M6 (owner decision C1): no verified barcode, no barcode. Non-food products have no USDA record to verify against,
-- and their Figma-invented codes could open the wrong page once real camera scanning exists. They stay searchable.
update public.products set barcode = null where id in (2, 5, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 48, 49, 50, 51);
```
  - Save it as `supabase/migrations/<version>_remove_nonfood_barcodes.sql`, using the version `list_migrations`
    reports.
  - Verify: `select count(*) from products where barcode is not null;` → **31**.
  - Run `get_advisors`.
- [ ] **Step 6: Commit.**
```bash
git add src/data/verified-barcodes.json src/data/products.csv src/lib/safety/verified-barcodes.test.ts supabase/migrations
git commit -m "Catalog: remove invented non-food barcodes; guard covers every product

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scanner logic and the reader packages

**Files:**
- Modify `package.json` and `package-lock.json`.
- Create `src/lib/scanner.ts` and `src/lib/scanner.test.ts`.

**Interfaces:**
- `SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"]`
- `normalizeScanned(raw): string | null`
- `confirmReads(): (code: string | null) => string | null`

- [ ] **Step 1: Install exactly.**
```bash
npm install barcode-detector@3.2.2 zxing-wasm@3.1.3 --save-exact --no-audit --no-fund
npm ls zxing-wasm
```
  Expected: `barcode-detector@3.2.2` with `zxing-wasm@3.1.3 deduped`, plus `zxing-wasm@3.1.3`, so there's a single
  copy. npm may warn about install scripts; none are needed, so don't approve any.
- [ ] **Step 2: Write the failing tests:** create `src/lib/scanner.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { confirmReads, normalizeScanned } from "./scanner.ts";
import { sameBarcode } from "./lookup.ts";

const require = createRequire(import.meta.url);

test("a code counts only when read twice in a row; empty frames don't break the pair", () => {
  const confirm = confirmReads();
  assert.equal(confirm("044000032029"), null);
  assert.equal(confirm(null), null);
  assert.equal(confirm("044000032029"), "044000032029");
  assert.equal(confirm("044000032029"), null, "the pair resets after a confirmation");
  assert.equal(confirm("028400199148"), null);
  assert.equal(confirm("044000032029"), null, "a different code restarts the pair");
  assert.equal(confirm("044000032029"), "044000032029");
});

test("decoded values become 8-14 digit codes or nothing", () => {
  assert.equal(normalizeScanned("0044000032029"), "0044000032029");
  assert.equal(normalizeScanned(" 01311501 "), "01311501");
  assert.equal(normalizeScanned("1234"), null);
  assert.equal(normalizeScanned("https://example.org"), null);
  assert.equal(normalizeScanned(""), null);
});

// Round trip through the same ZXing build the app ships: draw real catalog barcodes, read them back with ZXing's
// reader (the engine behind the barcode-detector ponyfill on iPhone), and check they match the catalog codes. No network: the .wasm files
// are read from node_modules.
test("barcodes drawn by ZXing decode back to the catalog codes", async () => {
  const wasm = (p: string) => readFileSync(require.resolve(`zxing-wasm/${p}`));
  const writer = await import("zxing-wasm/writer");
  writer.prepareZXingModule({ overrides: { wasmBinary: wasm("writer/zxing_writer.wasm") }, fireImmediately: true });
  const reader = await import("zxing-wasm/reader");
  reader.prepareZXingModule({ overrides: { wasmBinary: wasm("reader/zxing_reader.wasm") }, fireImmediately: true });

  for (const [format, digits, catalog] of [
    ["UPC-A", "04400003202", "044000032029"],    // Oreo (check digit added by the writer)
    ["UPC-A", "02840019914", "028400199148"],    // Lay's
    ["EAN-13", "301762042200", "3017620422003"], // Nutella
  ] as const) {
    const drawn = await writer.writeBarcode(digits, { format, scale: 3 });
    assert.equal(drawn.error, "", `${catalog}: drawn`);
    const found = await reader.readBarcodes(drawn.image!, { formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"] });
    const code = normalizeScanned(found[0]?.text ?? "");
    assert.ok(code && sameBarcode(code, catalog), `${catalog}: read back as ${found[0]?.text}`);
  }
});
```
- [ ] **Step 3: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/scanner.ts`.
- [ ] **Step 4: Implement:** create `src/lib/scanner.ts`:
```ts
// scanner.ts — pure parts of camera scanning (M6 spec §4.2). Import-free, so Node tests can load it.
// The camera and the barcode reader itself live in src/lib/barcodeReader.ts and CameraScanner.tsx.

/** Grocery barcode formats, as named by the Barcode Detection API. */
export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** A decoded value → digits, or null when it isn't an 8–14 digit product code. A UPC-A may come back as a
 *  13-digit EAN with a leading 0: kept as is, since the lookup matches both forms. */
export function normalizeScanned(rawValue: string): string | null {
  const digits = (rawValue ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/**
 * Misread guard: returns a code only when the same code is read twice in a row (frames with no code don't break the
 * pair; a different code restarts it). After a confirmation the pair resets.
 */
export function confirmReads(): (code: string | null) => string | null {
  let last: string | null = null;
  return (code) => {
    if (code === null) return null;
    if (code === last) { last = null; return code; }
    last = code;
    return null;
  };
}
```
- [ ] **Step 5: Run.** Run: `npm test`. Expected: 144 pass, 0 fail. The round-trip test reads the `.wasm` files from
  `node_modules`, with no network.
- [ ] **Step 6: Commit.**
```bash
git add package.json package-lock.json src/lib/scanner.ts src/lib/scanner.test.ts
git commit -m "Scanner logic: misread guard, code cleanup; ZXing round-trip test

Adds barcode-detector 3.2.2 and zxing-wasm 3.1.3 (MIT, exact pins).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phone layout

**Files:** Modify `src/app/App.tsx` and `index.html`.

- [ ] **Step 1: `App.tsx`.**
  - Directly above `// ── Status Bar ──…`, add:
```tsx
/** Phones get the app full-screen; desktop keeps the phone frame (M6 spec §4.5).
 *  ponytail: decided once at load; a window resized across 500 px keeps its layout until reload. */
const IS_PHONE = typeof window !== "undefined" && window.matchMedia("(max-width: 499px)").matches;
```
  - In `StatusBar`, add as its first line:
```tsx
  // On a real phone the device draws its own status bar: keep only the notch's safe area.
  if (IS_PHONE) return <div className="flex-shrink-0" style={{ height: "env(safe-area-inset-top)" }} />;
```
  - In `BottomNav`, the root `<div className="flex-shrink-0 bg-card border-t border-border flex items-center justify-around px-3 pt-2 pb-4">`
    gains a second attribute line:
    `      style={IS_PHONE ? { paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" } : undefined}>` (and the
    first line loses its `>`).
  - In `App`'s return, replace the two outer opening `<div …>` tags (the gradient page and the 390×844 frame) with:
```tsx
    <div className={IS_PHONE ? "fixed inset-0" : "min-h-screen flex items-center justify-center p-4"}
      style={IS_PHONE ? undefined : { background: "linear-gradient(135deg, #0a1a0f 0%, #1A5C39 50%, #0d3d2b 100%)" }}>
      <div className={IS_PHONE ? "absolute inset-0 overflow-hidden" : "relative overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.7)] flex-shrink-0"}
        style={IS_PHONE
          ? { background: "#F8F7F2", fontFamily: "'Plus Jakarta Sans', sans-serif" }
          : { width: 390, height: 844, borderRadius: 44, background: "#F8F7F2", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
```
- [ ] **Step 2: `index.html`.** The viewport meta becomes
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`.
- [ ] **Step 3: Verify.** Run `npm run build` (expected: builds). In the dev server:
  - **At 375×812** (`resize_window` preset mobile, then reload): no rounded phone frame, no "9:41" text, and the
    bottom nav at the bottom of the screen.
  - **At desktop:** the frame is unchanged.
- [ ] **Step 4: Commit.**
```bash
git add src/app/App.tsx index.html
git commit -m "Phone layout: full-screen on phones, frame on desktop only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The camera

**Files:**
- Create: `src/lib/barcodeReader.ts`, `src/app/components/CameraScanner.tsx`.
- Replace: `src/app/components/ScanTab.tsx` (the whole file).

**Interfaces:**
- `createDetector(): Promise<Detector>`
- `CameraScanner({ onCode, onClose, children })`
- `ScanTab`'s props are unchanged (`onScanResult`, `products`).

- [ ] **Step 1: Create `src/lib/barcodeReader.ts`:**
```ts
// barcodeReader.ts — the browser's built-in BarcodeDetector when it reads all grocery formats (Chrome on Android),
// else the barcode-detector ponyfill (ZXing-C++ in WebAssembly: iPhone, desktop). M6 spec §4.2, decisions C4–C6.
// The .wasm is bundled with the site (Vite ?url), so scanning never calls a CDN.
import { BarcodeDetector as Ponyfill, prepareZXingModule } from "barcode-detector/ponyfill";
import readerWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { SCAN_FORMATS } from "./scanner";

export interface Detector { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }

let configured = false;

export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (Native?.getSupportedFormats) {
    try {
      const supported = await Native.getSupportedFormats();
      if (SCAN_FORMATS.every(f => supported.includes(f))) return new Native({ formats: [...SCAN_FORMATS] });
    } catch { /* fall through to the ponyfill */ }
  }
  if (!configured) {
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? readerWasmUrl : prefix + path) } });
    configured = true;
  }
  return new Ponyfill({ formats: [...SCAN_FORMATS] });
}
```
- [ ] **Step 2: Create `src/app/components/CameraScanner.tsx`:**
```tsx
// CameraScanner.tsx — live back-camera view that reads grocery barcodes on its own (M6 spec §4.3).
// Frames are read on the device and never uploaded. The camera stops on close, on unmount, and when the page is hidden.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Zap, ZapOff, ChevronUp, ChevronDown, CameraOff } from "lucide-react";
import { createDetector } from "../../lib/barcodeReader";
import { confirmReads, normalizeScanned } from "../../lib/scanner";

type CameraState = "requesting" | "live" | "paused" | "denied" | "unsupported";

const MESSAGE: Record<Exclude<CameraState, "live">, string> = {
  requesting: "Allow camera access to scan barcodes.",
  paused: "Camera paused.",
  denied: "Camera blocked. Allow it in your browser's site settings, or type the barcode below.",
  unsupported: "No camera available. Type the barcode below.",
};

export default function CameraScanner({ onCode, onClose, children }: {
  onCode: (code: string) => void;  // a confirmed barcode (read twice in a row)
  onClose: () => void;             // ✕: back to the manual view
  children: ReactNode;             // the drawer: type-a-barcode and demo barcodes
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [state, setState] = useState<CameraState>("requesting");
  const [torch, setTorch] = useState<boolean | null>(null); // null = this camera has no torch
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [run, setRun] = useState(0); // bump to restart after a pause

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
      trackRef.current = null;
    };
    const fail = (s: "denied" | "unsupported") => { if (!stopped) { setState(s); setDrawerOpen(true); } stop(); };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        return fail(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch(caps.torch ? false : null);
      setState("live");

      let detector;
      try { detector = await createDetector(); } catch (err) {
        console.error("[scanner] the barcode reader failed to load", err);
        return fail("unsupported");
      }
      const confirm = confirmReads();
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const found = await detector.detect(video);
            const code = confirm(normalizeScanned(found[0]?.rawValue ?? ""));
            if (code && !stopped) {
              navigator.vibrate?.(60);
              stop();
              onCodeRef.current(code);
              return;
            }
          } catch { /* a bad frame: try the next one */ }
        }
        timer = window.setTimeout(tick, 150);
      };
      tick();
    })();

    const onVisibility = () => { if (document.hidden && !stopped) { stop(); setState("paused"); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); stop(); };
  }, [run]);

  const toggleTorch = async () => {
    const next = !torch;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch { setTorch(null); }
  };

  return (
    <div className="h-full relative flex flex-col bg-black text-white overflow-hidden">
      <video ref={videoRef} playsInline muted autoPlay aria-label="Camera view"
        className={`absolute inset-0 w-full h-full object-cover ${state === "live" ? "" : "opacity-0"}`} />

      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button onClick={onClose} aria-label="Close camera" className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
          <X size={18} />
        </button>
        {torch !== null && (
          <button onClick={toggleTorch} aria-label={torch ? "Turn torch off" : "Turn torch on"} aria-pressed={torch}
            className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            {torch ? <ZapOff size={18} /> : <Zap size={18} />}
          </button>
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {state === "live" ? (
          <>
            <div className="relative w-64 h-40">
              {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
                 "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"] as const)
                .map((cls, i) => <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />)}
            </div>
            <p className="mt-4 text-sm font-semibold drop-shadow">Point at a barcode</p>
          </>
        ) : (
          <>
            {state !== "requesting" && <CameraOff size={36} className="mb-3 text-white/70" />}
            <p className="text-sm text-white/80 max-w-xs leading-relaxed">{MESSAGE[state]}</p>
            {state === "paused" && (
              <button onClick={() => { setState("requesting"); setRun(r => r + 1); }}
                className="mt-4 px-5 py-3 rounded-2xl bg-white/15 text-sm font-bold">Resume camera</button>
            )}
          </>
        )}
      </div>

      <div className="relative z-10 px-4 pb-4 space-y-2">
        <p className="text-center text-[10px] text-white/70">Scanning happens on your phone. No images are uploaded.</p>
        <button onClick={() => setDrawerOpen(o => !o)} aria-expanded={drawerOpen}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-black/50 border border-white/15 text-xs font-semibold">
          <span>Type a barcode or try a demo</span>
          {drawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {drawerOpen && <div className="rounded-2xl bg-black/70 border border-white/10 p-3 space-y-3">{children}</div>}
      </div>
    </div>
  );
}
```
- [ ] **Step 3: Replace `src/app/components/ScanTab.tsx` entirely with:**
```tsx
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
import { lookupBarcode, normalizeBarcode, isBarcode, sameBarcode } from "../../lib/lookup";
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
      const found = await lookupBarcode(barcode, { fdcKey: import.meta.env.VITE_FDC_API_KEY });
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
```
- [ ] **Step 4: Build and test.** Run `npm run build` (expected: builds, with `dist/assets/zxing_reader-*.wasm`) and
  `npm test` (expected: 144 pass).
- [ ] **Step 5: Verify in the browser.**
  - Copy the asset for the dev server:
    `cp docs/superpowers/plans/2026-10-01-m6-assets/oreo-044000032029.png "$SCRATCH/"`. Serve it from the dev server
    by copying it to `public/` temporarily, or load it as a data URL; don't commit it.
  - Open the app, click "Continue as Guest", then in the console stand in a fake camera:
```js
const img = new Image(); img.src = "/oreo-044000032029.png"; await img.decode();
const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d");
setInterval(() => { x.fillStyle = "#fff"; x.fillRect(0, 0, 640, 480); x.drawImage(img, (640 - img.width) / 2, (480 - img.height) / 2); }, 100);
navigator.mediaDevices.getUserMedia = async () => c.captureStream(10);
```
  - **Detection:** tap Scan. Expected: within about 2 s, Oreo's product page opens ("Oreo Original Cookies 14.3oz").
  - **Privacy:** `performance.getEntriesByType("resource")` shows `zxing_reader*.wasm` from our own origin, and no
    `jsdelivr` host.
  - **Camera stops:** go back to Scan, close with ✕, and check `document.querySelector("video")` is gone. Then reopen
    Scan, switch to the Home tab, and confirm the old video element's tracks are all `readyState === "ended"` (grab
    `video.srcObject` before switching).
  - **Denied:** set `navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("x", "NotAllowedError"); }`
    and open Scan. Expected: "Camera blocked. Allow it in your browser's site settings, or type the barcode below.",
    with the type box visible. Typing `049000042566` and Look up opens Coke Zero.
  - **Demo:** in the drawer, "Demo barcodes" → "Unlisted product" shows the not-found screen. "Scan Another Product"
    reopens the camera.
  - **The console:** no errors besides OFF's expected 404.
  - Remove the temporary PNG from `public/` if you put it there.
- [ ] **Step 6: Commit.**
```bash
git add src/lib/barcodeReader.ts src/app/components/CameraScanner.tsx src/app/components/ScanTab.tsx
git commit -m "Scan: real camera barcode scanning (native or ZXing WebAssembly, on-device)

The Scan tab opens the back camera; a code read twice in a row runs the
existing lookup. Torch where supported, camera stops when hidden or closed,
type-a-barcode and demos in a drawer, clear denied/unsupported states.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docs, push (ask first), then the owner's phone check

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, `README.md`, the spec.

- [ ] **Step 1: Docs.**
  - **`KNOWN_ISSUES.md`:**
    - Roadmap: "M6 ✅ <date>": camera scanning, the phone layout, and no invented barcodes.
    - K-28 (no mobile layout) and the camera placeholder → resolved.
    - Next: the search fix, then the Home redesign (mockup first), then accounts and the real map.
  - **`ARCHITECTURE.md`:** file map entries for `scanner.ts`, `barcodeReader.ts` and `CameraScanner.tsx`; the feature
    inventory "Scan: camera" → working.
  - **`PROJECT_HANDOFF.md`:**
    - Decision log: `| 022 | Camera scanning on-device with barcode-detector (native or ZXing WebAssembly, bundled .wasm, no CDN); a code counts after two identical reads | Owner, 2026-10-01 | **Done** (M6) |`.
    - The "prototype done" criteria: mark criterion 1 met after the owner's phone check.
  - **`README.md`:** the live demo line drops "camera scanning is coming in the next milestone".
  - **`SYNOPSIS.md`** and the spec status.
- [ ] **Step 2: Commit.** Run `npm test`, then:
```bash
git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md README.md docs/superpowers/specs/2026-10-01-m6-camera-mobile-design.md
git commit -m "Docs: M6 done (camera scanning, phone layout)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 3: Push (ask first).** Ask the owner: "Push to GitHub? This updates the live site." On a yes, push and
  confirm the Actions run succeeds.
- [ ] **Step 4: The owner's phone checklist.** Send them this, about 2 minutes on https://skynetrebel42.github.io/ecogo/:
  1. **iPhone** (Safari): tap Scan and allow the camera. Point at an **Oreo or Coke** (or any grocery item) and its
     page should open. Then scan **something not in the catalog** (any snack) and you should see a USDA or Open Food
     Facts page, or "not found".
  2. **Android** (Chrome): the same two scans. If there's a ⚡ button, tap it to check the torch.
  3. **Laptop:** open Scan and hold a product up to the webcam.
  4. **Once, on any phone:** deny the camera and check the "Camera blocked…" message and that typing a barcode works.
  5. Reply with what worked, what didn't, and which phone and browser it was.

# M6: real camera scanning, phone layout, no invented non-food barcodes: design spec

- **Date:** 2026-10-01
- **Status:** implemented (`74850b7`…`8e01eeb`, plus the docs commit); the owner's phone check is pending
- **Designed with:** the owner (Minh Bui), 2026-10-01, through multiple-choice questions. They'll test on **both
  iPhone and Android**, plus a laptop webcam.
- **Builds on:** M2 lookup (`lookup.ts`), M5 verified barcodes (`src/data/verified-barcodes.json`, applier script),
  and the current `ScanTab.tsx` (demo picker, type-a-barcode, honest not-found and error states).

## 1. Why

This finishes the owner's prototype goal: **"Scan a real product with a phone camera → product page"** with a
trustworthy result. Today the Scan tab only simulates scanning. Before a real camera is added, every catalog barcode
must be real or absent. Food was fixed in M5. Non-food (Tide, Tylenol, Pampers, Purina…) still carries
Figma-invented codes that could open the wrong page.

**Done for M6:**
- On an iPhone, an Android phone and a laptop webcam, pointing the camera at a grocery barcode opens its product page
  within a couple of seconds.
- The app fills the phone screen.
- No catalog product carries an invented barcode.

## 2. Decisions (owner, 2026-10-01, unless marked *recommended default*)

| # | Decision |
|---|---|
| C1 | **Remove every non-food barcode**: no verified barcode, no barcode. Products stay searchable |
| C2 | **Camera first:** tapping Scan opens the live back camera full-screen with a framing box, and detection runs on its own (no shutter button) |
| C3 | "Type a barcode" and the demo list move into a small drawer on the camera screen; they're the path for devices without a camera |
| C4 | Reader: the `barcode-detector` package (MIT, v3.2.x). It uses the browser's built-in BarcodeDetector where it supports the grocery formats (Chrome on Android), and otherwise ZXing-C++ compiled to WebAssembly (iPhone, desktop) |
| C5 | The `.wasm` file is **bundled with the site**, not fetched from the jsDelivr CDN: no third-party request, and it works offline *(recommended default)* |
| C6 | Formats: `ean_13`, `ean_8`, `upc_a`, `upc_e` (grocery codes) |
| C7 | A code counts only when **the same value is read twice in a row** (cuts misreads), then: vibrate (where supported), stop the camera, and run the existing lookup flow *(recommended default)* |
| C8 | **Privacy:** frames are read on the device and never uploaded; the screen says so. The camera stops on close, on leaving the tab, and when the page is hidden |
| C9 | Torch button when the camera supports it; ✕ closes to the manual view |
| C10 | **Phone layout:** below 500 px wide the app fills the screen (no phone frame, no fake "9:41" status bar), using the safe-area insets. Desktop keeps the phone frame |
| C11 | Acceptance includes the owner's own check on iPhone, Android and a laptop, from a short checklist |

## 3. Facts this design rests on (checked 2026-10-01)

- iOS browsers (all WebKit) don't implement the Barcode Detection API
  ([WebKit bug 281848](https://bugs.webkit.org/show_bug.cgi?id=281848)). WebAssembly is the practical path on iPhone.
- `barcode-detector` 3.2.2 (MIT, published 2026-08-16) depends on `zxing-wasm` 3.1.x.
  - Its `barcode-detector/ponyfill` export is side-effect free.
  - It fetches a `.wasm` at runtime from jsDelivr by default. `prepareZXingModule({ overrides: { locateFile } })`
    serves it from our own path instead.
- `getUserMedia` needs HTTPS. The live site is HTTPS (GitHub Pages).
- On iOS a `<video>` needs `playsinline` and `muted` to play inline.

## 4. Design

### 4.1 Non-food barcodes (C1)

- `verified-barcodes.json` `removed` gains every non-food catalog product, with the reason "non-food: USDA has no
  record to verify against". Gerber Puffs ("Baby Care") is included.
- Rerun `scripts/apply-verified-barcodes.mjs`, which empties their CSV barcodes and prints the SQL. Apply it as a new
  migration.
- The demo picker drops their entries.
- `verified-barcodes.test.ts` widens from "every food" to "every catalog product has a verified barcode or none".

### 4.2 Scanner logic (`src/lib/scanner.ts`, new, pure parts tested in Node)

- `createDetector()` returns the native `BarcodeDetector` when `BarcodeDetector.getSupportedFormats()` includes all
  four formats, else the ponyfill. The ponyfill is configured once through `prepareZXingModule` to load the bundled
  `.wasm` (Vite `?url` import).
- `confirmReads()` is a tiny pure state machine: `push(code) → code | null`. It returns a code only when it equals the
  previous read, and resets on a different code. *Tested.*
- `normalizeScanned(rawValue, format)` returns digits only. A UPC-A read as a 13-digit EAN with a leading 0 is kept
  as is, because the lookup already matches both forms. *Tested.*

### 4.3 Camera screen (`src/app/components/CameraScanner.tsx`, new)

- **On mount:** `getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })`. A
  `<video playsinline muted autoplay>` fills the screen, with a framing box and "Point at a barcode" text.
- **The detect loop:** every ~150 ms (`requestVideoFrameCallback` when available, else a timer), run `detect(video)`
  and feed `confirmReads`. When a code is confirmed: `navigator.vibrate?.(60)`, stop all tracks, and call
  `onCode(code)`.
- **Controls:** ✕ (stop and close), a torch toggle (only when `track.getCapabilities().torch`), and the drawer with
  type-a-barcode and demo barcodes (the current controls, reused).
- **Stopping:** all tracks stop on unmount, on ✕, and on `visibilitychange` → hidden.
- **States:**
  - **requesting:** "Allow camera access to scan".
  - **live:** the camera view.
  - **denied:** "Camera blocked. Allow it in your browser's site settings, or type the barcode below", with the drawer
    open.
  - **unsupported / no camera:** "No camera found. Type the barcode below".
  - **reader failed to load:** same as unsupported, plus a console error.
- **Privacy line**, under the frame: "Scanning happens on your phone. No images are uploaded."

### 4.4 Scan tab (`ScanTab.tsx`)

- Opening the Scan tab shows `CameraScanner`. `onCode` calls the existing `handleScan(code, false)` (catalog → lookup
  → found / not found / error), so the honest not-found and error screens stay unchanged.
- After not-found or error, "Scan Another Product" reopens the camera.

### 4.5 Phone layout (C10)

- `App.tsx` decides the layout with a `matchMedia("(max-width: 499px)")` state.
- **On phones:** the root is `position: fixed; inset: 0` (100dvh), the phone frame and fake status bar are gone, and
  the bottom nav gets `padding-bottom: env(safe-area-inset-bottom)`.
- `index.html` viewport gains `viewport-fit=cover`.
- **Desktop** is unchanged.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| Permission denied | Denied state; drawer open; no retry loop (the user changes site settings, then reopens Scan) |
| No camera / insecure context | Unsupported state; drawer open |
| `.wasm` fails to load | Unsupported state; error logged; the typed barcode still works |
| Same barcode scanned again right after | Lookup cache answers; no new request |
| Leaving Scan mid-detection | Tracks stopped; no late `onCode` (guarded by a mounted flag) |

## 6. Testing

- `scanner.test.ts` (Node):
  - `confirmReads` (needs two equal reads, resets on change) and `normalizeScanned`;
  - **a round trip:** generate EAN-13 / UPC-A images for real catalog codes (Oreo `044000032029`, Lay's
    `028400199148`) with `zxing-wasm`'s writer, then decode them with the reader in Node. Each decodes to its code.
    *(If the writer isn't available in the shipped build, the plan records real barcode PNG fixtures instead.)*
- `verified-barcodes.test.ts`: no catalog product of any category carries an unverified barcode.
- **Browser (dev):** Chrome with `--use-fake-device-for-media-stream` and a fake video of a barcode, where feasible.
  At minimum, the denied and unsupported states, plus the drawer's type-a-barcode still working.
- **Owner checklist (live site):**
  - iPhone Safari: scan Oreo, Coke and something not in the catalog;
  - Android Chrome: the same;
  - a laptop webcam: one product;
  - the torch on a phone;
  - deny permission once and confirm the message.

## 7. Out of scope

Scan history, multiple-barcode frames, QR codes, the Home redesign, the search fix, and offline lookup.

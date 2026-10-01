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

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

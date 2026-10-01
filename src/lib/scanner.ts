// scanner.ts — pure parts of camera scanning (M6 spec §4.2). Import-free, so Node tests can load it.
// The camera and the barcode reader itself live in src/lib/barcodeReader.ts and CameraScanner.tsx.

/** Grocery barcode formats, as named by the Barcode Detection API. */
export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** Back camera in HD: without a size, Safari and desktop Chrome give ~640x480, too few pixels per bar for ZXing
 *  (the iPhone/PC reader) once a real camera blurs slightly. "ideal" lets the camera pick its nearest size. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

/** A decoded value → digits, or null when it isn't an 8–14 digit product code. A UPC-A may come back as a
 *  13-digit EAN with a leading 0: kept as is, since the lookup matches both forms. An 8-digit UPC-E (Chrome's built-in
 *  detector returns the printed digits) is expanded to its UPC-A, the form catalog and USDA codes use. */
export function normalizeScanned(rawValue: string, format?: string): string | null {
  const digits = (rawValue ?? "").replace(/\D/g, "");
  if (format === "upc_e" && /^[01]\d{7}$/.test(digits)) return expandUpcE(digits);
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/** UPC-E (number system, 6 digits, check) → UPC-A, by the standard zero-suppression rules; the check digit is shared. */
function expandUpcE(e: string): string {
  const [ns, d1, d2, d3, d4, d5, d6, check] = e;
  const body = d6 <= "2" ? `${d1}${d2}${d6}0000${d3}${d4}${d5}`
    : d6 === "3" ? `${d1}${d2}${d3}00000${d4}${d5}`
    : d6 === "4" ? `${d1}${d2}${d3}${d4}00000${d5}`
    : `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return ns + body + check;
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

// photo.ts — prepare a label photo for upload to Open Food Facts (M8, spec D5).

/** The size that fits within `max` on the long side, never enlarged. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Open Food Facts refuses photos under 640 × 160 px (either orientation). */
export function bigEnough(width: number, height: number): boolean {
  return Math.max(width, height) >= 640 && Math.min(width, height) >= 160;
}

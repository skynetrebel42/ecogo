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

export const TOO_SMALL = "This photo is too small for Open Food Facts. Take it closer, or choose a bigger one.";

/** A JPEG at most 2000 px on the long side, upright. Throws TOO_SMALL for a photo under OFF's minimum. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (!bigEnough(bitmap.width, bitmap.height)) throw new Error(TOO_SMALL);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 2000);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.85));
}

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

/** How sharp a photo is (M8 follow-up 3, H2): the variance of a 4-neighbour Laplacian over its grayscale, averaged over
 *  the sharpest 4 of 16 tiles (a 4×4 grid), so a flat background doesn't drag a sharp label down. Blur flattens edges,
 *  so the score drops. `rgba` is canvas ImageData's data. */
export function sharpness(rgba: ArrayLike<number>, width: number, height: number): number {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const n = new Array(16).fill(0), sum = new Array(16).fill(0), sq = new Array(16).fill(0);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
    const t = Math.floor((4 * y) / height) * 4 + Math.floor((4 * x) / width);
    n[t]++; sum[t] += lap; sq[t] += lap * lap;
  }
  const tiles = n.map((k, t) => (k ? sq[t] / k - (sum[t] / k) ** 2 : 0)).sort((a, b) => b - a);
  return (tiles[0] + tiles[1] + tiles[2] + tiles[3]) / 4;
}

/** The sharpness of a photo, scored on a copy at most 512 px on the long side (fast on a phone; same scale for all). */
export async function photoSharpness(photo: Blob): Promise<number> {
  const bitmap = await createImageBitmap(photo);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 512);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return sharpness(ctx.getImageData(0, 0, width, height).data, width, height);
}

/** H2: below this score a photo "looks blurry" (a hint, never a block). Set with the planner (H4), measured on tiles:
 *  Minh's sharp phone label 8416, his blurry photos 693–708, the soft curved-bag fixture 3266, clear fixtures 8554–15026. */
export const BLURRY = 1500;
/** Whether to show the blurry-photo hint; a photo that can't be scored gets none. */
export const isBlurry = async (photo: Blob) => (await photoSharpness(photo).catch(() => Infinity)) < BLURRY;

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

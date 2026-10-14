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

/** The size a photo (or crop) is sent at: at most 2000 px on the long side. Throws TOO_SMALL when that is under OFF's
 *  minimum, so a long, thin photo the shrink would take under 160 px is refused too (054 B1). */
export function preparedSize(width: number, height: number): { width: number; height: number } {
  const size = fitWithin(width, height, 2000);
  if (!bigEnough(size.width, size.height)) throw new Error(TOO_SMALL);
  return size;
}

/** How sharp a photo is (M8 follow-up 3, H2): the variance of a 4-neighbour Laplacian over its grayscale, averaged over
 *  the sharpest 4 of 16 tiles (a 4×4 grid), so a flat background doesn't drag a sharp label down. Blur flattens edges,
 *  so the score drops. `rgba` is canvas ImageData's data, full size: the grayscale is shrunk here to ≤ 512 px by a box
 *  average (follow-up 6, K1), because each browser's own canvas shrink scored the same photo differently (Edge's rough
 *  one high, iPhone Safari's smooth one low). */
export function sharpness(rgba: ArrayLike<number>, sourceWidth: number, sourceHeight: number): number {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, 512);
  const gray = new Float64Array(width * height), count = new Float64Array(width * height);
  for (let y = 0; y < sourceHeight; y++) {
    const row = Math.floor((y * height) / sourceHeight) * width;
    for (let x = 0; x < sourceWidth; x++) {
      const i = (y * sourceWidth + x) * 4, o = row + Math.floor((x * width) / sourceWidth);
      gray[o] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]; count[o]++;
    }
  }
  for (let i = 0; i < gray.length; i++) gray[i] /= count[i];
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

/** The sharpness of a photo, read at full size (prepared photos are ≤ 2000 px) and scored on its ≤ 512 px box copy. */
export async function photoSharpness(photo: Blob): Promise<number> {
  const bitmap = await createImageBitmap(photo);
  const { width, height } = bitmap;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return sharpness(ctx.getImageData(0, 0, width, height).data, width, height);
}

/** H2: below this score a photo "looks blurry" (a hint, never a block). K1 (planner, 2026-10-09), on the box copy:
 *  Minh's blurry photos 523–568, his night lentil label 1021, his sharp label 7478, the curved-bag fixture 2892. */
export const BLURRY = 800;
/** Whether to show the blurry-photo hint; a photo that can't be scored gets none. */
export const isBlurry = async (photo: Blob) => (await photoSharpness(photo).catch(() => Infinity)) < BLURRY;

/** A crop rectangle as shares (0–1) of the photo's width and height (M8 follow-up 6, K4). */
export type Crop = { x: number; y: number; w: number; h: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The crop's whole source pixels, kept inside a `width` × `height` photo. */
export function cropPixels(c: Crop, width: number, height: number) {
  const x = Math.round(clamp(c.x, 0, 1) * width), y = Math.round(clamp(c.y, 0, 1) * height);
  return { x, y, width: Math.round(clamp(c.x + c.w, 0, 1) * width) - x, height: Math.round(clamp(c.y + c.h, 0, 1) * height) - y };
}

/** The crop after dragging a corner (its two edges move) or the inside ("move"), by shares of the photo; it stays in
 *  the photo and never gets smaller than `min` (so it never flips). */
export function dragCrop(c: Crop, handle: "nw" | "ne" | "sw" | "se" | "move", dx: number, dy: number, min = 0.1): Crop {
  if (handle === "move") return { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) };
  let [l, t, r, b] = [c.x, c.y, c.x + c.w, c.y + c.h];
  if (handle[1] === "w") l = clamp(l + dx, 0, r - min); else r = clamp(r + dx, l + min, 1);
  if (handle[0] === "n") t = clamp(t + dy, 0, b - min); else b = clamp(b + dy, t + min, 1);
  return { x: l, y: t, w: r - l, h: b - t };
}

/** A JPEG at most 2000 px on the long side, upright, cut to `crop` if given. Throws TOO_SMALL when the size it would be
 *  sent at (after the shrink and any crop) is under OFF's minimum. */
export async function preparePhoto(file: Blob, crop?: Crop): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const r = crop ? cropPixels(crop, bitmap.width, bitmap.height) : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  let width: number, height: number;
  try { ({ width, height } = preparedSize(r.width, r.height)); } catch (err) { bitmap.close(); throw err; }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.85));
}

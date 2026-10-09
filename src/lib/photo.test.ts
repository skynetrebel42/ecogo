import { test } from "node:test";
import assert from "node:assert/strict";
import { fitWithin, bigEnough, sharpness, cropPixels, dragCrop } from "./photo.ts";

// M8 follow-up 3, H2: variance of a Laplacian over a grayscale copy (docs/superpowers/specs/2026-10-09-m8-followup3-blur-speed-design.md).
const W = 64, H = 64;
const rgba = (gray: (x: number, y: number) => number) => {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = gray(x, y); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  return d;
};
const stripes = (x: number) => (Math.floor(x / 3) % 2 ? 230 : 20); // dark text-like strokes on light
const box = (f: (x: number) => number, r: number) => (x: number) => { let s = 0; for (let k = -r; k <= r; k++) s += f(Math.min(W - 1, Math.max(0, x + k))); return s / (2 * r + 1); };

test("a sharp image scores far higher than the same image blurred; a flat one scores 0", () => {
  const sharp = sharpness(rgba(x => stripes(x)), W, H);
  const blurred = sharpness(rgba(box(stripes, 3)), W, H);
  assert.ok(sharp > 10 * blurred, `sharp ${sharp}, blurred ${blurred}`);
  assert.equal(sharpness(rgba(() => 128), W, H), 0);
});

test("a sharp label on a flat background still scores as sharp: only the sharpest tiles count", () => {
  const full = sharpness(rgba(x => stripes(x)), W, H);
  const label = sharpness(rgba(x => (x < W / 4 ? stripes(x) : 128)), W, H); // stripes in one tile column, flat elsewhere
  assert.ok(label > full / 2, `label on flat ${label}, full ${full}`);
});

// M8 follow-up 6, K1: the score shrinks the photo itself (box average), so every browser scores the same pixels.
test("a big photo is scored on its own box-averaged ≤ 512 px copy", () => {
  const S = 1024, big = new Uint8ClampedArray(S * S * 4), small = new Float64Array(512 * 512 * 4); // unrounded means
  const v = (x: number, y: number) => ((Math.floor(x / 5) + Math.floor(y / 7)) % 2 ? 230 : 20) + (x * y) % 13;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; big[i] = big[i + 1] = big[i + 2] = v(x, y); }
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { // each small pixel = the mean of its 2 × 2 block
    const g = (v(2 * x, 2 * y) + v(2 * x + 1, 2 * y) + v(2 * x, 2 * y + 1) + v(2 * x + 1, 2 * y + 1)) / 4, i = (y * 512 + x) * 4;
    small[i] = small[i + 1] = small[i + 2] = g;
  }
  const a = sharpness(big, S, S), b = sharpness(small, 512, 512);
  assert.ok(Math.abs(a - b) < 1e-6 * b, `big ${a}, box copy ${b}`);
});

test("a big photo shrinks so its long side is the limit, keeping its shape", () => {
  assert.deepEqual(fitWithin(4032, 3024, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(3024, 4032, 2000), { width: 1500, height: 2000 });
  assert.deepEqual(fitWithin(4000, 3001, 2000), { width: 2000, height: 1501 }, "rounded to whole pixels");
});

test("a photo already within the limit is never enlarged", () => {
  assert.deepEqual(fitWithin(1200, 900, 2000), { width: 1200, height: 900 });
  assert.deepEqual(fitWithin(2000, 2000, 2000), { width: 2000, height: 2000 });
});

test("Open Food Facts' minimum is 640 × 160, either way round", () => {
  assert.equal(bigEnough(640, 160), true);
  assert.equal(bigEnough(160, 640), true);
  assert.equal(bigEnough(639, 480), false);
  assert.equal(bigEnough(1000, 159), false);
});

// M8 follow-up 6, K4: the crop rectangle is kept as shares of the photo (0–1), turned into whole source pixels.
test("a crop rectangle becomes whole source pixels, kept inside the photo", () => {
  assert.deepEqual(cropPixels({ x: 0.25, y: 0.1, w: 0.5, h: 0.5 }, 2000, 1500), { x: 500, y: 150, width: 1000, height: 750 });
  assert.deepEqual(cropPixels({ x: 0, y: 0, w: 1, h: 1 }, 1500, 2000), { x: 0, y: 0, width: 1500, height: 2000 }, "the whole photo");
  assert.deepEqual(cropPixels({ x: 0.9, y: -0.1, w: 0.3, h: 0.5 }, 1000, 1000), { x: 900, y: 0, width: 100, height: 400 }, "clamped to the edges");
});

test("a crop under Open Food Facts' minimum is too small", () => {
  const r = cropPixels({ x: 0, y: 0, w: 0.3, h: 0.3 }, 2000, 1500);
  assert.equal(bigEnough(r.width, r.height), false, `${r.width} × ${r.height}`);
  const ok = cropPixels({ x: 0, y: 0.4, w: 0.4, h: 0.2 }, 2000, 1500);
  assert.equal(bigEnough(ok.width, ok.height), true, `${ok.width} × ${ok.height}`);
});

type Crop = { x: number; y: number; w: number; h: number };
const near = (a: Crop, b: Crop) => (["x", "y", "w", "h"] as const).every(k => Math.abs(a[k] - b[k]) < 1e-9);

test("dragging a corner moves only its two edges and never flips or leaves the photo", () => {
  const r = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  assert.ok(near(dragCrop(r, "se", -0.2, -0.3), { x: 0.1, y: 0.1, w: 0.6, h: 0.5 }));
  assert.ok(near(dragCrop(r, "nw", 0.2, 0.1), { x: 0.3, y: 0.2, w: 0.6, h: 0.7 }));
  assert.ok(near(dragCrop(r, "ne", 0.5, -0.5), { x: 0.1, y: 0, w: 0.9, h: 0.9 }), "stops at the photo's edges");
  assert.ok(near(dragCrop(r, "sw", 2, 0), { x: 0.8, y: 0.1, w: 0.1, h: 0.8 }), "keeps a minimum size, never flips");
});

test("dragging inside the rectangle moves it whole, inside the photo", () => {
  const r = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
  assert.ok(near(dragCrop(r, "move", 0.2, 0.1), { x: 0.3, y: 0.2, w: 0.5, h: 0.5 }));
  assert.ok(near(dragCrop(r, "move", 1, -1), { x: 0.5, y: 0, w: 0.5, h: 0.5 }));
});

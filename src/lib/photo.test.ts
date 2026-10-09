import { test } from "node:test";
import assert from "node:assert/strict";
import { fitWithin, bigEnough, sharpness } from "./photo.ts";

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

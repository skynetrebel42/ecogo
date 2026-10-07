import { test } from "node:test";
import assert from "node:assert/strict";
import { fitWithin, bigEnough } from "./photo.ts";

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

// 075 H2 (audit B1): iPhones before Safari 16.4 can't parse a regex lookbehind, and one at startup stops the whole app.
// Named groups, (?<name>…), are fine (Safari 11.1+).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

test("no regex lookbehind anywhere in src/", () => {
  const src = new URL("../", import.meta.url);
  const found = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter(f => /\.(?:ts|tsx|js|mjs)$/.test(f) && !f.endsWith("lookbehind.test.ts"))
    .flatMap(f => readFileSync(new URL(f.replace(/\\/g, "/"), src), "utf8").split("\n")
      .flatMap((line, i) => (/\(\?<[!=]/.test(line) ? [`${f}:${i + 1}`] : [])));
  assert.deepEqual(found, []);
});

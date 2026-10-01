import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { confirmReads, normalizeScanned } from "./scanner.ts";
import { sameBarcode } from "./lookup.ts";

const require = createRequire(import.meta.url);

test("a code counts only when read twice in a row; empty frames don't break the pair", () => {
  const confirm = confirmReads();
  assert.equal(confirm("044000032029"), null);
  assert.equal(confirm(null), null);
  assert.equal(confirm("044000032029"), "044000032029");
  assert.equal(confirm("044000032029"), null, "the pair resets after a confirmation");
  assert.equal(confirm("028400199148"), null);
  assert.equal(confirm("044000032029"), null, "a different code restarts the pair");
  assert.equal(confirm("044000032029"), "044000032029");
});

test("decoded values become 8-14 digit codes or nothing", () => {
  assert.equal(normalizeScanned("0044000032029"), "0044000032029");
  assert.equal(normalizeScanned(" 01311501 "), "01311501");
  assert.equal(normalizeScanned("1234"), null);
  assert.equal(normalizeScanned("https://example.org"), null);
  assert.equal(normalizeScanned(""), null);
});

// Round trip through the same ZXing build the app ships: draw real catalog barcodes, read them back with ZXing's
// reader (the engine behind the barcode-detector ponyfill on iPhone), and check they match the catalog codes. No network: the .wasm files
// are read from node_modules.
test("barcodes drawn by ZXing decode back to the catalog codes", async () => {
  const wasm = (p: string) => readFileSync(require.resolve(`zxing-wasm/${p}`));
  const writer = await import("zxing-wasm/writer");
  writer.prepareZXingModule({ overrides: { wasmBinary: wasm("writer/zxing_writer.wasm") }, fireImmediately: true });
  const reader = await import("zxing-wasm/reader");
  reader.prepareZXingModule({ overrides: { wasmBinary: wasm("reader/zxing_reader.wasm") }, fireImmediately: true });

  for (const [format, digits, catalog] of [
    ["UPC-A", "04400003202", "044000032029"],    // Oreo (check digit added by the writer)
    ["UPC-A", "02840019914", "028400199148"],    // Lay's
    ["EAN-13", "301762042200", "3017620422003"], // Nutella
  ] as const) {
    const drawn = await writer.writeBarcode(digits, { format, scale: 3 });
    assert.equal(drawn.error, "", `${catalog}: drawn`);
    const found = await reader.readBarcodes(drawn.image!, { formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"] });
    const code = normalizeScanned(found[0]?.text ?? "");
    assert.ok(code && sameBarcode(code, catalog), `${catalog}: read back as ${found[0]?.text}`);
  }
});

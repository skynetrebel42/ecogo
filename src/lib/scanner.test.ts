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

// Final review: Chrome's built-in detector (Android) returns UPC-E as its 8 printed digits; catalog and USDA codes are
// UPC-A, so a UPC-E read is expanded (EAN-8 never is).
test("an 8-digit UPC-E read is expanded to its UPC-A; EAN-8 isn't", () => {
  const coke = normalizeScanned("04963406", "upc_e");
  assert.equal(coke, "049000006346", "Coca-Cola 12 fl oz can");
  assert.ok(sameBarcode(coke!, "049000006346"));
  assert.equal(normalizeScanned("01234531", "upc_e"), "012300000451", "last digit 3: manufacturer d1-d3 + 00");
  assert.equal(normalizeScanned("01234542", "upc_e"), "012340000052", "last digit 4: manufacturer d1-d4 + 0");
  assert.equal(normalizeScanned("01234573", "upc_e"), "012345000073", "last digit 5-9: product 0000 + d6");
  assert.equal(normalizeScanned("04963406", "ean_8"), "04963406", "EAN-8 stays");
  assert.equal(normalizeScanned("0049000006346", "upc_e"), "0049000006346", "already expanded (ZXing): kept");
  assert.equal(normalizeScanned("04963406"), "04963406", "no format: unchanged");
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

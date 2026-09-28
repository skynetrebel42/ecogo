// The zero-false-alarms check: every product in the catalog gets exactly the hand-reviewed flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeIngredients } from "./analyze.ts";
import { parseProductsCSV } from "../productImporter.ts";
import { sameBarcode } from "../lookup.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const expected: Record<string, { verdict: string; flags: string[] }> =
  JSON.parse(readFileSync(new URL("./fixtures/expected-flags.json", import.meta.url), "utf8"));

test("the catalog and the expected file cover the same 51 products", () => {
  assert.equal(catalog.length, 51);
  assert.deepEqual(catalog.map(p => String(p.id)).sort(), Object.keys(expected).sort());
});

// A real package opens the catalog page, so the catalog's text must flag what that package's official label flags.
test("catalog products with a verified barcode get the same flags as their USDA label", () => {
  for (const [file, id] of [["oreo-original-044000032029", 14], ["doritos-028400335799", 13]] as const) {
    const label = JSON.parse(readFileSync(new URL(`../fixtures/usda/${file}.json`, import.meta.url), "utf8")).foods[0];
    const p = catalog.find(c => sameBarcode(c.barcode, label.gtinUpc));
    assert.equal(p?.id, id, `${file}: catalog product ${id} should own barcode ${label.gtinUpc}`);
    if (!p) continue;
    const flags = (text: string) => analyzeIngredients({ ingredients: text, category: p.category }).flags.map(f => f.entry.id).sort();
    assert.deepEqual(flags(p.ingredients), flags(label.ingredients), `${file}: catalog text vs USDA label`);
  }
  // 00044000042554 is a coloured Oreo variety (Yellow 5, Red 40, Blue 1): it must not open our Original Oreo page.
  assert.equal(catalog.find(c => sameBarcode(c.barcode, "00044000042554")), undefined);
});

for (const p of catalog) {
  test(`#${p.id} ${p.name}: exactly the reviewed flags`, () => {
    const a = analyzeIngredients({ ingredients: p.ingredients, category: p.category });
    assert.deepEqual(
      { verdict: a.verdict, flags: a.flags.map(f => f.entry.id).sort() },
      { verdict: expected[p.id].verdict, flags: [...expected[p.id].flags].sort() },
    );
    for (const f of a.flags) {
      assert.ok(p.ingredients.toLowerCase().includes(f.matchedText.toLowerCase()), `"${f.matchedText}" appears on the label`);
    }
  });
}

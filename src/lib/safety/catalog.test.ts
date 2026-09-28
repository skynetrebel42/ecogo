// The zero-false-alarms check: every product in the catalog gets exactly the hand-reviewed flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeIngredients } from "./analyze.ts";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const expected: Record<string, { verdict: string; flags: string[] }> =
  JSON.parse(readFileSync(new URL("./fixtures/expected-flags.json", import.meta.url), "utf8"));

test("the catalog and the expected file cover the same 51 products", () => {
  assert.equal(catalog.length, 51);
  assert.deepEqual(catalog.map(p => String(p.id)).sort(), Object.keys(expected).sort());
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

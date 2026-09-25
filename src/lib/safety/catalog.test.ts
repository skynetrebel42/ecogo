// The zero-false-alarms check: every product in the catalog gets exactly the hand-reviewed flags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeIngredients } from "./analyze.ts";

interface FixtureProduct { id: number; name: string; category: string; ingredients: string }
const read = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
const catalog: FixtureProduct[] = read("catalog.json");
const expected: Record<string, { verdict: string; flags: string[] }> = read("expected-flags.json");

test("the fixture and the expected file cover the same 51 products", () => {
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

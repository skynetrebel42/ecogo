// K-29: the Figma export invented the catalog barcodes. A food product may only carry a barcode verified against USDA
// FoodData Central (src/data/verified-barcodes.json, approved by the owner 2026-10-01), so a scan never opens the wrong
// product, and its name and ingredients are that record's real label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseProductsCSV } from "../productImporter.ts";

const catalog = parseProductsCSV(readFileSync(new URL("../../data/products.csv", import.meta.url), "utf8"));
const data = JSON.parse(readFileSync(new URL("../../data/verified-barcodes.json", import.meta.url), "utf8")) as {
  verified: { id: number; barcode: string; fdcId: number; name: string; ingredients: string }[];
  removed: { id: number; reason: string }[];
};

test("every catalog product (food and non-food) has a verified barcode or none", () => {
  const verified = new Map(data.verified.map(v => [v.id, v]));
  for (const p of catalog) {
    if (p.barcode === "") continue;
    assert.equal(p.barcode, verified.get(p.id)?.barcode, `#${p.id} ${p.name}: barcode ${p.barcode} is not verified`);
  }
});

test("verified products carry their USDA record's name and full label; removed ones have no barcode", () => {
  for (const v of data.verified) {
    const p = catalog.find(c => c.id === v.id);
    assert.ok(p, `#${v.id} exists`);
    assert.equal(p!.name, v.name, `#${v.id} name`);
    assert.equal(p!.ingredients, v.ingredients, `#${v.id} ingredients`);
    assert.match(v.barcode, /^\d{8,14}$/);
    assert.ok(Number.isInteger(v.fdcId), `#${v.id} fdcId`);
  }
  for (const r of data.removed) assert.equal(catalog.find(c => c.id === r.id)?.barcode, "", `#${r.id} barcode removed`);
  assert.equal(new Set(data.verified.map(v => v.barcode)).size, data.verified.length, "barcodes are unique");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { addRecent, resolveRecent, parseRecent, RECENT_MAX, type RecentEntry } from "./recent.ts";
import type { Product } from "./productImporter.ts";

const prod = (id: number, name = `P${id}`): Product => ({ id, name, barcode: `000${Math.abs(id)}` } as Product);

test("addRecent puts the product first, removes its earlier entry, and caps at 10", () => {
  let list: RecentEntry[] = [];
  list = addRecent(list, prod(1));
  list = addRecent(list, prod(2));
  list = addRecent(list, prod(1));
  assert.deepEqual(list.map(e => e.id), [1, 2]);
  for (let i = 10; i < 30; i++) list = addRecent(list, prod(i));
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].id, 29);
});

test("catalog products are stored by id; looked-up products keep a snapshot", () => {
  const list = addRecent(addRecent([], prod(5)), prod(-7, "From USDA"));
  assert.equal(list[1].product, undefined);
  assert.equal(list[0].product?.name, "From USDA");
});

test("resolveRecent re-reads catalog products, keeps snapshots, drops removed ones", () => {
  const list = addRecent(addRecent(addRecent([], prod(1)), prod(-2)), prod(99));
  const catalog = [prod(1, "Fresh name")];
  assert.deepEqual(resolveRecent(list, catalog).map(p => p.name), ["P-2", "Fresh name"]);
});

test("parseRecent: missing or corrupt storage gives an empty list; malformed entries are skipped", () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent("{not json"), []);
  assert.deepEqual(parseRecent('{"id":1}'), []);
  const old = { id: 1, barcode: "0001", at: 1 }; // saved by an older version: still parses
  const snap = { id: -2, product: prod(-2) };
  const raw = JSON.stringify([old, { id: "x" }, null, { id: -3, product: { id: -3 } }, snap]);
  assert.deepEqual(parseRecent(raw).map(e => e.id), [1, -2]);
  assert.deepEqual(parseRecent(JSON.stringify(addRecent(addRecent([], prod(1)), prod(-2)))).map(e => e.id), [-2, 1]);
});

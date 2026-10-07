import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toggleSave, setInList, createList, renameList, deleteList, resolveSaved, parseSaved, refreshSnapshot,
  EMPTY_SAVED, type SavedStore,
} from "./saved.ts";
import type { Product } from "./productImporter.ts";

const prod = (id: number, name = `P${id}`): Product => ({ id, name, barcode: `000${Math.abs(id)}` } as Product);
const ok = (r: SavedStore | string): SavedStore => { assert.equal(typeof r, "object", String(r)); return r as SavedStore; };

test("toggleSave saves newest first; catalog by id, looked-up with a snapshot", () => {
  const s = toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(-7, "From USDA"));
  assert.deepEqual(s.items.map(i => i.id), [-7, 1]);
  assert.equal(s.items[0].product?.name, "From USDA");
  assert.equal(s.items[1].product, undefined);
});

test("toggleSave on a saved product unsaves it everywhere, lists included", () => {
  let s = toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(2));
  s = ok(createList(s, "Snacks", [1]));
  s = ok(createList(s, "Lunch", [1, 2]));
  s = toggleSave(s, prod(1));
  assert.deepEqual(s.items.map(i => i.id), [2]);
  assert.deepEqual(s.lists.map(l => l.ids), [[], [2]]);
});

test("setInList adds newest first without duplicates, and removes", () => {
  let s = toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(2));
  s = ok(createList(s, "Snacks"));
  const id = s.lists[0].id;
  s = setInList(s, id, 1, true);
  s = setInList(s, id, 2, true);
  s = setInList(s, id, 1, true);
  assert.deepEqual(s.lists[0].ids, [2, 1]);
  s = setInList(s, id, 2, false);
  assert.deepEqual(s.lists[0].ids, [1]);
});

test("createList: trimmed, 1-30 characters, unique ignoring case, appended (oldest first), random id", () => {
  let s = ok(createList(EMPTY_SAVED, "  Snacks  "));
  assert.equal(s.lists[0].name, "Snacks");
  assert.equal(typeof createList(s, "   "), "string");
  assert.equal(typeof createList(s, "x".repeat(31)), "string");
  assert.equal(typeof createList(s, "snacks"), "string");
  s = ok(createList(s, "x".repeat(30)));
  assert.deepEqual(s.lists.map(l => l.name), ["Snacks", "x".repeat(30)]);
  assert.notEqual(s.lists[0].id, s.lists[1].id);
});

test("renameList: same rules; renaming to its own name in another case is fine", () => {
  let s = ok(createList(ok(createList(EMPTY_SAVED, "Snacks")), "Lunch"));
  const [a, b] = s.lists.map(l => l.id);
  assert.equal(typeof renameList(s, a, "LUNCH"), "string");
  assert.equal(typeof renameList(s, a, ""), "string");
  s = ok(renameList(s, a, " SNACKS "));
  s = ok(renameList(s, b, "Dinner"));
  assert.deepEqual(s.lists.map(l => l.name), ["SNACKS", "Dinner"]);
});

test("deleteList removes the list only; its products stay saved", () => {
  let s = ok(createList(toggleSave(EMPTY_SAVED, prod(1)), "Snacks", [1]));
  s = deleteList(s, s.lists[0].id);
  assert.deepEqual(s.lists, []);
  assert.deepEqual(s.items.map(i => i.id), [1]);
});

test("resolveSaved re-reads catalog products, keeps snapshots, drops removed ones, follows the given order", () => {
  const s = toggleSave(toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(-2)), prod(99));
  const catalog = [prod(1, "Fresh name")];
  assert.deepEqual(resolveSaved(s, catalog).map(p => p.name), ["P-2", "Fresh name"]);
  assert.deepEqual(resolveSaved(s, catalog, [1, 99, -2]).map(p => p.id), [1, -2]);
});

test("refreshSnapshot replaces a saved looked-up product's snapshot, and nothing else", () => {
  const s = toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(-2, "Old"));
  assert.equal(refreshSnapshot(s, prod(-2, "New")).items[0].product?.name, "New");
  assert.equal(refreshSnapshot(s, prod(-3)), s);
  assert.equal(refreshSnapshot(s, prod(1)), s);
});

test("parseSaved: missing or corrupt storage is empty; bad entries skipped; list ids not saved are dropped", () => {
  assert.deepEqual(parseSaved(null), EMPTY_SAVED);
  assert.deepEqual(parseSaved("{not json"), EMPTY_SAVED);
  assert.deepEqual(parseSaved("[1,2]"), EMPTY_SAVED);
  const raw = JSON.stringify({
    items: [{ id: 1 }, { id: "x" }, null, { id: -3, product: { id: -3 } }, { id: -2, product: prod(-2) }],
    lists: [{ id: "a", name: "Snacks", ids: [1, -3, 7, -2] }, { id: 5, name: "Bad", ids: [] }, { id: "b", name: "Lunch" }],
  });
  const s = parseSaved(raw);
  assert.deepEqual(s.items.map(i => i.id), [1, -2]);
  assert.deepEqual(s.lists, [{ id: "a", name: "Snacks", ids: [1, -2] }]);
  const round = ok(createList(toggleSave(toggleSave(EMPTY_SAVED, prod(1)), prod(-2)), "Snacks", [-2]));
  assert.deepEqual(parseSaved(JSON.stringify(round)), round);
});

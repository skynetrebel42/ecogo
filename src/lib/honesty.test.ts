// honesty.test.ts — M7.4 guard: no screen says something invented or promises a feature that doesn't exist.
// Spec: docs/superpowers/specs/2026-10-02-m74-trust-cleanup-design.md §4.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const APP = new URL("../app/", import.meta.url);
const BANNED = ["researched with AI", "Weekly Groceries", "Price Comparison", "best price", "(coming next)", "coming later", "cached data"];

test("no app screen claims invented content or a missing feature", () => {
  const files = readdirSync(APP, { recursive: true }).map(String).filter(f => f.endsWith(".tsx"));
  assert.ok(files.length > 5, `found the app's .tsx files (${files.length})`);
  const hits = files.flatMap(f => {
    const text = readFileSync(new URL(f.replace(/\\/g, "/"), APP), "utf8").toLowerCase();
    return BANNED.filter(b => text.includes(b.toLowerCase())).map(b => `${f}: "${b}"`);
  });
  assert.deepEqual(hits, []);
});

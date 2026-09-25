import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, deriveSeverity } from "./library.ts";

const BODIES = new Set(["IARC", "EU", "FDA", "EFSA", "WHO/JECFA"]);

test("the library is not empty", () => {
  assert.ok(LIBRARY.length > 0);
});

test("ids are unique slugs", () => {
  const ids = LIBRARY.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("aliases are lowercase, trimmed, at least 3 characters and unique across the library", () => {
  const seen = new Map<string, string>();
  for (const e of LIBRARY) {
    for (const a of e.aliases) {
      assert.equal(a, a.trim().toLowerCase(), `${e.id}: alias "${a}" must be lowercase and trimmed`);
      assert.ok(a.length >= 3, `${e.id}: alias "${a}" is shorter than 3 characters`);
      assert.ok(!seen.has(a), `alias "${a}" is used by both ${seen.get(a)} and ${e.id}`);
      seen.set(a, e.id);
    }
  }
});

test("E-codes are well-formed and unique; every entry has something to match", () => {
  const seen = new Map<string, string>();
  for (const e of LIBRARY) {
    assert.ok(e.aliases.length + e.eCodes.length > 0, `${e.id}: needs an alias or an E-code`);
    for (const c of e.eCodes) {
      assert.match(c, /^E\d{3,4}[A-Z]?$/, `${e.id}: bad E-code ${c}`);
      assert.ok(!seen.has(c), `E-code ${c} is used by both ${seen.get(c)} and ${e.id}`);
      seen.set(c, e.id);
    }
  }
});

test("every entry is fully sourced", () => {
  for (const e of LIBRARY) {
    assert.ok(e.name.trim() && e.concern.trim(), `${e.id}: name and concern are required`);
    assert.ok(e.sources.length > 0, `${e.id}: at least one source is required`);
    for (const s of e.sources) {
      assert.ok(BODIES.has(s.body), `${e.id}: unknown body ${s.body}`);
      assert.match(s.url, /^https:\/\//, `${e.id}: source url must be https`);
      assert.ok(s.finding.trim(), `${e.id}: finding is required`);
      assert.ok(s.quote.trim(), `${e.id}: quote is required`);
      assert.ok(s.quote.trim().split(/\s+/).length <= 25, `${e.id}: keep quotes short (<= 25 words)`);
      assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${e.id}: checkedOn must be YYYY-MM-DD`);
    }
  }
});

test("severity is exactly what the sources establish", () => {
  for (const e of LIBRARY) {
    assert.equal(e.severity, deriveSeverity(e.sources), `${e.id}: severity must match its sources`);
  }
});

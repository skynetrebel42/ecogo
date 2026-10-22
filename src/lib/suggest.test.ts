import { test } from "node:test";
import assert from "node:assert/strict";
import { nearKnownName } from "./suggest.ts";

// 066 R6 (planner, Option A): the first slice of R4's matcher. Misreads from Minh's perfume label (OCR-01).
test("a misread close to a known ingredient name is near one, at any case", () => {
  for (const w of ["UIHONENE", "LNONENE", "HYDROXYCITRONELLASS", "HEXAMETHYLINDANOFISA", "VANILLI", "Benzyl", "phenethyl"])
    assert.equal(nearKnownName(w), true, w);
});

test("a near-miss of a word that isn't an ingredient name stays unsure", () => {
  for (const w of ["FLAMMABIE", "UNDERARMUSE", "DERMATOLOGIST", "Repetir"]) assert.equal(nearKnownName(w), false, w);
});

test("short words are never near a name, so junk like 'AGE' or 'Fi' always counts", () => {
  for (const w of ["AGE", "Fi", "BUTL", "C1", "60730"]) assert.equal(nearKnownName(w), false, w);
});

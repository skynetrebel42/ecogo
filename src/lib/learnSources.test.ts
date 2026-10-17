import { test } from "node:test";
import assert from "node:assert/strict";
import { LEARN_SOURCES, type ExplainerId } from "./learnSources.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

test("S2: every Learn page has at least one checked source and one card, except How EcoGo checks (M12 D2: it describes EcoGo itself)", () => {
  for (const [id, cites] of Object.entries(LEARN_SOURCES) as [ExplainerId, typeof LEARN_SOURCES[ExplainerId]][]) {
    if (id === "how-it-works") { assert.equal(cites.length, 0); continue; }
    assert.ok(cites.length > 0, `${id}: no sources`);
    assert.ok(cites.some(c => c.card), `${id}: no Sources card`);
  }
});

test("S2: each entry has an https URL, a quote, a check date and a card flag; a hand-check date is a date", () => {
  for (const [id, cites] of Object.entries(LEARN_SOURCES)) for (const c of cites) {
    assert.match(c.url, /^https:\/\//, `${id}: ${c.url}`);
    assert.ok(c.quote.trim().length >= 10, `${id}: short quote "${c.quote}"`);
    assert.match(c.checkedOn, DATE, `${id}: checkedOn`);
    if (c.checkedByHand !== undefined) assert.match(c.checkedByHand, DATE, `${id}: checkedByHand`);
    assert.equal(typeof c.card, "boolean", `${id}: card`);
  }
});

test("C1: the seed-oils page has one USDA FoodData Central card and the five oils' values, each checked by hand", () => {
  const usda = LEARN_SOURCES["seed-oils"].filter(c => c.body === "USDA");
  assert.equal(usda.filter(c => c.card).length, 1);
  for (const id of [171411, 171029, 172336, 171025, 172338]) assert.ok(usda.some(c => c.url.includes(`/${id}/`) && c.checkedByHand), `FDC ${id}`);
  // "(including omega‑6)" for soybean and corn oil
  for (const id of [171411, 171029]) assert.ok(usda.some(c => c.url.includes(`/${id}/`) && c.quote.startsWith("PUFA 18:2 n-6")), `omega-6 ${id}`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONAL_CARE, CARE_NOTES, CARE_LIMITED, analyzeCare } from "./personalCare.ts";

const BODIES = new Set(["IARC", "EU", "FDA"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ids = (text: string) => analyzeCare(text).flags.map(f => f.entry.id);
const notes = (text: string) => analyzeCare(text).notes.map(n => n.note.id);

test("ids are unique slugs; aliases are lowercase, at least 3 characters and unique within flags and within notes", () => {
  for (const list of [PERSONAL_CARE, CARE_NOTES, CARE_LIMITED]) {
    const seenId = new Set<string>();
    const seen = new Map<string, string>();
    for (const e of list) {
      assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(!seenId.has(e.id), `duplicate id ${e.id}`);
      seenId.add(e.id);
      assert.ok(e.aliases.length > 0, `${e.id}: needs an alias`);
      for (const a of e.aliases) {
        assert.equal(a, a.trim().toLowerCase(), `${e.id}: alias "${a}"`);
        assert.ok(a.length >= 3, `${e.id}: alias "${a}" is too short`);
        assert.ok(!seen.has(a), `alias "${a}" is used by both ${seen.get(a)} and ${e.id}`);
        seen.set(a, e.id);
      }
    }
  }
});

test("every entry and note is fully sourced; EU and IARC pages carry a hand-check date", () => {
  for (const e of [...PERSONAL_CARE, ...CARE_NOTES, ...CARE_LIMITED]) {
    assert.ok(e.name.trim(), `${e.id}: name`);
    assert.ok(e.sources.length > 0, `${e.id}: at least one source`);
    for (const s of e.sources) {
      assert.ok(BODIES.has(s.body), `${e.id}: unknown body ${s.body}`);
      assert.match(s.url, /^https:\/\//);
      assert.ok(s.finding.trim() && s.quote.trim(), `${e.id}: finding and quote`);
      assert.ok(s.quote.trim().split(/\s+/).length <= 25, `${e.id}: quote <= 25 words`);
      assert.match(s.checkedOn, DATE);
      if (/eur-lex|iarc\.who/.test(s.url)) assert.match(s.checkedByHand ?? "", DATE, `${e.id}: ${s.url} needs checkedByHand`);
    }
  }
});

test("every flag entry has a severity-bearing source; notes never do", () => {
  for (const e of PERSONAL_CARE) assert.ok(["known", "high", "some"].includes(e.severity), e.id);
  for (const n of [...CARE_NOTES, ...CARE_LIMITED]) for (const s of n.sources) assert.equal(s.basis, "context", n.id);
});

test("levels map as the food engine's: an EU ban is high, IARC Group 1 is known", () => {
  const level = (id: string) => PERSONAL_CARE.find(e => e.id === id)?.severity;
  assert.equal(level("coal-tar"), "high");
  assert.equal(level("zinc-pyrithione"), "high");
  assert.equal(level("formaldehyde"), "known");
  assert.equal(level("vinyl-chloride"), "known");
});

test("INCI names match regardless of case, punctuation, stars and amounts", () => {
  assert.deepEqual(ids("Water, Sodium Laureth Sulfate, ZINC PYRITHIONE, Fragrance"), ["zinc-pyrithione"]);
  assert.deepEqual(ids("Active ingredient: Pyrithione zinc 1%. Inactive ingredients: water"), ["zinc-pyrithione"]);
  assert.deepEqual(ids("Aqua/Water/Eau, Isobutylparaben*, Glycerin."), ["isobutylparaben"]);
  assert.deepEqual(ids("Coal tar solution 2.5%"), ["coal-tar"]);
  assert.deepEqual(ids("100% Talc"), ["talc"], "an amount in front is stripped too, not the whole name");
});

test("no partial-word matches: a longer INCI name is a different substance", () => {
  assert.deepEqual(ids("Butylparaben, Propylparaben"), []);
  assert.deepEqual(ids("Sodium Formaldehyde Sulfoxylate"), []);
  assert.deepEqual(ids("Phenylmercuric Acetate, Thimerosal"), []);
  assert.deepEqual(ids("Hydroquinone Dimethyl Ether"), []);
  assert.deepEqual(notes("Limonene Oxide, Natural Linalool Extract"), []);
});

test("\"Parfum (Fragrance)\" gives one fragrance note; named EU allergens get their own rows; the badge doesn't move", () => {
  const a = analyzeCare("Water (Aqua), Glycerin, Parfum (Fragrance), Limonene, Linalool, Citronellol");
  assert.equal(a.verdict, "none");
  assert.deepEqual(a.notes.map(n => n.note.id), ["fragrance", "limonene", "linalool", "citronellol"]);
  assert.deepEqual(notes("Aroma, Menthol"), ["fragrance", "menthol"]);
  assert.deepEqual(notes("Fragrance-free lotion: water, glycerin"), []);
  assert.deepEqual(notes("Lavandula Oil/ Extract, Cedrus Atlantica Oil/Extract"), ["lavandula-oil-extract", "cedrus-atlantica-oil-extract"]);
});

test("sunscreen actives get FDA's own status, by US or INCI name, without a badge", () => {
  const a = analyzeCare("Active ingredients: Zinc Oxide 12%, Avobenzone 3%, Benzophenone-3 6%. Inactive: Water");
  assert.equal(a.verdict, "none");
  const text = (id: string) => a.notes.find(n => n.note.id === id)?.note.text;
  assert.match(text("zinc-oxide") ?? "", /proposed as safe and effective/);
  assert.match(text("avobenzone") ?? "", /more data are needed/);
  assert.match(text("oxybenzone") ?? "", /more data are needed/);
  assert.match(analyzeCare("Aminobenzoic acid").notes[0]?.note.text ?? "", /Removed by FDA/);
});

test("a flag and a note can come from one list; flags sort strongest first", () => {
  const a = analyzeCare("Water, Coal Tar, Formaldehyde, Fragrance, Coumarin");
  assert.equal(a.verdict, "known");
  assert.deepEqual(a.flags.map(f => f.entry.id), ["formaldehyde", "coal-tar"]);
  assert.deepEqual(a.notes.map(n => n.note.id), ["fragrance", "coumarin"]);
});

test("N2c: IARC-only entries map as the food engine's (2A high, 2B some); titanium dioxide and carbon black never flag", () => {
  const level = (text: string) => analyzeCare(text).verdict;
  assert.equal(level("Water, Talc"), "high");
  assert.equal(level("Methyleugenol"), "high");
  for (const t of ["Cocamide DEA", "Diethanolamine", "Pulegone", "Myrcene", "Isoeugenol"]) assert.equal(level(t), "some", t);
  assert.equal(level("Titanium Dioxide, CI 77266, Carbon Black"), "none");
  assert.deepEqual(ids("Benzophenone-3, Benzophenone-4"), [], "the sunscreen benzophenones are other substances");
  assert.deepEqual(notes("Isoeugenol"), ["isoeugenol"], "still an EU allergen row too");
});

test("N2c: FDA's own other names for formaldehyde flag it", () => {
  assert.deepEqual(ids("Water, Methylene Glycol"), ["formaldehyde"]);
  assert.deepEqual(ids("Formalin"), ["formaldehyde"]);
});

test("N2c: bemotrizinol gets FDA's 2026 status by US or INCI name", () => {
  for (const t of ["Bemotrizinol 4%", "Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine"])
    assert.match(analyzeCare(t).notes[0]?.note.text ?? "", /FDA: added as a sunscreen active in 2026/, t);
});

test("N2b: EU Annex III ingredients are 'limited, not banned': listed apart, no badge change, not when already flagged", () => {
  const a = analyzeCare("Water, Salicylic Acid, Retinyl Palmitate, Sodium Hydroxide");
  assert.equal(a.verdict, "none");
  assert.deepEqual(a.limited.map(l => l.note.id), ["salicylic-acid", "retinol", "sodium-hydroxide"]);
  assert.match(a.limited[0].note.text, /^The EU allows this in cosmetics up to a set limit\. EcoGo can't see how much this product has\.$/);
  assert.ok(a.limited.every(l => !a.notes.includes(l)));
  const talc = analyzeCare("Talc, Kojic Acid");
  assert.deepEqual(talc.flags.map(f => f.entry.id), ["talc"]);
  assert.deepEqual(talc.limited.map(l => l.note.id), ["kojic-acid"], "talc is flagged, so not also 'limited'");
  assert.deepEqual(analyzeCare("Titanium Dioxide").limited, [], "TiO2 powder (Annex III 321) can't be told from sunscreen TiO2");
  assert.deepEqual(analyzeCare("Water, Glycerin").limited, []);
});

test("blank or unreadable text is no data, not \"nothing flagged\"", () => {
  assert.equal(analyzeCare("").verdict, "no-data");
  assert.equal(analyzeCare("   ").verdict, "no-data");
});

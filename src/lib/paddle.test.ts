import { test } from "node:test";
import assert from "node:assert/strict";
import { ctcDecode, standing, unsureByLetters, wordConfidences } from "./paddle.ts";

// 066 R3: the recognizer gives, for each time step, a probability per class (0 = blank, then the dictionary).
// Worked example: dictionary [A, B, " "], 6 steps reading "A A _ B" with repeats and blanks.
const DICT = ["A", "B", " "];
const steps = [
  [0.1, 0.9, 0, 0], // A
  [0.2, 0.8, 0, 0], // A again: a repeat, collapsed
  [0.9, 0.1, 0, 0], // blank
  [0.3, 0.6, 0, 0.1], // A after a blank: a new letter
  [0.1, 0, 0, 0.9], // space
  [0.25, 0, 0.75, 0], // B
];

test("greedy CTC decode: best class per step, repeats collapsed, blanks dropped, one probability per letter", () => {
  const r = ctcDecode(steps.flat(), 0, steps.length, 4, DICT);
  assert.deepEqual(r.chars, ["A", "A", " ", "B"]);
  assert.deepEqual(r.probs, [0.9, 0.6, 0.9, 0.75]);
});

test("decode reads one sample out of a batch at its offset", () => {
  const other = [[0.9, 0.1, 0, 0]];
  const r = ctcDecode([...other.flat(), ...steps.flat()], 4, steps.length, 4, DICT);
  assert.equal(r.chars.join(""), "AA B");
});

test("each word's confidence is its weakest letter or digit; an unsure comma doesn't make the word unsure", () => {
  assert.deepEqual(wordConfidences([..."LIMONENE, ACETAIE"], [0.99, 0.98, 0.97, 0.99, 0.99, 0.99, 0.99, 0.95, 0.3, 0.99, 0.99, 0.99, 0.99, 0.99, 0.4, 0.99, 0.98]),
    [{ text: "LIMONENE,", conf: 0.95 }, { text: "ACETAIE", conf: 0.4 }]);
});

test("words whose weakest letter is under the cut are unsure, without their punctuation, once each", () => {
  const words = [{ text: "LIMONENE,", conf: 0.95 }, { text: "ACETAIE", conf: 0.4 }, { text: "(PNENE)", conf: 0.5 }, { text: "ACETAIE,", conf: 0.3 }, { text: "—", conf: 0.1 }];
  assert.deepEqual(unsureByLetters(words, 0.6), ["ACETAIE", "PNENE"]);
});

// 071 F: a sideways label (Coppertone's Drug Facts): its line boxes stand on end. The gate check-label reads one.
const box = (w: number, h: number): [number, number][] => [[0, 0], [w, 0], [w, h], [0, h]];
test("most line boxes standing on end (1.5x taller than wide) mean the label is sideways", () => {
  assert.equal(standing([box(30, 400), box(30, 250), box(30, 90), box(80, 30)]), true);
  assert.equal(standing([box(400, 30), box(250, 30), box(30, 60), box(30, 70)]), false, "half isn't most");
  assert.equal(standing([box(40, 40), box(300, 40)]), false, "a lone % or a square word isn't standing");
  assert.equal(standing([]), false);
});

// suggest.ts — known ingredient names for words the label reader isn't sure of (066, spec
// docs/superpowers/specs/2026-10-21-label-reader-v2-design.md). R6 uses the first slice: is a word close to a known name?
// R4 grows this into up to 3 suggestions from more lists. Names only: nothing here changes the text or counts as read.
import { LIBRARY } from "./safety/library.ts";
import { CARE_LIMITED, CARE_NOTES, PERSONAL_CARE } from "./safety/personalCare.ts";

/** Words of 5+ letters can be near a name; shorter ones ("AGE", "Fi") are too easy to match by chance. */
const MIN = 5;

/** Upper case without accents: a reader's "MONÓSODIUM" is MONOSODIUM with no letter used up. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
/** EcoGo's own ingredient names (library, personal care, notes, limited), upper case, and their words of 5+ letters. */
const NAMES = new Set([...LIBRARY, ...PERSONAL_CARE, ...CARE_NOTES, ...CARE_LIMITED].flatMap(e => e.aliases.map(fold)));
const NAME_WORDS = [...new Set([...NAMES].flatMap(a => a.match(/\p{L}+/gu) ?? []).filter(w => w.length >= MIN))];
const OURS = new Set(NAME_WORDS);
const KNOWN = new Set(NAME_WORDS);

let more: Promise<void> | undefined;
/** Adds the words of USDA FoodData Central's ingredient lists (planner, 066 §4; ~11 kB gzipped, loaded with the reader). */
export const loadMoreNames = () => (more ??= import("./data/usda-words.ts").then(m => {
  for (const w of m.default.split(" ")) if (!OURS.has(w)) { NAME_WORDS.push(w); KNOWN.add(w); }
  suggested.clear();
}));
/** 070 C3: whether `word` is a known name's word as it stands (5+ letters, EcoGo's or, once loaded, USDA's). */
export const knownWord = (word: string) => KNOWN.has(fold(word));
export const within = (w: string, n: string) => distance(w, n, Math.floor(n.length / 4)) <= Math.floor(n.length / 4);

/** Edit distance (insert, delete, change one letter), giving up once it must exceed `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Whether `word` is within one changed letter per 4 letters of a known name's word ("LNONENE" → LIMONENE). */
export function nearKnownName(word: string): boolean {
  const w = fold(word);
  if (w.length < MIN || !/\p{L}/u.test(w)) return false;
  // EcoGo's own names only (R6 as accepted): counting the USDA words too took the retake hint off photos cut off at the
  // edge (Minh's chip photos 7 and 8: 44 % → 25 %, 31 % → 23 %), where a retake is the right advice.
  return [...OURS].some(n => within(w, n));
}

/** R4: up to 3 known name words close to `word` (fewest changed letters first, then closest length), in its case.
 *  None for a word that already is one: the person types it, or retakes. */
const suggested = new Map<string, string[]>(); // the row asks again on every keystroke: each word is worked out once
export function suggestWords(word: string): string[] {
  let s = suggested.get(word);
  if (!s) suggested.set(word, s = suggest(word));
  return s;
}
function suggest(word: string): string[] {
  const w = fold(word);
  if (w.length < MIN || !/\p{L}/u.test(w) || NAME_WORDS.includes(word.toUpperCase())) return [];
  const cased = (n: string) => word === word.toUpperCase() ? n : word === word.toLowerCase() ? n.toLowerCase() : n[0] + n.slice(1).toLowerCase();
  return NAME_WORDS.map(n => ({ n, d: distance(w, n, Math.floor(n.length / 4)) })).filter(c => c.d <= Math.floor(c.n.length / 4))
    .sort((a, b) => a.d - b.d || +OURS.has(b.n) - +OURS.has(a.n) // as close: EcoGo's own names first
      || Math.abs(a.n.length - w.length) - Math.abs(b.n.length - w.length) || a.n.localeCompare(b.n))
    .slice(0, 3).map(c => cased(c.n));
}

/** The text split as the underlines split it: words at odd places (no lookbehind: older iOS Safari can't parse it). */
const parts = (text: string) => text.split(/([\p{L}\p{N}]+)/u);

/** R4's row under the box: the words still in `text` that the reader wasn't sure of, or that are a letter or two off a
 *  known name (the perfume's confidently read "LMONENE"), first appearance first; and the items to offer a comma in
 *  (`at`: where it goes in `text`). */
export function fixList(text: string, unsure: string[]) {
  const set = new Set(unsure), near = new Map<string, boolean>();
  const offer = (w: string) => set.has(w) || (near.has(w) ? near.get(w)! : near.set(w, suggestWords(w).length > 0).get(w)!);
  const words = [...new Set(parts(text).filter((p, i) => i % 2 && offer(p)))];
  const splits = [...text.matchAll(/[^,;]+/g)].flatMap(m => {
    const at = splitAt(m[0]);
    return at === null ? [] : [{ at: m.index! + at, before: m[0].slice(0, at).trim(), after: m[0].slice(at).trim() }];
  });
  return { words, splits };
}

/** `word` replaced by `by` wherever it stands as a whole word. */
export const replaceWord = (text: string, word: string, by: string) => parts(text).map((p, i) => (i % 2 && p === word ? by : p)).join("");

/** A comma at `at` (from fixList). */
export const addComma = (text: string, at: number) => `${text.slice(0, at)},${text.slice(at)}`;

/** Whether `text` is a known name, or close to one (5+ letters, one changed letter per 4). */
function nameLike(text: string): boolean {
  const t = fold(text).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return NAMES.has(t) || (t.length >= MIN && [...NAMES].some(n => within(t, n)));
}

/** R4's split: where to put a comma in an item that is two known names run together ("HEXAMETHYLINDANOPYRA BENZYL
 *  SALICYLATE"), as the index just after the first name; null when it isn't. Only offered: 062's whole-name matching
 *  stays, so nothing inside an item counts until the person accepts the comma. */
export function splitAt(item: string): number | null {
  // A CAS number ("WATER (7732-18-5)") ends an ingredient on labels that print them: a comma right after one that has
  // more text behind it (a misread bracket can swallow the comma: "BETAINE C61789-40-0) SODIUM LAURYL SULFATE").
  const cas = /\S*\d{2,7}-\d{2}-\d\S*(?=\s+[\p{L}\p{N}])/u.exec(item);
  if (cas) return cas.index + cas[0].length;
  const words = [...item.matchAll(/\S+/g)];
  for (let k = 1; k < words.length; k++) {
    const end = words[k - 1].index! + words[k - 1][0].length;
    // A bracket names the same ingredient ("FRAGRANCE (PARFUM)"): never a comma at or inside one.
    if (words[k][0].startsWith("(") || /\([^)]*$/.test(item.slice(0, end))) continue;
    if (nameLike(item.slice(0, end)) && nameLike(item.slice(words[k].index!))) return end;
  }
  return null;
}

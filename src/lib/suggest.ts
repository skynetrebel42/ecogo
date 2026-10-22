// suggest.ts — known ingredient names for words the label reader isn't sure of (066, spec
// docs/superpowers/specs/2026-10-21-label-reader-v2-design.md). R6 uses the first slice: is a word close to a known name?
// R4 grows this into up to 3 suggestions from more lists. Names only: nothing here changes the text or counts as read.
import { LIBRARY } from "./safety/library.ts";
import { CARE_LIMITED, CARE_NOTES, PERSONAL_CARE } from "./safety/personalCare.ts";

/** Words of 5+ letters can be near a name; shorter ones ("AGE", "Fi") are too easy to match by chance. */
const MIN = 5;

/** EcoGo's own ingredient names (library, personal care, notes, limited), upper case, and their words of 5+ letters. */
const NAMES = new Set([...LIBRARY, ...PERSONAL_CARE, ...CARE_NOTES, ...CARE_LIMITED].flatMap(e => e.aliases.map(a => a.toUpperCase())));
const NAME_WORDS = [...new Set([...NAMES].flatMap(a => a.match(/\p{L}+/gu) ?? []).filter(w => w.length >= MIN))];
const within = (w: string, n: string) => distance(w, n, Math.floor(n.length / 4)) <= Math.floor(n.length / 4);

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
  const w = word.toUpperCase();
  if (w.length < MIN || !/\p{L}/u.test(w)) return false;
  return NAME_WORDS.some(n => within(w, n));
}

/** R4: up to 3 known name words close to `word` (fewest changed letters first, then closest length), in its case.
 *  None for a word that already is one: the person types it, or retakes. */
export function suggestWords(word: string): string[] {
  const w = word.toUpperCase();
  if (w.length < MIN || !/\p{L}/u.test(w) || NAME_WORDS.includes(w)) return [];
  const cased = (n: string) => word === w ? n : word === word.toLowerCase() ? n.toLowerCase() : n[0] + n.slice(1).toLowerCase();
  return NAME_WORDS.map(n => ({ n, d: distance(w, n, Math.floor(n.length / 4)) })).filter(c => c.d <= Math.floor(c.n.length / 4))
    .sort((a, b) => a.d - b.d || Math.abs(a.n.length - w.length) - Math.abs(b.n.length - w.length) || a.n.localeCompare(b.n))
    .slice(0, 3).map(c => cased(c.n));
}

/** Whether `text` is a known name, or close to one (5+ letters, one changed letter per 4). */
function nameLike(text: string): boolean {
  const t = text.toUpperCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return NAMES.has(t) || (t.length >= MIN && [...NAMES].some(n => within(t, n)));
}

/** R4's split: where to put a comma in an item that is two known names run together ("HEXAMETHYLINDANOPYRA BENZYL
 *  SALICYLATE"), as the index just after the first name; null when it isn't. Only offered: 062's whole-name matching
 *  stays, so nothing inside an item counts until the person accepts the comma. */
export function splitAt(item: string): number | null {
  const words = [...item.matchAll(/\S+/g)];
  for (let k = 1; k < words.length; k++) {
    const end = words[k - 1].index! + words[k - 1][0].length;
    if (nameLike(item.slice(0, end)) && nameLike(item.slice(words[k].index!))) return end;
  }
  return null;
}

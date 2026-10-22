// suggest.ts — known ingredient names for words the label reader isn't sure of (066, spec
// docs/superpowers/specs/2026-10-21-label-reader-v2-design.md). R6 uses the first slice: is a word close to a known name?
// R4 grows this into up to 3 suggestions from more lists. Names only: nothing here changes the text or counts as read.
import { LIBRARY } from "./safety/library.ts";
import { CARE_LIMITED, CARE_NOTES, PERSONAL_CARE } from "./safety/personalCare.ts";

/** Words of 5+ letters can be near a name; shorter ones ("AGE", "Fi") are too easy to match by chance. */
const MIN = 5;

/** The words of EcoGo's own ingredient names (library, personal care, notes, limited), upper case, 5+ letters. */
const NAME_WORDS = [...new Set([...LIBRARY, ...PERSONAL_CARE, ...CARE_NOTES, ...CARE_LIMITED]
  .flatMap(e => e.aliases.flatMap(a => a.toUpperCase().match(/\p{L}+/gu) ?? [])).filter(w => w.length >= MIN))];

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
  return NAME_WORDS.some(n => distance(w, n, Math.floor(n.length / 4)) <= Math.floor(n.length / 4));
}

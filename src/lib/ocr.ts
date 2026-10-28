// ocr.ts — read an ingredients label on the phone (M8, spec docs/superpowers/specs/2026-10-02-m8-add-product-design.md D4).
// 066 R3: PaddleOCR (paddle.ts) reads first; Tesseract.js is the fallback. Both are self-hosted (scripts/copy-ocr.mjs
// fills public/tesseract/ and public/paddle/ before every dev/build), so no CDN is called. They load only when a photo is read.

import type { Block, Worker } from "tesseract.js";
import { jpegUnder } from "./photo.ts";
import { fold, knownWord, loadMoreNames, nearKnownName, unglueName, within } from "./suggest.ts";

/** Words read with less confidence than this (0–100) are underlined for the person to check. */
const UNSURE_BELOW = 70;

/** Tidy text read from a label: drop a leading "Ingredients:", rejoin words hyphenated across lines (071 L, GA-04: a
 *  hyphen after a digit is part of the name, "3-\nCyclohexene" → "3-Cyclohexene"), one line. */
export function cleanIngredients(raw: string): string {
  return raw
    .replace(/(\d?)-[ \t]*\r?\n\s*/g, (_, digit) => (digit ? `${digit}-` : ""))
    .replace(/^\s*ingredients?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// M8 follow-up F1 (docs/superpowers/specs/2026-10-08-m8-followup-label-trim-design.md): whole words, any case, no
// lookbehind (older iOS Safari can't parse it). "Contains 2% or less of", "Contains: less than 2% of" and "Contains one
// or more of" are part of the list, so "Contains" followed by a number, "less" or "one or more" isn't a stop; nor is a
// stop phrase right after "(" ("cheese (contains milk)") or followed by "-" ("Allergen-free"). 066 R5 (OCR-02) adds the
// personal-care and cleaner warnings ("CAUTION: FLAMMABLE… AVOID CONTACT WITH EYES" on Minh's perfume), and (planner,
// Minh's live tests) service and distributor lines ("Satisfaction guaranteed – For questions or comments please call…"
// on his Equate lotion, "DIST. FOR/POUR COTY" on a Burberry box). 071 G: "INGREDIENTS," starts a list as "INGREDIENTS:"
// does (Burberry); 071 A: a net quantity ("NET WT 15 OZ", "8 FL OZ (236 mL)", "1.7 oz / 50 g") ends one.
const START = /(^|[^\p{L}\p{N}])(ingredients?)(?![\p{L}\p{N}])\s*[:,]?/giu;
const STOPS = ["contains(?!\\s*:?\\s*(?:\\d|less|one or more))", "may contain", "allergens?", "allergy",
  "distributed by", "manufactured (?:by|for)", "produced by", "packed by", "nutrition facts", "best before", "best by",
  "keep refrigerated", "store in", "net wt", "caution", "warnings?", "directions", "avoid contact", "keep out of reach",
  "for external use", "flammable", "satisfaction guaranteed", "questions or comments", "please call", "dist[.,]?\\s*for",
  "\\d+(?:[.,]\\d+)?\\s*(?:fl\\.?\\s*oz|oz|ml|g|kg|lbs?)"];
const stops = (words: string[]) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(s => s.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}-])`, "giu");
const STOP = stops(STOPS);
// 071 G, M (GA-05): a Drug Facts "Active ingredient" line ends at its "Purpose", "Uses" or "Inactive ingredients"
// ("all-purpose flour" in a food list isn't a stop); the inactive list after it is read too.
const ACTIVE_STOP = stops([...STOPS, "purposes?", "uses", "inactive ingredients?"]);
const INACTIVE = /(^|[^\p{L}\p{N}])inactive\s+ingredients?(?![\p{L}\p{N}])\s*[:,]?/iu;
/** 071 D: "Made in Mexico with US and Imported Ingredients" (Pantene) isn't the list's start. */
const IMPORTED = (before: string) => /(?:^|[^\p{L}\p{N}])imported\s*$/iu.test(before);
const ACTIVE = /(?:^|[^\p{L}\p{N}])active\s*$/iu;
/** 071 K (GA-03): a stop phrase right after "(", spaces or not ("cheese ( contains milk)"), is part of the list. */
const IN_BRACKET = (before: string) => /\(\s*$/.test(before);
/** 071 G: the rest of the Drug Facts table's header after "Active ingredient" ("(in each 5 mL)   Purpose") isn't the list. */
const HEADER = /^\s*(?:\([^)]*\)\s*)?(?:purposes?(?![\p{L}\p{N}]))?/iu;
// 066 (planner): "INGREDIENTS:" with its left end cut off by a curve or the photo's edge ("CREDIENTS:"): a word ending in
// DIENTS (or EDIENT) and a colon, at the start of a line. NUTRIENTS:, CONTENTS: and DIRECTIONS: don't end that way.
const CUT_START = /(^|\n)[ \t]*(\p{L}*(?:dients|edient))[ \t]*:/iu;
const asWord = (s: string) => s.replace(/\s+/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());

/** Where the ingredient list is in text read from a label: just after the first "Ingredients" (or one cut at the left
 *  edge), up to the first stop phrase after it. No start word → from the beginning; no stop phrase → to the end. With no
 *  start word, a stop phrase before any text ("DIRECTIONS: …" first) cuts nothing: the line checkboxes decide. */
type Range = { start: number; end: number };
export function trimToIngredients(text: string): Range & { startWord?: string; stopWord?: string; then?: Range } {
  const s = first(START, text, IMPORTED) ?? CUT_START.exec(text);
  let start = s ? s.index + s[0].length : 0;
  const active = !!s && ACTIVE.test(text.slice(0, s.index + s[1].length));
  if (active) start += HEADER.exec(text.slice(start))![0].length;
  let e = stopAt(text, start, active ? ACTIVE_STOP : STOP);
  // 071 A: no start word, and only a front panel (brand, name: no comma) before a net quantity: the list starts after it.
  if (!s && e && /^(?:net|\d)/i.test(e.word) && !text.slice(0, e.end).includes(",")) {
    start = text.indexOf("\n", e.end) + 1 || text.length;
    e = stopAt(text, start);
  }
  if (!s && e && !/[\p{L}\p{N}]/u.test(text.slice(start, e.end))) return { start, end: text.length };
  const i = active && e ? INACTIVE.exec(text.slice(e.end)) : null;
  const then = i && { start: e!.end + i.index + i[0].length, end: text.length };
  const e2 = then && stopAt(text, then.start);
  if (then && e2) then.end = e2.end;
  const last = then ? e2 : e;
  return {
    start, end: e?.end ?? text.length,
    ...(s && { startWord: asWord(s[2]) }), ...(last && { stopWord: asWord(last.word) }), ...(then && { then }),
  };
}

/** The first match of `re` (flag g) in `text` that `skip`, given the text before its word, doesn't rule out. */
function first(re: RegExp, text: string, skip: (before: string) => boolean): RegExpExecArray | null {
  re.lastIndex = 0;
  for (let m; (m = re.exec(text)); ) if (!skip(text.slice(0, m.index + m[1].length))) return m;
  return null;
}

/** Where the list from `start` ends: at the first stop phrase's word, or null for none. */
function stopAt(text: string, start: number, re = STOP): { end: number; word: string } | null {
  const e = first(re, text.slice(start), IN_BRACKET);
  return e && { end: start + e.index + e[1].length, word: e[2] };
}

/** A line read from the photo, its part inside the ingredients ("" = none) and whether it's ticked (F2). */
export type LabelLine = { text: string; kept: string; on: boolean };

export function labelLines(lines: string[]): LabelLine[] {
  const t = trimToIngredients(lines.join("\n"));
  const ranges = t.then ? [t, t.then] : [t];
  let at = 0;
  return lines.map(text => {
    const from = at; at += text.length + 1;
    const kept = ranges.map(({ start, end }, i) => {
      const part = text.slice(Math.max(start - from, 0), Math.max(end - from, 0)).trim();
      // 071 M: the Drug Facts active line's end takes a comma, so the inactive list's first item stays its own.
      return i < ranges.length - 1 && end <= at && /[\p{L}\p{N}]/u.test(part) && !/[,;]$/.test(part) ? `${part},` : part;
    }).filter(part => /[\p{L}\p{N}]/u.test(part)).join(" ");
    return { text, kept, on: kept !== "" };
  });
}

/** The ingredients text from the ticked lines: a line's kept part, or all of it when it was outside the range; no
 *  dangling "," or ";" at the end. */
export const linesText = (lines: LabelLine[]) =>
  cleanIngredients(lines.filter(l => l.on).map(l => l.kept || l.text).join("\n")).replace(/\s*[,;]$/, "");

/** 071 E: words glued together on condensed print: one of EcoGo's names ("BENZYLSALICYLATE") gets its spaces back, and
 *  "INGREDIENTS" glued to the first ingredient (Burberry's "INGREDIENTSALCOHOL…") is split off, so the list starts. */
export const unglue = (line: string) =>
  line.replace(/\p{L}{6,}/gu, w => unglueName(w) ?? w.replace(/^(ingredients?)(?=\p{L}{3})/iu, "$1 "));

/** A photo's lines as read, glued words split (071 E): its ingredients and its lines to tick. */
const readLines = (read: string[]) => labelLines(read.map(t => unglue(t.trim())).filter(Boolean));

type WordsOnly = { paragraphs: { lines: { words: { text: string; confidence: number }[] }[] }[] }[];

/** The low-confidence words, without surrounding punctuation, each once. */
export function unsureWords(blocks: WordsOnly | null): string[] {
  const unsure = new Set<string>();
  for (const b of blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) {
    const text = w.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (text && w.confidence < UNSURE_BELOW) unsure.add(text);
  }
  return [...unsure];
}

/** The words in `text` (the kept ingredients) and how many of them were read with low confidence (M8 follow-up 2, G6). */
export function unsureCount(text: string, unsure: string[]): { words: number; unsure: number } {
  const set = new Set(unsure);
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  return { words: words.length, unsure: words.filter(w => set.has(w)).length };
}

/** G4: suggest a retake (never block) when at least this share of the kept words is unsure, or nothing was kept.
 *  25 % (planner, 2026-10-08): clear labels measure 0 %, the curved-bag fixture 29 %, Minh's real Takis read ~50 %.
 *  066 R6 (OCR-03): unsure words near a known ingredient name don't count: on a sharp, narrow, curved label they are the
 *  reader's misreads (a retake won't fix them; R4 offers the name), so Minh's perfume went 30 % → 13 %. */
export const HARD_TO_READ = 0.25;
export function hardToRead(text: string, unsure: string[]): boolean {
  const c = unsureCount(text, unsure.filter(w => !nearKnownName(w)));
  return !c.words || c.unsure / c.words >= HARD_TO_READ;
}

/** Reads the text of a label photo with the stronger reader (066 R3, paddle.ts); if it can't load or read, with
 *  Tesseract. The first call downloads the reader, which the browser then keeps. */
export async function readLabel(image: Blob): Promise<Read> {
  try {
    const { readPaddle, unsureByLetters, UNSURE_LETTER } = await import("./paddle.ts");
    const { lines: read, words } = await readPaddle(image);
    const lines = readLines(read);
    return { text: linesText(lines), unsure: unsureByLetters(words, UNSURE_LETTER), lines };
  } catch (err) {
    console.warn("[ocr] the stronger reader failed; reading with Tesseract", err);
    return readTesseract(image);
  }
}

let worker: Promise<Worker> | undefined;

/** Reads the text of a label photo with Tesseract (about 7 MB on first use). */
async function readTesseract(image: Blob): Promise<Read> {
  if (!worker) {
    worker = import("tesseract.js").then(({ createWorker }) => {
      // The site lives under a sub-path (Vite base './'): build absolute URLs, never "/…".
      const dir = new URL(`${import.meta.env.BASE_URL}tesseract/`, location.href).href;
      return createWorker("eng", 1, { workerPath: `${dir}worker.min.js`, corePath: dir, langPath: dir, workerBlobURL: false });
    });
    worker.catch(() => { worker = undefined; }); // a failed download gets a fresh try next time
  }
  const { data } = await (await worker).recognize(image, {}, { text: true, blocks: true });
  const blocks = data.blocks as Block[] | null;
  const read = blocks ? blocks.flatMap(b => b.paragraphs.flatMap(p => p.lines.map(l => l.text))) : data.text.split("\n");
  const lines = readLines(read);
  return { text: linesText(lines), unsure: unsureWords(blocks), lines };
}

/** R9: the same word in two reads of one label: equal; one a cut-off end of the other ("MONOSODIU", "HAN" ← "THAN"); or
 *  5+ letters with one changed letter per 4. Keys are folded, without punctuation. */
const piece = (p: string, w: string) => p.length >= 3 && (w.startsWith(p) || w.endsWith(p));
const sameWord = (x: string, y: string) => x === y || piece(x, y) || piece(y, x) || (Math.min(x.length, y.length) >= 5 && within(x, y));

/** 068 S2: Paste from Photos. The clipboard's text fills an empty box or goes on a new line after what's typed (nothing
 *  typed is lost); an empty clipboard is null, like a refused read (the box keeps it as it was). */
export const pasteInto = (box: string, clip: string) => !clip.trim() ? null : box.trim() ? `${box.trimEnd()}\n${clip.trim()}` : clip.trim();

/** 066 R9 "Add another photo": the box's text and a new photo's text as one, joined at the longest run of 3+ words
 *  that ends the box (or ends before its end, by up to 2 words or the run's own length: 071 C, a cut-off last line)
 *  and stands anywhere in the new text. The box keeps its words (its fixes) up to there, the new text follows; what the
 *  new photo read before the run (another panel) is left out. No such run → the new text goes at the end.
 *  071 N (GA-06): the box's words past the run each meet the new text's next words: one the new text also has (or a
 *  cut-off start of) gives way to it; words between two such that the new text has as many of are misreads of those;
 *  any other word only the box has is kept ("talc" was dropped).
 *  ponytail: one overlap, so photos each cut off on one side (every line cut: Minh's chip photos 7 and 8) don't line
 *  up and are added at the end; joining those line by line would need the reads' line positions (Future features). */
export function joinReads(box: string, read: string): { text: string; joined: boolean } {
  const a = box.split(/\s+/).filter(Boolean), b = read.split(/\s+/).filter(Boolean);
  const key = (w: string) => fold(w).replace(/[^\p{L}\p{N}]/gu, "") || w;
  const ka = a.map(key), kb = b.map(key);
  let best = { k: 0, p: 0, q: 0 }, run = kb.map(() => 0); // run[q]: words alike in a row, ending at a[p] and b[q]
  for (let p = 0; p < a.length; p++) {
    run = kb.map((w, q) => (sameWord(ka[p], w) ? (q ? run[q - 1] : 0) + 1 : 0));
    run.forEach((k, q) => { if (k && k >= best.k && a.length - 1 - p <= Math.max(2, k)) best = { k, p, q }; });
  }
  // No overlap: after a comma, so the box's last item and the new first one stay two items (whole-name matching).
  if (best.k < 3) return { text: [box.trim().replace(/\s*[,;]$/, ""), read.trim()].filter(Boolean).join(", "), joined: false };
  const { p, q } = best, ends = (w: string) => w.match(/[^\p{L}\p{N}]*$/u)![0];
  // Where they meet: the new word if the box's is a cut-off piece of it, else the box's with the new one's punctuation.
  const meet = ka[p] !== kb[q] && piece(ka[p], kb[q]) ? b[q] : a[p].slice(0, a[p].length - ends(a[p]).length) + ends(b[q]);
  const text = [...a.slice(0, p), meet];
  let j = q + 1, gap: string[] = []; // b[j]: the new text's next word; gap: the box's words since the last one met
  for (let i = p + 1; i < a.length; i++) {
    let r = j;
    while (r < b.length && !sameWord(ka[i], kb[r]) && !kb[r].startsWith(ka[i])) r++;
    if (r === b.length) { gap.push(a[i]); continue; }
    if (gap.length !== r - j) text.push(...gap);
    text.push(...b.slice(j, r + 1));
    gap = []; j = r + 1;
  }
  return { text: [...text, ...gap, ...b.slice(j)].join(" "), joined: true };
}

const COULDNT_READ = "Couldn't read it. Type the ingredients or retake the photo.";

type Read = { text: string; unsure: string[]; lines: LabelLine[] };
export type PhotoRead = Read & { hard: boolean; error?: string; read?: string; busy?: true };

/** What a screen shows after a read: no lines → the "couldn't read" message; hard to read (G4) → an empty box and no
 *  lines, the read text kept in `read` for "Show what we read" (follow-up 6, K2), so junk never goes into the box. */
export function afterRead(r: Read): PhotoRead {
  if (!r.lines.length) return { ...r, hard: false, error: COULDNT_READ };
  return hardToRead(r.text, r.unsure) ? { text: "", unsure: r.unsure, lines: [], hard: true, read: r.text } : { ...r, hard: false };
}

// 070 C2: the "Cloud help for hard labels" switch, off until the person turns it on, remembered on this device only.
const CLOUD_KEY = "ecogo.cloudHelp.v1";
export const cloudHelpOn = () => { try { return localStorage.getItem(CLOUD_KEY) === "on"; } catch { return false; } };
export const setCloudHelp = (on: boolean) => {
  try { if (on) localStorage.setItem(CLOUD_KEY, "on"); else localStorage.removeItem(CLOUD_KEY); } catch { /* applies this visit */ }
};

/** 070 C3: the words in `text` that are a known name's word as they stand. */
export const knownCount = (text: string) => (text.match(/[\p{L}\p{N}]+/gu) ?? []).filter(knownWord).length;

/** 070 C3: a hard photo's phone result, or cloud help's read (`cloud`: its lines; null: no answer) when that has more
 *  known name words; a tie keeps the phone's. OCR.space gives no confidences, so no unsure words: R4's chips still offer
 *  near names, and the box is the person's to accept, as with the phone's text. */
export function withCloud(phone: PhotoRead, cloud: string[] | null): PhotoRead {
  if (!cloud) return { ...phone, busy: true };
  const lines = readLines(cloud), text = linesText(lines);
  return knownCount(text) > knownCount(phone.read ?? phone.text) ? afterRead({ text, unsure: [], lines }) : phone;
}

/** 070 C1: the photo's lines from EcoGo's own ocr-cloud function (which asks OCR.space), or null on any failure. */
async function readCloud(photo: Blob): Promise<string[] | null> {
  const ctl = new AbortController(), wait = setTimeout(() => ctl.abort(), 30_000); // not AbortSignal.timeout: iOS 16+ only
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-cloud`, {
      method: "POST", body: await jpegUnder(photo, 1024 * 1024), signal: ctl.signal,
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "image/jpeg" },
    });
    const lines = res.ok ? (await res.json()).lines : null;
    return Array.isArray(lines) ? lines.filter((l: unknown) => typeof l === "string") : null;
  } catch (err) {
    console.warn("[ocr] cloud help didn't answer", err);
    return null;
  } finally {
    clearTimeout(wait);
  }
}

/** readLabel for the screens: never throws (spec §3). `hard` (follow-up 2, G4) only when something was read: a reader
 *  that failed (offline, say) isn't the photo's fault. A hard photo also goes to cloud help (070) if `cloud()` says so
 *  when the phone's read ends (075 H1: the switch on and the check still open); nothing else ever does. */
export async function readPhoto(photo: Blob, cloud = () => false, read = readLabel): Promise<PhotoRead> {
  try {
    loadMoreNames().catch(() => {}); // 066 R4: the USDA words for suggestions, fetched while the photo is read
    const r = afterRead(await read(photo));
    return r.hard && cloud() ? withCloud(r, await readCloud(photo)) : r;
  } catch (err) {
    console.warn("[ocr] couldn't read the photo", err);
    return { text: "", unsure: [], lines: [], hard: false, error: COULDNT_READ };
  }
}

/** R9: another photo of the same label: its text (planner: never held back by the hard-to-read hint) and unsure words,
 *  or the "couldn't read" message when nothing was kept. The caller joins it to the box as the box is by then. */
export async function readAnother(photo: Blob, cloud = () => false): Promise<{ text: string; unsure: string[]; busy?: true } | { error: string }> {
  const r = await readPhoto(photo, cloud), text = r.read ?? r.text;
  return r.error || !text ? { error: r.error ?? COULDNT_READ } : { text, unsure: r.unsure, busy: r.busy };
}

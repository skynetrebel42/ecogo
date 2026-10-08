// ocr.ts — read an ingredients label on the phone (M8, spec docs/superpowers/specs/2026-10-02-m8-add-product-design.md D4).
// Tesseract.js is self-hosted: scripts/copy-ocr.mjs copies its worker, its LSTM core builds and the English data into
// public/tesseract/ before every dev/build, so no CDN is called. It loads only when a photo is read.

import type { Block, Worker } from "tesseract.js";

/** Words read with less confidence than this (0–100) are underlined for the person to check. */
const UNSURE_BELOW = 70;

/** Tidy text read from a label: drop a leading "Ingredients:", rejoin words hyphenated across lines, one line. */
export function cleanIngredients(raw: string): string {
  return raw
    .replace(/-[ \t]*\r?\n\s*/g, "")
    .replace(/^\s*ingredients?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// M8 follow-up F1 (docs/superpowers/specs/2026-10-08-m8-followup-label-trim-design.md): whole words, any case, no
// lookbehind (older iOS Safari can't parse it). "Contains 2% or less of", "Contains: less than 2% of" and "Contains one
// or more of" are part of the list, so "Contains" followed by a number, "less" or "one or more" isn't a stop; nor is a
// stop phrase right after "(" ("cheese (contains milk)") or followed by "-" ("Allergen-free").
const START = /(^|[^\p{L}\p{N}])(ingredients?)(?![\p{L}\p{N}])\s*:?/iu;
const STOP = new RegExp(`(^|[^\\p{L}\\p{N}(])(${["contains(?!\\s*:?\\s*(?:\\d|less|one or more))", "may contain", "allergens?", "allergy",
  "distributed by", "manufactured (?:by|for)", "produced by", "packed by", "nutrition facts", "best before", "best by",
  "keep refrigerated", "store in", "net wt"].map(s => s.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}-])`, "iu");
const asWord = (s: string) => s.replace(/\s+/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());

/** Where the ingredient list is in text read from a label: just after the first "Ingredients", up to the first stop
 *  phrase after it. No start word → from the beginning; no stop phrase → to the end. */
export function trimToIngredients(text: string): { start: number; end: number; startWord?: string; stopWord?: string } {
  const s = START.exec(text);
  const start = s ? s.index + s[0].length : 0;
  const e = STOP.exec(text.slice(start));
  return {
    start, end: e ? start + e.index + e[1].length : text.length,
    ...(s && { startWord: asWord(s[2]) }), ...(e && { stopWord: asWord(e[2]) }),
  };
}

/** A line read from the photo, its part inside the ingredients ("" = none) and whether it's ticked (F2). */
export type LabelLine = { text: string; kept: string; on: boolean };

export function labelLines(lines: string[]): LabelLine[] {
  const { start, end } = trimToIngredients(lines.join("\n"));
  let at = 0;
  return lines.map(text => {
    const from = at; at += text.length + 1;
    const part = text.slice(Math.max(start - from, 0), Math.max(end - from, 0)).trim();
    const kept = /[\p{L}\p{N}]/u.test(part) ? part : "";
    return { text, kept, on: kept !== "" };
  });
}

/** The ingredients text from the ticked lines: a line's kept part, or all of it when it was outside the range; no
 *  dangling "," or ";" at the end. */
export const linesText = (lines: LabelLine[]) =>
  cleanIngredients(lines.filter(l => l.on).map(l => l.kept || l.text).join("\n")).replace(/\s*[,;]$/, "");

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

let worker: Promise<Worker> | undefined;

/** Reads the text of a label photo. The first call downloads the reader (about 7 MB), which the browser then keeps. */
export async function readLabel(image: Blob): Promise<{ text: string; unsure: string[]; lines: LabelLine[] }> {
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
  const lines = labelLines(read.map(t => t.trim()).filter(Boolean));
  return { text: linesText(lines), unsure: unsureWords(blocks), lines };
}

const COULDNT_READ = "Couldn't read it. Type the ingredients or retake the photo.";

/** readLabel for the screens: never throws; no text comes back with the "couldn't read" message (spec §3). */
export async function readPhoto(photo: Blob): Promise<{ text: string; unsure: string[]; lines: LabelLine[]; error?: string }> {
  try {
    const r = await readLabel(photo);
    return r.lines.length ? r : { ...r, error: COULDNT_READ };
  } catch (err) {
    console.warn("[ocr] couldn't read the photo", err);
    return { text: "", unsure: [], lines: [], error: COULDNT_READ };
  }
}

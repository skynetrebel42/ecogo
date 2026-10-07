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
export async function readLabel(image: Blob): Promise<{ text: string; unsure: string[] }> {
  if (!worker) {
    worker = import("tesseract.js").then(({ createWorker }) => {
      // The site lives under a sub-path (Vite base './'): build absolute URLs, never "/…".
      const dir = new URL(`${import.meta.env.BASE_URL}tesseract/`, location.href).href;
      return createWorker("eng", 1, { workerPath: `${dir}worker.min.js`, corePath: dir, langPath: dir, workerBlobURL: false });
    });
    worker.catch(() => { worker = undefined; }); // a failed download gets a fresh try next time
  }
  const { data } = await (await worker).recognize(image, {}, { text: true, blocks: true });
  return { text: cleanIngredients(data.text), unsure: unsureWords(data.blocks as Block[] | null) };
}

// paddle.ts — the stronger label reader (066 R3, spec docs/superpowers/specs/2026-10-21-label-reader-v2-design.md):
// PaddleOCR's official browser SDK with the PP-OCRv6 tiny models on ONNX Runtime's plain wasm build, all self-hosted in
// public/paddle/ (scripts/copy-ocr.mjs; models committed with SHA-256 checks), so no request leaves the page. Loaded only
// when a photo is read; ocr.ts falls back to Tesseract if it fails. The SDK gives one score per line, so the letter
// confidences that mark unsure words come from decoding the recognizer's own output here.

type Word = { text: string; conf: number };

/** Greedy CTC decode of one sample (the SDK's rule): the best class per time step, repeats collapsed, blanks (class 0)
 *  dropped. Returns each letter with its probability. */
export function ctcDecode(data: ArrayLike<number>, offset: number, steps: number, classes: number, dict: string[]) {
  const chars: string[] = [], probs: number[] = [];
  let prev = -1;
  for (let t = 0; t < steps; t++) {
    let best = 0, p = -Infinity;
    for (let c = 0; c < classes; c++) { const v = data[offset + t * classes + c]; if (v > p) { p = v; best = c; } }
    if (best > 0 && best !== prev && best - 1 < dict.length) { chars.push(dict[best - 1]); probs.push(p); }
    prev = best;
  }
  return { chars, probs };
}

/** The words of a decoded line, each with its weakest letter's or digit's probability (punctuation stays with its word
 *  but doesn't count: on a curved label the commas are the least sure, and a doubtful comma isn't a doubtful word). */
export function wordConfidences(chars: string[], probs: number[]): Word[] {
  const words: Word[] = [];
  let text = "", conf = 1;
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (text) words.push({ text, conf }); text = ""; conf = 1; }
    else { text += ch; if (/[\p{L}\p{N}]/u.test(ch)) conf = Math.min(conf, probs[i]); }
  });
  if (text) words.push({ text, conf });
  return words;
}

/** Words whose weakest letter is under `cut`, without surrounding punctuation, each once (like Tesseract's unsure words). */
export function unsureByLetters(words: Word[], cut: number): string[] {
  const unsure = new Set<string>();
  for (const w of words) {
    const text = w.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (text && w.conf < cut) unsure.add(text);
  }
  return [...unsure];
}

/** Letters under this probability make their word unsure. Tuned on the 13 R1 photos (526 kept words, 131 not in the
 *  answer key): 0.8 underlines 87 of the 131 and 69 of the 395 right ones; Minh's perfume stays under the retake hint
 *  (5 %) while the blurry, cut-off and angled chip photos (3, 5, 7, 8) still get it. 0.7: 79 / 47; 0.9: 99 / 98. */
export const UNSURE_LETTER = 0.8;

type Tensor = { dims: readonly number[]; data: ArrayLike<number> };
type Session = { run: (...a: unknown[]) => Promise<Record<string, Tensor>> };
type Ocr = { predict: (img: Blob) => Promise<{ items: { text: string }[] }[]>; recModel?: { config?: { charDict?: string[] } } };

let ready: Promise<Ocr> | undefined;
let captured: Tensor[] | null = null; // the recognizer's outputs during one read

async function load(): Promise<Ocr> {
  const dir = new URL(`${import.meta.env.BASE_URL}paddle/`, location.href).href; // the site lives under a sub-path
  const [ort, { PaddleOCR }, wasm] = await Promise.all([import("onnxruntime-web"), import("@paddleocr/paddleocr-js"), fetch(`${dir}ort-wasm-simd-threaded.wasm.gz`)]);
  if (!wasm.ok) throw new Error(`ONNX Runtime wasm: HTTP ${wasm.status}`);
  // Shipped gzipped (GitHub Pages may not compress .wasm) and unpacked here, so ONNX Runtime never fetches it. A server
  // that sends it with "Content-Encoding: gzip" (Vite's) has the browser unpack it already: only gzip bytes get unpacked.
  const bytes = new Uint8Array(await wasm.arrayBuffer());
  ort.env.wasm.wasmBinary = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer() : bytes;
  ort.env.wasm.numThreads = 1; // GitHub Pages can't send the headers threads need
  // Keep each recognizer output (its tensor: samples × steps × classes) to read the letter probabilities ourselves.
  const proto = ort.InferenceSession.prototype as unknown as Session;
  const run = proto.run;
  proto.run = async function (this: Session, ...a: unknown[]) {
    const out = await run.apply(this, a);
    const t = Object.values(out)[0];
    if (captured && t?.dims.length === 3) captured.push(t);
    return out;
  };
  return await PaddleOCR.create({
    textDetectionModelName: "PP-OCRv6_tiny_det", textDetectionModelAsset: { url: `${dir}PP-OCRv6_tiny_det_onnx_infer.tar` },
    textRecognitionModelName: "PP-OCRv6_tiny_rec", textRecognitionModelAsset: { url: `${dir}PP-OCRv6_tiny_rec_onnx_infer.tar` },
    ortOptions: { backend: "wasm", numThreads: 1 },
  }) as unknown as Ocr;
}

/** Reads a label photo: its lines in reading order, and each word with its weakest letter's probability. The first call
 *  downloads the reader (about 13 MB), which the browser then keeps. */
export async function readPaddle(image: Blob): Promise<{ lines: string[]; words: Word[] }> {
  if (!ready) { ready = load(); ready.catch(() => { ready = undefined; }); }
  const ocr = await ready;
  const outs: Tensor[] = captured = [];
  let items: { text: string }[];
  try { items = (await ocr.predict(image))[0]?.items ?? []; } finally { captured = null; }
  // Match decoded samples to lines by their text (the SDK reorders samples by width before recognising them).
  const dict = ocr.recModel?.config?.charDict ?? [];
  const byText = new Map<string, Word[][]>();
  for (const t of outs) {
    const [n, steps, classes] = t.dims;
    for (let i = 0; i < n; i++) {
      const { chars, probs } = ctcDecode(t.data, i * steps * classes, steps, classes, dict);
      const key = chars.join("");
      byText.set(key, [...(byText.get(key) ?? []), wordConfidences(chars, probs)]);
    }
  }
  const lines = items.map(i => i.text);
  // A line we couldn't match keeps its words unsure (confidence 0): better a needless underline than a missed one.
  const words = lines.flatMap(l => byText.get(l)?.shift() ?? wordConfidences([...l], [...l].map(() => 0)));
  return { lines, words };
}

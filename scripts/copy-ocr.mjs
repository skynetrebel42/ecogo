// copy-ocr.mjs — self-host the label reader (M8 spec D4): copies Tesseract.js's worker, its three LSTM core builds
// (the library picks one per device) and the English data into public/tesseract/, which Vite serves and builds into
// dist/. Runs before `npm run dev` and `npm run build`; public/tesseract/ is not committed.
import { cpSync, mkdirSync } from "node:fs";

const out = "public/tesseract";
mkdirSync(out, { recursive: true });
for (const [from, name] of [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
]) cpSync(from, `${out}/${name}`);

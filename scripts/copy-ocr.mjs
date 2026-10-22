// copy-ocr.mjs — self-host the label readers (M8 spec D4; 066 R3). Runs before `npm run dev` and `npm run build`.
// Tesseract (the fallback): its worker, three LSTM core builds (the library picks one per device) and the English data
// go into public/tesseract/ (not committed). PaddleOCR: its two model files are committed in public/paddle/ and checked
// here against the SHA-256 they were downloaded with; ONNX Runtime's plain wasm build goes in gzipped (GitHub Pages may
// not compress .wasm; paddle.ts unpacks it) as public/paddle/ort-* (not committed). Licences: public/paddle/NOTICE.txt.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { basename } from "node:path";

mkdirSync("public/tesseract", { recursive: true });
for (const from of [
  "node_modules/tesseract.js/dist/worker.min.js",
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
]) cpSync(from, `public/tesseract/${basename(from)}`);

for (const [file, sha256] of [
  ["PP-OCRv6_tiny_det_onnx_infer.tar", "ff6ab415b0a6e0c488550f2fb5d5046f1719848df220b2dc21b56402a65bc05d"],
  ["PP-OCRv6_tiny_rec_onnx_infer.tar", "1e13b22717b1edd89d4cde4fda272b6c17d5b505c97c2baea99da1a3a2d54b29"],
]) {
  const got = createHash("sha256").update(readFileSync(`public/paddle/${file}`)).digest("hex");
  if (got !== sha256) throw new Error(`public/paddle/${file}: SHA-256 ${got}, expected ${sha256}`);
}
writeFileSync("public/paddle/ort-wasm-simd-threaded.wasm.gz",
  gzipSync(readFileSync("node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"), { level: 9 }));

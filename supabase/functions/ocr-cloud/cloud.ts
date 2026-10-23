// ocr-cloud's checks and its one call to OCR.space (070 C1, docs/superpowers/specs/2026-10-23-cloud-help-070-design.md).
// Plain Request → Response with the fetch passed in, so Node tests can run it. Stores nothing; logs no image or text.
import { readUpTo } from "../_shared/body.ts";

export const SITE = "https://skynetrebel42.github.io";
export const OCR_SPACE = "https://api.ocr.space/parse/image";
/** OCR.space's free plan takes files up to 1 MB; the app shrinks photos below this. */
export const MAX_PHOTO = 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: { lines: string[] } | { busy: true } | { error: string }) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const busy = () => answer(503, { busy: true });

type Deps = { key: string; publicKeys: string[]; fetch: typeof fetch };

export async function ocrCloud(req: Request, { key, publicKeys, fetch }: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return answer(405, { error: "method" });
  // Cheap guards (planner, spec §4): EcoGo's site and its public key, which anyone can read, so they keep out stray
  // callers, not a determined one. The worst a determined one can do is use up the day's 500 ("busy" until reset).
  if (req.headers.get("origin") !== SITE) return answer(403, { error: "origin" });
  if (!publicKeys.includes(req.headers.get("apikey") ?? "")) return answer(401, { error: "key" });
  if (Number(req.headers.get("content-length")) > MAX_PHOTO) return answer(413, { error: "size" });
  if (req.headers.get("content-type") !== "image/jpeg") return answer(415, { error: "type" });
  const photo = await readUpTo(req, MAX_PHOTO); // 075 M1: stops past 1 MB, with or without Content-Length
  if (!photo) return answer(413, { error: "size" });
  if (photo[0] !== 0xff || photo[1] !== 0xd8 || photo[2] !== 0xff) return answer(415, { error: "type" }); // a JPEG's first bytes
  if (!key) { console.error("OCRSPACE_API_KEY is not set"); return busy(); }

  const form = new FormData();
  form.append("file", new Blob([photo], { type: "image/jpeg" }), "label.jpg");
  form.append("OCREngine", "2"); // OCR.space's all-round engine: photos, rotated text (Engine 3 is slower)
  form.append("scale", "true");
  form.append("detectOrientation", "true"); // sideways labels
  try {
    const r = await fetch(OCR_SPACE, { method: "POST", headers: { apikey: key }, body: form, signal: AbortSignal.timeout(20_000) });
    const json = r.ok ? await r.json() : null;
    if (!json || json.IsErroredOnProcessing || ![1, 2].includes(Number(json.OCRExitCode))) {
      console.error("OCR.space didn't read", r.status, json?.OCRExitCode ?? ""); // never its message: no text, no key
      return busy();
    }
    const text = (json.ParsedResults ?? []).map((p: { ParsedText?: string }) => p.ParsedText ?? "").join("\n");
    return answer(200, { lines: text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean) });
  } catch (err) {
    console.error("OCR.space call failed", (err as Error).name);
    return busy();
  }
}

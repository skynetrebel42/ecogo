import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PHOTO, OCR_SPACE, ocrCloud, SITE } from "./cloud.ts";

// 070 C1 (docs/superpowers/specs/2026-10-23-cloud-help-070-design.md): one label photo in, its text out, nothing kept.
const KEY = "secret-ocr-key", PUBLIC = "sb_publishable_test";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const parsed = (text: string) => Response.json({ ParsedResults: [{ ParsedText: text, FileParseExitCode: 1 }], OCRExitCode: 1, IsErroredOnProcessing: false });

function call(init: { method?: string; origin?: string; apikey?: string; type?: string; body?: Uint8Array } = {},
  answer: () => Promise<Response> | Response = () => parsed("INGREDIENTS: SUGAR,\r\nSALT\r\n")) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(); }) as typeof globalThis.fetch;
  const method = init.method ?? "POST";
  const headers: Record<string, string> = { origin: init.origin ?? SITE, apikey: init.apikey ?? PUBLIC, "content-type": init.type ?? "image/jpeg" };
  const req = new Request("https://x.supabase.co/functions/v1/ocr-cloud", { method, headers, body: method === "POST" ? init.body ?? JPEG : undefined });
  return { calls, res: ocrCloud(req, { key: KEY, publicKeys: [PUBLIC], fetch }) };
}

test("the preflight answers EcoGo's site only", async () => {
  const { res, calls } = call({ method: "OPTIONS" });
  const r = await res;
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), SITE);
  assert.equal(calls.length, 0);
});

test("a call from another site, or without the app's public key, is refused before OCR.space", async () => {
  for (const [init, status] of [[{ origin: "https://evil.example" }, 403], [{ apikey: "" }, 401], [{ apikey: "sb_publishable_other" }, 401]] as const) {
    const { res, calls } = call(init);
    assert.equal((await res).status, status, JSON.stringify(init));
    assert.equal(calls.length, 0);
  }
});

test("only a JPEG photo of 1 MB or less is sent on", async () => {
  const cases = [
    [{ type: "text/plain" }, 415], [{ body: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }, 415], // a PDF called a JPEG
    [{ body: new Uint8Array(0) }, 415],
    [{ body: (() => { const b = new Uint8Array(MAX_PHOTO + 1); b.set(JPEG); return b; })() }, 413],
  ] as const;
  for (const [init, status] of cases) {
    const { res, calls } = call(init);
    assert.equal((await res).status, status, JSON.stringify(init).slice(0, 80));
    assert.equal(calls.length, 0);
  }
});

test("a photo goes to OCR.space once, with the key in a header, and only the text comes back", async () => {
  const { res, calls } = call();
  const r = await res;
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { lines: ["INGREDIENTS: SUGAR,", "SALT"] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OCR_SPACE);
  assert.equal(new Headers(calls[0].init.headers).get("apikey"), KEY);
  const form = calls[0].init.body as FormData;
  assert.equal(form.get("OCREngine"), "2");
  assert.deepEqual(new Uint8Array(await (form.get("file") as Blob).arrayBuffer()), JPEG);
});

test("OCR.space's limit, an error or no answer is 'busy', and never echoes the key", async () => {
  const answers: (() => Promise<Response> | Response)[] = [
    () => new Response(`You may only perform this action upto maximum 500 number of times within 86400 seconds (key ${KEY})`, { status: 403 }),
    () => Response.json({ OCRExitCode: 3, IsErroredOnProcessing: true, ErrorMessage: [`bad ${KEY}`] }),
    () => Promise.reject(new Error("timeout")),
    () => new Response("<html>", { status: 200 }),
  ];
  for (const answer of answers) {
    const r = await call({}, answer).res;
    assert.equal(r.status, 503);
    const body = await r.text();
    assert.deepEqual(JSON.parse(body), { busy: true });
    assert.ok(!body.includes(KEY));
  }
});

test("with no key set, it answers 'busy' without calling OCR.space", async () => {
  const calls: unknown[] = [];
  const req = new Request("https://x/ocr-cloud", { method: "POST", headers: { origin: SITE, apikey: PUBLIC, "content-type": "image/jpeg" }, body: JPEG });
  const r = await ocrCloud(req, { key: "", publicKeys: [PUBLIC], fetch: (async () => { calls.push(1); return parsed(""); }) as typeof fetch });
  assert.equal(r.status, 503);
  assert.equal(calls.length, 0);
});

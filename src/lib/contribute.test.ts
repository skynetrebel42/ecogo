import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { submitProduct, type ContributeClient, type SendStage } from "./contribute.ts";

const CODE = "0123456789012";
const jpeg = (s: string) => new Blob([s], { type: "image/jpeg" });
const URL_ = "https://example.supabase.co/functions/v1/off-submit";

/** What off-submit answers: a status and a body (an object is sent as JSON), or no answer at all. */
// silent: uploaded, then no answer; stall: the upload never moves; trickle: one progress event at 50 s, then nothing
type Reply = { status: number; body: unknown } | "network" | "timeout" | "silent" | "stall" | "trickle";
let reply: Reply = { status: 200, body: { ok: true } };
let calls: string[] = [];
let request: { headers: Record<string, string>; body: FormData } | undefined;

/** A stub XMLHttpRequest (follow-up 4, P1): reports upload progress 30 % → 100 %, then answers with `reply`. */
class FakeXHR {
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void; onload?: () => void } = {};
  status = 0; responseText = ""; timeout = 0;
  onload?: () => void; onerror?: () => void; ontimeout?: () => void; onabort?: () => void;
  private url = ""; private headers: Record<string, string> = {};
  open(method: string, url: string) { this.url = `${method} ${url}`; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  abort() { this.onabort?.(); }
  send(body: FormData) {
    calls.push(this.url === `POST ${URL_}` ? "send off-submit" : `send ${this.url}`);
    request = { headers: this.headers, body };
    if (reply === "stall") return;
    if (reply === "trickle") { setTimeout(() => this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 }), 50_000); return; }
    setTimeout(() => {
      if (reply === "network") return this.onerror?.();
      if (reply === "timeout") return this.abort(); // the app's wait after the upload ran out
      for (const loaded of [30, 100]) this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 });
      this.upload.onload?.();
      if (reply === "silent") return;
      this.status = reply.status;
      this.responseText = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
      this.onload?.();
    });
  }
}
(globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXHR;

/** A fake Supabase auth: `session` says whether someone is signed in; signing in makes a session. */
function fakeClient(opts: { session?: boolean; signInError?: boolean; signInHangs?: boolean; reply?: Reply } = {}) {
  calls = []; request = undefined; reply = opts.reply ?? { status: 200, body: { ok: true } };
  let signedIn = !!opts.session;
  const client: ContributeClient = {
    functionUrl: URL_,
    apikey: "publishable-key",
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: "user-jwt" } : null } }),
      signInAnonymously: async ({ options }) => {
        calls.push(`signIn ${options.captchaToken}`);
        if (opts.signInHangs) return new Promise(() => {});
        if (!opts.signInError) signedIn = true;
        return { error: opts.signInError ? new Error("captcha verification process failed") : null };
      },
      signOut: async ({ scope }) => { calls.push(`signOut ${scope}`); return { error: null }; },
    },
  };
  return { client, calls: () => calls, sent: () => request?.body };
}
/** off-submit answering with a non-2xx status and a JSON body. */
const httpError = (status: number, body: unknown): Reply => ({ status, body });
const ok = (body: unknown): Reply => ({ status: 200, body });
const token = async () => "turnstile-token";
const input = { code: CODE, ingredients: "Sugar, Red 40" };

test("a first-time sender is signed in anonymously with the human-check token, then the product is sent", async () => {
  const f = fakeClient();
  const r = await submitProduct({ ...input, name: "Gummy bears", photos: { front: jpeg("f"), ingredients: jpeg("i") } }, token, f.client);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(f.calls(), ["signIn turnstile-token", "send off-submit"]);
  assert.deepEqual(request!.headers, { Authorization: "Bearer user-jwt", apikey: "publishable-key" });
  const body = f.sent()!;
  assert.equal(body.get("code"), CODE);
  assert.equal(body.get("ingredients"), "Sugar, Red 40");
  assert.equal(body.get("name"), "Gummy bears");
  assert.equal(await (body.get("front") as File).text(), "f");
  assert.equal(await (body.get("ingredients_photo") as File).text(), "i");
  assert.equal(body.has("nutrition"), false, "skipped photos aren't sent");
});

// M8 follow-up 5, J2: new photos for a product OFF has, without text or name.
test("a photos-only send carries mode=photos and the photos, never the text or the name", async () => {
  const f = fakeClient({ session: true });
  const r = await submitProduct({ code: CODE, ingredients: "", name: "Gummy bears", photosOnly: true, photos: { nutrition: jpeg("n") } }, token, f.client);
  assert.deepEqual(r, { ok: true });
  const body = f.sent()!;
  assert.equal(body.get("mode"), "photos");
  assert.equal(await (body.get("nutrition") as File).text(), "n");
  assert.equal(body.has("ingredients"), false);
  assert.equal(body.has("name"), false);
  const g = fakeClient({ session: true });
  assert.deepEqual(await submitProduct({ code: CODE, ingredients: "", photosOnly: true, photos: {} }, token, g.client),
    { ok: false, reason: "invalid" }, "no photo: nothing to send");
  assert.deepEqual(g.calls(), [], "nothing reached the server");
});

test("someone already signed in isn't asked for a human check again", async () => {
  const f = fakeClient({ session: true });
  let asked = false;
  const r = await submitProduct({ ...input, photos: {} }, async () => { asked = true; return "t"; }, f.client);
  assert.deepEqual(r, { ok: true });
  assert.equal(asked, false);
  assert.deepEqual(f.calls(), ["send off-submit"]);
  assert.equal(f.sent()!.has("name"), false);
});

// M8 follow-up 4 (docs/superpowers/specs/2026-10-09-m8-followup4-send-progress-design.md P1).
test("the send reports its stages: human check, upload with rising percents, then saving", async () => {
  const stages: SendStage[] = [];
  await submitProduct({ ...input, photos: { front: jpeg("f") } }, token, fakeClient().client, s => stages.push(s));
  assert.deepEqual(stages, [{ stage: "check" }, { stage: "upload", percent: 0 }, { stage: "upload", percent: 30 },
    { stage: "upload", percent: 100 }, { stage: "saving" }]);
  const again: SendStage[] = [];
  await submitProduct({ ...input, photos: {} }, token, fakeClient({ session: true }).client, s => again.push(s));
  assert.equal(again[0].stage, "upload", "no human check when already signed in");
});

test("no session even after signing in means the human check failed; nothing is sent", async () => {
  const f = fakeClient();
  f.client.auth.getSession = async () => ({ data: { session: null } });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "captcha" });
  assert.deepEqual(f.calls(), ["signIn turnstile-token"]);
});

test("a failed human check stops before anything is sent", async () => {
  const f = fakeClient({ signInError: true });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "captcha" });
  assert.deepEqual(f.calls(), ["signIn turnstile-token"]);

  const g = fakeClient();
  const r = await submitProduct({ ...input, photos: {} }, async () => { throw new Error("Turnstile didn't load"); }, g.client);
  assert.deepEqual(r, { ok: false, reason: "captcha" });
  assert.deepEqual(g.calls(), []);
});

test("the server's limit answers come back as their reasons", async () => {
  for (const reason of ["limit-you", "limit-tries", "limit-all", "invalid", "off-down", "photo-rejected"] as const) {
    const f = fakeClient({ session: true, reply: httpError(reason.startsWith("limit") ? 429 : 400, { ok: false, reason }) });
    assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason });
  }
});

test("when Open Food Facts already had the ingredients, the result says the text was kept", async () => {
  const f = fakeClient({ session: true, reply: ok({ ok: true, textKept: true }) });
  assert.deepEqual(await submitProduct({ ...input, photos: { front: jpeg("f") } }, token, f.client), { ok: true, textKept: true });
  const g = fakeClient({ session: true, reply: httpError(409, { ok: false, reason: "nothing-new" }) });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, g.client), { ok: false, reason: "nothing-new" });
});

test("a send where some photos didn't go through is still sent, naming only known photo kinds (048 G2)", async () => {
  const f = fakeClient({ session: true, reply: ok({ ok: true, textKept: false, failedPhotos: ["nutrition", "junk"] }) });
  assert.deepEqual(await submitProduct({ ...input, photos: { nutrition: jpeg("n") } }, token, f.client), { ok: true, failedPhotos: ["nutrition"] });
});

test("photos still uploading in the background come back as pendingPhotos, known kinds only (049 H1)", async () => {
  const f = fakeClient({ session: true, reply: ok({ ok: true, pendingPhotos: ["front", "nutrition", "x"] }) });
  assert.deepEqual(await submitProduct({ ...input, photos: { front: jpeg("f") } }, token, f.client), { ok: true, pendingPhotos: ["front", "nutrition"] });
});

test("a session the server no longer accepts is dropped, so Try again signs in afresh", async () => {
  const f = fakeClient({ session: true, reply: httpError(401, { ok: false, reason: "captcha" }) });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "captcha" });
  assert.deepEqual(f.calls(), ["send off-submit", "signOut local"]);
});

// 055 E2: with no reply EcoGo can't know whether it arrived, so it doesn't say "Not sent".
test("no answer, a timeout, or an answer that isn't EcoGo's, means we don't know whether it arrived", async () => {
  for (const r of ["network", "timeout", httpError(500, { message: "boom" }), httpError(502, "<html>"), ok({ ok: "yes" }),
    httpError(502, { ok: false, reason: "who-knows" })] as Reply[]) {
    const f = fakeClient({ session: true, reply: r });
    assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "unknown" }, JSON.stringify(r));
  }
});

// 055 E1a: Close is locked while sending, so every send must end.
const settles = async (p: Promise<unknown>, ms: number) => {
  let done = false; void p.then(() => { done = true; });
  await new Promise(r => setImmediate(r)); // let the send reach its wait
  mock.timers.tick(ms); await new Promise(r => setImmediate(r));
  return done;
};
test("no human-check token within 60 s ends the send as captcha, with no sign-in", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const f = fakeClient();
    const p = submitProduct({ ...input, photos: {} }, () => new Promise<string>(() => {}), f.client);
    assert.equal(await settles(p, 59_999), false);
    assert.equal(await settles(p, 1), true);
    assert.deepEqual(await p, { ok: false, reason: "captcha" });
    assert.deepEqual(f.calls(), []);
  } finally { mock.timers.reset(); }
});

test("no answer within 90 s after the upload's last byte ends the send as unknown", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const f = fakeClient({ session: true, reply: "silent" });
    const p = submitProduct({ ...input, photos: {} }, token, f.client);
    assert.equal(await settles(p, 0), false, "uploaded, waiting for the answer");
    assert.equal(await settles(p, 89_999), false);
    assert.equal(await settles(p, 1), true);
    assert.deepEqual(await p, { ok: false, reason: "unknown" });
  } finally { mock.timers.reset(); }
});

// 055 E1b: the last two ways a send could hang.
test("an upload with no progress for 60 s ends as unknown; each progress event restarts the 60 s", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const f = fakeClient({ session: true, reply: "stall" });
    const p = submitProduct({ ...input, photos: {} }, token, f.client);
    assert.equal(await settles(p, 59_999), false);
    assert.equal(await settles(p, 1), true);
    assert.deepEqual(await p, { ok: false, reason: "unknown" });

    const g = fakeClient({ session: true, reply: "trickle" });
    const q = submitProduct({ ...input, photos: {} }, token, g.client);
    assert.equal(await settles(q, 50_000), false, "a slow upload that moves isn't cut off");
    assert.equal(await settles(q, 59_999), false);
    assert.equal(await settles(q, 1), true);
    assert.deepEqual(await q, { ok: false, reason: "unknown" });
  } finally { mock.timers.reset(); }
});

test("an anonymous sign-in with no answer in 60 s is Not sent (off-down): nothing left the phone", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const f = fakeClient({ signInHangs: true });
    const p = submitProduct({ ...input, photos: {} }, token, f.client);
    assert.equal(await settles(p, 59_999), false);
    assert.equal(await settles(p, 1), true);
    assert.deepEqual(await p, { ok: false, reason: "off-down" });
    assert.deepEqual(f.calls(), ["signIn turnstile-token"], "nothing sent");
  } finally { mock.timers.reset(); }
});

test("off-submit's own off-down answer (502 with its JSON) stays off-down", async () => {
  const f = fakeClient({ session: true, reply: httpError(502, { ok: false, reason: "off-down" }) });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "off-down" });
});

test("empty ingredients or a malformed barcode are refused without signing in or sending", async () => {
  const f = fakeClient();
  assert.deepEqual(await submitProduct({ code: CODE, ingredients: "   ", photos: {} }, token, f.client), { ok: false, reason: "invalid" });
  assert.deepEqual(await submitProduct({ code: "12-34", ingredients: "Water", photos: {} }, token, f.client), { ok: false, reason: "invalid" });
  assert.deepEqual(f.calls(), []);
});

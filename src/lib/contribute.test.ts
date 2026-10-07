import { test } from "node:test";
import assert from "node:assert/strict";
import { submitProduct, type ContributeClient } from "./contribute.ts";

const CODE = "0123456789012";
const jpeg = (s: string) => new Blob([s], { type: "image/jpeg" });

/** A fake Supabase client: `session` says whether someone is signed in, `reply` is what off-submit answers. */
function fakeClient(opts: {
  session?: boolean;
  signInError?: boolean;
  reply?: { data: unknown; error: unknown };
} = {}) {
  const calls: string[] = [];
  let sent: FormData | undefined;
  const client: ContributeClient = {
    auth: {
      getSession: async () => ({ data: { session: opts.session ? {} : null } }),
      signInAnonymously: async ({ options }) => {
        calls.push(`signIn ${options.captchaToken}`);
        return { error: opts.signInError ? new Error("captcha verification process failed") : null };
      },
    },
    functions: {
      invoke: async (name, { body }) => {
        calls.push(`invoke ${name}`);
        sent = body;
        return opts.reply ?? { data: { ok: true }, error: null };
      },
    },
  };
  return { client, calls, sent: () => sent };
}
/** off-submit answering with a non-2xx status: supabase-js returns the Response as `error.context`. */
const httpError = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });
const token = async () => "turnstile-token";
const input = { code: CODE, ingredients: "Sugar, Red 40" };

test("a first-time sender is signed in anonymously with the human-check token, then the product is sent", async () => {
  const f = fakeClient();
  const r = await submitProduct({ ...input, name: "Gummy bears", photos: { front: jpeg("f"), ingredients: jpeg("i") } }, token, f.client);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(f.calls, ["signIn turnstile-token", "invoke off-submit"]);
  const body = f.sent()!;
  assert.equal(body.get("code"), CODE);
  assert.equal(body.get("ingredients"), "Sugar, Red 40");
  assert.equal(body.get("name"), "Gummy bears");
  assert.equal(await (body.get("front") as File).text(), "f");
  assert.equal(await (body.get("ingredients_photo") as File).text(), "i");
  assert.equal(body.has("nutrition"), false, "skipped photos aren't sent");
});

test("someone already signed in isn't asked for a human check again", async () => {
  const f = fakeClient({ session: true });
  let asked = false;
  const r = await submitProduct({ ...input, photos: {} }, async () => { asked = true; return "t"; }, f.client);
  assert.deepEqual(r, { ok: true });
  assert.equal(asked, false);
  assert.deepEqual(f.calls, ["invoke off-submit"]);
  assert.equal(f.sent()!.has("name"), false);
});

test("a failed human check stops before anything is sent", async () => {
  const f = fakeClient({ signInError: true });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason: "captcha" });
  assert.deepEqual(f.calls, ["signIn turnstile-token"]);

  const g = fakeClient();
  const r = await submitProduct({ ...input, photos: {} }, async () => { throw new Error("Turnstile didn't load"); }, g.client);
  assert.deepEqual(r, { ok: false, reason: "captcha" });
  assert.deepEqual(g.calls, []);
});

test("the server's limit answers come back as their reasons", async () => {
  for (const reason of ["limit-you", "limit-all", "invalid", "off-down"] as const) {
    const f = fakeClient({ session: true, reply: httpError(reason.startsWith("limit") ? 429 : 400, { ok: false, reason }) });
    assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, f.client), { ok: false, reason });
  }
});

test("no answer, or one EcoGo doesn't recognise, means Open Food Facts didn't answer", async () => {
  const down = fakeClient({ session: true, reply: { data: null, error: new Error("Failed to send a request to the Edge Function") } });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, down.client), { ok: false, reason: "off-down" });
  const odd = fakeClient({ session: true, reply: httpError(500, { message: "boom" }) });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, odd.client), { ok: false, reason: "off-down" });
  const html = fakeClient({ session: true, reply: { data: null, error: { context: new Response("<html>", { status: 502 }) } } });
  assert.deepEqual(await submitProduct({ ...input, photos: {} }, token, html.client), { ok: false, reason: "off-down" });
});

test("empty ingredients or a malformed barcode are refused without signing in or sending", async () => {
  const f = fakeClient();
  assert.deepEqual(await submitProduct({ code: CODE, ingredients: "   ", photos: {} }, token, f.client), { ok: false, reason: "invalid" });
  assert.deepEqual(await submitProduct({ code: "12-34", ingredients: "Water", photos: {} }, token, f.client), { ok: false, reason: "invalid" });
  assert.deepEqual(f.calls, []);
});

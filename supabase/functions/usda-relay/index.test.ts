// usda-relay tests (Node). Spec: docs/superpowers/specs/2026-10-02-m75-usda-key-relay-design.md §6.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "./index.ts";

const SITE = "https://skynetrebel42.github.io";
const FN = "https://example.supabase.co/functions/v1/usda-relay";
const FOODS = JSON.stringify({ totalHits: 1, foods: [{ fdcId: 1, gtinUpc: "049000042566" }] });

/** A fake USDA that records the upstream URL and answers with `status` and `body` (or throws). */
function fakeUsda(status = 200, body = FOODS) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (status === 0) throw new TypeError("network down");
    return new Response(body, { status });
  }) as typeof fetch;
  return { impl, calls };
}
const req = (query: string, init: { origin?: string | null; method?: string } = {}) => {
  const headers = new Headers();
  if (init.origin !== null) headers.set("Origin", init.origin ?? SITE);
  return new Request(`${FN}${query}`, { method: init.method ?? "GET", headers });
};
const OK = "?query=049000042566&pageSize=5";

test("an allowed origin gets USDA's JSON unchanged, with the CORS header", async () => {
  for (const origin of [SITE, "http://localhost:5173", "http://127.0.0.1:4317"]) {
    const usda = fakeUsda();
    const res = await handle(req(OK, { origin }), { key: "KEY" }, usda.impl);
    assert.equal(res.status, 200, origin);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(await res.text(), FOODS);
  }
});

test("another website, a look-alike or a missing Origin gets 403 and USDA is never called", async () => {
  for (const origin of ["https://evil.example", "https://skynetrebel42.github.io.evil.example", "http://localhost.evil.example", null]) {
    const usda = fakeUsda();
    const res = await handle(req(OK, { origin }), { key: "KEY" }, usda.impl);
    assert.equal(res.status, 403, String(origin));
    assert.equal(usda.calls.length, 0);
  }
});

test("GET only: OPTIONS is 204 (preflight), anything else 405", async () => {
  const usda = fakeUsda();
  const pre = await handle(req(OK, { method: "OPTIONS" }), { key: "KEY" }, usda.impl);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal((await handle(req(OK, { method: "POST" }), { key: "KEY" }, usda.impl)).status, 405);
  assert.equal(usda.calls.length, 0);
});

test("a missing, blank or over-long query, or a pageSize other than 5 or 15, is 400", async () => {
  const usda = fakeUsda();
  for (const q of ["?pageSize=5", "?query=%20%20&pageSize=5", `?query=${"a".repeat(101)}&pageSize=15`, "?query=oreo&pageSize=99", "?query=oreo"]) {
    assert.equal((await handle(req(q), { key: "KEY" }, usda.impl)).status, 400, q);
  }
  assert.equal(usda.calls.length, 0);
  assert.equal((await handle(req(`?query=${"a".repeat(100)}&pageSize=15`), { key: "KEY" }, usda.impl)).status, 200);
});

test("only query and pageSize are forwarded: the upstream URL is fixed and holds exactly four parameters", async () => {
  const usda = fakeUsda();
  await handle(req("?query=ice%20cream&pageSize=15&api_key=EVIL&dataType=Foundation&url=https://evil.example"), { key: "KEY" }, usda.impl);
  const up = new URL(usda.calls[0]);
  assert.equal(`${up.origin}${up.pathname}`, "https://api.nal.usda.gov/fdc/v1/foods/search");
  assert.deepEqual([...up.searchParams.keys()].sort(), ["api_key", "dataType", "pageSize", "query"]);
  assert.equal(up.searchParams.get("api_key"), "KEY");
  assert.equal(up.searchParams.get("dataType"), "Branded");
  assert.equal(up.searchParams.get("pageSize"), "15");
  assert.equal(up.searchParams.get("query"), "ice cream");
});

test("USDA errors keep their status but never USDA's body or the key; a network failure is 502", async () => {
  const res = await handle(req(OK), { key: "KEY" }, fakeUsda(429, "rate limited for api_key=KEY").impl);
  assert.equal(res.status, 429);
  const body = await res.text();
  assert.deepEqual(JSON.parse(body), { error: "USDA returned HTTP 429" });
  assert.ok(!body.includes("KEY"));
  assert.equal((await handle(req(OK), { key: "KEY" }, fakeUsda(0).impl)).status, 502);
});

test("a 200 body that contains the key is not passed through", async () => {
  const res = await handle(req(OK), { key: "SECRETKEY" }, fakeUsda(200, '{"foods":[],"echo":"SECRETKEY"}').impl);
  assert.equal(res.status, 502);
  assert.ok(!(await res.text()).includes("SECRETKEY"));
});

test("no secret is 500 'relay is not configured'; a pasted secret is trimmed", async () => {
  const none = await handle(req(OK), { key: undefined }, fakeUsda().impl);
  assert.equal(none.status, 500);
  assert.deepEqual(await none.json(), { error: "relay is not configured" });
  assert.equal((await handle(req(OK), { key: "  \n" }, fakeUsda().impl)).status, 500);
  const usda = fakeUsda();
  await handle(req(OK), { key: " KEY\n" }, usda.impl);
  assert.equal(new URL(usda.calls[0]).searchParams.get("api_key"), "KEY");
});

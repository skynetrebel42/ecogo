import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSource, verdict } from "./sourceCheck.ts";

const LONG = "x ".repeat(3000);
const answer = (body: string, type = "text/html", status = 200) => async () => new Response(body, { status, headers: { "content-type": type } });
const src = (o: { checkedByHand?: string } = {}) => ({ url: "https://example.org/a", quote: "Glycidol is “genotoxic”", ...o });

test("checkSource: the quote on the page passes; missing from a full page fails; JSON answers are text", async () => {
  assert.equal((await checkSource(src(), answer(`<p>${LONG} glycidol is "genotoxic" </p>`))).status, "pass");
  assert.equal((await checkSource(src(), answer(`<p>${LONG}</p>`))).status, "fail");
  assert.equal((await checkSource(src(), answer(`{"text":"glycidol is \\u201c"} ${LONG}`, "application/json"))).status, "fail");
  assert.equal((await checkSource({ url: "u", quote: '"amount":57.74' }, answer('{"name":"x","amount":57.74}', "application/json; charset=utf-8"))).status, "pass");
  // EUR-Lex prints "reﬁned" with the ﬁ ligature
  assert.equal((await checkSource({ url: "u", quote: "highest levels in refined vegetable oils" }, answer(`<p>${LONG} highest levels in reﬁned vegetable oils</p>`))).status, "pass");
});

test("checkSource: blocked, PDF, script-rendered or unreachable pages are unverifiable, with why", async () => {
  assert.deepEqual(await checkSource(src(), answer("", "text/html", 403)), { status: "unverifiable", detail: "HTTP 403" });
  assert.deepEqual(await checkSource(src(), answer("%PDF", "application/pdf")), { status: "unverifiable", detail: "application/pdf" });
  assert.deepEqual(await checkSource(src(), answer("<div id=app></div>")), { status: "unverifiable", detail: "page is script-rendered or bot-gated" });
  assert.deepEqual(await checkSource(src(), async () => { throw new Error("fetch failed"); }), { status: "unverifiable", detail: "fetch failed" });
});

test("verdict (S1): fails on any fail, on 0 passes, and on an unverifiable source with no hand-check date", () => {
  const pass = { status: "pass" as const, source: src() };
  const fail = { status: "fail" as const, source: src() };
  const undated = { status: "unverifiable" as const, source: src() };
  const dated = { status: "unverifiable" as const, source: src({ checkedByHand: "2026-10-16" }) };
  const badDate = { status: "unverifiable" as const, source: src({ checkedByHand: "yes" }) };
  assert.deepEqual(verdict([pass, pass]), { exit: 0, undated: [] });
  assert.deepEqual(verdict([pass, dated]), { exit: 0, undated: [] });
  assert.deepEqual(verdict([pass, fail]), { exit: 1, undated: [] });
  assert.deepEqual(verdict([pass, undated]), { exit: 1, undated: [undated.source] });
  assert.deepEqual(verdict([pass, badDate]), { exit: 1, undated: [badDate.source] });
  assert.deepEqual(verdict([dated, dated]), { exit: 1, undated: [] }); // offline: nothing passed
  assert.deepEqual(verdict([]), { exit: 1, undated: [] });
});

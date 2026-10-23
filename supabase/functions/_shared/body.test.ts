import { test } from "node:test";
import assert from "node:assert/strict";
import { readUpTo } from "./body.ts";

// 075 M1 (audit S3): a body sent without Content-Length (streamed), in 4 KB chunks.
const streamed = (chunks: number) => {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({ pull(c) { if (sent++ === chunks) c.close(); else c.enqueue(new Uint8Array(4096).fill(0x61)); } });
  return { req: new Request("https://x/", { method: "POST", body, duplex: "half" } as RequestInit), sent: () => sent };
};

test("a streamed body within the limit comes back whole", async () => {
  const s = streamed(2);
  assert.equal((await readUpTo(s.req, 8 * 1024))?.length, 8 * 1024);
});

test("a streamed body over the limit is refused after being read to its end, so the reply always comes", async () => {
  const s = streamed(64);
  assert.equal(await readUpTo(s.req, 8 * 1024), null);
  assert.equal(s.sent(), 65, "read to the end (the stream closed), not left mid-upload");
});

test("no body is an empty one", async () => {
  assert.equal((await readUpTo(new Request("https://x/", { method: "POST" }), 10))?.length, 0);
});

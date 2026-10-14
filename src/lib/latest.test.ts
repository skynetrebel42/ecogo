import { test } from "node:test";
import assert from "node:assert/strict";
import { latestWins } from "./latest.ts";

// RW1-01 "latest photo wins": a slow read must never overwrite newer state. Each scenario below mirrors the screens'
// code: `begin()` when a photo, crop, Type it, Skip, Retake, Close or reset happens; after every await, drop the result
// unless its own check is still true. Reads are deferred promises resolved by hand, in any order.
const deferred = <T,>() => { let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
type Screen = { step: string; text: string; photo?: string };

/** A screen like AddProductFlow's ingredients step: a photo is read, then the check step shows its text. */
function screen(read: (photo: string) => Promise<string>) {
  const begin = latestWins();
  const s: Screen = { step: "ingredients", text: "" };
  return {
    s,
    async photo(name: string) {
      const live = begin();
      s.step = "reading";
      try {
        const text = await read(name);
        if (!live()) return;
        s.photo = name; s.text = text; s.step = "check";
      } catch {
        if (!live()) return;
        s.text = ""; s.step = "check";
      }
    },
    typeIt(text: string) { begin(); s.photo = undefined; s.step = "check"; s.text = text; },
    close() { begin(); },
  };
}

test("(a) Type it while photo A is still being read: A's late text doesn't replace the typed text or the step", async () => {
  const a = deferred<string>();
  const flow = screen(() => a.promise);
  const pending = flow.photo("A");
  flow.typeIt("Red lentils");
  a.resolve("junk from A"); await pending;
  assert.deepEqual(flow.s, { step: "check", text: "Red lentils", photo: undefined });
});

test("(b) photo A, then photo B: B's photo and text win whichever read finishes first", async () => {
  for (const order of [["A", "B"], ["B", "A"]]) {
    const reads: Record<string, ReturnType<typeof deferred<string>>> = { A: deferred(), B: deferred() };
    const flow = screen(p => reads[p].promise);
    const done = [flow.photo("A"), flow.photo("B")];
    for (const p of order) { reads[p].resolve(`text of ${p}`); await Promise.resolve(); }
    await Promise.all(done);
    assert.deepEqual(flow.s, { step: "check", text: "text of B", photo: "B" }, `resolved ${order.join(" then ")}`);
  }
});

test("(c) a stale failure doesn't replace newer state", async () => {
  const reads: Record<string, ReturnType<typeof deferred<string>>> = { A: deferred(), B: deferred() };
  const flow = screen(p => reads[p].promise);
  const a = flow.photo("A"), b = flow.photo("B");
  reads.B.resolve("text of B"); await b;
  reads.A.reject(new Error("reader failed")); await a;
  assert.deepEqual(flow.s, { step: "check", text: "text of B", photo: "B" });
});

test("(d) Close, then reopen: the new screen gets nothing from the old one's read", async () => {
  const a = deferred<string>();
  const old = screen(() => a.promise);
  const pending = old.photo("A");
  old.close();
  const reopened = screen(() => new Promise(() => {}));
  a.resolve("text of A"); await pending;
  assert.deepEqual(reopened.s, { step: "ingredients", text: "" });
  assert.equal(old.s.text, "", "the closed screen drops it too");
});

test("an intentional retake still works: the newest photo is always read and shown", async () => {
  const flow = screen(async p => `text of ${p}`);
  await flow.photo("A");
  await flow.photo("A again");
  assert.deepEqual(flow.s, { step: "check", text: "text of A again", photo: "A again" });
});

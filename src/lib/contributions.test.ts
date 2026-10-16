import { test } from "node:test";
import assert from "node:assert/strict";
import { milestones, productCount, justReached, readContributions } from "./contributions.ts";

test("milestones: reached badges, and the next one with how many to go", () => {
  assert.deepEqual(milestones(0), { reached: [], next: { badge: "First help", toGo: 1 } });
  assert.deepEqual(milestones(1), { reached: ["First help"], next: { badge: "5 helps", toGo: 4 } });
  assert.deepEqual(milestones(4), { reached: ["First help"], next: { badge: "5 helps", toGo: 1 } });
  assert.deepEqual(milestones(5), { reached: ["First help", "5 helps"], next: { badge: "10 helps", toGo: 5 } });
  assert.deepEqual(milestones(49).next, { badge: "50 helps", toGo: 1 });
  assert.equal(milestones(49).reached.length, 4);
  assert.deepEqual(milestones(50), { reached: ["First help", "5 helps", "10 helps", "25 helps", "50 helps"] });
  assert.deepEqual(milestones(51), milestones(50));
});

test("products count distinct barcodes: two sends of one barcode count once", () => {
  assert.equal(productCount([]), 0);
  assert.equal(productCount(["111", "222", "111"]), 2);
});

test("justReached: only when this send added a new barcode and the total lands on a milestone", () => {
  assert.equal(justReached(["111"], "111", 0), "First help");
  assert.equal(justReached(["111", "111"], "111", 0), undefined); // a second send of one barcode adds nothing
  assert.equal(justReached(["111", "222"], "222", 0), undefined); // total 2
  assert.equal(justReached(["1", "2", "3", "4"], "4", 1), "5 helps"); // 4 products + 1 approved map fix
  assert.equal(justReached(["1"], "9", 0), undefined); // this send isn't counted (read before the row): no line
});

/** A fake Supabase client: a session or none, and the two answers. */
function fakeClient(o: { session?: boolean; barcodes?: string[]; places?: number; fail?: boolean; refreshFailed?: boolean }) {
  const calls: string[] = [];
  const query = (table: string) => {
    const q = {
      filters: [] as string[],
      select(cols: string, opts?: { count?: string; head?: boolean }) { calls.push(`${table}.select(${cols}${opts?.head ? ",head" : ""})`); return q; },
      eq(col: string, v: string) {
        calls.push(`${table}.eq(${col},${v})`);
        const error = o.fail ? { message: "down" } : null;
        return Promise.resolve(table === "contributions"
          ? { data: o.fail ? null : (o.barcodes ?? []).map(barcode => ({ barcode })), error }
          : { count: o.fail ? null : o.places ?? 0, error });
      },
    };
    return q;
  };
  return {
    calls,
    client: {
      auth: { async getSession() { return { data: { session: o.session ? { access_token: "t" } : null }, error: o.refreshFailed ? { message: "offline" } : null }; } },
      from: query,
    },
  };
}

test("readContributions: no session reads nothing; a session reads own sent barcodes and approved place count", async () => {
  const none = fakeClient({});
  assert.equal(await readContributions(none.client), "none");
  assert.deepEqual(none.calls, []);

  const mine = fakeClient({ session: true, barcodes: ["111", "111", "222"], places: 3 });
  assert.deepEqual(await readContributions(mine.client), { barcodes: ["111", "111", "222"], places: 3 });
  assert.deepEqual(mine.calls.sort(), [
    "contributions.eq(status,sent)", "contributions.select(barcode)",
    "place_reports.eq(status,approved)", "place_reports.select(id,head)",
  ]);

  assert.equal(await readContributions(fakeClient({ session: true, fail: true }).client), null);
  // a stored session whose refresh failed: a failed read, never zeros
  const offline = fakeClient({ refreshFailed: true });
  assert.equal(await readContributions(offline.client), null);
  assert.deepEqual(offline.calls, []);
});

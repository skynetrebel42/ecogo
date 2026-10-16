import { test } from "node:test";
import assert from "node:assert/strict";
import { limitReason, placeRow, placeSubmit, type PlaceDb, type PlaceRow } from "./place.ts";

// M8.1 (docs/superpowers/specs/2026-10-15-m81-suggest-report-design.md P1, P2, P4, P4a).
const SUGGEST = {
  kind: "suggest", name: " Westside Pantry ", address: "Pico & Bundy", offers: "Food pantry", who: "Anyone",
  link: "https://westsidepantry.org", note: "Open Saturdays",
};
const REPORT = { kind: "report", placeRef: "node/123", name: "Westside Pantry", wrong: "Closed for good", note: "" };

test("a suggestion keeps its fields, trimmed, with no place_ref; unknown fields are dropped", () => {
  assert.deepEqual(placeRow({ ...SUGGEST, userId: "someone-else", status: "approved", extra: "x" }), {
    kind: "suggest", place_ref: null,
    fields: { name: "Westside Pantry", address: "Pico & Bundy", offers: "Food pantry", who: "Anyone", link: "https://westsidepantry.org", note: "Open Saturdays" },
  });
  assert.equal(placeRow({ ...SUGGEST, note: "  " })?.fields.note, undefined);
});

test("a suggestion needs a name, an address, an offer, who can use it and an https:// link", () => {
  for (const key of ["name", "address", "offers", "who", "link"]) assert.equal(placeRow({ ...SUGGEST, [key]: " " }), null, key);
  assert.equal(placeRow({ ...SUGGEST, link: "http://westsidepantry.org" }), null);
  assert.equal(placeRow({ ...SUGGEST, link: "https://" }), null);
  assert.equal(placeRow({ ...SUGGEST, offers: "Groceries" }), null);
  assert.equal(placeRow({ ...SUGGEST, who: "Seniors" }), null);
  assert.equal(placeRow({ ...SUGGEST, name: 42 }), null);
});

test("notes: ≤ 500 characters; 'Who can use it: Other' needs its own note ≤ 100, kept only with Other", () => {
  assert.ok(placeRow({ ...SUGGEST, note: "a".repeat(500) }));
  assert.equal(placeRow({ ...SUGGEST, note: "a".repeat(501) }), null);
  assert.equal(placeRow({ ...SUGGEST, who: "Other" }), null);
  assert.equal(placeRow({ ...SUGGEST, who: "Other", whoNote: "a".repeat(101) }), null);
  assert.equal(placeRow({ ...SUGGEST, who: "Other", whoNote: "Seniors 60+" })?.fields.who_note, "Seniors 60+");
  assert.equal(placeRow({ ...SUGGEST, whoNote: "ignored" })?.fields.who_note, undefined);
  assert.equal(placeRow({ ...REPORT, note: "a".repeat(501) }), null);
});

test("a report carries its place's id, name and source; kind and place_ref must pair", () => {
  assert.deepEqual(placeRow(REPORT), { kind: "report", place_ref: "node/123", fields: { name: "Westside Pantry", source: "OpenStreetMap", wrong: "Closed for good" } });
  assert.equal(placeRow({ ...REPORT, placeRef: "county/42" })?.fields.source, "LA County");
  assert.equal(placeRow({ ...REPORT, placeRef: undefined }), null);
  assert.equal(placeRow({ ...REPORT, placeRef: "node/12x" }), null);
  assert.equal(placeRow({ ...REPORT, placeRef: "county/-4" }), null);
  assert.equal(placeRow({ ...REPORT, wrong: "Rude staff" }), null);
  assert.equal(placeRow({ ...REPORT, name: "" }), null);
  assert.equal(placeRow({ ...SUGGEST, placeRef: "node/123" }), null);
  assert.equal(placeRow({ ...SUGGEST, kind: "edit" }), null);
});

test("limits: 10 a person and 50 in all a day; product sends and place sends share the 30 tries", () => {
  assert.equal(limitReason(9, 49, 20), null);
  assert.equal(limitReason(10, 10, 10), "limit-you");
  assert.equal(limitReason(5, 10, 30), "limit-tries");
  assert.equal(limitReason(0, 50, 0), "limit-all");
});

/** A fake database: who the JWT is, today's counts, and what was written. */
function fakeDb(o: { user?: string | null; mine?: number; all?: number; products?: number; fail?: "counts" | "insert" | "cleanup" } = {}) {
  const inserted: [string, PlaceRow][] = [], cleaned: string[] = [], since: string[] = [];
  const db: PlaceDb = {
    async userId(jwt) { return jwt === "good-jwt" ? (o.user === undefined ? "user-1" : o.user) : null; },
    async counts(_user, day) { since.push(day); if (o.fail === "counts") throw new Error("db down"); return { mine: o.mine ?? 0, all: o.all ?? 0, products: o.products ?? 0 }; },
    async insert(user, row) { if (o.fail === "insert") throw new Error("db down"); inserted.push([user, row]); },
    async deleteReviewed(status, before) { cleaned.push(`delete ${status} ${before}`); if (o.fail === "cleanup") throw new Error("db down"); },
    async clearReviewed(status, before) { cleaned.push(`clear ${status} ${before}`); if (o.fail === "cleanup") throw new Error("db down"); },
  };
  return { db, inserted, cleaned, since };
}
const NOW = new Date("2026-10-15T18:30:00Z");
const post = (body: unknown, jwt = "good-jwt") => new Request("https://x.supabase.co/functions/v1/place-submit",
  { method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const reply = async (r: Response) => [r.status, await r.json()];

test("a good send inserts one row for the caller and answers ok", async () => {
  const f = fakeDb();
  assert.deepEqual(await reply(await placeSubmit(post(REPORT), f.db, NOW)), [200, { ok: true }]);
  assert.deepEqual(f.inserted, [["user-1", placeRow(REPORT)]]);
  assert.deepEqual(f.since, ["2026-10-15T00:00:00.000Z"]); // today, UTC
});

test("no session (the human check failed) is captcha, and nothing is read or written", async () => {
  const f = fakeDb();
  assert.deepEqual(await reply(await placeSubmit(post(SUGGEST, "bad-jwt"), f.db, NOW)), [401, { ok: false, reason: "captcha" }]);
  assert.deepEqual([f.inserted, f.since, f.cleaned], [[], [], []]);
  const noAuth = new Request("https://x/", { method: "POST", body: JSON.stringify(SUGGEST) });
  assert.deepEqual(await reply(await placeSubmit(noAuth, f.db, NOW)), [401, { ok: false, reason: "captcha" }]);
});

test("a bad body or bad fields is invalid; a limit is its reason; a database error is off-down", async () => {
  assert.deepEqual(await reply(await placeSubmit(post("{not json"), fakeDb().db, NOW)), [400, { ok: false, reason: "invalid" }]);
  assert.deepEqual(await reply(await placeSubmit(post({ ...SUGGEST, link: "" }), fakeDb().db, NOW)), [400, { ok: false, reason: "invalid" }]);
  const big = post({ ...SUGGEST, note: "a".repeat(9000) }); big.headers.set("Content-Length", "9100");
  assert.deepEqual(await reply(await placeSubmit(big, fakeDb().db, NOW)), [413, { ok: false, reason: "invalid" }]);
  const full = fakeDb({ mine: 5, products: 25 });
  assert.deepEqual(await reply(await placeSubmit(post(SUGGEST), full.db, NOW)), [429, { ok: false, reason: "limit-tries" }]);
  assert.deepEqual(full.inserted, []);
  assert.deepEqual(await reply(await placeSubmit(post(SUGGEST), fakeDb({ fail: "counts" }).db, NOW)), [502, { ok: false, reason: "off-down" }]);
  assert.deepEqual(await reply(await placeSubmit(post(SUGGEST), fakeDb({ fail: "insert" }).db, NOW)), [502, { ok: false, reason: "off-down" }]);
  assert.equal((await placeSubmit(new Request("https://x/", { method: "GET" }), fakeDb().db, NOW)).status, 405);
  assert.equal((await placeSubmit(new Request("https://x/", { method: "OPTIONS" }), fakeDb().db, NOW)).status, 200);
});

test("each call, for rows reviewed more than 90 days ago: deletes rejected ones, clears approved ones' text (M15 C6); a failed cleanup doesn't fail the send", async () => {
  const f = fakeDb();
  await placeSubmit(post(SUGGEST), f.db, NOW);
  assert.deepEqual(f.cleaned, ["delete rejected 2026-07-17T18:30:00.000Z", "clear approved 2026-07-17T18:30:00.000Z"]);
  const g = fakeDb({ fail: "cleanup" });
  assert.deepEqual(await reply(await placeSubmit(post(SUGGEST), g.db, NOW)), [200, { ok: true }]);
});

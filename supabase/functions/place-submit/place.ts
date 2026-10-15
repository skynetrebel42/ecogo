// place.ts — what `place-submit` checks and does (M8.1 spec P1, P2, P4, P4a): one suggestion or report a call, into
// `place_reports`. No imports and the database passed in, so Deno (index.ts) and `node --test` both load it.
// Answers { ok: true } or { ok: false, reason } (reasons as in src/lib/contribute.ts).

export const PER_PERSON_DAILY = 10;
export const ALL_DAILY = 50; // the owner reviews each one by hand
export const ATTEMPTS_DAILY = 30; // M8's cap (off.ts): product sends and place sends together, counted here only (P4a)
const KEEP_DAYS = 90;
const NOTE_MAX = 500;
const WHO_NOTE_MAX = 100;
const TEXT_MAX = 200; // name, address

const OFFERS = ["Food pantry", "Free meals", "Community fridge", "Other"];
const WHO = ["Anyone", "Students only", "Other"];
const WRONG = ["Closed for good", "Wrong address or hours", "Not free", "Other"];
const PLACE_REF = /^((node|way|relation)\/[1-9][0-9]*|county\/[1-9][0-9]*)$/;

export type PlaceRow = { kind: "suggest" | "report"; place_ref: string | null; fields: Record<string, string> };

/** A trimmed string of 1..max characters (optional: "" too), or null. */
const text = (v: unknown, max: number, optional = false): string | null => {
  const s = typeof v === "string" ? v.trim() : optional && v == null ? "" : null;
  return s === null || s.length > max || (!optional && !s) ? null : s;
};
const httpsLink = (v: unknown): string | null => {
  const s = text(v, NOTE_MAX);
  try { return s && new URL(s).protocol === "https:" && new URL(s).hostname ? s : null; } catch { return null; }
};
/** Drops empty optional fields. */
const kept = (f: Record<string, string>) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));

/** The row to insert from what the app sent (trust boundary: every field checked, anything else dropped), or null. */
export function placeRow(b: Record<string, unknown>): PlaceRow | null {
  const note = text(b.note, NOTE_MAX, true);
  if (note === null) return null;
  if (b.kind === "suggest" && b.placeRef == null) {
    const name = text(b.name, TEXT_MAX), address = text(b.address, TEXT_MAX), link = httpsLink(b.link);
    const offers = OFFERS.find(o => o === b.offers), who = WHO.find(w => w === b.who);
    const whoNote = who === "Other" ? text(b.whoNote, WHO_NOTE_MAX) : "";
    if (!name || !address || !link || !offers || !who || whoNote === null) return null;
    return { kind: "suggest", place_ref: null, fields: kept({ name, address, offers, who, who_note: whoNote, link, note }) };
  }
  if (b.kind === "report" && typeof b.placeRef === "string" && PLACE_REF.test(b.placeRef)) {
    const name = text(b.name, TEXT_MAX), wrong = WRONG.find(w => w === b.wrong);
    if (!name || !wrong) return null;
    const source = b.placeRef.startsWith("county/") ? "LA County" : "OpenStreetMap";
    return { kind: "report", place_ref: b.placeRef, fields: kept({ name, source, wrong, note }) };
  }
  return null;
}

/** Why a send must wait until tomorrow, from today's counts before this one (`attempts`: this person's product and
 *  place sends); null = it may go. */
export function limitReason(mine: number, all: number, attempts: number): "limit-you" | "limit-tries" | "limit-all" | null {
  if (mine >= PER_PERSON_DAILY) return "limit-you";
  if (attempts >= ATTEMPTS_DAILY) return "limit-tries";
  if (all >= ALL_DAILY) return "limit-all";
  return null;
}

/** The database calls place-submit makes (index.ts: the service-role client). */
export interface PlaceDb {
  /** The (anonymous) Supabase user the JWT belongs to, or null. */
  userId(jwt: string): Promise<string | null>;
  /** Since `day`: this person's place rows, everyone's, and this person's `contributions` rows (all statuses). */
  counts(userId: string, day: string): Promise<{ mine: number; all: number; products: number }>;
  insert(userId: string, row: PlaceRow): Promise<void>;
  /** Deletes rows reviewed before `before`. */
  cleanup(before: string): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*", // the caller is identified by its JWT, not its origin
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: { ok: boolean; reason?: string }) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function placeSubmit(req: Request, db: PlaceDb, now = new Date()): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return answer(405, { ok: false, reason: "invalid" });

  // Who is asking: the session made at the first Send, after the human check (as off-submit).
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const user = await db.userId(jwt).catch(() => null);
  if (!user) return answer(401, { ok: false, reason: "captcha" });

  // P4: each call clears rows the owner reviewed more than 90 days ago; a failure here mustn't lose the send.
  await db.cleanup(new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString()).catch(err => console.error("cleanup failed", err));

  let row: PlaceRow | null = null;
  try { const b = await req.json(); row = b && typeof b === "object" ? placeRow(b) : null; } catch { /* not JSON */ }
  if (!row) return answer(400, { ok: false, reason: "invalid" });

  // ponytail: count-then-insert, so simultaneous sends can pass a limit by a few (as off-submit).
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
  try {
    const { mine, all, products } = await db.counts(user, day.toISOString());
    const limit = limitReason(mine, all, mine + products);
    if (limit) return answer(429, { ok: false, reason: limit });
    await db.insert(user, row);
  } catch (err) {
    console.error("place_reports failed", err);
    return answer(502, { ok: false, reason: "off-down" });
  }
  return answer(200, { ok: true });
}

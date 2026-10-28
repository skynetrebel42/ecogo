// off-submit — the only writer to Open Food Facts and to `contributions` (M8 spec D6, D9, D10).
// Verifies the (anonymous) caller, enforces the daily limits, logs the submission, then calls OFF with EcoGo's app
// account. Answers { ok: true } or { ok: false, reason } (reasons as in src/lib/contribute.ts).
// Secrets: OFF_BASE, OFF_USER, OFF_PASSWORD, OFF_CONTACT; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { readUpTo } from "../_shared/body.ts";
import { imageForm, limitReason, offHeaders, photoResult, productForm, sendPlan, sendReply, validForm, withLater, type OffAccount, type PhotoKind, type PhotoResult } from "./off.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }; // Supabase Edge Functions: work after the answer

const env = (name: string) => Deno.env.get(name) ?? "";
const OFF_BASE = env("OFF_BASE").replace(/\/$/, "");
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*", // the caller is identified by its JWT, not its origin
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: { ok: boolean; reason?: string; textKept?: boolean; failedPhotos?: PhotoKind[]; pendingPhotos?: PhotoKind[] }) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PHOTO_FIELDS: Record<string, PhotoKind> = { front: "front", ingredients_photo: "ingredients", nutrition: "nutrition" };
const MAX_PHOTO = 5 * 1024 * 1024; // the app sends ≤ 2000 px JPEGs, well under this
const MAX_BODY = 3 * MAX_PHOTO + 64 * 1024; // three photos and the text fields (075 M1)

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return answer(405, { ok: false, reason: "invalid" });

  // Who is asking: an (anonymous) Supabase user, from the JWT supabase-js sends.
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return answer(401, { ok: false, reason: "captcha" });

  // What they send (trust boundary: check everything). 075 M1: keep no more than MAX_BODY, with or without Content-Length.
  if (Number(req.headers.get("Content-Length") ?? 0) > MAX_BODY) return answer(413, { ok: false, reason: "invalid" });
  let form: FormData;
  try {
    const body = await readUpTo(req, MAX_BODY);
    if (!body) return answer(413, { ok: false, reason: "invalid" });
    form = await new Response(body, { headers: { "Content-Type": req.headers.get("Content-Type") ?? "" } }).formData();
  } catch { return answer(400, { ok: false, reason: "invalid" }); }
  const code = String(form.get("code") ?? "");
  const ingredients = String(form.get("ingredients") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const brand = String(form.get("brand") ?? "").trim(); // 071 B
  const photosMode = form.get("mode") === "photos"; // follow-up 5, J3: new photos for a product OFF has, no text
  const photos: [PhotoKind, File][] = [];
  for (const [field, kind] of Object.entries(PHOTO_FIELDS)) {
    const f = form.get(field);
    if (f === null) continue;
    if (!(f instanceof File) || f.type !== "image/jpeg" || f.size === 0 || f.size > MAX_PHOTO) return answer(400, { ok: false, reason: "invalid" });
    photos.push([kind, f]);
  }
  if (!validForm({ code, ingredients, name, brand, photosMode, photos: photos.length })) return answer(400, { ok: false, reason: "invalid" });

  // Daily limits (UTC day): submissions that didn't fail (10 a person, 200 in all), and every attempt (30 a person, 054 B2).
  // ponytail: count-then-insert, so simultaneous sends can pass a limit by a few; a DB function with a lock if that matters.
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const count = async (mine: boolean, failedToo = false) => {
    let q = db.from("contributions").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString());
    if (!failedToo) q = q.neq("status", "failed");
    if (mine) q = q.eq("user_id", user.id);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };
  let limit;
  try { limit = limitReason(await count(true), await count(false), await count(true, true)); }
  catch (err) { console.error("limit count failed", err); return answer(502, { ok: false, reason: "off-down" }); }
  if (limit) return answer(429, { ok: false, reason: limit });

  const { data: row, error: logError } = await db.from("contributions").insert({ user_id: user.id, barcode: code }).select("id").single();
  if (logError) { console.error("log insert failed", logError); return answer(502, { ok: false, reason: "off-down" }); }
  const finish = (status: "sent" | "failed", error?: string) => db.from("contributions").update({ status, error }).eq("id", row.id);

  const headers = offHeaders(OFF_BASE, env("OFF_CONTACT"));
  const account: OffAccount = { user: env("OFF_USER"), password: env("OFF_PASSWORD"), uuid: user.id };
  try {
    // D10: never overwrite OFF's data. Read the product first (main language and English, which EcoGo writes);
    // send text only where it has none.
    const existing = await fetch(`${OFF_BASE}/api/v3/product/${code}?fields=product_name,product_name_en,brands,ingredients_text,ingredients_text_en`, { headers });
    const product = existing.ok ? (await existing.json()).product ?? {} : {};
    if (!existing.ok && existing.status !== 404) throw new Error(`OFF read ${existing.status}`);
    const textKept = Boolean(product.ingredients_text || product.ingredients_text_en);
    const hasName = Boolean(product.product_name || product.product_name_en);
    const hasBrand = Boolean(product.brands);
    const plan = sendPlan(photosMode, existing.ok, textKept);
    if (!plan) { await finish("failed", "photos mode: not on OFF"); return answer(400, { ok: false, reason: "invalid" }); }
    const writeText = plan === "text";
    const notes: string[] = [];
    if (writeText) {
      const r = await fetch(`${OFF_BASE}/cgi/product_jqm2.pl`, {
        method: "POST", headers, body: productForm({ code, ingredients, name: hasName ? undefined : name || undefined, brand: hasBrand ? undefined : brand || undefined }, account),
      });
      const body = r.ok ? await r.json() : null;
      if (body?.status !== 1) throw new Error(`OFF write ${r.status} ${body?.status_verbose ?? ""}`.trim());
    } else notes.push(photosMode ? "photos mode: photos only" : "had ingredients: photos only");
    // M8 follow-up 2, G1: one photo at a time (OFF's test server answered 500 to parallel uploads to one product).
    const upload = async ([kind, photo]: [PhotoKind, File]) => {
      const r = await fetch(`${OFF_BASE}/cgi/product_image_upload.pl`, { method: "POST", headers, body: imageForm(code, kind, photo, account) })
        .catch(err => { console.error(`OFF image ${kind}`, err); return null; });
      return photoResult(kind, r?.status ?? 0, r?.ok ? await r.json().catch(() => null) : null);
    };
    // Follow-up 3, H1: wait only for the ingredients photo after a text write (or, with no text written, until OFF takes
    // a photo), answer, then send the rest in the background.
    const queue = [...photos].sort(([a], [b]) => Number(b === "ingredients") - Number(a === "ingredients"));
    const results: PhotoResult[] = [];
    if (writeText) { if (queue[0]?.[0] === "ingredients") results.push(await upload(queue.shift()!)); }
    else while (queue.length && !results.some(p => p.taken)) results.push(await upload(queue.shift()!));
    // G2: partial success is "Sent", naming the failed photos. Nothing invented: if OFF took nothing, it isn't.
    const reply = sendReply(writeText, results, queue.map(([kind]) => kind));
    const log = [...notes, ...results.flatMap(p => p.note ?? [])].join("; ") || undefined;
    if (!reply.ok) { await finish("failed", log); return answer(reply.reason === "off-down" ? 502 : 409, reply); }
    await finish("sent", log);
    // ponytail: background failures are logged only (owner accepted, 049); the person isn't told.
    if (queue.length) EdgeRuntime.waitUntil((async () => {
      const later: PhotoResult[] = [];
      for (const p of queue) later.push(await upload(p));
      const all = withLater(log, later);
      if (all === log) return;
      const { error } = await db.from("contributions").update({ error: all }).eq("id", row.id);
      if (error) console.error("background log write failed", error);
    })().catch(err => console.error("background photos failed", err)));
    return answer(200, { ...reply, textKept });
  } catch (err) {
    console.error("OFF call failed", err);
    await finish("failed", String(err).slice(0, 500));
    return answer(502, { ok: false, reason: "off-down" });
  }
});

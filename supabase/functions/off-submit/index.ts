// off-submit — the only writer to Open Food Facts and to `contributions` (M8 spec D6, D9, D10).
// Verifies the (anonymous) caller, enforces the daily limits, logs the submission, then calls OFF with EcoGo's app
// account. Answers { ok: true } or { ok: false, reason } (reasons as in src/lib/contribute.ts).
// Secrets: OFF_BASE, OFF_USER, OFF_PASSWORD, OFF_CONTACT; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { imageForm, limitReason, offHeaders, productForm, type OffAccount, type PhotoKind } from "./off.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const OFF_BASE = env("OFF_BASE").replace(/\/$/, "");
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*", // the caller is identified by its JWT, not its origin
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: { ok: boolean; reason?: string; textKept?: boolean }) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PHOTO_FIELDS: Record<string, PhotoKind> = { front: "front", ingredients_photo: "ingredients", nutrition: "nutrition" };
const MAX_PHOTO = 5 * 1024 * 1024; // the app sends ≤ 2000 px JPEGs, well under this

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return answer(405, { ok: false, reason: "invalid" });

  // Who is asking: an (anonymous) Supabase user, from the JWT supabase-js sends.
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const { data: { user } } = await db.auth.getUser(jwt);
  if (!user) return answer(401, { ok: false, reason: "captcha" });

  // What they send (trust boundary: check everything).
  let form: FormData;
  try { form = await req.formData(); } catch { return answer(400, { ok: false, reason: "invalid" }); }
  const code = String(form.get("code") ?? "");
  const ingredients = String(form.get("ingredients") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const photos: [PhotoKind, File][] = [];
  for (const [field, kind] of Object.entries(PHOTO_FIELDS)) {
    const f = form.get(field);
    if (f === null) continue;
    if (!(f instanceof File) || f.type !== "image/jpeg" || f.size === 0 || f.size > MAX_PHOTO) return answer(400, { ok: false, reason: "invalid" });
    photos.push([kind, f]);
  }
  if (!/^[0-9]{8,14}$/.test(code) || !ingredients || ingredients.length > 5000 || name.length > 200) {
    return answer(400, { ok: false, reason: "invalid" });
  }

  // Daily limits (UTC day), counting submissions that didn't fail.
  // ponytail: count-then-insert, so simultaneous sends can pass a limit by a few; a DB function with a lock if that matters.
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const count = async (mine: boolean) => {
    let q = db.from("contributions").select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString()).neq("status", "failed");
    if (mine) q = q.eq("user_id", user.id);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };
  let limit;
  try { limit = limitReason(await count(true), await count(false)); }
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
    const existing = await fetch(`${OFF_BASE}/api/v3/product/${code}?fields=product_name,product_name_en,ingredients_text,ingredients_text_en`, { headers });
    const product = existing.ok ? (await existing.json()).product ?? {} : {};
    if (!existing.ok && existing.status !== 404) throw new Error(`OFF read ${existing.status}`);
    const textKept = Boolean(product.ingredients_text || product.ingredients_text_en);
    const hasName = Boolean(product.product_name || product.product_name_en);
    const notes: string[] = [];
    let accepted = 0; // what OFF actually took: the text, and each photo it answered "status ok" to
    if (!textKept) {
      const r = await fetch(`${OFF_BASE}/cgi/product_jqm2.pl`, {
        method: "POST", headers, body: productForm({ code, ingredients, name: hasName ? undefined : name || undefined }, account),
      });
      const body = r.ok ? await r.json() : null;
      if (body?.status !== 1) throw new Error(`OFF write ${r.status} ${body?.status_verbose ?? ""}`.trim());
      accepted++;
    } else notes.push("had ingredients: photos only");
    // M8 follow-up F4: the photos go up in parallel (after the text), each result recorded; any failed upload still
    // fails the send, after all of them have answered, with what the others did in the log.
    const uploads = await Promise.allSettled(photos.map(async ([kind, photo]) => {
      const r = await fetch(`${OFF_BASE}/cgi/product_image_upload.pl`, { method: "POST", headers, body: imageForm(code, kind, photo, account) });
      if (!r.ok) throw new Error(`OFF image ${kind} ${r.status}`);
      return [kind, await r.json().catch(() => null)] as const;
    }));
    const failed: string[] = [];
    for (const u of uploads) {
      if (u.status === "rejected") { failed.push(String(u.reason)); continue; }
      const [kind, body] = u.value;
      if (body?.status === "status ok") accepted++;
      else notes.push(`${kind}: ${body?.error ?? body?.status ?? "no answer"}`); // e.g. a duplicate photo
    }
    if (failed.length) throw new Error([...failed, `OFF took ${accepted} (text and photos)`, ...notes].join("; "));
    // Nothing invented: if OFF took nothing (it had the text and refused every photo), the app mustn't say "Sent".
    if (!accepted) { await finish("failed", notes.join("; ")); return answer(409, { ok: false, reason: "nothing-new" }); }
    await finish("sent", notes.join("; ") || undefined);
    return answer(200, { ok: true, textKept });
  } catch (err) {
    console.error("OFF call failed", err);
    await finish("failed", String(err).slice(0, 500));
    return answer(502, { ok: false, reason: "off-down" });
  }
});

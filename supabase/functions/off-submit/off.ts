// off.ts — pure Open Food Facts request builders and the daily limit rule for `off-submit` (M8 spec D1, D6, D9, D12).
// No imports, so Deno (the function) and `node --test` both load it.

export const APP_VERSION = "0.1"; // same as lookup.ts's User-Agent
export const PER_PERSON_DAILY = 10;
export const ALL_DAILY = 200;

export type PhotoKind = "front" | "ingredients" | "nutrition";
/** The shared EcoGo app account on OFF, and the person's own app ID (their anonymous Supabase user ID). */
export interface OffAccount { user: string; password: string; uuid: string }

/** Why a submission must wait until tomorrow, from today's counts before this one; null = it may go. */
export function limitReason(mine: number, all: number): "limit-you" | "limit-all" | null {
  if (mine >= PER_PERSON_DAILY) return "limit-you";
  if (all >= ALL_DAILY) return "limit-all";
  return null;
}

/** Headers for every OFF request: a custom User-Agent, and OFF's public `off`/`off` basic auth on the test server. */
export function offHeaders(base: string, contact: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": `EcoGo/${APP_VERSION} (${contact})` };
  if (new URL(base).hostname.endsWith("openfoodfacts.net")) headers.Authorization = `Basic ${btoa("off:off")}`;
  return headers;
}

function accountForm(code: string, a: OffAccount): FormData {
  const f = new FormData();
  f.set("code", code);
  f.set("user_id", a.user);
  f.set("password", a.password);
  f.set("app_name", "EcoGo");
  f.set("app_version", APP_VERSION);
  f.set("app_uuid", a.uuid);
  return f;
}

/** Body for POST /cgi/product_jqm2.pl: the checked ingredients and, if given, the name. */
export function productForm(p: { code: string; ingredients: string; name?: string }, a: OffAccount): FormData {
  const f = accountForm(p.code, a);
  f.set("ingredients_text_en", p.ingredients);
  if (p.name) f.set("product_name_en", p.name);
  return f;
}

/** What one photo upload came to (M8 follow-up 2, G1): OFF took it, or already had it, or not; `note` goes in the log. */
export type PhotoResult = { kind: PhotoKind; taken: boolean; httpError?: boolean; note?: string };

/** `status` 0 = the request itself failed. "This picture has already been sent" counts as taken. */
export function photoResult(kind: PhotoKind, status: number, body: { status?: string; error?: string } | null): PhotoResult {
  if (status < 200 || status >= 300) return { kind, taken: false, httpError: true, note: `${kind}: HTTP ${status}` };
  if (body?.status === "status ok") return { kind, taken: true };
  const why = body?.error ?? body?.status ?? "no answer";
  return { kind, taken: /already been sent/i.test(why), note: `${kind}: ${why}` };
}

/** The answer once the text (if OFF had none) and the photos have gone (G2): partial success is success, naming the
 *  photos that didn't go through; only when OFF took nothing is it not sent. */
export function sendReply(textTaken: boolean, photos: PhotoResult[]):
  { ok: true; failedPhotos?: PhotoKind[] } | { ok: false; reason: "off-down" | "nothing-new" } {
  const failedPhotos = photos.filter(p => !p.taken).map(p => p.kind);
  if (textTaken || photos.some(p => p.taken)) return failedPhotos.length ? { ok: true, failedPhotos } : { ok: true };
  return { ok: false, reason: photos.some(p => p.httpError) ? "off-down" : "nothing-new" };
}

/** Body for POST /cgi/product_image_upload.pl: one photo under `imgupload_<kind>_en`. */
export function imageForm(code: string, kind: PhotoKind, photo: Blob, a: OffAccount): FormData {
  const f = accountForm(code, a);
  f.set("imagefield", `${kind}_en`);
  f.set(`imgupload_${kind}_en`, photo, `${kind}.jpg`);
  return f;
}

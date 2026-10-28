// contribute.ts — send a new product to Open Food Facts through EcoGo's `off-submit` function (M8 spec D6–D9), and a
// Map suggestion or report through `place-submit` (M8.1 P3).
// The Supabase client is passed in (the app passes lib/supabase.ts), so Node tests can load this module.

/** unknown (055 E2): no reply, or not EcoGo's, so it may have arrived; every other reason is off-submit's own answer. */
export type SubmitReason = "limit-you" | "limit-tries" | "limit-all" | "captcha" | "off-down" | "invalid" | "nothing-new" | "photo-rejected" | "unknown";
export type PhotoKind = "front" | "ingredients" | "nutrition";
/** textKept: OFF already had ingredients, so only the photos went (D10). failedPhotos: sent, but these photos didn't
 *  go through (M8 follow-up 2, G2). */
export type SubmitResult = { ok: true; textKept?: boolean; failedPhotos?: PhotoKind[]; pendingPhotos?: PhotoKind[] } | { ok: false; reason: SubmitReason };
const KINDS: PhotoKind[] = ["front", "ingredients", "nutrition"];
/** The known photo kinds named in a server list (anything else is dropped). pendingPhotos (follow-up 3, H1): still
 *  uploading in the background. */
const kinds = (v: unknown): PhotoKind[] => (Array.isArray(v) ? KINDS.filter(k => v.includes(k)) : []);
export interface Submission {
  code: string;
  name?: string;
  brand?: string;
  ingredients: string;
  photos: { front?: Blob; ingredients?: Blob; nutrition?: Blob };
  /** Follow-up 5, J2: new photos for a product OFF has; no text or name is sent, at least one photo is. */
  photosOnly?: boolean;
}
/** Supabase auth, and where off-submit lives: its URL and the public (publishable) key it's called with. */
export interface ContributeClient {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
    signInAnonymously(o: { options: { captchaToken: string } }): Promise<{ error: unknown }>;
    signOut(o: { scope: "local" }): Promise<{ error: unknown }>;
  };
  functionUrl: string;
  apikey: string;
}
/** Where a send is (follow-up 4, P1): the human check, the upload with its real percent, then the server's work. */
export type SendStage = { stage: "check" } | { stage: "upload"; percent: number } | { stage: "saving" };

const REASONS: SubmitReason[] = ["limit-you", "limit-tries", "limit-all", "captcha", "off-down", "invalid", "nothing-new", "photo-rejected"];
const fail = (reason: SubmitReason): SubmitResult => ({ ok: false, reason });

/** How long to wait for off-submit's answer once the upload is done (it answers in ~10 s since 049 H1); then the
 *  outcome is `unknown` (055 E1a, E2). The upload itself has no limit: a slow phone mustn't give up mid-upload and then
 *  send again while the server finishes. */
const ANSWER_WAIT_MS = 90_000;
/** 055 E1a, E1b: Close is locked while sending, so every wait ends: a human check with no token (`captcha`), a sign-in
 *  with no answer (`off-down`: nothing left the phone), an upload with no progress (`unknown`), each after 60 s. */
const CHECK_WAIT_MS = 60_000;
const SIGN_IN_WAIT_MS = 60_000;
const STALL_MS = 60_000;

const TIMEOUT = new Error("timed out");
/** `p`, or a rejection with TIMEOUT after `ms`; the timer is cleared either way. */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, reject) => { t = setTimeout(() => reject(TIMEOUT), ms); })]).finally(() => clearTimeout(t));
}

/** POST with real upload progress (XMLHttpRequest: fetch can't report it). Resolves the status and the parsed JSON
 *  (null when it isn't JSON), or null on a network error or no answer in time. */
function post(url: string, headers: Record<string, string>, body: FormData | string, onProgress: (s: SendStage) => void):
  Promise<{ status: number; json: unknown } | null> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    let wait: ReturnType<typeof setTimeout> | undefined;
    const stalling = () => { clearTimeout(wait); wait = setTimeout(() => x.abort(), STALL_MS); }; // E1b: restarts on progress
    x.open("POST", url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = e => { stalling(); if (e.lengthComputable) onProgress({ stage: "upload", percent: Math.round((100 * e.loaded) / e.total) }); };
    x.upload.onload = () => { onProgress({ stage: "saving" }); clearTimeout(wait); wait = setTimeout(() => x.abort(), ANSWER_WAIT_MS); };
    x.onload = () => {
      clearTimeout(wait);
      let json: unknown = null;
      try { json = JSON.parse(x.responseText); } catch { /* not JSON: an unknown answer */ }
      resolve({ status: x.status, json });
    };
    x.onerror = x.onabort = () => { clearTimeout(wait); resolve(null); };
    x.send(body);
    stalling();
  });
}

/** Signs in anonymously (with a human-check token) only when nobody is signed in yet; the session, or why not. */
async function signedIn(getCaptchaToken: () => Promise<string>, client: ContributeClient, onProgress: (s: SendStage) => void):
  Promise<{ access_token: string } | SubmitReason> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;
  onProgress({ stage: "check" });
  let captchaToken: string;
  try { captchaToken = await within(getCaptchaToken(), CHECK_WAIT_MS); } catch { return "captcha"; }
  try {
    const { error } = await within(client.auth.signInAnonymously({ options: { captchaToken } }), SIGN_IN_WAIT_MS);
    if (error) return "captcha";
  } catch (err) {
    return err === TIMEOUT ? "off-down" : "captcha";
  }
  // Signed in, yet no session: treat as a failed check, send nothing.
  return (await client.auth.getSession()).data.session ?? "captcha";
}

/** A failed answer's reason; a 401 means the server no longer accepts this session (expired or deleted), so it is
 *  dropped and Try again signs in afresh. */
async function failure(res: { status: number; json: unknown } | null, client: ContributeClient): Promise<SubmitResult> {
  if (res?.status === 401) await client.auth.signOut({ scope: "local" });
  const reason = (res?.json as { reason?: SubmitReason } | null)?.reason;
  return fail(reason && REASONS.includes(reason) ? reason : "unknown");
}

/** Signs in anonymously (with a human-check token) only when nobody is signed in yet, then sends, reporting stages. */
export async function submitProduct(s: Submission, getCaptchaToken: () => Promise<string>, client: ContributeClient,
  onProgress: (s: SendStage) => void = () => {}): Promise<SubmitResult> {
  const ingredients = s.ingredients.trim();
  const hasPhoto = KINDS.some(k => s.photos[k]);
  if (!(s.photosOnly ? hasPhoto : ingredients) || !/^[0-9]{8,14}$/.test(s.code)) return fail("invalid");

  const session = await signedIn(getCaptchaToken, client, onProgress);
  if (typeof session === "string") return fail(session);

  const body = new FormData();
  body.set("code", s.code);
  if (s.photosOnly) body.set("mode", "photos");
  else {
    body.set("ingredients", ingredients);
    if (s.name?.trim()) body.set("name", s.name.trim());
    if (s.brand?.trim()) body.set("brand", s.brand.trim()); // 071 B (an off-submit from before 071 ignores it)
  }
  if (s.photos.front) body.set("front", s.photos.front, "front.jpg");
  if (s.photos.ingredients) body.set("ingredients_photo", s.photos.ingredients, "ingredients.jpg");
  if (s.photos.nutrition) body.set("nutrition", s.photos.nutrition, "nutrition.jpg");

  onProgress({ stage: "upload", percent: 0 });
  const res = await post(client.functionUrl, { Authorization: `Bearer ${session.access_token}`, apikey: client.apikey }, body, onProgress);
  // off-submit answers { ok, reason?, … } with any status.
  const answer = res?.json as
    { ok?: boolean; reason?: SubmitReason; textKept?: boolean; failedPhotos?: unknown; pendingPhotos?: unknown } | null | undefined;
  if (answer?.ok === true) {
    const failedPhotos = kinds(answer.failedPhotos), pendingPhotos = kinds(answer.pendingPhotos);
    return { ok: true, ...(answer.textKept && { textKept: true }), ...(failedPhotos.length > 0 && { failedPhotos }),
      ...(pendingPhotos.length > 0 && { pendingPhotos }) };
  }
  return failure(res, client);
}

/** M8.1 P3: a Map suggestion or report, for `place-submit` (client.functionUrl). The form gates its required fields;
 *  place-submit checks them all. Same sign-in, human check and waits as a product send. */
export type PlaceSubmission = { kind: "suggest" | "report" } & Record<string, string>;
export async function submitPlace(p: PlaceSubmission, getCaptchaToken: () => Promise<string>, client: ContributeClient,
  onProgress: (s: SendStage) => void = () => {}): Promise<SubmitResult> {
  const session = await signedIn(getCaptchaToken, client, onProgress);
  if (typeof session === "string") return fail(session);
  onProgress({ stage: "saving" });
  const res = await post(client.functionUrl, { Authorization: `Bearer ${session.access_token}`, apikey: client.apikey, "Content-Type": "application/json" },
    JSON.stringify(p), () => {});
  return (res?.json as { ok?: boolean } | null)?.ok === true ? { ok: true } : failure(res, client);
}

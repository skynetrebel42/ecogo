// contribute.ts — send a new product to Open Food Facts through EcoGo's `off-submit` function (M8 spec D6–D9).
// The Supabase client is passed in (the app passes lib/supabase.ts), so Node tests can load this module.

export type SubmitReason = "limit-you" | "limit-all" | "captcha" | "off-down" | "invalid" | "nothing-new";
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
  ingredients: string;
  photos: { front?: Blob; ingredients?: Blob; nutrition?: Blob };
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

const REASONS: SubmitReason[] = ["limit-you", "limit-all", "captcha", "off-down", "invalid", "nothing-new"];
const fail = (reason: SubmitReason): SubmitResult => ({ ok: false, reason });

/** How long to wait for off-submit's answer once the upload is done (it answers in ~10 s since 049 H1). The upload
 *  itself has no limit: a slow phone mustn't give up mid-upload and then send again while the server finishes. */
const ANSWER_WAIT_MS = 60_000;

/** POST with real upload progress (XMLHttpRequest: fetch can't report it). Resolves the status and the parsed JSON
 *  (null when it isn't JSON), or null on a network error or no answer in time. */
function post(url: string, headers: Record<string, string>, body: FormData, onProgress: (s: SendStage) => void):
  Promise<{ status: number; json: unknown } | null> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    let wait: ReturnType<typeof setTimeout> | undefined;
    x.open("POST", url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress({ stage: "upload", percent: Math.round((100 * e.loaded) / e.total) }); };
    x.upload.onload = () => { onProgress({ stage: "saving" }); wait = setTimeout(() => x.abort(), ANSWER_WAIT_MS); };
    x.onload = () => {
      clearTimeout(wait);
      let json: unknown = null;
      try { json = JSON.parse(x.responseText); } catch { /* not JSON: an unknown answer */ }
      resolve({ status: x.status, json });
    };
    x.onerror = x.onabort = () => { clearTimeout(wait); resolve(null); };
    x.send(body);
  });
}

/** Signs in anonymously (with a human-check token) only when nobody is signed in yet, then sends, reporting stages. */
export async function submitProduct(s: Submission, getCaptchaToken: () => Promise<string>, client: ContributeClient,
  onProgress: (s: SendStage) => void = () => {}): Promise<SubmitResult> {
  const ingredients = s.ingredients.trim();
  if (!ingredients || !/^[0-9]{8,14}$/.test(s.code)) return fail("invalid");

  const { data } = await client.auth.getSession();
  if (!data.session) {
    onProgress({ stage: "check" });
    try {
      const { error } = await client.auth.signInAnonymously({ options: { captchaToken: await getCaptchaToken() } });
      if (error) return fail("captcha");
    } catch {
      return fail("captcha");
    }
  }

  const body = new FormData();
  body.set("code", s.code);
  body.set("ingredients", ingredients);
  if (s.name?.trim()) body.set("name", s.name.trim());
  if (s.photos.front) body.set("front", s.photos.front, "front.jpg");
  if (s.photos.ingredients) body.set("ingredients_photo", s.photos.ingredients, "ingredients.jpg");
  if (s.photos.nutrition) body.set("nutrition", s.photos.nutrition, "nutrition.jpg");

  const session = data.session ?? (await client.auth.getSession()).data.session;
  if (!session) return fail("captcha"); // signed in, yet no session: treat as a failed check, send nothing
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
  // 401: the server no longer accepts this session (expired or deleted); drop it so Try again signs in afresh.
  if (res?.status === 401) await client.auth.signOut({ scope: "local" });
  return fail(answer?.reason && REASONS.includes(answer.reason) ? answer.reason : "off-down");
}

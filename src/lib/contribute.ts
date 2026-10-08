// contribute.ts — send a new product to Open Food Facts through EcoGo's `off-submit` function (M8 spec D6–D9).
// The Supabase client is passed in (the app passes lib/supabase.ts), so Node tests can load this module.

export type SubmitReason = "limit-you" | "limit-all" | "captcha" | "off-down" | "invalid" | "nothing-new";
/** textKept: OFF already had ingredients, so only the photos went (D10). */
export type SubmitResult = { ok: true; textKept?: boolean } | { ok: false; reason: SubmitReason };
export interface Submission {
  code: string;
  name?: string;
  ingredients: string;
  photos: { front?: Blob; ingredients?: Blob; nutrition?: Blob };
}
/** The two parts of the Supabase client this uses. */
export interface ContributeClient {
  auth: {
    getSession(): Promise<{ data: { session: unknown } }>;
    signInAnonymously(o: { options: { captchaToken: string } }): Promise<{ error: unknown }>;
    signOut(o: { scope: "local" }): Promise<{ error: unknown }>;
  };
  functions: { invoke(name: string, o: { body: FormData }): Promise<{ data: unknown; error: unknown }> };
}

const REASONS: SubmitReason[] = ["limit-you", "limit-all", "captcha", "off-down", "invalid", "nothing-new"];
const fail = (reason: SubmitReason): SubmitResult => ({ ok: false, reason });

/** Signs in anonymously (with a human-check token) only when nobody is signed in yet, then sends. */
export async function submitProduct(s: Submission, getCaptchaToken: () => Promise<string>, client: ContributeClient): Promise<SubmitResult> {
  const ingredients = s.ingredients.trim();
  if (!ingredients || !/^[0-9]{8,14}$/.test(s.code)) return fail("invalid");

  const { data } = await client.auth.getSession();
  if (!data.session) {
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

  const { data: reply, error } = await client.functions.invoke("off-submit", { body });
  // off-submit answers { ok, reason? }; a non-2xx answer arrives as error.context (the Response).
  const context = (error as { context?: unknown } | null)?.context;
  const answer = (!error ? reply : context instanceof Response ? await context.json().catch(() => null) : null) as
    { ok?: boolean; reason?: SubmitReason; textKept?: boolean } | null;
  if (answer?.ok === true) return answer.textKept ? { ok: true, textKept: true } : { ok: true };
  // 401: the server no longer accepts this session (expired or deleted); drop it so Try again signs in afresh.
  if (context instanceof Response && context.status === 401) await client.auth.signOut({ scope: "local" });
  return fail(answer?.reason && REASONS.includes(answer.reason) ? answer.reason : "off-down");
}

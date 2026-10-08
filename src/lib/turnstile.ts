// turnstile.ts — Cloudflare Turnstile, the human check before the one anonymous sign-in (M8 spec D8). Loaded only on
// the Send screen; usually invisible, it shows a challenge in the given element only when Cloudflare needs one.

type Turnstile = {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: Turnstile } }

let script: Promise<Turnstile> | undefined;

/** Starts loading Turnstile's script (once). */
export function loadTurnstile(): Promise<Turnstile> {
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't start")));
    s.onerror = () => reject(new Error("Turnstile didn't load"));
    document.head.append(s);
  });
  script.catch(() => { script = undefined; });
  return script;
}

/** A fresh one-time token, from a widget rendered into `el`. */
export async function turnstileToken(el: HTMLElement): Promise<string> {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!sitekey) throw new Error("No Turnstile site key");
  const t = await loadTurnstile();
  return new Promise((resolve, reject) => {
    const id = t.render(el, {
      sitekey,
      appearance: "interaction-only",
      retry: "never", // a failure reports once ("Try again" renders a fresh widget); its own retry would reset a removed one
      callback: (token: string) => { t.remove(id); resolve(token); },
      // Every way it can end without a token settles too, so Send never hangs on "Sending…".
      "error-callback": () => { t.remove(id); reject(new Error("Turnstile failed")); },
      "timeout-callback": () => { t.remove(id); reject(new Error("Turnstile challenge timed out")); },
      "expired-callback": () => { t.remove(id); reject(new Error("Turnstile token expired")); },
    });
  });
}

// photon.ts — address suggestions for the Suggest a place form (decision 059 Q4) from Photon (photon.komoot.io, OSM
// data). Photon's terms (checked 2026-10-16): "You can use the API for your project, but please be fair". So: 3+
// characters after a 400 ms pause (the form), LA County's box, 5 results, one request at a time, and after 2 s nothing.
import { LA_BOX } from "./osmPlaces.ts";

export const MIN_CHARS = 3;
export const PAUSE_MS = 400;
const TIMEOUT_MS = 2000;
const LIMIT = 5;

export const photonUrl = (q: string) => `https://photon.komoot.io/api/?${new URLSearchParams({
  q, limit: String(LIMIT), lang: "en", bbox: [LA_BOX.west, LA_BOX.south, LA_BOX.east, LA_BOX.north].join(","),
})}`;

/** "House number street, city ZIP"; a place with no street goes by its name; null when there's no street or name. */
export function formatAddress(p: Record<string, unknown>): string | null {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const street = s("street") ? [s("housenumber"), s("street")].filter(Boolean).join(" ") : s("name");
  if (!street) return null;
  const town = [s("city") ?? s("locality") ?? s("district"), s("postcode")].filter(Boolean).join(" ");
  return town ? `${street}, ${town}` : street;
}

/** Up to 5 distinct suggestions for `q`, or [] (under 3 characters nothing is asked; any failure or a 2 s wait is []).
 *  `signal`: aborted when a newer request starts, so an older answer is dropped. */
export async function suggestAddresses(q: string, fetchFn: typeof fetch = fetch, signal?: AbortSignal): Promise<string[]> {
  const text = q.trim();
  if (text.length < MIN_CHARS) return [];
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  signal?.addEventListener("abort", stop);
  const timer = setTimeout(stop, TIMEOUT_MS);
  try {
    const r = await fetchFn(photonUrl(text), { signal: ctl.signal });
    if (!r.ok) return [];
    const { features } = await r.json();
    if (!Array.isArray(features)) return [];
    const out = features.map(f => formatAddress(f?.properties ?? {})).filter((a): a is string => !!a);
    return [...new Set(out)].slice(0, LIMIT);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

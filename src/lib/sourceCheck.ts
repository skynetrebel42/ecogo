// sourceCheck.ts — `npm run verify:sources`' rules (SOURCE-01 S1, docs/superpowers/specs/2026-10-16-source-copy-design.md):
// fetch a source and look for its verbatim quote; the run fails on a missing quote, on zero passes (offline), and on a
// source that couldn't be checked and has no `checkedByHand` date (the page opened and the quote confirmed by hand).

export interface Checkable { url: string; quote: string; checkedByHand?: string }
export type Status = "pass" | "fail" | "unverifiable";

// NFKC folds typographic ligatures ("reﬁned" on EUR-Lex) and compatibility spaces into plain letters.
export const normalize = (s: string) => s.normalize("NFKC")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[‐-―]/g, "-")
  .replace(/\s+/g, " ")
  .toLowerCase()
  .trim();

export async function checkSource(s: Checkable, get: typeof fetch = fetch): Promise<{ status: Status; detail: string }> {
  try {
    const res = await get(s.url, {
      headers: { "User-Agent": "EcoGo source check (personal project)", Accept: "text/html,application/xhtml+xml,application/json", "Accept-Language": "en" },
      signal: AbortSignal.timeout(20_000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { status: "unverifiable", detail: `HTTP ${res.status}` };
    if (!/html|text|json/.test(type)) return { status: "unverifiable", detail: type || "unknown content type" };
    const page = normalize(await res.text());
    if (page.includes(normalize(s.quote))) return { status: "pass", detail: "" };
    // Script-rendered tables (IARC list) and bot-gated pages (EUR-Lex) return almost no text to a plain fetch.
    if (page.length < 5000) return { status: "unverifiable", detail: "page is script-rendered or bot-gated" };
    return { status: "fail", detail: "quote not found on page" };
  } catch (err) {
    return { status: "unverifiable", detail: (err as Error)?.message ?? String(err) };
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Exit 1 on any fail, when nothing passed, or when an unverifiable source has no hand-check date (listed in `undated`). */
export function verdict(results: { status: Status; source: Checkable }[]): { exit: 0 | 1; undated: Checkable[] } {
  const undated = results.filter(r => r.status === "unverifiable" && !DATE.test(r.source.checkedByHand ?? "")).map(r => r.source);
  const bad = results.some(r => r.status === "fail") || !results.some(r => r.status === "pass") || undated.length > 0;
  return { exit: bad ? 1 : 0, undated };
}

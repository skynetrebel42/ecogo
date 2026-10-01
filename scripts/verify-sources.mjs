// Checks every library source: fetches its URL and confirms the recorded quote appears on the page.
// Usage: npm run verify:sources   (needs the internet; run whenever src/lib/safety/library.ts changes)
// "unverifiable" (blocked, PDF, JS-only page) means: open the page by hand and confirm the quote before keeping the entry.
import { LIBRARY } from "../src/lib/safety/library.ts";
import { PROCESSED_MEAT, ACRYLAMIDE } from "../src/lib/safety/foodConcerns.ts";

const normalize = (s) => s
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

const totals = { pass: 0, fail: 0, unverifiable: 0 };
for (const entry of [...LIBRARY, PROCESSED_MEAT, ACRYLAMIDE]) {
  for (const source of entry.sources) {
    let status;
    let detail = "";
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "EcoGo source check (personal project)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" },
        signal: AbortSignal.timeout(20_000),
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok) { status = "unverifiable"; detail = `HTTP ${res.status}`; }
      else if (!/html|text/.test(type)) { status = "unverifiable"; detail = type || "unknown content type"; }
      else {
        const page = normalize(await res.text());
        if (page.includes(normalize(source.quote))) status = "pass";
        // Script-rendered tables (IARC list) and bot-gated pages (EUR-Lex) return almost no text to a plain fetch.
        else if (page.length < 5000) { status = "unverifiable"; detail = "page is script-rendered or bot-gated"; }
        else { status = "fail"; detail = "quote not found on page"; }
      }
    } catch (err) {
      status = "unverifiable";
      detail = err?.message ?? String(err);
    }
    totals[status]++;
    console.log(`${status.toUpperCase().padEnd(13)} ${entry.id} · ${source.body} · ${source.url}${detail ? ` (${detail})` : ""}`);
  }
}
console.log(`\n${totals.pass} pass, ${totals.fail} fail, ${totals.unverifiable} unverifiable`);
if (totals.fail > 0) process.exitCode = 1;

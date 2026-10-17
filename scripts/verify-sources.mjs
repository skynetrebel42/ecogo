// Checks every library source and every Learn claim (src/lib/learnSources.ts): fetches its URL and confirms the
// recorded quote appears on the page.
// Usage: npm run verify:sources   (needs the internet; run whenever library.ts, foodConcerns.ts or learnSources.ts changes)
// Exits 1 on a missing quote, when nothing passed (offline), or when an "unverifiable" source (blocked, PDF, JS-only
// page) has no `checkedByHand` date: open that page by hand, confirm the quote, then add the date (rules: src/lib/sourceCheck.ts).
import { LIBRARY } from "../src/lib/safety/library.ts";
import { PROCESSED_MEAT, ACRYLAMIDE } from "../src/lib/safety/foodConcerns.ts";
import { LEARN_SOURCES } from "../src/lib/learnSources.ts";
import { checkSource, verdict } from "../src/lib/sourceCheck.ts";

// The library, then Learn's claims (S2); a URL + quote pair already checked isn't fetched again.
const learn = Object.entries(LEARN_SOURCES).map(([id, sources]) => ({ id: `learn:${id}`, sources }));
const seen = new Set();
const results = [];
for (const entry of [...LIBRARY, PROCESSED_MEAT, ACRYLAMIDE, ...learn]) {
  for (const source of entry.sources) {
    const key = `${source.url} ${source.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { status, detail } = await checkSource(source);
    results.push({ status, source });
    const hand = status === "unverifiable" && source.checkedByHand ? `, checked by hand ${source.checkedByHand}` : "";
    console.log(`${status.toUpperCase().padEnd(13)} ${entry.id} · ${source.body} · ${source.url}${detail ? ` (${detail}${hand})` : ""}`);
  }
}
const count = s => results.filter(r => r.status === s).length;
const { exit, undated } = verdict(results);
console.log(`\n${count("pass")} pass, ${count("fail")} fail, ${count("unverifiable")} unverifiable (${count("unverifiable") - undated.length} checked by hand)`);
if (count("pass") === 0) console.log("Nothing passed: offline, or every page blocked.");
for (const { status, source: s } of results) if (status === "unverifiable")
  console.log(`  ${undated.includes(s) ? "NOT CHECKED BY HAND" : `checked by hand ${s.checkedByHand}`}: ${s.url} "${s.quote}"`);
process.exitCode = exit;

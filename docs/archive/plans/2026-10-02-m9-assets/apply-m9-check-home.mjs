// M9 plan, Task 4: check-home.mjs expects the Map tab again (M9 brings it back; the map itself is checked by check-map.mjs).
// Run from the repo root: node <this file>. Each anchor must match exactly once; the file keeps its line endings.
import { readFileSync, writeFileSync } from "node:fs";

const path = "docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs";
const crlf = readFileSync(path, "utf8").includes("\r\n");
let text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
for (const [from, to] of [
  [`// search result, opened and bookmarked, is listed in Favorites.\n`,
   `// search result, opened and bookmarked, is listed in Favorites.\n// M9: the Map tab is back (its own check: docs/superpowers/plans/2026-10-02-m9-assets/check-map.mjs).\n`],
  [`  check("bottom nav is Home, Scan, Saved, Profile (no Map)", JSON.stringify(nav) === '["Home","Scan","Saved","Profile"]', JSON.stringify(nav));`,
   `  check("bottom nav is Home, Map, Scan, Saved, Profile (M9)", JSON.stringify(nav) === '["Home","Map","Scan","Saved","Profile"]', JSON.stringify(nav));`],
]) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${path}: expected 1 match, found ${n}:\n${from}`);
  text = text.replace(from, () => to);
}
writeFileSync(path, crlf ? text.replace(/\n/g, "\r\n") : text);
console.log(`patched ${path}`);

// Writes src/data/safer-choice.json, the app's snapshot of EPA's Safer Choice list (M17, decision 065). The OWNER runs
// this when the snapshot should be refreshed, then commits the file:
//   npm run import:saferchoice              (downloads EPA's Envirofacts table, about 2.5 MB)
//   npm run import:saferchoice -- <file>    (an already-downloaded copy of the same JSON)
// Only the trimmed snapshot is written; rules in src/lib/saferChoice.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { ENVIROFACTS, trimSaferChoice } from "../src/lib/saferChoice.ts";

const file = process.argv[2];
const rows = file ? JSON.parse(readFileSync(file, "utf8")) : await (await fetch(ENVIROFACTS)).json();
if (!Array.isArray(rows) || rows.length < 1000) { console.error("Unexpected answer from EPA: not a list of products."); process.exit(1); }
const { snapshot, stats } = trimSaferChoice(rows, new Date().toLocaleDateString("en-CA") /* local YYYY-MM-DD */);
writeFileSync(new URL("../src/data/safer-choice.json", import.meta.url), JSON.stringify(snapshot) + "\n");
console.log(stats);

// Loads USDA FoodData Central Branded Foods into the `foods` table. The OWNER runs this, from their own machine:
//   npm run import:usda -- <path to FoodData_Central_branded_food_json_YYYY-MM-DD.zip> [--dry-run]
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored; never commit it, never run this in CI) and the project URL
// from .env. --dry-run parses and scores everything but writes nothing. A .json file works too (the tests' sample).
// Download: https://fdc.nal.usda.gov/download-datasets/ (Branded Foods, JSON, about 195 MB zipped, 3 GB unzipped).
// Spec: docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §4.
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { createClient } from "@supabase/supabase-js";
import { deleteOlderSnapshots, keepNewest, recordSplitter, usdaDate, usdaRecordToRow } from "../src/lib/foodsImport.ts";

for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* optional */ } } // existing variables win: .env.local first

const MAX_ROWS = 600_000; // the free tier holds about 430,000 of these comfortably; stop if USDA's file suddenly doubles
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const file = args.find(a => !a.startsWith("--"));
if (!file) { console.error("Usage: npm run import:usda -- <branded_food_json zip or .json> [--dry-run]"); process.exit(1); }
const snapshot = file.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
if (!snapshot) { console.error("The file name must contain USDA's release date, like ..._2025-12-18.zip"); process.exit(1); }

function open() {
  if (file.endsWith(".json")) return createReadStream(file);
  const [cmd, cmdArgs] = process.platform === "win32"
    ? ["C:\\Windows\\System32\\tar.exe", ["-xOf", file]]   // Windows' bsdtar reads zips
    : ["unzip", ["-p", file]];
  const p = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "inherit"] });
  p.on("exit", code => { if (code) { console.error(`${cmd} exited with ${code}`); process.exit(1); } });
  return p.stdout;
}

// One row per barcode, the newest record wins.
const rows = new Map(); // barcode_key -> { row, modified }
const stat = { records: 0, skipped: 0, unreadable: 0 };
const feed = recordSplitter(json => {
  let rec;
  try { rec = JSON.parse(json); } catch { stat.unreadable++; return; }
  stat.records++;
  const row = usdaRecordToRow(rec, snapshot);
  if (!row) { stat.skipped++; return; }
  keepNewest(rows, row, usdaDate(rec.modifiedDate) || usdaDate(rec.publicationDate));
});
const decoder = new StringDecoder("utf8");
let bytes = 0, lastLog = Date.now();
for await (const chunk of open()) {
  bytes += chunk.length;
  feed(decoder.write(chunk));
  if (Date.now() - lastLog > 15000) { lastLog = Date.now(); console.log(`${(bytes / 1e9).toFixed(2)} GB read, ${stat.records} records`); }
}
feed(decoder.end());

const all = [...rows.values()].map(x => x.row);
const levels = {};
for (const r of all) levels[r.verdict] = (levels[r.verdict] ?? 0) + 1;
console.log(`Snapshot ${snapshot}: ${stat.records} records, ${all.length} products kept (one per barcode), ${stat.skipped} without a barcode or ingredients, ${stat.unreadable} unreadable.`);
console.log("Levels:", JSON.stringify(levels));
if (all.length === 0) { console.error("Nothing to load: is this the Branded Foods JSON?"); process.exit(1); }
if (all.length > MAX_ROWS) { console.error(`${all.length} products is more than the ${MAX_ROWS} limit; check the free tier's size before raising it.`); process.exit(1); }
if (dry) { console.log("Dry run: nothing was written."); process.exit(0); }

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set VITE_SUPABASE_URL (in .env) and SUPABASE_SERVICE_ROLE_KEY (in .env.local)."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

for (let i = 0; i < all.length; i += 1000) {
  const batch = all.slice(i, i + 1000);
  for (let attempt = 1; ; attempt++) {
    const { error } = await db.from("foods").upsert(batch, { onConflict: "barcode_key" });
    if (!error) break;
    if (attempt === 3) { console.error(`The batch starting at ${i} failed: ${error.message}`); process.exit(1); }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  if ((i / 1000) % 20 === 0) console.log(`${i + batch.length} / ${all.length} uploaded`);
}
// A full run succeeded: products from older snapshots are gone from USDA's file, so remove them (in small batches).
let count = 0;
try { count = await deleteOlderSnapshots(db, snapshot); } catch (error) {
  console.error(`Could not remove older snapshots: ${error.message}`); process.exit(1);
}
console.log(`Done. ${all.length} products loaded; ${count} older rows removed.`);
console.log("Check the size in the Supabase SQL editor: select pg_size_pretty(pg_total_relation_size('public.foods'));");

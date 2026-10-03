// Draws the launch-audit sample from the live `foods` table and writes it as numbered batch files for reviewers (spec O8):
// a random sample of flagged products (High/Known and Some badges), plus every "Nothing flagged" product in the two
// processed-meat categories. Each entry shows the badge, the reasons the app's own engine gives, and the label text.
//   node scripts/audit-foods.mjs <out-dir> [highKnown=200] [some=100] [batchSize=40]
// Reads with the public key (the table is world-readable). ponytail: a one-off helper run once per import.
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assessProduct } from "../src/lib/safety/assess.ts";

/** One numbered entry: kind is "flagged" (a High/Known/Some badge to confirm) or "clean-meat" (a 'Nothing flagged' to confirm). */
export function entryText(row, n, kind) {
  const a = assessProduct({ name: row.name, category: "", ingredients: row.ingredients, source: { foodCategory: row.category }, additiveCodes: [] });
  const why = [
    ...a.flags.map(f => `${f.entry.name} (“${f.matchedText}”)`),
    ...a.concerns.map(c => c.reason),
  ].join(" · ") || "(nothing)";
  const label = row.ingredients.length > 600 ? `${row.ingredients.slice(0, 600)}…` : row.ingredients;
  return [
    `### ${n}. ${row.brand} — ${row.name}  (${row.barcode}, ${row.category})`,
    `Kind: ${kind} | Badge now: ${a.verdict} (stored: ${row.verdict})`,
    `Why: ${why}`,
    `Label: ${label}`,
    "",
  ].join("\n");
}

/** Splits entries into batches of at most `size`. */
export function toBatches(entries, size) {
  const out = [];
  for (let i = 0; i < entries.length; i += size) out.push(entries.slice(i, i + size));
  return out;
}

/** Every row's key, level and category, paged along the primary key. (A filtered count or an offset into a filtered list
 *  reads the whole table and hits the public role's 3 s statement timeout on 430k rows.) */
async function allKeys(db) {
  const out = [];
  for (let last = ""; ;) {
    const { data, error } = await db.from("foods").select("barcode_key, verdict, category")
      .gt("barcode_key", last).order("barcode_key").limit(1000);
    if (error) throw new Error(error.message || `reading foods failed (${error.code ?? "no code"})`);
    out.push(...data);
    if (data.length < 1000) return out;
    last = data.at(-1).barcode_key;
  }
}

/** `n` items drawn at random without repeats (Fisher-Yates). */
export function pick(items, n) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/** The full rows for these keys, in the same order. */
async function rowsFor(db, keys) {
  const byKey = new Map();
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await db.from("foods").select("*").in("barcode_key", keys.slice(i, i + 100));
    if (error) throw new Error(error.message || "reading foods failed");
    for (const r of data) byKey.set(r.barcode_key, r);
  }
  return keys.map(k => byKey.get(k)).filter(Boolean);
}

const MEAT = ["Pepperoni, Salami & Cold Cuts", "Sausages, Hotdogs & Brats"];

if (import.meta.main) {
  process.loadEnvFile(".env");
  const [dir, hk, sm, sz] = process.argv.slice(2);
  if (!dir) { console.error("Usage: node scripts/audit-foods.mjs <out-dir> [highKnown=200] [some=100] [batchSize=40]"); process.exit(1); }
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const keys = await allKeys(db);
  const flagged = [
    ...pick(keys.filter(k => k.verdict === "high" || k.verdict === "known"), Number(hk) || 200),
    ...pick(keys.filter(k => k.verdict === "some"), Number(sm) || 100),
  ].map(k => k.barcode_key);
  const meatKeys = keys.filter(k => k.verdict === "none" && MEAT.includes(k.category)).slice(0, 500).map(k => k.barcode_key);
  const flaggedRows = await rowsFor(db, flagged), meat = await rowsFor(db, meatKeys);
  const rows = [...flaggedRows.map(r => [r, "flagged"]), ...meat.map(r => [r, "clean-meat"])];
  const entries = rows.map(([row, kind], i) => entryText(row, i + 1, kind));
  mkdirSync(dir, { recursive: true });
  const batches = toBatches(entries, Number(sz) || 40);
  batches.forEach((b, i) => writeFileSync(`${dir}/batch-${String(i + 1).padStart(2, "0")}.md`, b.join("\n")));
  console.log(`${keys.length} rows read; ${entries.length} entries (${flaggedRows.length} flagged, ${meat.length} clean-meat) in ${batches.length} batches in ${dir}`);
}

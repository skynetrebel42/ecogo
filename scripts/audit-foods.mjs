// Draws the launch-audit sample from the live `foods` table and writes it as numbered batch files for reviewers (spec O8):
// a random sample of flagged products (High/Known and Some badges), plus every "Nothing flagged" product in the
// processed-meat categories and up to 150 named like one. Each entry shows the badge, the reasons the app's own engine
// gives, and the label text; prompt.md beside the batches is the first-pass prompt.
//   node scripts/audit-foods.mjs <out-dir> [highKnown=200] [some=100] [batchSize=40]
//   node scripts/audit-foods.mjs --recheck <out-dir> <sample-dir>...   (targeted gate, see recheck())
// Reads with the public key (the table is world-readable). ponytail: a one-off helper run once per import.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assessProduct } from "../src/lib/safety/assess.ts";

/** One numbered entry: kind is "flagged" (a High/Known/Some badge to confirm) or "clean-meat" (a 'Nothing flagged' to confirm). */
export function entryText(row, n, kind) {
  const a = assessProduct({ name: row.name, category: "", ingredients: row.ingredients, source: { foodCategory: row.category }, additiveCodes: [] });
  const why = [
    ...a.flags.map(f => `${f.entry.name} (“${f.matchedText}”)`),
    ...a.concerns.map(c => c.reason),
  ].join(" · ") || "(nothing)";
  const label = row.ingredients; // full label (M10.2): a cut hid the finding and made the first pass "unsure"
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
    const { data, error } = await db.from("foods").select("barcode_key, verdict, category, name")
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

// M10.2 spec §6 step 3: every "Nothing flagged" product in these USDA categories; in the generic prepared-meat and "Other"
// meat categories, every one named like processed meat; plus up to 150 named like it anywhere else.
const MEAT = new Set(["Pepperoni, Salami & Cold Cuts", "Sausages, Hotdogs & Brats", "Frozen Sausages, Hotdogs & Brats",
  "Canned Meat", "Bacon, Sausages & Ribs", "Frozen Bacon, Sausages & Ribs", "Sausages/Smallgoods", "Bacon",
  "Salami / Cured Meat", "Ham/Cold Meats"]);
export const meatCategory = c => MEAT.has(c) || /^Meat\/Poultry\/Other Animals Sausages\b.*Prepared\/Processed$/.test(c);
export const genericMeatCategory = c => /^(?:Meat\/Poultry\/Other Animals -? ?Prepared\/Processed|Other Meats|Other Frozen Meats)$/.test(c.replace(/\s+/g, " "));
export const MEAT_NAME = /\b(?:hams?|bacon|sausages?|salamis?|pepperoni|hot ?dogs?|franks?|jerky|bologna|links?|ribs|meat ?balls?|roast beef)\b/i;

/** The first-pass prompt (M10 plan Task 5 step 7, with the M10.1 and M10.2 spec §6 step 4 and M10.3 §6 step 3 additions); <BATCH> is the batch file's path. */
export const PROMPT = `You are checking safety badges on packaged foods. Read the batch file <BATCH>. Each numbered entry shows a product, the badge a program gave it ("Badge now"), the reasons it gave ("Why"), and the label's ingredient text ("Label"). Judge ONLY from the text in the entry; use no outside knowledge about the brand or the product.

For entries with Kind: flagged, decide whether the badge is supported by the label:
- "some" (Some concern) is supported only if an additive named in "Why" really appears on the label as that additive (including its E-number, or a "Lake" form), not a different substance that merely shares letters.
- "high" (High concern) or "known" (Known carcinogen) is supported only if the label really contains the finding named in "Why": a listed additive, or processed meat (hot dogs, bacon, ham, sausage, salami, pepperoni, jerky, cured or smoked meat and the like). A product named after meat but made without it (plant-based, vegan, veggie, meat-free), a flavouring ("bacon flavor"), a bun, a sauce or seasoning meant to go with the meat, or a dish that merely contains a little meat is NOT the processed meat itself: "Contains processed meat" is supported only if the label lists such meat as an ingredient.
For entries with Kind: clean-meat the badge is "none": decide whether that is right. It is WRONG if the label shows the product is processed meat or contains it (a missed flag).
Processed meat includes canned and deli chicken and turkey, and deli roast beef in a salt or preservative solution (WHO/IARC: meat transformed through salting, curing, fermentation, smoking or other processes to enhance flavour or improve preservation). It does NOT include a fresh cut (for example 'Pork Ham Bone In' with the label 'Pork'), bacon FAT alone, imitation bacon bits, fish, or a product whose name only says 'flavored'.
Processed meat also includes sausage links, patties and breakfast sausage, and meatballs or ribs that are smoked, cured (celery powder or juice, nitrite, nitrate) or preserved (sodium or potassium lactate, sodium diacetate). It does NOT include plain ground-meat meatballs or ribs (meat, salt, spices, phosphate only), burger patties, 'smoke flavor' on its own, or chicken injected with a solution.
A roast beef in an added brine or solution (water and salt, a stated solution, a preservative or cultured sugar and vinegar) is processed meat; plain cooked beef with salt and pepper, a flavour called roast beef, and roast beef in a gravy are not. 'Franks Red Hot' is a sauce. Coconut or crab 'meat' is not meat.

Answer with exactly one line per entry and nothing else:
<number> | correct | "<the label phrase you relied on>" | <at most 10 words>
<number> | false | "<the label phrase>" | <at most 10 words: why the badge is wrong>
<number> | unsure | "<the label phrase>" | <at most 10 words: what is unclear>
`;

/** Barcode key → kind of every entry in earlier batch files' text (a later file wins). */
export function sampleKinds(texts) {
  const kinds = new Map();
  for (const t of texts)
    for (const m of t.replace(/\r\n/g, "\n").matchAll(/^### \d+\. .*\((\d+), [^\n]*\)\nKind: (\S+)/gm)) kinds.set(m[1].replace(/^0+/, ""), m[2]);
  return kinds;
}

/** Targeted gate (M10.3 §6, decision 031): re-scores earlier samples with today's engine. Writes changed.md (every entry
 *  whose badge differs from the row's stored verdict; run it while the table still holds the previous engine's scores),
 *  and 50 random unchanged entries as spot-NN.md batches with prompt.md. */
async function recheck(db, dir, sampleDirs) {
  const texts = sampleDirs.flatMap(d => readdirSync(d).filter(f => /^batch-\d+\.md$/.test(f)).sort().map(f => readFileSync(`${d}/${f}`, "utf8")));
  const kinds = sampleKinds(texts);
  const rows = await rowsFor(db, [...kinds.keys()]);
  const verdict = r => assessProduct({ name: r.name, category: "", ingredients: r.ingredients, source: { foodCategory: r.category }, additiveCodes: [] }).verdict;
  const changed = rows.filter(r => verdict(r) !== r.verdict), unchanged = rows.filter(r => verdict(r) === r.verdict);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/changed.md`, changed.map((r, i) => entryText(r, i + 1, verdict(r) === "none" ? "clean-meat" : "flagged")).join("\n"));
  const spot = pick(unchanged, 50).map((r, i) => entryText(r, i + 1, kinds.get(r.barcode_key)));
  toBatches(spot, 40).forEach((b, i) => writeFileSync(`${dir}/spot-${String(i + 1).padStart(2, "0")}.md`, b.join("\n")));
  writeFileSync(`${dir}/prompt.md`, PROMPT);
  const revs = [...new Set(rows.map(r => r.engine_rev))].join(", ");
  console.log(`${kinds.size} sample entries, ${rows.length} rows found (stored engine_rev ${revs}); ${changed.length} change, ${spot.length} unchanged in the spot check, in ${dir}`);
}

if (import.meta.main) {
  process.loadEnvFile(".env");
  if (process.argv[2] === "--recheck") {
    const [dir, ...samples] = process.argv.slice(3);
    if (!dir || !samples.length) { console.error("Usage: node scripts/audit-foods.mjs --recheck <out-dir> <sample-dir>..."); process.exit(1); }
    await recheck(createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY), dir, samples);
    process.exit(0);
  }
  const [dir, hk, sm, sz] = process.argv.slice(2);
  if (!dir) { console.error("Usage: node scripts/audit-foods.mjs <out-dir> [highKnown=200] [some=100] [batchSize=40]"); process.exit(1); }
  const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const keys = await allKeys(db);
  const flagged = [
    ...pick(keys.filter(k => k.verdict === "high" || k.verdict === "known"), Number(hk) || 200),
    ...pick(keys.filter(k => k.verdict === "some"), Number(sm) || 100),
  ].map(k => k.barcode_key);
  const none = keys.filter(k => k.verdict === "none");
  const meatKeys = [
    ...none.filter(k => meatCategory(k.category) || (genericMeatCategory(k.category) && MEAT_NAME.test(k.name))),
    ...pick(none.filter(k => !meatCategory(k.category) && !genericMeatCategory(k.category) && MEAT_NAME.test(k.name)), 150),
  ].map(k => k.barcode_key);
  const flaggedRows = await rowsFor(db, flagged), meat = await rowsFor(db, meatKeys);
  const rows = [...flaggedRows.map(r => [r, "flagged"]), ...meat.map(r => [r, "clean-meat"])];
  const entries = rows.map(([row, kind], i) => entryText(row, i + 1, kind));
  mkdirSync(dir, { recursive: true });
  const batches = toBatches(entries, Number(sz) || 40);
  batches.forEach((b, i) => writeFileSync(`${dir}/batch-${String(i + 1).padStart(2, "0")}.md`, b.join("\n")));
  writeFileSync(`${dir}/prompt.md`, PROMPT);
  console.log(`${keys.length} rows read; ${entries.length} entries (${flaggedRows.length} flagged, ${meat.length} clean-meat) in ${batches.length} batches in ${dir}`);
}

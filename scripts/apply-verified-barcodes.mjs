// Applies src/data/verified-barcodes.json to src/data/products.csv (barcode, name, ingredients; removed → empty
// barcode) and prints the matching SQL migration. Usage: node scripts/apply-verified-barcodes.mjs > migration.sql
// Rerun whenever the JSON changes; the DB change itself goes through a new migration (never edit applied ones).
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("src/data/verified-barcodes.json", root), "utf8"));
const csvPath = new URL("src/data/products.csv", root);
const text = readFileSync(csvPath, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";

/** Split one CSV line into fields, keeping quoted commas; "" is an escaped quote. */
function split(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const quote = (v) => (/[",\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v);
const quoteAlways = (v) => `"${v.replace(/"/g, '""')}"`;

const lines = text.split(/\r?\n/);
const header = split(lines[0]);
const col = (name) => { const i = header.indexOf(name); if (i < 0) throw new Error(`no column ${name}`); return i; };
const [ID, BARCODE, NAME, INGREDIENTS] = ["id", "barcode", "product_name", "ingredients"].map(col);
const byId = new Map(data.verified.map((v) => [String(v.id), v]));
const removed = new Set(data.removed.map((r) => String(r.id)));
let touched = 0;
const outLines = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const f = split(line);
  const v = byId.get(f[ID]);
  if (!v && !removed.has(f[ID])) return line;
  touched++;
  if (v) { f[BARCODE] = v.barcode; f[NAME] = v.name; f[INGREDIENTS] = v.ingredients; } else f[BARCODE] = "";
  return f.map((x, j) => (j === NAME || j === INGREDIENTS ? quoteAlways(x) : quote(x))).join(",");
});
writeFileSync(csvPath, outLines.join(nl));
console.error(`products.csv: ${touched} rows updated`);

const sql = (s) => `'${s.replace(/'/g, "''")}'`;
console.log(`-- Real catalog barcodes (K-29). The Figma export invented them; each verified product now carries the barcode,`);
console.log(`-- name and full ingredient label of its USDA FoodData Central record (checked ${data.checkedOn}, approved by the`);
console.log(`-- owner). Products with no reliable match lose their barcode so a scan can never open the wrong product.`);
for (const v of data.verified) {
  console.log(`update public.products set barcode = ${sql(v.barcode)}, name = ${sql(v.name)}, ingredients = ${sql(v.ingredients)} where id = ${v.id}; -- fdcId ${v.fdcId}`);
}
console.log(`update public.products set barcode = null where id in (${data.removed.map((r) => r.id).join(", ")});`);

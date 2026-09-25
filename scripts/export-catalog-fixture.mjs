// Exports { id, name, category, ingredients } for every product in src/data/products.csv,
// using the app's own CSV importer (loaded through Vite so its "?raw" CSV import works).
// Usage: node scripts/export-catalog-fixture.mjs [outFile]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.argv[3] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = process.argv[2] ?? path.join(root, "src/lib/safety/fixtures/catalog.json");
const vite = await import(pathToFileURL(createRequire(path.join(root, "package.json")).resolve("vite")).href);
const server = await vite.createServer({
  root, configFile: path.join(root, "vite.config.ts"), appType: "custom", logLevel: "error",
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { PRODUCTS } = await server.ssrLoadModule("/src/lib/productImporter.ts");
  const fixture = PRODUCTS.map(({ id, name, category, ingredients }) => ({ id, name, category, ingredients }));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Wrote ${fixture.length} products to ${path.relative(root, outFile)}`);
} finally {
  await server.close();
}

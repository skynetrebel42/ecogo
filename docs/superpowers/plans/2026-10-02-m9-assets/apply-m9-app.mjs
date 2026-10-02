// M9 plan, Task 3: brings the Map tab back in App.tsx and types `resources` rows in catalog.ts.
// Run from the repo root: node <this file>. Each anchor must match exactly once; files keep CRLF line endings.
import { readFileSync, writeFileSync } from "node:fs";

function patch(path, edits) {
  const crlf = readFileSync(path, "utf8").includes("\r\n");
  let text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  for (const [from, to] of edits) {
    const n = text.split(from).length - 1;
    if (n !== 1) throw new Error(`${path}: expected 1 match, found ${n}:\n${from}`);
    text = text.replace(from, () => to);
  }
  writeFileSync(path, crlf ? text.replace(/\n/g, "\r\n") : text);
  console.log(`patched ${path} (${edits.length} edits)`);
}

patch("src/app/App.tsx", [
  [`import { loadCatalog } from "../lib/catalog";\n`,
   `import { loadCatalog, type ResourceRow } from "../lib/catalog";\nimport MapTab from "./components/MapTab";\n`],
  [`  Home, Camera, Heart, User,`, `  Home, Map as MapIcon, Camera, Heart, User,`],
  [`// The Map tab is hidden until it shows real places (M7.4 spec M1); MapTab.tsx stays in the repo, unimported.\ntype Tab = "home" | "scan" | "saved" | "profile";`,
   `// The Map is back with real Los Angeles places from OpenStreetMap (M9).\ntype Tab = "home" | "map" | "scan" | "saved" | "profile";`],
  [`  { name: "FDA % Daily Value", text: "Sugar, saturated fat and salt per serving, by the FDA's 5/20 rule." },\n];`,
   `  { name: "FDA % Daily Value", text: "Sugar, saturated fat and salt per serving, by the FDA's 5/20 rule." },\n  { name: "OpenStreetMap", text: "Map places, community-edited. Hours can change." },\n];`],
  [`Your recently scanned list stays in this browser.</p>\n`,
   `Your recently scanned list stays in this browser.</p>\n        <p className="text-xs text-foreground/80 leading-relaxed">The map asks for your location only when you tap My location. It stays on your phone. Map images load from OpenStreetMap.</p>\n`],
  [`    { id: "home",    Icon: Home,   label: "Home"    },\n`,
   `    { id: "home",    Icon: Home,   label: "Home"    },\n    { id: "map",     Icon: MapIcon, label: "Map"    },\n`],
  [`  const [products, setProducts] = useState<Product[]>(PRODUCTS);\n`,
   `  const [products, setProducts] = useState<Product[]>(PRODUCTS);\n  // The Map's places come only from the database: no bundled copy (M9 spec D11).\n  const [places, setPlaces] = useState<ResourceRow[]>([]);\n`],
  [`      setProducts(catalog.products);\n`, `      setProducts(catalog.products);\n      setPlaces(catalog.resources);\n`],
  [`                  {activeTab === "scan"    && (`,
   `                  {activeTab === "map"     && <MapTab places={places} status={dbStatus} />}\n                  {activeTab === "scan"    && (`],
]);

patch("src/lib/catalog.ts", [
  [`// catalog.ts — reads the product catalog and community resources from Supabase.`,
   `// catalog.ts — reads the product catalog and the Map's food places (\`resources\`) from Supabase.`],
  [`import type { Product } from "./productImporter";\n`,
   `import type { Product } from "./productImporter";\nimport type { Place } from "./osmPlaces";\n`],
  [`export interface ResourceRow {
  id: number;
  name: string;
  type: string;
  address: string;
  hours: string;
  phone: string | null;
  description: string;
  latitude: number;
  longitude: number;
  rating: number | null;
}`,
   `/** A food place on the Map: an OpenStreetMap snapshot row (M9; see osmPlaces.ts). */
export type ResourceRow = Place & { id: number };`],
]);

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get("/make-server-504b3bba/health", (c) => c.json({ status: "ok" }));

// ── Default data ──────────────────────────────────────────────────────────────

const DEFAULT_RESOURCES = [
  { id: 1,  name: "Community Food Pantry",   type: "food-bank",   address: "142 Oak Street",       hours: "Mon–Fri 9am–5pm",      phone: "(555) 234-5678", description: "Hot meals and dry goods. No ID required.", x: 78,  y: 144 },
  { id: 2,  name: "Second Harvest Hub",      type: "food-bank",   address: "389 Maple Avenue",     hours: "Daily 8am–7pm",        phone: "(555) 876-5432", description: "Fresh produce and pantry staples. 200+ families weekly.", x: 568, y: 222 },
  { id: 3,  name: "Goodwill Drop-Off",       type: "donation",    address: "55 Central Boulevard", hours: "Mon–Sat 8am–8pm",      phone: "(555) 345-6789", description: "Clothing, furniture, electronics. Tax receipt provided.", x: 372, y: 66  },
  { id: 4,  name: "Habitat ReStore",         type: "donation",    address: "201 Pine Road",        hours: "Tue–Sat 9am–6pm",      phone: "(555) 456-7890", description: "Home improvement items and appliances.", x: 176, y: 378 },
  { id: 5,  name: "Winter Warmth Drive",     type: "clothing",    address: "78 Elm Street",        hours: "Wed–Sun 10am–4pm",     phone: "(555) 567-8901", description: "Coats, hats, and warm clothing for all ages.", x: 470, y: 144 },
  { id: 6,  name: "Thread & Share Co-op",    type: "clothing",    address: "315 Birch Way",        hours: "Mon, Wed, Fri 12–6pm", phone: "(555) 678-9012", description: "Free clothing exchange — take what you need.", x: 666, y: 66  },
  { id: 7,  name: "Community Bike Shop",     type: "bike-repair", address: "92 River Drive",       hours: "Sat–Sun 10am–3pm",     phone: "(555) 789-0123", description: "Free repairs, tire changes, and safety checks.", x: 78,  y: 222 },
  { id: 8,  name: "Pedal Forward Workshop",  type: "bike-repair", address: "420 Lake Avenue",      hours: "Tue, Thu 4pm–8pm",     phone: "(555) 890-1234", description: "DIY repair station with tools and spare parts.", x: 470, y: 300 },
  { id: 9,  name: "City Hall Restrooms",     type: "restroom",    address: "1 Civic Plaza",        hours: "Mon–Fri 7am–9pm",      phone: null,             description: "Clean, accessible public restrooms. ADA compliant.", x: 372, y: 222 },
  { id: 10, name: "Central Park Facilities", type: "restroom",    address: "Park Boulevard",       hours: "Daily 6am–10pm",       phone: null,             description: "Restrooms and water fountains throughout the park.", x: 225, y: 261 },
  { id: 11, name: "Public Library WiFi",     type: "wifi",        address: "250 Knowledge Drive",  hours: "Mon–Sat 8am–8pm",      phone: "(555) 901-2345", description: "High-speed internet. Computers available.", x: 666, y: 222 },
  { id: 12, name: "Community Center WiFi",   type: "wifi",        address: "88 Unity Avenue",      hours: "Daily 7am–11pm",       phone: "(555) 012-3456", description: "Free WiFi, charging stations, and computer terminals.", x: 470, y: 222 },
];

const DEFAULT_PRODUCTS = [
  { id: 1, name: "Lay's Classic Potato Chips 8oz",       brand: "Frito-Lay / PepsiCo",          category: "Snacks",   amazon_price: 3.98,  amazon_rating: 4.5, walmart_price: 3.48,  walmart_rating: 4.3, fb_price: 2.00,  fb_condition: "Unopened",     ethical_score: "C", safety_score: 62, keywords: ["chips","lays","snacks","potato"],           flagged_ingredients: [], ingredients: "Potatoes, Vegetable Oil, Salt." },
  { id: 2, name: "Tide PODS Laundry Detergent 42ct",     brand: "Procter & Gamble",             category: "Cleaning", amazon_price: 13.97, amazon_rating: 4.8, walmart_price: 12.94, walmart_rating: 4.7, fb_price: 10.00, fb_condition: "Partial box",  ethical_score: "D", safety_score: 38, keywords: ["tide","laundry","detergent","pods"],        flagged_ingredients: [], ingredients: "Anionic surfactants, enzymes, fragrance, methylisothiazolinone." },
  { id: 3, name: "KIND Bars Variety Pack 12ct",           brand: "KIND Snacks (Mars Inc.)",      category: "Snacks",   amazon_price: 14.99, amazon_rating: 4.6, walmart_price: 13.88, walmart_rating: 4.5, fb_price: null,  fb_condition: null,           ethical_score: "B", safety_score: 81, keywords: ["kind","bars","granola","healthy","nuts"],   flagged_ingredients: [], ingredients: "Almonds, honey, glucose syrup, palm kernel oil, soy lecithin, sea salt." },
  { id: 4, name: "Gatorade Thirst Quencher 12×20oz",     brand: "PepsiCo",                      category: "Beverages",amazon_price: 18.99, amazon_rating: 4.7, walmart_price: 16.98, walmart_rating: 4.6, fb_price: 12.00, fb_condition: "Sealed case",  ethical_score: "C", safety_score: 55, keywords: ["gatorade","sports drink","beverage"],       flagged_ingredients: [], ingredients: "Water, sucrose, dextrose, citric acid, Red 40, Blue 1." },
  { id: 5, name: "Seventh Generation Free & Clear",       brand: "Seventh Generation (Unilever)",category: "Cleaning", amazon_price: 18.49, amazon_rating: 4.4, walmart_price: 17.97, walmart_rating: 4.3, fb_price: null,  fb_condition: null,           ethical_score: "A", safety_score: 92, keywords: ["seventh generation","laundry","natural","eco"], flagged_ingredients: [], ingredients: "Water, sodium gluconate, sodium lauryl sulfate, lauramine oxide." },
  { id: 6, name: "Oscar Mayer Beef Hot Dogs 10ct",        brand: "Kraft Heinz",                  category: "Meat",     amazon_price: 5.99,  amazon_rating: 4.2, walmart_price: 4.98,  walmart_rating: 4.1, fb_price: 3.50,  fb_condition: "Fresh",        ethical_score: "D", safety_score: 28, keywords: ["hot dogs","beef","meat","wieners"],         flagged_ingredients: [], ingredients: "Beef, water, corn syrup, dextrose, salt, sodium nitrite." },
  { id: 7, name: "Diet Coke 12-Pack Cans",                brand: "The Coca-Cola Company",        category: "Beverages",amazon_price: 7.99,  amazon_rating: 4.5, walmart_price: 6.98,  walmart_rating: 4.4, fb_price: 5.00,  fb_condition: "Sealed",       ethical_score: "C", safety_score: 48, keywords: ["diet coke","soda","cola","beverage"],       flagged_ingredients: [], ingredients: "Carbonated water, caramel color, aspartame, phosphoric acid, caffeine." },
];

const DEFAULT_PARTNERS = [
  { id: 1, name: "GreenLeaf Organic Market", type: "Grocery",         ethical_score: "A", emoji: "🌿", services: ["10% community discount","Weekly produce drives","Local sourcing within 150mi"],       offer: "15% off + free reusable bag for community card holders", since: "2019" },
  { id: 2, name: "City Cycles Cooperative",   type: "Transportation",  ethical_score: "A", emoji: "🚲", services: ["Free safety inspections","Pay-what-you-can repairs","30-day bike lending library"],  offer: "Free inner tube + patch kit with any visit",             since: "2021" },
  { id: 3, name: "ReThreaded Clothing Co.",   type: "Retail",          ethical_score: "B", emoji: "👕", services: ["100% second-hand inventory","Living wage certified","Clothing vouchers for families"],offer: "Buy-one-get-one on all thrifted items Saturdays",        since: "2020" },
  { id: 4, name: "Sunrise Community Health",  type: "Healthcare",      ethical_score: "A", emoji: "🏥", services: ["Sliding-scale fees","Free quarterly screenings","Multilingual staff (12 languages)"],offer: "Free 30-min initial consultation, no referral needed",   since: "2018" },
  { id: 5, name: "Fair Ground Coffee",         type: "Food & Beverage", ethical_score: "A", emoji: "☕", services: ["Direct-trade beans","10% profits to community fund","Free workspace Mon–Thu"],       offer: "Free drip coffee during job-search hours (10am–2pm)",   since: "2022" },
  { id: 6, name: "MegaMart Retail",           type: "Big Box Retail",  ethical_score: "D", emoji: "🏪", services: ["Price match guarantee","Curbside pickup"],                                             offer: "5% off select items with community card",               since: "2023" },
];

// ── Seed (run once) ───────────────────────────────────────────────────────────

app.get("/make-server-504b3bba/commons/seed", async (c) => {
  const existing = await kv.get("commons_resources");
  if (!existing || (Array.isArray(existing) && existing.length === 0)) {
    await kv.mset(
      ["commons_resources", "commons_products", "commons_partners"],
      [DEFAULT_RESOURCES, DEFAULT_PRODUCTS, DEFAULT_PARTNERS]
    );
    return c.json({ seeded: true });
  }
  return c.json({ seeded: false, count: (existing as any[]).length });
});

app.post("/make-server-504b3bba/commons/seed", async (c) => {
  await kv.mset(
    ["commons_resources", "commons_products", "commons_partners"],
    [DEFAULT_RESOURCES, DEFAULT_PRODUCTS, DEFAULT_PARTNERS]
  );
  return c.json({ seeded: true });
});

// ── Resources CRUD ────────────────────────────────────────────────────────────

app.get("/make-server-504b3bba/commons/resources", async (c) => c.json(await kv.get("commons_resources") ?? []));

app.post("/make-server-504b3bba/commons/resources", async (c) => {
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_resources") ?? [];
  const id = current.length > 0 ? Math.max(...current.map((r: any) => r.id)) + 1 : 1;
  const newItem = { ...body, id };
  await kv.set("commons_resources", [...current, newItem]);
  return c.json(newItem, 201);
});

app.put("/make-server-504b3bba/commons/resources/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_resources") ?? [];
  await kv.set("commons_resources", current.map((r: any) => r.id === id ? { ...r, ...body, id } : r));
  return c.json({ ok: true });
});

app.delete("/make-server-504b3bba/commons/resources/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const current: any[] = await kv.get("commons_resources") ?? [];
  await kv.set("commons_resources", current.filter((r: any) => r.id !== id));
  return c.json({ ok: true });
});

// ── Products CRUD ─────────────────────────────────────────────────────────────

app.get("/make-server-504b3bba/commons/products", async (c) => c.json(await kv.get("commons_products") ?? []));

app.post("/make-server-504b3bba/commons/products", async (c) => {
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_products") ?? [];
  const id = current.length > 0 ? Math.max(...current.map((r: any) => r.id)) + 1 : 1;
  const newItem = { ...body, id };
  await kv.set("commons_products", [...current, newItem]);
  return c.json(newItem, 201);
});

app.put("/make-server-504b3bba/commons/products/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_products") ?? [];
  await kv.set("commons_products", current.map((r: any) => r.id === id ? { ...r, ...body, id } : r));
  return c.json({ ok: true });
});

app.delete("/make-server-504b3bba/commons/products/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const current: any[] = await kv.get("commons_products") ?? [];
  await kv.set("commons_products", current.filter((r: any) => r.id !== id));
  return c.json({ ok: true });
});

// ── Partners CRUD ─────────────────────────────────────────────────────────────

app.get("/make-server-504b3bba/commons/partners", async (c) => c.json(await kv.get("commons_partners") ?? []));

app.post("/make-server-504b3bba/commons/partners", async (c) => {
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_partners") ?? [];
  const id = current.length > 0 ? Math.max(...current.map((r: any) => r.id)) + 1 : 1;
  await kv.set("commons_partners", [...current, { ...body, id }]);
  return c.json({ ok: true }, 201);
});

app.put("/make-server-504b3bba/commons/partners/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  const current: any[] = await kv.get("commons_partners") ?? [];
  await kv.set("commons_partners", current.map((r: any) => r.id === id ? { ...r, ...body, id } : r));
  return c.json({ ok: true });
});

app.delete("/make-server-504b3bba/commons/partners/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const current: any[] = await kv.get("commons_partners") ?? [];
  await kv.set("commons_partners", current.filter((r: any) => r.id !== id));
  return c.json({ ok: true });
});

// ── Scan History ──────────────────────────────────────────────────────────────

/** Return all scan events, newest first. */
app.get("/make-server-504b3bba/commons/scan-history", async (c) => {
  const history: any[] = await kv.get("scan_history") ?? [];
  return c.json([...history].sort((a, b) =>
    new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
  ));
});

/** Record a new scan event. Assigns a sequential id and persists. */
app.post("/make-server-504b3bba/commons/scan-history", async (c) => {
  const body = await c.req.json();
  const current: any[] = await kv.get("scan_history") ?? [];
  const id = current.length > 0 ? Math.max(...current.map((s: any) => s.id ?? 0)) + 1 : 1;
  const event = {
    id,
    barcode:        body.barcode        ?? "",
    product_id:     body.product_id     ?? null,
    product_name:   body.product_name   ?? "Unknown Product",
    store:          body.store          ?? "unknown",
    price:          body.price          ?? null,
    scanned_at:     body.scanned_at     ?? new Date().toISOString(),
    latitude:       body.latitude       ?? null,
    longitude:      body.longitude      ?? null,
    is_placeholder: body.is_placeholder ?? false,
    note:           body.note           ?? "",
  };
  await kv.set("scan_history", [...current, event]);
  return c.json(event, 201);
});

/** Aggregate statistics across all scan events. */
app.get("/make-server-504b3bba/commons/scan-history/stats", async (c) => {
  const history: any[] = await kv.get("scan_history") ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const productCounts: Record<string, { name: string; count: number }> = {};
  for (const s of history) {
    if (s.product_id != null) {
      const key = String(s.product_id);
      if (!productCounts[key]) productCounts[key] = { name: s.product_name, count: 0 };
      productCounts[key].count++;
    }
  }
  const topEntry = Object.values(productCounts).sort((a, b) => b.count - a.count)[0];

  return c.json({
    total_scans:           history.length,
    unique_products:       new Set(history.map((s: any) => s.product_id).filter(Boolean)).size,
    unknown_barcodes:      history.filter((s: any) => s.is_placeholder).length,
    scans_today:           history.filter((s: any) => String(s.scanned_at).startsWith(today)).length,
    most_scanned_product:  topEntry?.name ?? null,
  });
});

/**
 * Grouped summary of unrecognised barcodes — the "needs review" queue.
 * Sorted by scan count descending so the most-requested products surface first.
 */
app.get("/make-server-504b3bba/commons/scan-history/placeholders", async (c) => {
  const history: any[] = await kv.get("scan_history") ?? [];
  const placeholders = history.filter((s: any) => s.is_placeholder === true);

  const grouped: Record<string, any> = {};
  for (const s of placeholders) {
    const bc = s.barcode;
    if (!grouped[bc]) {
      grouped[bc] = { barcode: bc, scan_count: 0, first_seen: s.scanned_at, last_seen: s.scanned_at, locations: [] };
    }
    grouped[bc].scan_count++;
    if (s.scanned_at < grouped[bc].first_seen) grouped[bc].first_seen = s.scanned_at;
    if (s.scanned_at > grouped[bc].last_seen)  grouped[bc].last_seen  = s.scanned_at;
    if (s.latitude != null && s.longitude != null) {
      grouped[bc].locations.push({ lat: s.latitude, lng: s.longitude });
    }
  }

  const sorted = Object.values(grouped).sort((a: any, b: any) => b.scan_count - a.scan_count);
  return c.json(sorted);
});

Deno.serve(app.fetch);

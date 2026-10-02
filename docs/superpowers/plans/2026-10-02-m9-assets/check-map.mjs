// M9 (headless Edge): the Map shows real LA County food places from the database, credited to OpenStreetMap and dated;
// no ratings, open/closed guess or Chicago; a place card with hours note, Directions and "Fix it on OSM"; type chips;
// "My location" sorts by distance in LA, shows the "covers LA County" note elsewhere, and a note when location is off;
// tiles come from tile.openstreetmap.org; no database → "Places need a connection", never fake places.
// Usage: node docs/superpowers/plans/2026-10-02-m9-assets/check-map.mjs <url> [rows.json]
//   rows.json (dry run only, before the migration is live): served in place of the database's `resources` rows.
// Spec: docs/superpowers/specs/2026-10-02-m9-real-map-design.md §5.
import { spawn } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const ROWS = process.argv[3] ? readFileSync(process.argv[3], "utf8") : null;
const PORT = 9700 + Math.floor(Math.random() * 90);
const PROFILE = `${process.env.TEMP}\\ecogo-map-${PORT}`;
rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=900,1000",
  `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
setTimeout(() => { console.log("TIMEOUT"); edge.kill(); process.exit(1); }, 150000).unref?.();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
let ok = 0, total = 0;
const check = (name, pass, detail = "") => { total++; if (pass) ok++; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  let failResources = false;
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      if (failResources) send("Fetch.failRequest", { requestId, errorReason: "InternetDisconnected" });
      else if (ROWS && request.method === "GET") send("Fetch.fulfillRequest", { requestId, responseCode: 200, body: Buffer.from(ROWS).toString("base64"),
        responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }] });
      else send("Fetch.continueRequest", { requestId });
    }
  });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const helpers = () => run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s || b.getAttribute("aria-label") === s);
    window.__list = () => { const h = [...document.querySelectorAll("h3")].find(e => e.innerText === "Food places in LA County");
      return h ? [...h.parentElement.parentElement.querySelectorAll("button")].map(b => b.innerText.split("\\n")) : null; };
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Home")); if (b.innerText.includes("Look around")) { b.click(); await __sleep(400); } }; true`);
  const openMap = async () => { await helpers(); await run(`(async () => { await __guest(); __btn("Map").click(); await __until(() => __list()?.length > 0 || document.body.innerText.includes("Places need a connection"), 15000); await __sleep(500); })()`); };

  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/resources*", requestStage: "Request" }] });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await openMap();

  const nav = await run(`[...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Home", "Map", "Scan", "Saved", "Profile"].includes(s))`);
  check("bottom nav is Home, Map, Scan, Saved, Profile", JSON.stringify(nav) === '["Home","Map","Scan","Saved","Profile"]',
    `${JSON.stringify(nav)} ${nav?.length ? "" : (await run(`location.href + " " + document.body.innerText.slice(0, 200)`))}`);
  const list = await run(`__list()`);
  check("the list holds the database's places (more than 50)", list?.length > 50, `${list?.length} places`);
  const names = list?.map(x => x[0]) ?? [];
  check("…sorted A–Z", names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"));
  const t = await run(`document.body.innerText`);
  check("no ratings, open/closed guess, Smart Score or Chicago", !/★|Rating|Smart Score|\bOpen\b|\bClosed\b|Chicago|\(555\)/.test(t.replace(/OpenStreetMap/g, "")));
  const credit = await run(`[...document.querySelectorAll("a")].filter(a => a.innerText.includes("© OpenStreetMap contributors")).map(a => a.href)`);
  check("© OpenStreetMap contributors credit links the copyright page", credit?.includes("https://www.openstreetmap.org/copyright"), JSON.stringify(credit));
  check("the list says community-edited, as of <month year>, hours can change", /community-edited\), as of [A-Z][a-z]{2} 20\d\d\. Hours can change — check before you go\./.test(t));
  const tiles = await run(`performance.getEntriesByType("resource").map(e => e.name).filter(n => n.includes("tile.openstreetmap.org"))`);
  check("tiles load from tile.openstreetmap.org (no a/b/c subdomains)", tiles.length > 0 && tiles.every(n => n.startsWith("https://tile.openstreetmap.org/")), `${tiles.length} tiles`);

  // A place card
  const card = await run(`(async () => { const b = [...document.querySelectorAll("h3")].find(e => e.innerText === "Food places in LA County").parentElement.parentElement.querySelector("button");
    const name = b.innerText.split("\\n")[0]; b.click(); await __sleep(900);
    const links = Object.fromEntries([...document.querySelectorAll("a")].map(a => [a.innerText.trim(), a.href]));
    return { name, h: [...document.querySelectorAll("h3")].map(e => e.innerText), text: document.body.innerText, links }; })()`);
  check("tapping a place opens its card", card.h.includes(card.name), card.name);
  check("card: hours (or 'No hours listed') with the check-before-you-go note", card.text.includes("Hours can change — check before you go."));
  check("card: Directions opens Google Maps with only the place's position", /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+$/.test(card.links["Directions"] ?? ""), card.links["Directions"]);
  check("card: Fix it on OSM + the OSM object link + credit", /^https:\/\/www\.openstreetmap\.org\/edit\?(node|way|relation)=\d+$/.test(card.links["Fix it on OSM"] ?? "")
    && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(card.links["OpenStreetMap"] ?? "") && !!card.links["© OpenStreetMap contributors"]);
  await run(`(async () => { __btn("Close").click(); await __sleep(400); })()`);

  // Type chips
  const counts = await run(`(async () => { const n0 = __list().length; __btn("Gardens").click(); await __sleep(500); const n1 = __list().length;
    const pressed = __btn("Gardens").getAttribute("aria-pressed"); __btn("Gardens").click(); await __sleep(500); return [n0, n1, __list().length, pressed]; })()`);
  check("the Gardens chip hides and brings back gardens", counts[1] < counts[0] && counts[2] === counts[0] && counts[3] === "false", JSON.stringify(counts));

  // Location: only on tap; LA → nearest first; Chicago → the LA County note; denied → a note
  const origin = new URL(URL_).origin;
  await send("Browser.grantPermissions", { origin, permissions: ["geolocation"] });
  await send("Emulation.setGeolocationOverride", { latitude: 34.0997, longitude: -118.3283, accuracy: 10 }); // Hollywood
  const la = await run(`(async () => { __btn("My location").click(); await __until(() => document.body.innerText.includes("Nearest first"), 8000); await __sleep(400);
    return { text: document.body.innerText, first: __list()[0] }; })()`);
  check("My location in LA: nearest first, with distances", la.text.includes("Nearest first") && / (mi|ft)$/.test(la.first.at(-1)), JSON.stringify(la.first));
  await send("Emulation.setGeolocationOverride", { latitude: 41.8827, longitude: -87.6233, accuracy: 10 }); // Chicago
  const chi = await run(`(async () => { __btn("My location").click(); await __until(() => __btn("Back to LA"), 8000); return document.body.innerText; })()`);
  check("My location outside LA County: the 'covers LA County for now' note", chi.includes("The map covers LA County for now") && chi.includes("Your location stays on this phone."));
  const backed = await run(`(async () => { __btn("Back to LA").click(); await __sleep(600); return document.body.innerText; })()`);
  check("Back to LA closes the note; the list is A–Z again", !backed.includes("The map covers LA County") && backed.includes("A–Z · tap My location"));
  await send("Browser.setPermission", { origin, permission: { name: "geolocation" }, setting: "denied" });
  const off = await run(`(async () => { __btn("My location").click(); await __until(() => document.body.innerText.includes("Location is off"), 8000); return document.body.innerText; })()`);
  check("location denied: 'Location is off. Showing Los Angeles.'", off.includes("Location is off. Showing Los Angeles."));

  // Profile names OpenStreetMap and the location rule
  const p = await run(`(async () => { __btn("Profile").click(); await __sleep(500); return document.body.innerText; })()`);
  check("Profile: OpenStreetMap source and the map's location rule", p.includes("Map places, community-edited. Hours can change.")
    && p.includes("The map asks for your location only when you tap My location."));
  check("no console errors", errors.length === 0, errors.join(" | "));

  // No database → no places, never fake ones
  failResources = true;
  await send("Page.reload"); await sleep(4000);
  await openMap();
  const offline = await run(`({ text: document.body.innerText, list: __list()?.length ?? 0 })`);
  check("database unreachable: 'Places need a connection', no places", offline.text.includes("Places need a connection") && offline.list === 0, `${offline.list} places`);
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1);
}

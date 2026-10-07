// M13 (headless Edge): Map near me, layout A, on top of M9's checks. Copied from docs/archive/plans/2026-10-02-m9-assets/
// check-map.mjs and updated for docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md (D1-D5, D10).
// M9: real LA County food places from the database, credited to OpenStreetMap and dated; no ratings, open/closed guess or
// Chicago; a place card with hours note, Directions and "Fix it on OSM"; type chips; My location in LA sorts by distance,
// elsewhere shows the "covers LA County" note, and a note when location is off; tiles from tile.openstreetmap.org; no
// database → "Places need a connection", never fake places.
// M13: before a ZIP the list is A–Z with the "Enter a ZIP" line; ZIP 90017 → "N places within 10 mi of 90017", nearest
// first with distances; the 5 mi chip lowers the count; a ZIP not in the table shows the D4 note; "Nothing within 5 mi"
// offers the next size; the ZIP is never sent (no request contains it), stored or put in the URL; "Missing a place?" links
// to the OSM editor at the map's centre (D10); the chip reads "Free food".
// Usage: node docs/superpowers/specs/2026-10-07-m13-assets/check-map.mjs <url> [rows.json]
//   rows.json (dry run only, before a migration is live): served in place of the database's `resources` rows.
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
setTimeout(() => { console.log("TIMEOUT"); edge.kill(); process.exit(1); }, 300000).unref?.();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const requests = []; // every URL the page asked for after the ZIP checks start
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
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url + " " + (m.params.request.postData ?? ""));
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
    window.__list = () => { const ul = document.querySelector('ul[aria-label="Places"]'); return ul ? [...ul.querySelectorAll("button")].map(b => b.innerText.split("\\n")) : null; };
    window.__header = () => document.getElementById("map-list-title")?.innerText ?? "";
    window.__zip = async v => { const i = document.querySelector('input[aria-label="ZIP code"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(700); };
    window.__radius = async mi => { document.querySelector('input[name="radius"][value="' + mi + '"]').click(); await __sleep(600); };
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Home")); if (b.innerText.includes("Look around")) { b.click(); await __sleep(400); } }; true`);
  const openMap = async () => { await helpers(); await run(`(async () => { await __guest(); __btn("Map").click(); await __until(() => __list()?.length > 0 || document.body.innerText.includes("Places need a connection"), 15000); await __sleep(500); })()`); };
  const miles = row => { const d = row.at(-1); return / mi$/.test(d) ? Number(d.slice(0, -3)) : / ft$/.test(d) ? Number(d.slice(0, -3)) / 5280 : NaN; };

  await send("Runtime.enable");
  // Headless Edge sometimes starts the tab as "hidden": no animation frames (Leaflet never finishes a zoom, so the map's
  // centre never updates) and throttled timers (waits look like hangs). Keep the page visible and focused.
  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/resources*", requestStage: "Request" }] });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await openMap();

  const nav = await run(`[...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Home", "Map", "Scan", "Saved", "Profile"].includes(s))`);
  check("bottom nav is Home, Map, Scan, Saved, Profile", JSON.stringify(nav) === '["Home","Map","Scan","Saved","Profile"]',
    `${JSON.stringify(nav)} ${nav?.length ? "" : (await run(`location.href + " " + document.body.innerText.slice(0, 200)`))}`);
  const list = await run(`__list()`);
  check("the list holds the database's places (more than 50)", list?.length > 50, `${list?.length} places`);
  const names = list?.map(x => x[0].replace(/\*$/, "")) ?? []; // County rows end in "*" (D11)
  check("…sorted A–Z", names.join("|") === [...names].sort((a, b) => a.localeCompare(b)).join("|"));
  const t = await run(`document.body.innerText`);
  check("before a ZIP: 'Enter a ZIP or tap My location to see what's near you'", t.includes("Enter a ZIP or tap My location to see what's near you"));
  const chips = await run(`[...document.querySelectorAll("button[aria-pressed]")].map(b => b.innerText.trim())`);
  check("type chips: Free food, Farmers markets, Gardens (D5)", JSON.stringify(chips) === '["Free food","Farmers markets","Gardens"]', JSON.stringify(chips));
  // "Open 24 hours, every day" is OSM's own opening_hours=24/7 in words (community fridges, M13), not a guess.
  check("no ratings, open/closed guess, Smart Score or Chicago",
    !/★|Rating|Smart Score|\bOpen\b|\bClosed\b|Chicago|\(555\)/.test(t.replace(/OpenStreetMap|Open 24 hours, every day/g, "")));
  const credit = await run(`[...document.querySelectorAll("a")].filter(a => a.innerText.includes("© OpenStreetMap contributors")).map(a => a.href)`);
  check("© OpenStreetMap contributors credit links the copyright page", credit?.includes("https://www.openstreetmap.org/copyright"), JSON.stringify(credit));
  check("the list says community-edited, as of <month year>, hours can change", /community-edited\), as of [A-Z][a-z]{2} 20\d\d\. Hours can change — check before you go\./.test(t));
  const tiles = await run(`performance.getEntriesByType("resource").map(e => e.name).filter(n => n.includes("tile.openstreetmap.org"))`);
  check("tiles load from tile.openstreetmap.org (no a/b/c subdomains)", tiles.length > 0 && tiles.every(n => n.startsWith("https://tile.openstreetmap.org/")), `${tiles.length} tiles`);

  // An OSM place card (D1: it replaces the list, with Back); County rows end in "*"
  const card = await run(`(async () => { const b = [...document.querySelectorAll('ul[aria-label="Places"] button')].find(b => !/\\*$/.test(b.innerText.split("\\n")[0]));
    const name = b.innerText.split("\\n")[0]; b.click(); await __sleep(900);
    const links = Object.fromEntries([...document.querySelectorAll("a")].map(a => [a.innerText.trim(), a.href]));
    return { name, h: [...document.querySelectorAll("h3")].map(e => e.innerText), text: document.body.innerText, links, list: !!__list() }; })()`);
  check("tapping a place opens its card in place of the list", card.h.includes(card.name) && !card.list, card.name);
  check("card: hours (or 'No hours listed') with the check-before-you-go note", card.text.includes("Hours can change — check before you go."));
  check("card: Directions opens Google Maps with only the place's position", /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+$/.test(card.links["Directions"] ?? ""), card.links["Directions"]);
  check("card: Fix it on OSM + the OSM object link + credit", /^https:\/\/www\.openstreetmap\.org\/edit\?(node|way|relation)=\d+$/.test(card.links["Fix it on OSM"] ?? "")
    && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(card.links["OpenStreetMap"] ?? "") && !!card.links["© OpenStreetMap contributors"]);
  const d = card.links["Directions"]?.match(/destination=(-?\d+\.\d+),(-?\d+\.\d+)$/);
  const note = d ? `https://www.openstreetmap.org/note/new#map=19/${Number(d[1]).toFixed(5)}/${Number(d[2]).toFixed(5)}` : "";
  check("card: Report a problem opens an OSM note at the place, with the hint (D12)", card.links["Report a problem"] === note
    && card.text.includes("Say what changed: closed, moved, or new hours."), card.links["Report a problem"]);
  const backList = await run(`(async () => { __btn("Back to the list").click(); await __sleep(400); return __list()?.length ?? 0; })()`);
  check("card: Back returns to the list", backList > 50, `${backList} places`);

  // LA County sites (decision 041, D5-D8, D11-D13)
  const COUNTY_NOTE = "* County listing from May 2023, last updated April 2024. Search the name or call 211 to check it's still open before you go.";
  const COUNTY_CREDIT = "LA County Public Health, from 211LA food resources (May 2023), updated April 2024";
  const foot = await run(`document.querySelector('section[aria-labelledby="map-list-title"]').innerText`);
  check("the list shows County sites marked * with the footnote and the County credit under it", list.some(x => /\*$/.test(x[0]))
    && foot.includes(COUNTY_NOTE) && foot.includes(COUNTY_CREDIT), `${list.filter(x => /\*$/.test(x[0])).length} County rows`);
  const cc = await run(`(async () => { const b = [...document.querySelectorAll('ul[aria-label="Places"] button')].find(b => /\\*$/.test(b.innerText.split("\\n")[0]));
    b.click(); await __sleep(900);
    const links = [...document.querySelectorAll("section a")].map(a => [a.innerText.trim(), a.getAttribute("href")]);
    const text = document.querySelector('section[aria-labelledby="map-list-title"]').innerText;
    __btn("Back to the list").click(); await __sleep(400); return { text, links }; })()`);
  const ccLinks = Object.fromEntries(cc.links);
  check("County card: the footnote, the credit with the County's terms, Directions; no hours note, no 'Fix it on OSM'",
    cc.text.includes(COUNTY_NOTE) && cc.text.includes(COUNTY_CREDIT) && ccLinks["Terms"] === "https://egis-lacounty.hub.arcgis.com/pages/terms-of-use"
    && !!ccLinks["Directions"] && !ccLinks["Fix it on OSM"] && !cc.text.includes("Hours can change"), JSON.stringify(cc.links));
  const mail = ccLinks["Report a problem"] ?? "";
  check("County card: Report a problem emails the owner's address with the County id in the subject (D12)",
    mail.startsWith("mailto:ecogo-admin@proton.me?subject=") && /\(County \d+\)/.test(decodeURIComponent(mail)), mail.slice(0, 120));

  // Type chips
  const counts = await run(`(async () => { const n0 = __list().length; __btn("Gardens").click(); await __sleep(500); const n1 = __list().length;
    const pressed = __btn("Gardens").getAttribute("aria-pressed"); __btn("Gardens").click(); await __sleep(500); return [n0, n1, __list().length, pressed]; })()`);
  check("the Gardens chip hides and brings back gardens", counts[1] < counts[0] && counts[2] === counts[0] && counts[3] === "false", JSON.stringify(counts));

  // M13: ZIP, radius, privacy (D2-D4, D10)
  requests.length = 0;
  // The D10 link follows the map's centre on Leaflet's moveend, after the zoom-to-circle animation: wait for it to change.
  const z10 = await run(`(async () => { const add = () => [...document.querySelectorAll("a")].find(a => a.innerText.includes("Add it on OpenStreetMap"))?.href ?? "";
    const before = add(); await __zip("90017"); await __until(() => add() !== before, 3000);
    return { header: __header(), rows: __list(), add: add() }; })()`);
  const n10 = Number(z10.header.match(/^(\d+) places? within 10 mi of 90017$/)?.[1]);
  check("ZIP 90017: 'N places within 10 mi of 90017' (10 mi by default)", n10 > 0 && z10.rows.length === n10, `${z10.header} / ${z10.rows.length} rows`);
  const d10 = z10.rows.map(miles);
  check("…nearest first, each with its distance, all within 10 mi", d10.every((d, i) => d <= 10 && (i === 0 || d >= d10[i - 1])), JSON.stringify(d10.slice(0, 5)));
  const m = z10.add.match(/^https:\/\/www\.openstreetmap\.org\/edit#map=18\/(-?\d+\.\d+)\/(-?\d+\.\d+)$/);
  check("'Missing a place? Add it on OpenStreetMap' opens the OSM editor at the map's centre (D10)",
    !!m && Math.abs(Number(m[1]) - 34.0531) < 0.01 && Math.abs(Number(m[2]) + 118.2645) < 0.01, z10.add);
  const z5 = await run(`(async () => { await __radius(5); return __header(); })()`);
  const n5 = Number(z5.match(/^(\d+) places? within 5 mi of 90017$/)?.[1]);
  check("the 5 mi chip lowers the count", n5 > 0 && n5 < n10, `${z5} (was ${n10})`);
  const bad = await run(`(async () => { await __zip("99999"); return document.body.innerText; })()`);
  check("a ZIP not in the table: 'EcoGo doesn't have that ZIP…' (D4)", bad.includes("EcoGo doesn't have that ZIP. The map covers LA County and nearby."));
  // ZIPs with nothing within 5 mi but places within 10 (OSM + County, 2026-10-07); the first that still is wins.
  const none = await run(`(async () => { for (const z of ["91377", "90742", "91387", "91765", "91301"]) { await __zip(z); await __radius(5);
      if (__header() === "Nothing within 5 mi") { const b = __btn("Show 10 mi"); b?.click(); await __sleep(600); return { z, next: !!b, after: __header() }; } }
    return null; })()`);
  check("nothing within 5 mi: 'Nothing within 5 mi' with a 'Show 10 mi' button (D4)", !!none?.next && / within 10 mi of /.test(none.after), JSON.stringify(none));
  // A card whose place leaves a smaller radius closes for good (it doesn't come back when the radius grows again).
  const shrink = await run(`(async () => { await __zip("90017"); await __radius(20);
    const rows = [...document.querySelectorAll('ul[aria-label="Places"] button')]; const far = rows.at(-1); const name = far.innerText.split("\\n")[0].replace(/\\*$/, "");
    far.click(); await __sleep(900); const opened = !__list();
    await __radius(5); const closed = !!__list(); await __radius(20);
    return { name, opened, closed, reopened: !__list() }; })()`);
  check("a card whose place falls outside a smaller radius closes, and stays closed", shrink.opened && shrink.closed && !shrink.reopened, JSON.stringify(shrink));
  const kept = await run(`JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href + document.cookie`);
  check("the ZIP is never sent, stored or put in the URL (D3)",
    !requests.some(u => /90017|99999|91377|90742|91387|91765|91301/.test(u)) && !/90017|91377/.test(kept), `${requests.length} requests`);

  // Location: only on tap; LA → nearest first; Chicago → the LA County note; denied → a note
  const origin = new URL(URL_).origin;
  await send("Browser.grantPermissions", { origin, permissions: ["geolocation"] });
  await send("Emulation.setGeolocationOverride", { latitude: 34.0997, longitude: -118.3283, accuracy: 10 }); // Hollywood
  const la = await run(`(async () => { __btn("My location").click(); await __until(() => / of your location$/.test(__header()), 8000); await __sleep(400);
    return { header: __header(), first: __list()?.[0] }; })()`);
  check("My location in LA: 'N places within R mi of your location', with distances", / within \d+ mi of your location$/.test(la.header) && / (mi|ft)$/.test(la.first?.at(-1) ?? ""), JSON.stringify(la));
  await send("Emulation.setGeolocationOverride", { latitude: 41.8827, longitude: -87.6233, accuracy: 10 }); // Chicago
  const chi = await run(`(async () => { __btn("My location").click(); await __until(() => __btn("Back to LA"), 8000); return document.body.innerText; })()`);
  check("My location outside LA County: the 'covers LA County for now' note", chi.includes("The map covers LA County for now") && chi.includes("Your location stays on this phone."));
  const backed = await run(`(async () => { __btn("Back to LA").click(); await __sleep(600); return document.body.innerText; })()`);
  check("Back to LA closes the note; the list is A–Z again", !backed.includes("The map covers LA County") && backed.includes("Enter a ZIP or tap My location"));
  // Locate once (Hollywood), then deny: the old position must not keep sorting the list (M9 review follow-up).
  await send("Emulation.setGeolocationOverride", { latitude: 34.0997, longitude: -118.3283, accuracy: 10 });
  await run(`(async () => { __btn("My location").click(); await __until(() => / of your location$/.test(__header()), 8000); })()`);
  await send("Browser.setPermission", { origin, permission: { name: "geolocation" }, setting: "denied" });
  const off = await run(`(async () => { __btn("My location").click(); await __until(() => document.body.innerText.includes("Location is off"), 8000); await __sleep(400); return document.body.innerText; })()`);
  check("location denied: 'Location is off. Showing Los Angeles.'", off.includes("Location is off. Showing Los Angeles."));
  check("…and a failed My location after a success drops the old position (A–Z again)", off.includes("Enter a ZIP or tap My location") && !off.includes("of your location"));
  const keepZip = await run(`(async () => { await __zip("90017"); __btn("My location").click(); await __sleep(1500); return __header(); })()`);
  check("…but a failed My location keeps a ZIP search", / within \d+ mi of 90017$/.test(keepZip), keepZip);

  // Profile names OpenStreetMap and the location rule (M11: the rows open on tap)
  const p = await run(`(async () => { __btn("Profile").click(); await __sleep(500);
    for (const t of ["Where results come from", "Privacy"]) [...document.querySelectorAll("button[aria-expanded]")].find(b => b.innerText.startsWith(t))?.click();
    await __sleep(300); return document.body.innerText; })()`);
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

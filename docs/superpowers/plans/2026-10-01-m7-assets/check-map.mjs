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
// M8.1 (spec 2026-10-15-m81-suggest-report-design.md): "Suggest a place" and every card's "Report a problem" open EcoGo's own
// forms (the OSM note and County mailto are gone); required fields gate Send; sends are answered here (CDP Fetch).
// 059 (spec 2026-10-16-map-feedback-design.md): Suggest by the heading; County "Search for it" + "Call 211"; OSM's editor as a
// small "Edit there" link ("Fix it on OSM" is gone); Photon address suggestions (stubbed here).
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
  let onPaused = p => send("Fetch.continueRequest", { requestId: p.requestId });
  // 059 Q4: Photon is always answered here (nothing reaches photon.komoot.io): `photonReply`, or held unanswered.
  const photonAsked = [], photonHeld = [];
  let photonReply = { status: 200, body: { type: "FeatureCollection", features: [] } };
  const PHOTON = { urlPattern: "*photon.komoot.io/*" };
  const answerPhoton = p => {
    photonAsked.push(p.request.url);
    if (photonReply === "hold") return void photonHeld.push(p.requestId);
    send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: photonReply.status, body: Buffer.from(JSON.stringify(photonReply.body)).toString("base64"),
      responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }] });
  };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url + " " + (m.params.request.postData ?? ""));
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      if (request.url.includes("photon.komoot.io")) answerPhoton(m.params);
      else if (!request.url.includes("/rest/v1/resources")) onPaused(m.params); // M8.1: auth and place-submit, answered here
      else if (failResources) send("Fetch.failRequest", { requestId, errorReason: "InternetDisconnected" });
      else if (ROWS && request.method === "GET") send("Fetch.fulfillRequest", { requestId, responseCode: 200, body: Buffer.from(ROWS).toString("base64"),
        responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }] });
      else send("Fetch.continueRequest", { requestId });
    }
  });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const OSM_EDIT = "Have an OpenStreetMap account? Edit there.";
  const helpers = () => run(`window.OSM_EDIT = "${OSM_EDIT}"; window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s || b.getAttribute("aria-label") === s);
    window.__list = () => { const ul = document.querySelector('ul[aria-label="Places"]'); return ul ? [...ul.querySelectorAll("button")].map(b => b.innerText.split("\\n")) : null; };
    window.__header = () => document.getElementById("map-list-title")?.innerText ?? "";
    window.__zip = async v => { const i = document.querySelector('input[aria-label="ZIP code"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(700); };
    window.__type = async (id, v) => { const i = document.getElementById(id); const p = i.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(p.prototype, "value").set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(50); };
    window.__pick = async (name, v) => { document.querySelector('input[name="' + name + '"][value="' + v + '"]').click(); await __sleep(50); };
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
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/resources*", requestStage: "Request" }, PHOTON] });
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
    const edit = [...document.querySelectorAll("a")].find(a => a.innerText.trim().startsWith(OSM_EDIT)); const rp = __btn("Report a problem");
    return { name, h: [...document.querySelectorAll("h3")].map(e => e.innerText), text: document.body.innerText, links, list: !!__list(),
      edit: edit ? [edit.innerText.trim(), edit.href, edit.target] : null, reportBg: rp ? getComputedStyle(rp).backgroundColor : "none" }; })()`);
  check("tapping a place opens its card in place of the list", card.h.includes(card.name) && !card.list, card.name);
  check("card: hours (or 'No hours listed') with the check-before-you-go note", card.text.includes("Hours can change — check before you go."));
  check("card: Directions opens Google Maps with only the place's position", /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+$/.test(card.links["Directions"] ?? ""), card.links["Directions"]);
  check("059 Q3: OSM's editor is the small 'Have an OpenStreetMap account? Edit there.' link (new tab, said aloud); no OSM button; + the OSM object link + credit",
    card.edit?.[0].replace(/\s+/g, " ") === `${OSM_EDIT} (opens OpenStreetMap in a new tab)` && /^https:\/\/www\.openstreetmap\.org\/edit\?(node|way|relation)=\d+$/.test(card.edit[1]) && card.edit[2] === "_blank"
    && !card.text.includes("Fix it on OSM")
    && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(card.links["OpenStreetMap"] ?? "") && !!card.links["© OpenStreetMap contributors"], JSON.stringify(card.edit));
  check("059 Q3: 'Report a problem' is the card's main fix (a filled button, not a text link)", !/rgba\(0, 0, 0, 0\)|none/.test(card.reportBg), card.reportBg);
  // M8.1 P2, P3, P3a: "Report a problem" opens EcoGo's own form (the OSM note link is gone).
  const NOTICE = "EcoGo's owner reads this by hand. Don't include personal details. Approved places are added to OpenStreetMap, which is public.";
  const CONSENT = "My note has no personal details, mine or anyone else's.";
  const rep = await run(`(async () => { __btn("Report a problem").click(); await __sleep(500);
    const t = document.querySelector('[role="dialog"]')?.innerText ?? ""; const send = __btn("Send"); const focus = document.activeElement?.id;
    const radios = [...document.querySelectorAll('input[name="wrong"]')].map(r => r.parentElement.innerText.trim());
    const before = send?.disabled; await __pick("wrong", "Not free"); const noConsent = send?.disabled;
    document.querySelector('input[type="checkbox"]').click(); await __sleep(100); const ready = send && !send.disabled;
    __btn("Close").click(); await __sleep(400);
    return { t, radios, before, noConsent, ready, focus, back: [...document.querySelectorAll("h3")].map(e => e.innerText), opener: document.activeElement?.innerText }; })()`);
  check("M8.1 P2: Report a problem opens EcoGo's form with the card's name, OpenStreetMap and its id; no OSM note link or hint",
    rep.t.includes(card.name) && /From OpenStreetMap · (node|way|relation)\/\d+/.test(rep.t) && !card.links["Report a problem"]
    && !card.text.includes("Say what changed"), rep.t.slice(0, 160));
  check("…What's wrong: the four choices; Send waits for a choice and the consent box",
    JSON.stringify(rep.radios) === '["Closed for good","Wrong address or hours","Not free","Other"]' && rep.before && rep.noConsent && rep.ready, JSON.stringify(rep.radios));
  check("…the notice and the consent line (P3, P3a); the title takes focus", rep.t.includes(NOTICE) && rep.t.includes(CONSENT) && rep.focus === "place-form-title", rep.focus);
  check("…Close goes back to the card, focus on Report a problem", rep.back.includes(card.name) && rep.opener === "Report a problem", rep.opener);
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
    const h = document.querySelector("section h3"), name = h.innerText.replace(/\\*$/, ""), address = h.nextElementSibling?.innerText ?? "";
    const search = [...document.querySelectorAll("section a")].find(a => a.innerText.trim().startsWith("Search for it"));
    __btn("Back to the list").click(); await __sleep(400); return { text, links, name, address, searchHref: search?.getAttribute("href"), searchTarget: search?.target }; })()`);
  const ccLinks = Object.fromEntries(cc.links);
  check("County card: the footnote, the credit with the County's terms, Directions; no hours note, no 'Fix it on OSM'",
    cc.text.includes(COUNTY_NOTE) && cc.text.includes(COUNTY_CREDIT) && ccLinks["Terms"] === "https://egis-lacounty.hub.arcgis.com/pages/terms-of-use"
    && !!ccLinks["Directions"] && !cc.links.some(([t]) => t.startsWith(OSM_EDIT) || t === "Fix it on OSM") && !cc.text.includes("Hours can change"), JSON.stringify(cc.links));
  check("059 Q2: a County card offers 'Search for it' (a web search for its name and address, new tab) and 'Call 211'",
    cc.searchHref === `https://www.google.com/search?q=${encodeURIComponent(`${cc.name} ${cc.address}`)}` && cc.searchTarget === "_blank"
    && ccLinks["Call 211"] === "tel:211" && cc.address.length > 5, `${cc.searchHref} | ${ccLinks["Call 211"]}`);
  const crep = await run(`(async () => { const b = [...document.querySelectorAll('ul[aria-label="Places"] button')].find(b => /\\*$/.test(b.innerText.split("\\n")[0]));
    const name = b.innerText.split("\\n")[0].replace(/\\*$/, ""); b.click(); await __sleep(900); __btn("Report a problem").click(); await __sleep(400);
    const t = document.querySelector('[role="dialog"]')?.innerText ?? ""; document.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await __sleep(300); const gone = !document.querySelector('[role="dialog"]'); __btn("Back to the list").click(); await __sleep(400); return { name, t, gone }; })()`);
  check("M8.1 P2: a County card's Report a problem opens the same form, with LA County and the site's id; no mailto",
    crep.t.includes(crep.name) && /From LA County · site \d+/.test(crep.t) && !cc.links.some(([, h]) => h?.startsWith("mailto:")), crep.t.slice(0, 160));
  check("…Escape closes the form", crep.gone);

  // M8.1 P1: Suggest a place (059 Q1: by the list heading)
  const HINT = "Its own site or its own Instagram/Facebook page. Not Yelp, Google Maps or news.";
  const sug = await run(`(async () => { const a = [...document.querySelectorAll("section a")].find(a => a.innerText.trim().startsWith(OSM_EDIT));
    const foot = document.querySelector('section[aria-labelledby="map-list-title"]').innerText;
    const suggests = [...document.querySelectorAll("button")].filter(b => b.innerText.trim() === "Suggest a place");
    const button = suggests.length === 1 && suggests[0].parentElement.contains(document.getElementById("map-list-title")); // Q1: by the heading, once
    __btn("Suggest a place").click(); await __sleep(500); const nothingPicked = !document.querySelector('input[name="offers"]:checked, input[name="who"]:checked');
    // 063 F12: the name field's border against the card behind it (colours read back from a canvas, alpha blended).
    const rgb = (fg, bg) => { const x = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d");
      x.fillStyle = bg; x.fillRect(0, 0, 1, 1); x.fillStyle = fg; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const L = c => c.map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    let card = document.getElementById("place-name").parentElement;
    while (card && /rgba\\(0, 0, 0, 0\\)|transparent/.test(getComputedStyle(card).backgroundColor)) card = card.parentElement;
    const cardBg = rgb(card ? getComputedStyle(card).backgroundColor : "#fff", "#fff");
    const [la, lb] = [L(rgb(getComputedStyle(document.getElementById("place-name")).borderTopColor, \`rgb(\${cardBg})\`)), L(cardBg)].sort((p, q) => q - p);
    const edge = Math.round((la + 0.05) / (lb + 0.05) * 100) / 100;
    const t = document.querySelector('[role="dialog"]')?.innerText ?? ""; const send = () => __btn("Send").disabled; const steps = [send()];
    await __type("place-name", "Westside Pantry"); await __type("place-address", "Pico & Bundy"); await __pick("offers", "Food pantry"); await __pick("who", "Anyone");
    document.querySelector('input[type="checkbox"]').click(); await __sleep(50); steps.push(send()); // no link yet
    await __type("place-link", "http://westsidepantry.org"); steps.push(send()); // not https://
    await __type("place-link", "https://westsidepantry.org"); steps.push(send()); // all there: ready
    await __pick("who", "Other"); steps.push(send()); // Who: Other, with no note
    const whoNote = !!document.getElementById("place-who-note");
    await __type("place-who-note", "Seniors 60+"); steps.push(send());
    const tabs = [...document.querySelectorAll("button")].filter(b => ["Home", "Map", "Scan", "Saved", "Profile"].includes(b.innerText.trim()));
    const nav = tabs.length === 5 && tabs.every(b => b.closest("[inert]"));
    return { link: a?.href ?? "", foot, button, nothingPicked, t, steps, whoNote, nav, edge }; })()`);
  check("063 F12: Suggest a place's fields have a visible edge, 3:1 against their card", sug.edge >= 3, String(sug.edge));
  check("059 Q1: 'Suggest a place' sits by the list heading (only there), opens with no type picked; the OSM editor link stays in the footer",
    sug.button && sug.nothingPicked && /^https:\/\/www\.openstreetmap\.org\/edit#map=18\//.test(sug.link) && !sug.foot.includes("Missing a place?"), sug.link);
  check("…its form asks name, address, what it offers, who can use it, the link with its hint, and a note; notice and consent",
    ["Name", "Address or cross streets", "What it offers", "Food pantry", "Free meals", "Community fridge", "Who can use it", "Anyone", "Students only",
      HINT, "Note (optional)", NOTICE, CONSENT].every(s => sug.t.includes(s)), sug.t.slice(0, 300));
  check("…Send waits for every required field: an https:// link, and a note when 'Who can use it' is Other",
    JSON.stringify(sug.steps) === "[true,true,true,false,true,false]" && sug.whoNote, JSON.stringify(sug.steps));
  check("…while the form is open the bottom tabs are inert (no leaving mid-send)", sug.nav);

  // M8.1 P3: the sends. Auth and place-submit are answered here (CDP Fetch); the human check hands over a stub token.
  const placeAsked = [], placeBodies = [];
  let placeReply = { status: 200, body: { ok: true } }, heldPlace = null;
  const CORS = [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" }, { name: "Content-Type", value: "application/json" }];
  onPaused = p => {
    const url = p.request.url.split("?")[0], post = p.request.method === "POST", place = url.includes("/functions/v1/place-submit");
    placeAsked.push(`${p.request.method} ${url.split("/").slice(-2).join("/")}`);
    if (post && place) { placeBodies.push(p.request.postData); if (placeReply === "hold") return void (heldPlace = p.requestId); }
    const body = p.request.method === "OPTIONS" ? "" : place ? JSON.stringify(placeReply.body) : JSON.stringify({ access_token: "fake", token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake",
      user: { id: "00000000-0000-4000-8000-000000000081", aud: "authenticated", role: "authenticated", is_anonymous: true } });
    send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: place && post ? placeReply.status : 200, responseHeaders: CORS, body: Buffer.from(body).toString("base64") });
  };
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/resources*", requestStage: "Request" }, { urlPattern: "*/auth/v1/*" }, { urlPattern: "*/functions/v1/*" }, PHOTON] });
  const sent = await run(`(async () => { const t = await __until(() => window.turnstile, 10000); if (!t) return "Turnstile didn't load";
    t.render = (el, o) => { setTimeout(() => o.callback("stub-token"), 50); return "stub"; }; t.remove = () => {};
    __btn("Send").click(); await __until(() => document.body.innerText.includes("Thanks."), 10000); return document.querySelector('[role="dialog"]')?.innerText ?? "no dialog"; })()`);
  const sb = JSON.parse(placeBodies[0] ?? "{}");
  check("M8.1 P3: Send signs in, posts the suggestion to place-submit and says thanks (all answered here: nothing reaches Supabase)",
    sent.includes("Thanks. EcoGo checks these by hand, so it can take a few days.") && sb.kind === "suggest" && sb.name === "Westside Pantry"
    && sb.link === "https://westsidepantry.org" && sb.who === "Other" && sb.whoNote === "Seniors 60+" && placeAsked.includes("POST v1/signup")
    && placeAsked.every(f => /^(OPTIONS|POST) v1\/(signup|place-submit)$/.test(f)), `${placeAsked.join(", ")} ${placeBodies[0]} ${sent.slice(0, 200)}`);
  const mapBack = await run(`(async () => { __btn("Back to the map").click(); await __sleep(400); return document.activeElement === __btn("Suggest a place"); })()`);
  check("…'Back to the map' closes the form, focus back on Suggest a place", mapBack);

  placeReply = { status: 429, body: { ok: false, reason: "limit-you" } }; placeBodies.length = 0;
  const lim = await run(`(async () => { const b = await __until(() => [...document.querySelectorAll('ul[aria-label="Places"] button')].find(b => !/\\*$/.test(b.innerText.split("\\n")[0])));
    const name = b.innerText.split("\\n")[0]; b.click(); (await __until(() => __btn("Report a problem"))).click(); await __until(() => document.querySelector('input[name="wrong"]'));
    await __pick("wrong", "Not free"); await __type("place-note", "Asks for $5 now");
    document.querySelector('input[type="checkbox"]').click(); await __sleep(50); __btn("Send").click();
    await __until(() => document.body.innerText.includes("Not sent"), 10000); const t = document.body.innerText;
    __btn("Try again").click(); await __sleep(300);
    return { name, t, kept: document.querySelector('input[name="wrong"][value="Not free"]')?.checked && document.getElementById("place-note")?.value === "Asks for $5 now" }; })()`);
  const rb = JSON.parse(placeBodies[0] ?? "{}");
  check("M8.1 P3: a limit answer is Not sent with M8's line; Try again keeps the answers",
    lim.t.includes("You've sent 10 today. Thanks! Try again tomorrow.") && lim.kept, lim.t.slice(0, 200));
  check("…the report names the card's place: kind, placeRef, name, what's wrong and the note",
    rb.kind === "report" && /^(node|way|relation)\/\d+$/.test(rb.placeRef) && rb.name === lim.name && rb.wrong === "Not free" && rb.note === "Asks for $5 now", placeBodies[0]);

  placeReply = "hold";
  const held = await run(`(async () => { __btn("Send").click(); await __until(() => __btn("Sending…"), 5000); await __sleep(300);
    const close = __btn("Close"); close.click(); await __sleep(200);
    return { close: close.disabled, still: !!__btn("Sending…"), consent: document.querySelector('input[type="checkbox"]').disabled,
      radio: document.querySelector('input[name="wrong"]').disabled, note: document.getElementById("place-note").disabled }; })()`);
  check("055 E1 for M8.1: while sending, Close and every field are locked; a Close click does nothing",
    held.close && held.still && held.consent && held.radio && held.note, JSON.stringify(held));
  if (heldPlace) await send("Fetch.failRequest", { requestId: heldPlace, errorReason: "ConnectionReset" });
  const unk = await run(`(async () => { await __until(() => document.body.innerText.includes("Not sure it arrived"), 10000); const t = document.body.innerText;
    const back = !!__btn("Back to the map"), again = !!__btn("Try again"); __btn("Back to the map")?.click(); await __sleep(400);
    __btn("Back to the list")?.click(); await __sleep(400); return { t, back, again }; })()`);
  check("…no answer is 'Not sure it arrived' with EcoGo's line, and only 'Back to the map' (no Try again)",
    unk.t.includes("We didn't hear back from EcoGo. It may have arrived. Wait a few minutes before sending again.") && unk.back && !unk.again, unk.t.slice(0, 200));
  // M15: with the session above, Profile reads the person's counts; failed here, so nothing reaches Supabase.
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/resources*", requestStage: "Request" }, PHOTON,
    { urlPattern: "*/rest/v1/contributions*" }, { urlPattern: "*/rest/v1/place_reports*" }] });
  onPaused = p => /\/rest\/v1\/(contributions|place_reports)/.test(p.request.url)
    ? send("Fetch.failRequest", { requestId: p.requestId, errorReason: "InternetDisconnected" }) : send("Fetch.continueRequest", { requestId: p.requestId });

  // 059 Q4: Photon address suggestions in the Suggest form (answered here; nothing reaches photon.komoot.io)
  const PHOTON_LINE = "Address suggestions come from Photon (OpenStreetMap data); it sees what you type here.";
  const bixel = { housenumber: "501", street: "South Bixel Street", city: "Los Angeles", postcode: "90017" };
  photonAsked.length = 0;
  photonReply = { status: 200, body: { type: "FeatureCollection", features: [{ properties: bixel }, { properties: bixel }, { properties: { street: "Bixel Street", city: "Los Angeles" } }] } };
  const ph = await run(`(async () => { __btn("Suggest a place").click(); await __sleep(400);
    const list = () => [...document.querySelectorAll('ul[aria-label="Address suggestions"] button')].map(b => b.innerText.trim());
    await __type("place-address", "50"); await __sleep(700); const short = list().length;
    await __type("place-address", "501 s bix"); await __sleep(150); const early = list().length;
    const shown = await __until(() => list().length && list(), 3000);
    document.querySelector('ul[aria-label="Address suggestions"] button').click(); await __sleep(700);
    return { short, early, shown, filled: document.getElementById("place-address").value, after: list().length, focus: document.activeElement?.id,
      line: document.querySelector('[role="dialog"]').innerText.includes("${PHOTON_LINE}") }; })()`);
  const asked = photonAsked.map(u => Object.fromEntries(new URL(u).searchParams));
  check("059 Q4: no Photon request under 3 characters or before the pause; then one, for LA County's box, 5 results, English",
    ph.short === 0 && ph.early === 0 && asked.length === 1 && JSON.stringify(asked[0]) === JSON.stringify({ q: "501 s bix", limit: "5", lang: "en", bbox: "-118.95,33.28,-117.65,34.82" }),
    JSON.stringify(asked));
  check("…suggestions are formatted addresses with no duplicates; picking one fills the box, closes the list and asks nothing more; the Photon line shows",
    JSON.stringify(ph.shown) === '["501 South Bixel Street, Los Angeles 90017","Bixel Street, Los Angeles"]' && ph.filled === "501 South Bixel Street, Los Angeles 90017"
    && ph.after === 0 && photonAsked.length === 1 && ph.line && ph.focus === "place-address", JSON.stringify(ph));
  // A list in each failing answer: only the status (500), or arriving after the 2 s, says not to show it.
  const twoFound = { type: "FeatureCollection", features: [{ properties: bixel }, { properties: { street: "Main Street", city: "Los Angeles" } }] };
  photonReply = { status: 500, body: twoFound };
  const phFail = await run(`(async () => { await __type("place-address", "Main str"); await __sleep(1200);
    return document.querySelectorAll('ul[aria-label="Address suggestions"] button').length; })()`);
  photonReply = "hold";
  await run(`(async () => { await __type("place-address", "Main stre"); await __sleep(2900); return true; })()`);
  for (const r of photonHeld.splice(0)) await send("Fetch.fulfillRequest", { requestId: r, responseCode: 200, body: Buffer.from(JSON.stringify(twoFound)).toString("base64"),
    responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }] }); // too late
  const phSlow = await run(`(async () => { await __sleep(500);
    const n = document.querySelectorAll('ul[aria-label="Address suggestions"] button').length, typed = document.getElementById("place-address").value;
    __btn("Close").click(); await __sleep(300); return { n, typed }; })()`);
  photonReply = { status: 200, body: { type: "FeatureCollection", features: [] } };
  check("…a failed (500) or slow (answered after 2 s) Photon reply shows no list, and the typed address stays", phFail === 0 && phSlow.n === 0 && phSlow.typed === "Main stre"
    && photonAsked.length === 3, `${phFail} ${JSON.stringify(phSlow)} ${photonAsked.length} asked`);

  // Type chips
  const counts = await run(`(async () => { const n0 = __list().length; __btn("Gardens").click(); await __sleep(500); const n1 = __list().length;
    const pressed = __btn("Gardens").getAttribute("aria-pressed"); __btn("Gardens").click(); await __sleep(500); return [n0, n1, __list().length, pressed]; })()`);
  check("the Gardens chip hides and brings back gardens", counts[1] < counts[0] && counts[2] === counts[0] && counts[3] === "false", JSON.stringify(counts));

  // M13: ZIP, radius, privacy (D2-D4, D10)
  requests.length = 0;
  // The D10 link follows the map's centre on Leaflet's moveend, after the zoom-to-circle animation: wait for it to change.
  const z10 = await run(`(async () => { const add = () => [...document.querySelectorAll("section a")].find(a => a.innerText.trim().startsWith(OSM_EDIT))?.href ?? "";
    const before = add(); await __zip("90017"); await __until(() => add() !== before, 3000);
    return { header: __header(), rows: __list(), add: add() }; })()`);
  const n10 = Number(z10.header.match(/^(\d+) places? within 10 mi of 90017$/)?.[1]);
  check("ZIP 90017: 'N places within 10 mi of 90017' (10 mi by default)", n10 > 0 && z10.rows.length === n10, `${z10.header} / ${z10.rows.length} rows`);
  const d10 = z10.rows.map(miles);
  check("…nearest first, each with its distance, all within 10 mi", d10.every((d, i) => d <= 10 && (i === 0 || d >= d10[i - 1])), JSON.stringify(d10.slice(0, 5)));
  const m = z10.add.match(/^https:\/\/www\.openstreetmap\.org\/edit#map=18\/(-?\d+\.\d+)\/(-?\d+\.\d+)$/);
  check("the footer's 'Have an OpenStreetMap account? Edit there.' opens the OSM editor at the map's centre (D10, 059 Q3)",
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
  // 054 K-23: the © OpenStreetMap credit is on screen (not covered) in the list and with a place card open, at normal
  // and Larger text (375 × 812).
  const CREDIT = `(() => { const a = document.querySelector("[data-osm-credit]"); if (!a) return "missing: " + document.body.innerText.slice(0, 120).split("\\n").join(" / "); const r = a.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.top >= 0 && r.bottom <= innerHeight && r.width > 0 && (e === a || a.contains(e)) && a.href === "https://www.openstreetmap.org/copyright" ? "ok" : JSON.stringify(r); })()`;
  const creditStates = async () => {
    const inList = await run(CREDIT);
    await run(`(async () => { document.querySelector('ul[aria-label="Places"] button').click(); await __sleep(700); return true; })()`);
    const inCard = await run(CREDIT);
    await run(`(async () => { __btn("Back to the list").click(); await __sleep(400); return true; })()`);
    return `list ${inList}, card ${inCard}`;
  };
  await openMap();
  const normalText = await creditStates();
  check("K-23: the OSM credit is on screen in the list and with a place card open", normalText === "list ok, card ok", normalText);
  await run(`localStorage.setItem("ecogo.settings.v1", JSON.stringify({ textSize: "larger", contrast: "normal" })); true`);
  await send("Page.reload"); await sleep(4000);
  await openMap();
  const largerText = await creditStates();
  check("…and at Larger text", largerText === "list ok, card ok", largerText);
  await run(`localStorage.removeItem("ecogo.settings.v1"); true`);

  check("no console errors", errors.length === 0, errors.join(" | "));

  // No database → no places, never fake ones
  failResources = true;
  await send("Page.reload"); await sleep(4000);
  await openMap();
  const offline = await run(`({ text: document.body.innerText, list: __list()?.length ?? 0 })`);
  check("database unreachable: 'Places need a connection', no places", offline.text.includes("Places need a connection") && offline.list === 0, `${offline.list} places`);
} catch (err) {
  check("the script ran to the end", false, String(err?.stack ?? err).slice(0, 300)); // a crash must not read as a pass
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1);
}

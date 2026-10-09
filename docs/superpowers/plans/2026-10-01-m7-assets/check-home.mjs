// M7 (headless Edge): Home has no fake content; first visit shows "How EcoGo checks"; Scan card opens Scan;
// Oreo (search) then Diet Coke (typed barcode) appear newest first; survives reload; Clear; explainers; Saved › Scanned.
// M7.1: Home lists 5 explainer cards (M7's two first); seed oils, pesticides and ultra-processed open with sources;
// the pesticides page's "What the badge levels mean" link opens it and Back returns.
// M7.2/M7.3: the welcome screen is honest and shows once per device; Profile shows only true things.
// M7.4: no Map in the nav; no prices, Share or AI claims; Saved has only Favorites (empty at first) and Scanned; a USDA
// search result, opened and bookmarked, is listed in Favorites.
// Data ownership: lookups, nutrition, search and alternatives come from our own `foods` table; USDA's API is never called.
// M9: the Map tab is back (its own check: docs/archive/plans/2026-10-02-m9-assets/check-map.mjs).
// M12: Home shows six Learn tiles instead of the explainer rows and the "How EcoGo checks" box; tiles are clicked by their
// aria-label (= the page's full title); "How EcoGo checks a product" is a page with its three steps and no Sources.
// M8: the Scan drawer (not Home) offers the no-barcode check, where typed Red 40 shows Some concern; the not-found screen
// offers "Add this product"; Send stays disabled until the consent box is ticked; Turnstile loads only on the Send screen.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs <url>  (M7 plan Task 4; M7.1)
// Build with a Turnstile site key (the deploy has the real one; locally Cloudflare's public test key will do:
// VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA). The send checks stub the widget, answer the sign-in themselves (CDP
// Fetch) and route off-submit to a local stub server, so nothing is sent.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const PORT = 9600 + Math.floor(Math.random() * 90);
// A fresh profile every run: a reused one can keep an old "Recently scanned" list (Edge is killed before it flushes
// storage), so "first visit" wouldn't be a first visit.
const PROFILE = `${process.env.TEMP}\\ecogo-home-${PORT}`;
rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=900,1000",
  `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
setTimeout(() => { console.log("TIMEOUT"); edge.kill(); process.exit(1); }, 120000).unref?.();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const requests = []; // every URL the page asked for (Network events)
let onPaused = () => {}; // Fetch interception (M8 follow-up 2): set where it's used
let ok = 0, total = 0;
const check = (name, pass, detail = "") => { total++; if (pass) ok++; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
    if (m.method === "Fetch.requestPaused") onPaused(m.params);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
  });
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const helpers = () => run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.includes(s) || b.getAttribute("aria-label") === s);
    // Welcome shows on the first visit only: tap "Look around first" when it's there, else Home is already showing.
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Scan a product"));
      const welcomed = b?.innerText.includes("Look around first"); if (welcomed) { b.click(); await __sleep(400); } return welcomed; }; true`);
  const type = async text => {
    await send("Input.insertText", { text });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  };
  const back = () => run(`(async () => { document.querySelector("button svg.lucide-arrow-left")?.closest("button").click(); await __sleep(400); })()`);
  const home = () => run(`(async () => { __btn("Home").click(); await __sleep(400); })()`);
  const recentNames = () => run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Recently scanned");
    return h ? [...h.parentElement.nextElementSibling.querySelectorAll("button")].map(b => b.innerText.split("\\n")[0]) : null; })()`);
  // M12: the Learn tiles' accessible names, in order (null when there's no Learn heading).
  const learnTiles = () => run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Learn");
    return h ? [...h.nextElementSibling.querySelectorAll("button")].map(b => b.getAttribute("aria-label")) : null; })()`);
  // A name is the page's full title and contains the tile's visible label (spec D3, WCAG 2.5.3), so the first adds it.
  const HEALTHY = "“Nothing flagged” isn’t “healthy”";
  const LEARN = [`Not a health score: ${HEALTHY}`, "What the badge levels mean", "Seed oils: what the evidence says",
    "Pesticides: what a label can’t tell you", "Ultra-processed foods: no official line yet", "How EcoGo checks a product"];

  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  const w = await run(`(async () => { await __until(() => __btn("Look around first")); return document.body.innerText; })()`);
  check("welcome is honest: what EcoGo does, no fake promises", w.includes("Know what's in your food") && w.includes("Start scanning")
    && !/Sign In|Save Money|better prices|Best Price|Amazon|Walmart|Get Started/i.test(w));
  await run(`__guest()`); await sleep(800);

  const t = await run(`document.body.innerText`);
  check("Home has no invented content", !/Alex|Chicago|Rating|Why Recommended|Deals|Nearby Resources/i.test(t));
  const h = new Date().getHours(), g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  check("greeting matches the time", t.includes(g) && t.includes("What are you eating?"), g);
  check("first visit shows Learn and no Recently scanned", JSON.stringify(await learnTiles()) === JSON.stringify(LEARN) && !t.includes("Recently scanned"));

  // M7.4 (spec 2026-10-02-m74-trust-cleanup-design.md §4): nothing invented, nothing promised.
  const nav = await run(`[...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Home", "Map", "Scan", "Saved", "Profile"].includes(s))`);
  check("bottom nav is Home, Map, Scan, Saved, Profile (M9)", JSON.stringify(nav) === '["Home","Map","Scan","Saved","Profile"]', JSON.stringify(nav));
  check("Home shows no prices", !t.includes("$"));
  await run(`(async () => { __btn("Saved").click(); await __sleep(500); })()`);
  const sv = await run(`({ tabs: [...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Favorites", "Scanned", "Lists"].includes(s)), text: document.body.innerText })`);
  check("Saved: only Favorites and Scanned; Favorites empty on a fresh profile", JSON.stringify(sv.tabs) === '["Favorites","Scanned"]'
    && sv.text.includes("No saved items") && !/Weekly Groceries|Shopping Lists/.test(sv.text), JSON.stringify(sv.tabs));
  await home();

  await run(`__btn("Scan a product").click(); true`); await sleep(600);
  check("Scan card opens the Scan tab", !!(await run(`(async () => !!(await __until(() => __btn("Close camera") || document.querySelector('input[aria-label="Barcode number"]'), 5000)))()`)));
  await home();

  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("oreo"); await sleep(800);
  const sr = await run(`(async () => { await __until(() => __btn("Oreo Original")); return document.body.innerText; })()`);
  check("search results: no prices, sorted by fewest concerns", !sr.includes("$") && sr.includes("Sorted by fewest concerns") && !sr.includes("Sort:"));
  await run(`(async () => { (await __until(() => __btn("Oreo Original"))).click(); await __sleep(600); })()`);
  const op = await run(`({ text: document.body.innerText, share: !!__btn("Share") })`);
  check("Oreo page: no prices, Price Comparison, Share or AI", !op.text.includes("$") && !op.text.includes("Price Comparison") && !op.share
    && !/\bAI\b/.test(op.text) && op.text.includes("Findings are matched against official sources"));
  check("Oreo page points to its Nutrition section", op.text.includes("see the Nutrition section") && op.text.includes("Added sugar"));
  await back(); await back(); // product → search → home
  await run(`(async () => { __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "049000042566");
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click(); })()`);
  await run(`__until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes("Coca-Cola Zero"), 15000)`); await sleep(500);
  await back(); await home();
  let names = await recentNames();
  check("Recently scanned: Coke Zero then Oreo, newest first", names?.[0]?.includes("Coca-Cola Zero") && names?.[1]?.includes("Oreo"), JSON.stringify(names));
  const badge = await run(`[...document.querySelectorAll("h2")].find(e => e.innerText === "Recently scanned").parentElement.nextElementSibling.innerText`);
  check("…with badges", /Nothing flagged|concern|carcinogen/.test(badge), badge.replace(/\n/g, " / "));

  await send("Page.reload"); await sleep(4000); await helpers();
  check("welcome doesn't show again on this device", (await run(`__guest()`)) === false); await sleep(800);
  names = await recentNames();
  check("a reload keeps them", names?.length === 2, JSON.stringify(names));

  await run(`(async () => { __btn("See all").click(); await __sleep(500); })()`);
  const saved = await run(`document.body.innerText`);
  check("See all → Saved › Scanned shows the same list", saved.includes("Coca-Cola Zero") && saved.includes("Oreo") && !saved.includes("No scanned products"));
  await home();

  for (const [name, title] of [[LEARN[0], HEALTHY], [LEARN[1], LEARN[1]]]) {
    await run(`(async () => { __btn(${JSON.stringify(name)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    await back();
  }

  // M12 (spec 2026-10-06-m12-home-tiles-design.md §2): six tiles, the two badge explainers first, How EcoGo checks last.
  const tiles = await learnTiles();
  check("Home lists 6 Learn tiles, in order", JSON.stringify(tiles) === JSON.stringify(LEARN), JSON.stringify(tiles));
  for (const title of [LEARN[2], LEARN[3], LEARN[4]]) {
    await run(`(async () => { __btn(${JSON.stringify(title)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`M7.1 explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    if (title.startsWith("Pesticides")) {
      // Final review: the court ruling (2022, EPA's review) must not read as if it vacated the dated 2017 assessment.
      check("pesticides: the 2022 court ruling isn't tied to the 2017 assessment",
        e.includes("In 2022 a court vacated the human health part of EPA’s review") && !e.includes("(a court vacated part of that review"));
      await run(`(async () => { __btn("Open: What the badge levels mean").click(); await __sleep(400); })()`);
      const linked = await run(`[...document.querySelectorAll("h1")].map(h => h.innerText)`);
      await back();
      const backTo = await run(`[...document.querySelectorAll("h1")].map(h => h.innerText)`);
      check("pesticides → 'What the badge levels mean' link, Back returns to pesticides",
        linked.includes("What the badge levels mean") && backTo.some(t => t.startsWith("Pesticides")), `${JSON.stringify(linked)} → ${JSON.stringify(backTo)}`);
    }
    await back();
  }
  await run(`(async () => { __btn(${JSON.stringify(LEARN[5])}).click(); await __sleep(500); })()`);
  const how = await run(`document.body.innerText`);
  check("How EcoGo checks opens a page with its three steps and no Sources", how.includes(LEARN[5])
    && how.includes("Reads the real label from USDA") && how.includes("Checks ingredients and the food itself")
    && how.includes("Shows the strongest finding") && !how.includes("Sources"));
  await back();

  // M7.2: Profile shows only true things
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  const p = await run(`document.body.innerText`);
  check("Profile has no invented content", !/Alex|Level 4|Money Saved|CO₂|Ethical Purchases|Achievements|Notifications|Dark Mode/i.test(p));
  // M11: Your data is a closed accordion row; its summary carries the count.
  check("Profile: your data, sources and privacy", p.includes("2 recent products, on this device") && p.includes("Where results come from") && p.includes("Privacy"));
  const gh = await run(`(() => { const a = [...document.querySelectorAll("a")].find(a => a.innerText.includes("Source code")); return a ? a.href + " " + a.target : null; })()`);
  check("Profile: source-code link opens GitHub in a new tab", gh === "https://github.com/skynetrebel42/ecogo _blank", gh);
  await home();

  await run(`(async () => { __btn("Clear recently scanned").click(); await __sleep(400); })()`);
  const after = await run(`document.body.innerText`);
  check("Clear empties the list", JSON.stringify(await learnTiles()) === JSON.stringify(LEARN) && !after.includes("Recently scanned"));
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  check("…and Profile says Nothing scanned yet", (await run(`document.body.innerText`)).includes("Nothing scanned yet"));

  // M7.4 D3: a looked-up product opened from search (not Scan), then bookmarked, is listed in Saved › Favorites.
  await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("oreo");
  const usdaName = await run(`(async () => {
    const first = () => [...document.querySelectorAll("p")].find(e => e.innerText === "More from USDA FoodData Central")?.parentElement.querySelector("button");
    const b = await __until(first, 20000); if (!b) return null;
    b.click(); await __sleep(800); const name = document.querySelector("h1")?.innerText;
    __btn("Save")?.click(); await __sleep(300); return name; })()`);
  await back(); await back(); // product → search → home
  await run(`(async () => { __btn("Saved").click(); await __sleep(500); })()`);
  const fav = await run(`document.body.innerText`);
  check("a USDA search result, opened and bookmarked, is listed in Favorites", !!usdaName && fav.includes(usdaName) && !fav.includes("No saved items"),
    usdaName ?? "no USDA result");

  // M7.4 final review: a page without a Nutrition section (KIND Bars has no verified barcode) mustn't point to one.
  await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("kind");
  await run(`(async () => { (await __until(() => __btn("KIND Bars")))?.click(); await __sleep(800); })()`);
  const kind = await run(`document.body.innerText`);
  check("KIND Bars (no nutrition data): no pointer to a missing Nutrition section", kind.includes("KIND Bars")
    && kind.includes("This badge doesn't rate nutrition.") && !kind.includes("see the Nutrition section") && !kind.includes("Added sugar"));
  // Data ownership (spec 2026-10-02-m10-data-ownership-design.md §7): lookups, nutrition, search and alternatives come from
  // our own `foods` table. The app never calls USDA's API.
  const scanTyped = (code, text) => run(`(async () => {
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click();
    await __until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes(${JSON.stringify(text)}), 15000);
    await __sleep(800); return document.body.innerText; })()`);
  await back(); await back(); // KIND product → search → home
  await home();
  const tos = await scanTyped("028400064057", "Tostitos");
  check("a barcode outside the catalog is found in our database, with the USDA snapshot date",
    tos.includes("Tostitos") && /snapshot [A-Z][a-z]{2} \d{4}/.test(tos), tos.match(/\(snapshot [^)]*\)/)?.[0] ?? "no snapshot note");
  await back(); await home();
  const dor = await scanTyped("028400335799", "Doritos");
  const alt = await run(`(async () => { await __until(() => document.body.innerText.includes("Alternatives with fewer concerns"), 15000); return document.body.innerText; })()`);
  check("a flagged product shows alternatives from the same USDA category, with the caption",
    dor.includes("Doritos") && alt.includes("Alternatives with fewer concerns") && alt.includes("Availability near you isn't known"));
  await back(); await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("granola");
  const more = await run(`(async () => { const first = () => [...document.querySelectorAll("p")].find(e => e.innerText === "More from USDA FoodData Central")?.parentElement.querySelector("button");
    return !!(await __until(first, 20000)); })()`);
  check("a text search lists more products from our USDA copy", more);
  // M8 (spec 2026-10-02-m8-add-product-design.md §7; the photo reader has its own check, check-ocr.mjs).
  await back(); await home();
  check("M8: Home has no no-barcode entry", !(await run(`document.body.innerText`)).includes("No barcode"));
  await run(`(async () => { __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); return true; })()`);
  check("M8: the Scan drawer shows 'No barcode? Check ingredients'", !!(await run(`!!__btn("No barcode? Check ingredients")`)));
  const typeIngredients = async text => {
    await run(`(() => { const t = document.querySelector("#ingredients"); t.focus(); t.select(); return true; })()`);
    await send("Input.insertText", { text }); await sleep(300);
    return run(`document.querySelector('[role="status"]')?.innerText ?? ""`);
  };
  await run(`(async () => { __btn("No barcode? Check ingredients").click(); await __sleep(400); __btn("Type it").click(); await __sleep(300); return true; })()`);
  check("M8: typing a list containing Red 40 shows Some concern", (await typeIngredients("Sugar, corn syrup, Red 40")).includes("Some concern"));
  await run(`(async () => { __btn("Close").click(); await __sleep(600); return true; })()`);
  const nf = await scanTyped("3017620429996", "We couldn't find this barcode yet");
  check("M8: the not-found screen shows 'Add this product', the OFF website link stays as a fallback",
    nf.includes("Add this product") && nf.includes("Or add it on the Open Food Facts website"));
  const turnstile = () => requests.some(u => u.includes("challenges.cloudflare.com"));
  const tipsStep = await run(`(async () => { __btn("Add this product").click(); await __sleep(400); __btn("Skip").click(); await __sleep(300);
    const t = document.body.innerText; __btn("Skip the photo, type the ingredients").click(); await __sleep(300); return t; })()`);
  check("M8 H3: the ingredients photo step shows the numbered tips", ["Lay it flat", "Close & sharp", "Only the ingredients", "No glare"]
    .every(t => tipsStep.includes(t)));
  await typeIngredients("Water, sugar, Red 40");
  const beforeSend = turnstile();
  await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); __btn("Skip").click(); await __sleep(600); return true; })()`);
  const sendOff = await run(`__btn("Send")?.disabled`);
  await run(`(async () => { document.querySelector('input[type="checkbox"]').click(); await __sleep(200); return true; })()`);
  const sendOn = await run(`__btn("Send")?.disabled === false`);
  check("M8: Send stays disabled until the checkbox is ticked", sendOff === true && sendOn === true, `before ${sendOff}, after tick disabled=${!sendOn}`);
  check("M8: the human check loads only on the Send screen", !beforeSend && turnstile());
  const backed = await run(`(async () => { __btn("Back").click(); await __sleep(300); const nutrition = !!__btn("Skip");
    __btn("Back").click(); await __sleep(300); return nutrition && document.querySelector("#ingredients")?.value; })()`);
  check("M8: Back from Send goes to the nutrition photo, then to the check, keeping the text", backed === "Water, sugar, Red 40", String(backed));
  // M8 follow-up 4, P2: a stubbed human check that never answers keeps the send at its first stage: a moving bar with
  // no percent, which reduced motion stills.
  await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); return true; })()`);
  const { root: docRoot } = (await send("DOM.getDocument")).result;
  const lib = (await send("DOM.querySelector", { nodeId: docRoot.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib, files: [fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url))] });
  const waiting = await run(`(async () => { await __until(() => __btn("Send") && document.querySelector('img[alt="Nutrition photo"]'), 10000);
    const t = await __until(() => window.turnstile, 10000); if (!t) return "Turnstile didn't load";
    t.render = () => "stub"; t.remove = () => {}; __btn("Send").click(); await __sleep(300);
    const b = [...document.querySelectorAll("button")].find(b => b.innerText.startsWith("Sending")), bar = document.querySelector('[role="progressbar"]');
    return [b?.innerText, b?.disabled, bar?.getAttribute("aria-valuetext"), bar?.hasAttribute("aria-valuenow"),
      getComputedStyle(document.querySelector("[data-moving]")).animationName].join(" | "); })()`);
  check("M8 P2: while the human check runs: 'Checking you're human…' on a moving bar with no percent, button 'Sending…'",
    waiting === "Sending… | true | Checking you're human… | false | ecogo-indeterminate", waiting);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const still = await run(`getComputedStyle(document.querySelector("[data-moving]")).animationName`);
  await send("Emulation.setEmulatedMedia", { features: [] });
  check("…with reduced motion the bar doesn't move", still === "none", still);
  await run(`(async () => { __btn("Close").click(); await __sleep(600); return true; })()`);
  // M8 follow-up 2, G2: OFF took the text but not the nutrition photo. Every auth call is answered here (CDP Fetch); the
  // off-submit POST goes to a local stub server instead (follow-up 4: a real, throttled upload, so the bar shows real
  // percents). Nothing of the send reaches Supabase or OFF; the human check is stubbed to hand over a token.
  const faked = [];
  const CORS = [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" }, { name: "Content-Type", value: "application/json" }];
  const stub = createServer((req, res) => {
    req.resume(); // read the whole upload, then answer after a moment (the "saving" stage)
    req.on("end", () => setTimeout(() => {
      res.writeHead(200, Object.fromEntries(CORS.map(h => [h.name, h.value])));
      res.end(JSON.stringify({ ok: true, textKept: false, failedPhotos: ["nutrition"], pendingPhotos: ["front"] }));
    }, 800));
  });
  await new Promise(r => stub.listen(0, "127.0.0.1", r));
  onPaused = p => {
    faked.push(`${p.request.method} ${p.request.url.split("/").slice(-2).join("/")}`);
    if (p.request.method === "POST" && p.request.url.includes("/functions/v1/off-submit")) {
      send("Fetch.continueRequest", { requestId: p.requestId, url: `http://127.0.0.1:${stub.address().port}/off-submit` });
      return;
    }
    const body = p.request.method === "OPTIONS" ? "" : JSON.stringify({ access_token: "fake",
      token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake",
      user: { id: "00000000-0000-4000-8000-000000000048", aud: "authenticated", role: "authenticated", is_anonymous: true } });
    send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: CORS, body: Buffer.from(body).toString("base64") });
  };
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/auth/v1/*" }, { urlPattern: "*/functions/v1/*" }] });
  await scanTyped("3017620429996", "We couldn't find this barcode yet");
  await run(`(async () => { __btn("Add this product").click(); await __sleep(400); __btn("Skip").click(); await __sleep(300);
    __btn("Skip the photo, type the ingredients").click(); await __sleep(300); return true; })()`);
  await typeIngredients("Water, sugar, Red 40");
  const nutritionStep = await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); return document.body.innerText; })()`);
  check("M8 H3: the nutrition photo step's tips say 'Only the nutrition table'", ["Lay it flat", "Close & sharp", "Only the nutrition table", "No glare"]
    .every(t => nutritionStep.includes(t)) && !nutritionStep.includes("Only the ingredients"));
  const { root: docRoot2 } = (await send("DOM.getDocument")).result;
  const lib2 = (await send("DOM.querySelector", { nodeId: docRoot2.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib2, files: [fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url))] });
  await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 40_000 }); // ~40 KB/s
  const sent = await run(`(async () => { await __until(() => __btn("Send") && document.querySelector('img[alt="Nutrition photo"]'), 10000);
    document.querySelector('input[type="checkbox"]').click(); await __sleep(200);
    const t = await __until(() => window.turnstile, 10000); if (!t) return "Turnstile didn't load";
    t.render = (el, o) => { setTimeout(() => o.callback("stub-token"), 50); return "stub"; }; t.remove = () => {};
    window.__bar = []; const seen = setInterval(() => { const b = document.querySelector('[role="progressbar"]');
      const s = b && b.getAttribute("aria-valuetext") + "/" + (b.getAttribute("aria-valuenow") ?? "-"); if (s && __bar.at(-1) !== s) __bar.push(s); }, 20);
    __btn("Send").click(); await __until(() => document.body.innerText.includes("Sent to Open Food Facts"), 20000); clearInterval(seen);
    const a = [...document.querySelectorAll("a")].find(a => a.innerText === "Open Food Facts website");
    return document.body.innerText + "|" + (a?.href ?? "no link"); })()`);
  await send("Fetch.disable");
  await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  stub.close();
  const bar = await run(`__bar`);
  const pct = bar.filter(s => s.startsWith("Uploading photos")).map(s => Number(s.split("/")[1]));
  check("M8 P1/P2: the bar shows the real upload percent rising, then 'Open Food Facts is saving it…', then Sent",
    pct.length >= 3 && pct.every((p, i) => i === 0 || p >= pct[i - 1]) && pct.some(p => p > 0 && p < 100)
    && bar.at(-1) === "Open Food Facts is saving it…/-" && bar.every(s => s.startsWith("Uploading photos") || !/\/\d/.test(s)), bar.join(" → "));
  check("M8 G2/H1: a send where the nutrition photo failed says Sent, names it, links to OFF, and says the others are still uploading",
    sent.includes("Sent to Open Food Facts") && sent.includes("The nutrition photo didn't go through. You can add it later on the Open Food Facts website.")
    && sent.includes("Your other photos are still uploading to Open Food Facts.")
    && sent.includes("|https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=3017620429996")
    && faked.some(f => f.startsWith("POST") && f.includes("signup")) && faked.some(f => f.startsWith("POST") && f.includes("off-submit"))
    && faked.every(f => /^(OPTIONS|POST) v1\/(signup|off-submit)$/.test(f)),
    `${sent.split("|")[1]}; answered here: ${faked.join(", ")}`);
  await run(`(async () => { __btn("Scan another product").click(); await __sleep(600); return true; })()`);
  check("USDA's own API is never called",!requests.some(u => u.includes("api.nal.usda.gov")), requests.filter(u => u.includes("usda")).slice(0, 3).join(" "));
  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until the 120 s timeout
}

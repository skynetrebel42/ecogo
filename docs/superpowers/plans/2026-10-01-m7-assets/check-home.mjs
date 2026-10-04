// M7 (headless Edge): Home has no fake content; first visit shows "How EcoGo checks"; Scan card opens Scan;
// Oreo (search) then Diet Coke (typed barcode) appear newest first; survives reload; Clear; explainers; Saved › Scanned.
// M7.1: Home lists 5 explainer cards (M7's two first); seed oils, pesticides and ultra-processed open with sources;
// the pesticides page's "What the badge levels mean" link opens it and Back returns.
// M7.2/M7.3: the welcome screen is honest and shows once per device; Profile shows only true things.
// M7.4: no Map in the nav; no prices, Share or AI claims; Saved has only Favorites (empty at first) and Scanned; a USDA
// search result, opened and bookmarked, is listed in Favorites.
// M9: the Map tab is back (its own check: docs/archive/plans/2026-10-02-m9-assets/check-map.mjs).
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs <url>  (M7 plan Task 4; M7.1)
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
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

  await send("Runtime.enable");
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
  check("first visit shows How EcoGo checks a product", t.includes("How EcoGo checks a product") && !t.includes("Recently scanned"));

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

  for (const title of ["isn’t “healthy”", "What the badge levels mean"]) {
    await run(`(async () => { __btn(${JSON.stringify(title)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    await back();
  }

  // M7.1: five cards, M7's two first, then seed oils, pesticides, ultra-processed (spec E1)
  const cards = await run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Hidden risks, explained");
    return h ? [...h.nextElementSibling.querySelectorAll("button")].map(b => b.innerText.split("\\n")[0]) : []; })()`);
  check("Home lists 5 explainer cards, in order", cards.length === 5 && /isn’t “healthy”/.test(cards[0]) && /badge levels/.test(cards[1])
    && /^Seed oils/.test(cards[2]) && /^Pesticides/.test(cards[3]) && /^Ultra-processed/.test(cards[4]), JSON.stringify(cards));
  for (const title of ["Seed oils: what the evidence says", "Pesticides: what a label", "Ultra-processed foods: no official line yet"]) {
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

  // M7.2: Profile shows only true things
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  const p = await run(`document.body.innerText`);
  check("Profile has no invented content", !/Alex|Level 4|Money Saved|CO₂|Ethical Purchases|Achievements|Notifications|Dark Mode/i.test(p));
  check("Profile: your data, sources and privacy", p.includes("2 products, saved in this browser only") && p.includes("Where results come from") && p.includes("Privacy"));
  const gh = await run(`(() => { const a = [...document.querySelectorAll("a")].find(a => a.innerText.includes("Source code")); return a ? a.href + " " + a.target : null; })()`);
  check("Profile: source-code link opens GitHub in a new tab", gh === "https://github.com/skynetrebel42/ecogo _blank", gh);
  await home();

  await run(`(async () => { __btn("Clear recently scanned").click(); await __sleep(400); })()`);
  const after = await run(`document.body.innerText`);
  check("Clear empties the list", after.includes("How EcoGo checks a product") && !after.includes("Recently scanned"));
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
  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until the 120 s timeout
}

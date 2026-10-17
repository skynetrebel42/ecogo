// M16 personal care (headless Edge, same CDP setup as check-saved): spec docs/superpowers/specs/2026-10-16-m16-personal-care-design.md §2.
// Open Beauty Facts, Open Food Facts and the `foods` table are answered in the page (CDP Fetch): nothing reaches them.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-care.mjs <url> [shotDir]
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const SHOTS = process.argv[3];
const PORT = 9700 + Math.floor(Math.random() * 90);
const PROFILE = `${process.env.TEMP}\\ecogo-care-${PORT}`;
rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=375,812",
  `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
setTimeout(() => { console.log("TIMEOUT"); edge.kill(); process.exit(1); }, 120000).unref?.();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const requests = []; // every URL the page asked for (Network events)
const obfAsked = []; // "METHOD url X-User-Agent" for every Open Beauty Facts request
let ok = 0, total = 0;
const check = (name, pass, detail = "") => { total++; if (pass) ok++; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// Open Beauty Facts answers: the recorded lotion and no-ingredients products, plus two made up for the check.
const fixture = name => JSON.parse(readFileSync(new URL(`../../../../src/lib/fixtures/obf/${name}.json`, import.meta.url), "utf8"));
const fake = (code, product_name, ingredients_text, categories_tags = []) => ({ httpStatus: 200, body: { code, status: 1, status_verbose: "product found",
  product: { code, product_name, brands: "Check Brand", lang: "en", ingredients_text, categories_tags } } });
const OBF = {
  "0055086009386": fixture("lotion-0055086009386"),
  "0345334300014": fixture("no-ingredients-0345334300014"),
  "0099990000017": fake("0099990000017", "Check Dandruff Shampoo", "Water, Sodium Laureth Sulfate, Zinc Pyrithione, Fragrance, Limonene"),
  "0099990000024": fake("0099990000024", "Check Mineral Sunscreen SPF 30", "Active ingredients: Zinc Oxide 20%, Octinoxate 7.5%, Bemotrizinol 4%. Inactive ingredients: Water, Glycerin"),
  "0099990000048": fake("0099990000048", "Check Daily Shampoo", "Water, Cocamide DEA, Salicylic Acid, Sodium Hydroxide"),
  "0099990000055": fake("0099990000055", "Check Whitening Toothpaste", "Sodium Fluoride, Water, Hydrated Silica, Titanium Dioxide (CI 77891)"),
  "0099990000062": fake("0099990000062", "Check Daily Moisture Lotion", "Water, Zinc Oxide, Glycerin", ["en:body-care", "en:sunscreens"]),
};
const OBF_404 = fixture("not-found-0049000042566").body;
const OFF_404 = { status: "failure", result: { id: "product_not_found" } };
const CORS = [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" },
  { name: "Content-Type", value: "application/json" }];

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const answer = (requestId, status, body) => send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: CORS,
    body: Buffer.from(body === "" ? "" : JSON.stringify(body)).toString("base64") });
  const onPaused = ({ requestId, request: { url, method, headers } }) => {
    if (method === "OPTIONS") return answer(requestId, 200, "");
    if (url.includes("openbeautyfacts.org")) {
      obfAsked.push(`${method} ${url} ${headers["X-User-Agent"] ?? "-"}`);
      const hit = OBF[url.match(/product\/(\d+)\?/)?.[1] ?? ""];
      return hit ? answer(requestId, hit.httpStatus, hit.body) : answer(requestId, 404, OBF_404);
    }
    if (url.includes("openfoodfacts.org")) return answer(requestId, 404, OFF_404);
    return answer(requestId, 200, []); // the foods table: no row
  };
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
    if (m.method === "Fetch.requestPaused") onPaused(m.params);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    // Open Food/Beauty Facts' 404 for a product they don't have is logged by the browser as a failed resource, not by the app.
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
  });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const helpers = () => run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s || b.getAttribute("aria-label") === s);
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Home")); if (b?.innerText.includes("Look around first")) { b.click(); await __sleep(400); } }; true`);
  const click = s => run(`(async () => { const b = await __until(() => __btn(${JSON.stringify(s)}), 5000); b?.click(); await __sleep(400); return !!b; })()`);
  const back = () => run(`(async () => { document.querySelector("button svg.lucide-arrow-left")?.closest("button").click(); await __sleep(400); })()`);
  const home = () => click("Home");
  const text = () => run(`document.body.innerText`);
  const scanTyped = (code, wait) => run(`(async () => {
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click();
    await __until(() => document.body.innerText.includes(${JSON.stringify(wait)}), 15000);
    await __sleep(800); return document.body.innerText; })()`);
  const typeIngredients = async list => {
    await click("Type it");
    await run(`(() => { const t = document.querySelector("#ingredients"); t.focus(); t.select(); return true; })()`);
    await send("Input.insertText", { text: list }); await sleep(300);
    return run(`document.querySelector('[role="status"]')?.innerText ?? ""`);
  };
  const shot = async name => { if (!SHOTS) return; await sleep(300);
    const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.result.data, "base64")); };

  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*openbeautyfacts.org/*" }, { urlPattern: "*openfoodfacts.org/*" }, { urlPattern: "*/rest/v1/foods*" }] });
  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  await run(`__guest()`); await sleep(500);

  // N1 + N2: an OBF product with an EU-banned ingredient.
  const shampoo = await scanTyped("0099990000017", "Check Dandruff Shampoo");
  check("N1: a barcode only Open Beauty Facts has opens its page, credited, with OBF's own edit link and no EcoGo sends",
    shampoo.includes("From Open Beauty Facts, crowd-sourced.") && shampoo.includes("Data © Open Beauty Facts contributors, ODbL.")
    && shampoo.includes("Have an Open Beauty Facts account? Edit there.") && !shampoo.includes("Send new photos") && !shampoo.includes("Open Food Facts"));
  const edit = await run(`[...document.querySelectorAll("a")].find(a => a.innerText.includes("Have an Open Beauty Facts account"))?.href`);
  check("N1: the edit link opens Open Beauty Facts' editor for this barcode", edit === "https://world.openbeautyfacts.org/cgi/product.pl?type=edit&code=0099990000017", edit);
  check("N2: zinc pyrithione (EU Annex II) gives High concern and says it's banned in EU cosmetics",
    shampoo.includes("High concern · 1 finding") && shampoo.includes("Zinc pyrithione") && shampoo.includes("Banned in cosmetics in the EU."));
  await run(`(async () => { [...document.querySelectorAll("button[aria-expanded]")].find(b => b.innerText.startsWith("Zinc pyrithione"))?.click(); await __sleep(300); })()`);
  const zinc = await text();
  check("N2a: its sources open with FDA's dandruff-drug line", zinc.includes("FDA allows it as a dandruff-shampoo drug ingredient.")
    && zinc.includes("Annex II entry 1670") && zinc.includes("21 CFR 358.710"));
  check("N3 + N4 rows sit under 'Good to know' and don't add findings", shampoo.includes("Good to know") && shampoo.includes("Known skin allergen")
    && shampoo.includes("The label doesn't say what's in 'fragrance'."));
  check("N7: the limits line is on the page", shampoo.includes("EcoGo checks this list against FDA, EU and IARC findings only. Not finding a match doesn't mean a product is safe for you."));
  await shot("care-shampoo");
  await back(); await home();

  // N3 + N4: the real lotion: fragrance and five EU allergens, nothing flagged.
  const lotion = await scanTyped("0055086009386", "Cherry Blossom");
  check("N3/N4: fragrance and named EU allergens are info rows; the badge stays 'Nothing flagged'",
    lotion.includes("Nothing flagged by FDA, EU or IARC") && ["Fragrance", "Limonene", "Linalool", "Citronellol", "Geraniol", "Citral"].every(n => lotion.includes(`${n}\nInfo`)));
  await back(); await home();
  const recent = await run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Recently viewed");
    return h ? h.parentElement.nextElementSibling.innerText : ""; })()`);
  check("lists use the personal-care check too (Recently viewed)", recent.includes("Cherry Blossom") && recent.includes("Nothing flagged") && !recent.includes("Food only"), recent.replace(/\s+/g, " ").slice(0, 120));

  // N5: sunscreen actives with FDA's status, no badge change.
  const sun = await scanTyped("0099990000024", "Check Mineral Sunscreen");
  check("N5: zinc oxide 'proposed as safe and effective', octinoxate 'more data are needed', no finding",
    sun.includes("As a sunscreen active: FDA: proposed as safe and effective.") && sun.includes("As a sunscreen active: FDA says more data are needed.")
    && sun.includes("Nothing flagged by FDA, EU or IARC"));
  check("N2c: bemotrizinol has FDA's 2026 status", sun.includes("As a sunscreen active: FDA: added as a sunscreen active in 2026."));
  await back(); await home();
  // N2c item 2 (revised): a page shows sunscreen rows only for a sunscreen, by name or OBF category.
  const paste = await scanTyped("0099990000055", "Check Whitening Toothpaste");
  check("a toothpaste with titanium dioxide (CI 77891) gets no sunscreen row", paste.includes("Check Whitening Toothpaste") && !paste.includes("As a sunscreen active"));
  await back(); await home();
  const byTag = await scanTyped("0099990000062", "Check Daily Moisture Lotion");
  check("a lotion that OBF files under sunscreens gets the zinc oxide row", byTag.includes("As a sunscreen active: FDA: proposed as safe and effective."));
  await back(); await home();

  // N2c + N2b: cocamide DEA (IARC 2B) sets the badge; two EU Annex III ingredients sit in one closed grey row.
  const daily = await scanTyped("0099990000048", "Check Daily Shampoo");
  check("N2c: cocamide DEA (IARC 2B) gives Some concern", daily.includes("Some concern · 1 finding") && daily.includes("Cocamide DEA"));
  const fold = () => run(`(() => { const d = [...document.querySelectorAll("details")].find(e => e.innerText.startsWith("Limited, not banned"));
    return d ? { open: d.open, summary: d.querySelector("summary").innerText, shown: d.querySelector("ul").checkVisibility() } : null; })()`);
  const closed = await fold();
  check("N2b: one row 'Limited, not banned: 2 ingredients', closed by default", closed?.summary === "Limited, not banned: 2 ingredients" && !closed.open && !closed.shown, JSON.stringify(closed));
  await run(`(async () => { [...document.querySelectorAll("summary")].find(s => s.innerText.startsWith("Limited, not banned")).click(); await __sleep(300); })()`);
  const opened = await run(`[...document.querySelectorAll("details")].find(e => e.innerText.startsWith("Limited, not banned"))?.innerText ?? ""`);
  check("N2b: opened, each entry says the EU allows it up to a limit, with its Annex III entry",
    opened.split("The EU allows this in cosmetics up to a set limit. EcoGo can't see how much this product has.").length === 3
    && opened.includes("Annex III entry 98") && opened.includes("Annex III entry 15a") && !/\b(?:un)?safe\b/i.test(opened), opened.replace(/\s+/g, " ").slice(0, 160));
  await shot("care-limited");
  await back(); await home();
  const none = await scanTyped("0055086009386", "Cherry Blossom");
  check("N2b: no 'Limited, not banned' row when there's nothing limited", none.includes("Cherry Blossom") && !none.includes("Limited, not banned"));
  await back(); await home();

  // Q6: a catalog "Personal Care" product gets the personal-care check, not "Food only".
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await send("Input.insertText", { text: "head & shoulders" });
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await run(`(async () => { (await __until(() => [...document.querySelectorAll("button")].find(b => b.innerText.includes("Head & Shoulders"))))?.click(); await __sleep(800); })()`);
  const hs = await text();
  check("Q6: Head & Shoulders (catalog) reads High concern for zinc pyrithione, with no OBF credit or edit link",
    hs.includes("Head & Shoulders") && hs.includes("High concern · 1 finding") && hs.includes("Zinc pyrithione") && !hs.includes("Food only")
    && !hs.includes("Open Beauty Facts"));
  await back(); await back(); await home();

  // N1: an OBF hit with no ingredient list.
  const bare = await scanTyped("0345334300014", "Vanicream");
  check("N1: a hit without ingredients says so and offers 'Check the label yourself'",
    bare.includes("No ingredient list on Open Beauty Facts.") && bare.includes("Check the label yourself") && !bare.includes("Add the ingredients"));
  await click("Check the label yourself");
  const pressed = await run(`[...document.querySelectorAll('[aria-labelledby="check-kind"] button')].map(b => b.innerText + ":" + b.getAttribute("aria-pressed")).join(",")`);
  check("N6: from an OBF page the check starts on Personal care", pressed === "Food:false,Personal care:true", pressed);
  const own = await typeIngredients("Aqua, Petrolatum, Parfum");
  check("N6: the typed list is checked as personal care, said to be from what you typed", own.includes("Nothing flagged by FDA, EU or IARC")
    && own.includes("From what you typed, not from Open Beauty Facts.") && own.includes("Fragrance:"));
  await click("Close");
  await back(); await home();

  // N6: not found anywhere → What is it? → Personal care → photo-or-type check.
  const nf = await scanTyped("0099990000031", "We couldn't find this barcode yet");
  check("N6: the not-found screen names Open Beauty Facts and asks 'What is it?', Food first",
    nf.includes("Open Beauty Facts") && nf.includes("What is it?") && nf.includes("Add this product") && nf.includes("Or add it on the Open Food Facts website"));
  await click("Personal care");
  const careNf = await text();
  check("N6: Personal care swaps the OFF add buttons for 'Check the label yourself'", careNf.includes("Check the label yourself")
    && !careNf.includes("Add this product") && !careNf.includes("Or add it on the Open Food Facts website"));
  await shot("care-not-found");
  await click("Check the label yourself");
  const formal = await typeIngredients("Water, Formaldehyde, Fragrance (Parfum), Coumarin");
  check("N6: a typed personal-care list gets the personal-care result (formaldehyde: Known carcinogen; one fragrance row)",
    formal.includes("Known carcinogen · 1 finding") && formal.includes("Formaldehyde:") && formal.split("Fragrance:").length === 2
    && formal.includes("Coumarin:") && formal.includes("Not finding a match doesn't mean a product is safe for you."));
  check("N6: no send button after a personal-care check", !(await text()).includes("Also send these photos"));
  await shot("care-typed");
  await click("Food");
  check("N6: switching to Food runs the food check on the same text", (await run(`document.querySelector('[role="status"]')?.innerText ?? ""`)).includes("Nothing flagged among"));
  await click("Close");

  check("every OBF request is a GET to the v2 product API with EcoGo's X-User-Agent",
    obfAsked.length >= 5 && obfAsked.every(r => /^GET https:\/\/world\.openbeautyfacts\.org\/api\/v2\/product\/\d+\?fields=\S+ EcoGo\/0\.1 \(/.test(r)), `${obfAsked.length} requests`);
  check("nothing signs in or sends (no auth, functions, Turnstile)", !requests.some(u => /\/auth\/v1\/|\/functions\/v1\/|challenges\.cloudflare\.com/.test(u)));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (err) {
  check("the check ran to the end", false, String(err?.stack ?? err).slice(0, 300));
} finally {
  console.log(`\n${ok}/${total} passed`);
  edge.kill();
  process.exit(ok === total && total > 0 ? 0 : 1);
}

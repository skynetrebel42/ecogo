// M16 personal care (headless Edge, same CDP setup as check-saved): spec docs/superpowers/specs/2026-10-16-m16-personal-care-design.md §2.
// Open Beauty Facts, Open Food Facts and the `foods` table are answered in the page (CDP Fetch): nothing reaches them.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-care.mjs <url> [shotDir]
import { startEdge } from "./edge.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const URL_ = process.argv[2];
const SHOTS = process.argv[3];
const { PORT, closeAndCheck } = startEdge("care", 9700, "375,812", 120000);
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
  // M17: a hand soap on EPA's Safer Choice list (src/data/safer-choice.json), here also found on Open Beauty Facts.
  "041260380570": fake("041260380570", "Check Coconut Milk Hand Soap", "Water, Sodium Laureth Sulfate, Glycerin"),
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
  check("063 F4: FDA's dandruff-drug line shows next to the EU ban without opening the row",
    shampoo.includes("Banned in cosmetics in the EU. FDA allows it as a dandruff-shampoo drug ingredient."));
  check("063 F1: the fragrance note names MoCRA and no longer says 'US law doesn't'",
    shampoo.includes("A 2022 US law (MoCRA) requires FDA to make rules for labeling fragrance allergens.") && !shampoo.includes("US law doesn't"));
  check("063 F8: no USDA or food line on a personal-care page", !/USDA|Nutrition|additives/.test(shampoo), shampoo.match(/.{0,40}(USDA|Nutrition|additives).{0,40}/)?.[0]);
  const sizes = await run(`["Back", "Save"].map(s => { const r = __btn(s)?.getBoundingClientRect(); return r ? Math.round(r.width) + "x" + Math.round(r.height) : "none"; }).join(",")`);
  check("063 F13: Back and Save are at least 44 x 44 px", sizes.split(",").every(s => s.split("x").every(n => Number(n) >= 44)), sizes);
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
    lotion.includes("No matches in EcoGo's checked list.") && !lotion.includes("Nothing flagged by FDA") && ["Fragrance", "Limonene", "Linalool", "Citronellol", "Geraniol", "Citral"].every(n => lotion.includes(`${n}\nInfo`)));
  await back(); await home();
  const recent = await run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Recently viewed");
    return h ? h.parentElement.nextElementSibling.innerText : ""; })()`);
  check("lists use the personal-care check too (Recently viewed)", recent.includes("Cherry Blossom") && recent.includes("Nothing flagged") && !recent.includes("Food only"), recent.replace(/\s+/g, " ").slice(0, 120));

  // N5: sunscreen actives with FDA's status, no badge change.
  const sun = await scanTyped("0099990000024", "Check Mineral Sunscreen");
  check("N5: zinc oxide 'proposed as safe and effective', octinoxate 'more data are needed', no finding",
    sun.includes("As a sunscreen active: FDA: proposed as safe and effective.") && sun.includes("As a sunscreen active: FDA says more data are needed.")
    && sun.includes("No matches in EcoGo's checked list."));
  const MEANING = "FDA says “more data needed” is not a conclusion that an ingredient is unsafe for use in sunscreens.";
  check("063 F3: FDA's 'more data isn't a finding of unsafe' line shows once under the sunscreen rows", sun.split(MEANING).length === 2);
  check("N2c: bemotrizinol has FDA's 2026 status", sun.includes("As a sunscreen active: FDA: added as a sunscreen active in 2026."));
  await back(); await home();
  // N2c item 2 (revised): a page shows sunscreen rows only for a sunscreen, by name or OBF category.
  const paste = await scanTyped("0099990000055", "Check Whitening Toothpaste");
  check("a toothpaste with titanium dioxide (CI 77891) gets no sunscreen row", paste.includes("Check Whitening Toothpaste") && !paste.includes("As a sunscreen active"));
  await back(); await home();
  const byTag = await scanTyped("0099990000062", "Check Daily Moisture Lotion");
  check("a lotion that OBF files under sunscreens gets the zinc oxide row", byTag.includes("As a sunscreen active: FDA: proposed as safe and effective."));
  check("063 F3: no 'more data' line when no row says more data (zinc oxide only)", !byTag.includes(MEANING));
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
  check("N2b + 063 F6: opened, each entry says how the EU limits it, with its Annex III entry",
    opened.split("The EU limits how this can be used (amount, product type or pH). EcoGo can't check that from a label.").length === 3
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
  check("N6: from an OBF page the check starts on Personal care", pressed === "Food:false,Personal care:true,Cleaning product:false", pressed); // 068 G2: three choices
  const own = await typeIngredients("Aqua, Petrolatum, Parfum");
  check("N6: the typed list is checked as personal care, said to be from what you typed", own.includes("No matches in EcoGo's checked list.")
    && own.includes("From what you typed, not from Open Beauty Facts.") && own.includes("Fragrance:"));
  await click("Close");
  await back(); await home();

  // M17 S2 (spec docs/superpowers/specs/2026-10-20-m17-cleaners-design.md): EPA's Safer Choice list, from the snapshot.
  const ENDORSE = "“EPA certification does not constitute endorsement of this product.” (EPA)";
  const epaOnly = await scanTyped("033200230021", "EPA Safer Choice certified");
  check("S2: a barcode only on EPA's list opens a page with EPA's name, company, endorsement line and list date",
    epaOnly.includes("EPA Safer Choice certified") && epaOnly.includes("As listed by EPA: Arm & Hammer Baby Liquid Laundry Detergent, Church & Dwight Co., Inc.\n")
    && epaOnly.includes(ENDORSE) && /From EPA's Safer Choice list, [A-Z][a-z]{2} \d{4}\./.test(epaOnly), epaOnly.replace(/\s+/g, " ").slice(0, 200));
  check("S2/Q4: that page has no ingredients and no Open Food Facts sends; Save stays",
    epaOnly.includes("No ingredient list available.") && !/Add the ingredients|Send new photos|Open Food Facts|USDA/.test(epaOnly)
    && await run(`!!__btn("Save")`), epaOnly.match(/.{0,40}(Add the ingredients|Send new photos|Open Food Facts|USDA).{0,40}/)?.[0]);
  const epaLink = await run(`[...document.querySelectorAll("a")].find(a => a.innerText.includes("Search EPA's Safer Choice products"))?.href`);
  check("S2: the card links to EPA's product search", epaLink === "https://www.epa.gov/saferchoice/products", epaLink);
  const CALIFORNIA = "California law requires the maker of a cleaning product sold in the state to post its intentionally added ingredients online, with some exceptions such as confidential business information.";
  check("S3: a listed laundry detergent gets the California line", epaOnly.includes(CALIFORNIA));
  await back(); await home();
  const twice = await scanTyped("732913451302", "EPA Safer Choice certified");
  check("S2/Q6: a barcode EPA lists under two products names both", twice.includes("EPA lists this barcode for:")
    && twice.includes("Dish Liquid, Free & Clear, Seventh Generation.") && twice.includes("Dish Liquid, Lavender Flower & Mint, Seventh Generation."));
  await back(); await home();
  const both = await scanTyped("041260380570", "EPA Safer Choice certified");
  check("S2: a listed barcode found on Open Beauty Facts keeps its page and adds the card",
    both.includes("Check Coconut Milk Hand Soap") && both.includes("From Open Beauty Facts, crowd-sourced.") && both.includes("As listed by EPA: Coconut Milk Hand Soap, Kroger.") && both.includes(ENDORSE));
  check("S3: a listed hand soap (outside California's cleaning-product law) gets no California line", !both.includes("California"));
  await back(); await home();
  const unlisted = await scanTyped("0099990000017", "Check Dandruff Shampoo");
  await sleep(1500); // the list is loaded by now: a card would have shown
  check("S2: a barcode not on the list shows nothing about Safer Choice", unlisted.includes("Check Dandruff Shampoo") && !(await text()).includes("Safer Choice"));
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
  const formal = await typeIngredients("Water, Formaldehyde, Fragrance (Parfum), Coumarin, Homosalate, Octocrylene");
  check("N6: a typed personal-care list gets the personal-care result (formaldehyde: Known carcinogen; one fragrance row)",
    formal.includes("Known carcinogen · 1 finding") && formal.includes("Formaldehyde:") && formal.split("Fragrance:").length === 2
    && formal.includes("Coumarin:") && formal.includes("Not finding a match doesn't mean a product is safe for you."));
  check("063 F3: the typed check shows FDA's 'more data' line once for two 'more data' actives", formal.split(MEANING).length === 2);
  check("N6: no send button after a personal-care check", !(await text()).includes("Also send these photos"));
  await shot("care-typed");
  await click("Food");
  check("N6: switching to Food runs the food check on the same text", (await run(`document.querySelector('[role="status"]')?.innerText ?? ""`)).includes("Nothing flagged among"));
  await click("Close");
  // M17 S4 + 068 S3 (G3): not found → Cleaning product: EPA's label explained, the California line, the cleaner line, and
  // "Check the label yourself" (check-scan follows it); no Add or Open Food Facts.
  await home();
  const nfAgain = await scanTyped("0099990000031", "We couldn't find this barcode yet");
  check("S2: the not-found screen says nothing about Safer Choice until Cleaning product is picked", nfAgain.includes("What is it?") && !nfAgain.includes("Safer Choice"));
  await click("Cleaning product");
  const cleanNf = await text();
  check("S4, 068: Cleaning product shows what EPA's label means, the California line and the cleaner line",
    cleanNf.includes("Products with EPA's Safer Choice label have had every chemical ingredient reviewed by EPA against criteria for human health and the environment.")
    && cleanNf.includes(CALIFORNIA) && cleanNf.includes("EcoGo's cleaner checks are just starting: for now it looks for cancer findings (IARC). More official lists are coming.")
    && !cleanNf.includes("Check the maker's website"));
  check("S4, 068: 'Check the label yourself', and no Add or Open Food Facts buttons (nothing is sent)",
    !/Add this product|Open Food Facts website|Safer Choice certified/.test(cleanNf) && cleanNf.includes("Check the label yourself") && cleanNf.includes("Scan another product"));
  const kinds = await run(`[...document.querySelectorAll('[aria-labelledby="what-is-it"] button')].map(b => b.innerText.replace(/\\s+/g, " ") + ":" + b.getAttribute("aria-pressed")).join(",")`);
  const heights = await run(`[...document.querySelectorAll('[aria-labelledby="what-is-it"] button')].map(b => Math.round(b.getBoundingClientRect().height))`);
  check("S4: three 'What is it?' choices, Cleaning product pressed, each at least 44 px tall",
    kinds === "Food:false,Personal care:false,Cleaning product:true" && heights.every(h => h >= 44), `${kinds} ${heights}`);
  await shot("care-not-found-cleaning");
  check("S2: the app never calls EPA (the list is EcoGo's own file)", !requests.some(u => /epa\.gov/.test(u)), requests.find(u => /epa\.gov/.test(u)));

  check("every OBF request is a GET to the v2 product API with EcoGo's X-User-Agent",
    obfAsked.length >= 5 && obfAsked.every(r => /^GET https:\/\/world\.openbeautyfacts\.org\/api\/v2\/product\/\d+\?fields=\S+ EcoGo\/0\.1 \(/.test(r)), `${obfAsked.length} requests`);
  check("nothing signs in or sends (no auth, functions, Turnstile)", !requests.some(u => /\/auth\/v1\/|\/functions\/v1\/|challenges\.cloudflare\.com/.test(u)));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (err) {
  check("the check ran to the end", false, String(err?.stack ?? err).slice(0, 300));
} finally {
  await closeAndCheck(check);
  console.log(`\n${ok}/${total} passed`);
  process.exit(ok === total && total > 0 ? 0 : 1);
}

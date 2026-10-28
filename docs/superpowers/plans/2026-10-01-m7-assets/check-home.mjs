// M7 (headless Edge): Home has no fake content; first visit shows "How EcoGo checks"; Scan card opens Scan;
// Oreo (search) then Diet Coke (typed barcode) appear newest first; survives reload; Clear; explainers; Saved › Viewed.
// M7.1: Home lists 5 explainer cards (M7's two first); seed oils, pesticides and ultra-processed open with sources;
// the pesticides page's "What the badge levels mean" link opens it and Back returns.
// M7.2/M7.3: the welcome screen is honest and shows once per device; Profile shows only true things.
// M7.4: no Map in the nav; no prices, Share or AI claims; Saved has only Favorites (empty at first) and Scanned; a USDA
// search result, opened and bookmarked, is listed in Favorites.
// Data ownership: lookups, nutrition, search and alternatives come from our own `foods` table.
// M9: the Map tab is back (its own check: check-map.mjs).
// M12: Home shows six Learn tiles instead of the explainer rows and the "How EcoGo checks" box; tiles are clicked by their
// aria-label (= the page's full title); "How EcoGo checks a product" is a page with its three steps and no Sources.
// The Scan drawer's no-barcode check and adding a product: check-scan.mjs (split out 2026-10-23, 073). Send endings on
// an OFF product: check-sends.mjs (split out 2026-10-16).
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs <url>  (M7 plan Task 4; M7.1)
import { startEdge } from "./edge.mjs";
const URL_ = process.argv[2];
// 240 s: ~105 s after the 073 split (323 s with check-scan's part).
const { PORT, closeAndCheck } = startEdge("home", 9600, "900,1000", 240000);
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
  const recentNames = () => run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Recently viewed");
    return h ? [...h.parentElement.nextElementSibling.querySelectorAll("button")].map(b => b.innerText.split("\\n")[0]) : null; })()`);
  // M12: the Learn tiles' accessible names, in order (null when there's no Learn heading).
  const learnTiles = () => run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Learn");
    return h ? [...h.nextElementSibling.querySelectorAll("button")].map(b => b.getAttribute("aria-label")) : null; })()`);
  // A name is the page's full title and contains the tile's visible label (spec D3, WCAG 2.5.3), so the first adds it.
  const HEALTHY = "“Nothing flagged” isn’t “healthy”";
  const LEARN = [`Not a health score: ${HEALTHY}`, "What the badge levels mean", "Seed oils: what the evidence says",
    "Pesticides: what a label can’t tell you", "Ultra-processed foods: no official line yet", "How EcoGo checks a product",
    "Risks a label can’t show"]; // 064 H1: the 7th tile, full width

  await send("Runtime.enable");
  await send("Network.enable");
  // M16: a barcode nobody has is also asked of Open Beauty Facts; it answers "not found" here, never over the network.
  // The X-User-Agent header makes the browser send a CORS preflight first: that one gets a 200, the GET the 404.
  const obf404 = p => send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: p.request.method === "OPTIONS" ? 200 : 404,
    responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" }, { name: "Content-Type", value: "application/json" }],
    body: Buffer.from(p.request.method === "OPTIONS" ? "" : JSON.stringify({ status: 0, status_verbose: "product not found" })).toString("base64") });
  const OBF_PATTERN = { urlPattern: "*openbeautyfacts.org/*" };
  onPaused = obf404;
  await send("Fetch.enable", { patterns: [OBF_PATTERN] });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  const w = await run(`(async () => { await __until(() => __btn("Look around first")); return document.body.innerText; })()`);
  check("welcome is honest: what EcoGo does, no fake promises", w.includes("Scan. Learn. Decide.") && w.includes("Start scanning")
    && !/Sign In|Save Money|better prices|Best Price|Amazon|Walmart|Get Started/i.test(w), String(w).replace(/\n/g, " / ").slice(0, 300));
  await run(`__guest()`); await sleep(800);

  const t = await run(`document.body.innerText`);
  check("Home has no invented content", !/Alex|Chicago|Rating|Why Recommended|Deals|Nearby Resources/i.test(t));
  check("053 W4: no 'Live data' label", !t.includes("Live data"));
  const h = new Date().getHours(), g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  check("greeting matches the time", t.includes(g) && t.includes("What are you checking?"), g);
  check("first visit shows Learn and no Recently viewed", JSON.stringify(await learnTiles()) === JSON.stringify(LEARN) && !t.includes("Recently viewed"));

  // M7.4 (spec 2026-10-02-m74-trust-cleanup-design.md §4): nothing invented, nothing promised.
  const nav = await run(`[...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Home", "Map", "Scan", "Saved", "Profile"].includes(s))`);
  check("bottom nav is Home, Map, Scan, Saved, Profile (M9)", JSON.stringify(nav) === '["Home","Map","Scan","Saved","Profile"]', JSON.stringify(nav));
  check("Home shows no prices", !t.includes("$"));
  await run(`(async () => { __btn("Saved").click(); await __sleep(500); })()`);
  const sv = await run(`({ tabs: [...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(s => ["Favorites", "Viewed", "Lists"].includes(s)), text: document.body.innerText })`);
  check("Saved: only Favorites and Viewed; Favorites empty on a fresh profile", JSON.stringify(sv.tabs) === '["Favorites","Viewed"]'
    && sv.text.includes("No saved items") && !/Weekly Groceries|Shopping Lists/.test(sv.text), JSON.stringify(sv.tabs));
  await home();

  await run(`__btn("Scan a product").click(); true`); await sleep(600);
  check("Scan card opens the Scan tab", !!(await run(`(async () => !!(await __until(() => __btn("Close camera") || document.querySelector('input[aria-label="Barcode number"]'), 5000)))()`)));
  await home();

  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("oreo"); await sleep(800);
  const sr = await run(`(async () => { await __until(() => __btn("Oreo Original")); return document.body.innerText; })()`);
  check("search results: no prices, sorted by fewest concerns", !sr.includes("$") && sr.includes("Sorted by fewest concerns") && !sr.includes("Sort:"));
  // 056 R2-03: each result row has a grey line telling look-alike rows apart. No record carries a package size, so it's
  // the barcode (catalog and USDA rows alike).
  const rows = await run(`(async () => { await __until(() => [...document.querySelectorAll("p")].find(e => e.innerText === "More from USDA FoodData Central")
    ?.parentElement.querySelector("button"), 20000);
    return [...document.querySelectorAll("button.bg-card")].map(b => b.innerText.split("\\n").find(l => l.startsWith("Barcode ")) ?? "none"); })()`);
  check("056 R2-03: every search row, catalog and USDA, shows its barcode line", rows.length > 1 && rows.every(l => /^Barcode \d{8,14}$/.test(l)),
    rows.slice(0, 4).join(" | "));
  await run(`(async () => { (await __until(() => __btn("Oreo Original"))).click(); await __sleep(600); })()`);
  const op = await run(`({ text: document.body.innerText, share: !!__btn("Share") })`);
  check("Oreo page: no prices, Price Comparison, Share or AI", !op.text.includes("$") && !op.text.includes("Price Comparison") && !op.share
    && !/\bAI\b/.test(op.text) && op.text.includes("Findings are matched against official sources"));
  check("Oreo page points to its Nutrition section", op.text.includes("see the Nutrition section") && op.text.includes("Added sugar"));
  await back();
  check("ACCESS-01: the search screen's Back button is named 'Back'", !!(await run(`[...document.querySelectorAll('button[aria-label="Back"]')].some(b => b.checkVisibility({ visibilityProperty: true }))`)));
  const backSearch = await run(`({ text: document.body.innerText, query: [...document.querySelectorAll("span")].some(s => s.innerText === "oreo"), oreo: !!__btn("Oreo Original") })`);
  check("054 K-19: Back from a product opened from search returns to the same query and results",
    backSearch.query && backSearch.oreo && backSearch.text.includes("Sorted by fewest concerns") && !backSearch.text.includes("What are you checking?"));
  await back(); // search → home
  // 063 F8 + F9: a personal-care search has no USDA food section; a search with no hits suggests personal-care words and the scan.
  const search = async q => { await run(`(() => { const i = document.querySelector('input[placeholder^="Search products"]'); i.focus(); i.select(); return true; })()`); await type(q); };
  await search("shampoo");
  const care = await run(`(async () => { await __until(() => __btn("Head & Shoulders")); await __sleep(4000); return document.body.innerText; })()`);
  check("063 F8: a search that finds only personal care shows no 'More from USDA FoodData Central'",
    care.includes("Pantene") && !care.includes("USDA"), care.replace(/\s+/g, " ").slice(0, 160));
  await back();
  await search("zzqxv");
  const empty = await run(`(async () => (await __until(() => document.body.innerText.includes("No results for") && document.body.innerText, 20000)) || document.body.innerText)()`);
  check("063 F9: no results suggests \"shampoo\" and \"sunscreen\" and says 'Or scan its barcode.'",
    empty.includes('Try a product name, brand, or category like "snacks", "shampoo", or "sunscreen".') && empty.includes("Or scan its barcode."), empty.replace(/\s+/g, " ").slice(0, 200));
  await back();
  // 075 M2 (audit B3): a search that failed (its request dropped here) says so; it isn't "No results".
  onPaused = p => p.request.url.includes("/rpc/search_foods") ? send("Fetch.failRequest", { requestId: p.requestId, errorReason: "Failed" }) : obf404(p);
  await send("Fetch.enable", { patterns: [OBF_PATTERN, { urlPattern: "*/rpc/search_foods*" }] });
  await search("zzqxw");
  const failed = await run(`(async () => (await __until(() => /Couldn't search right now|No results for/.test(document.body.innerText) && document.body.innerText, 20000)) || document.body.innerText)()`);
  check("075 M2: a failed search says 'Couldn't search right now.', not 'No results'",
    failed.includes("Couldn't search right now.") && !failed.includes("No results for"), failed.replace(/\s+/g, " ").slice(0, 200));
  onPaused = obf404; await send("Fetch.enable", { patterns: [OBF_PATTERN] });
  await back();
  await run(`(async () => { __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "049000042566");
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click(); })()`);
  await run(`__until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes("Coca-Cola Zero"), 15000)`); await sleep(500);
  await back(); await home();
  let names = await recentNames();
  check("Recently viewed: Coke Zero then Oreo, newest first", names?.[0]?.includes("Coca-Cola Zero") && names?.[1]?.includes("Oreo"), JSON.stringify(names));
  const badge = await run(`[...document.querySelectorAll("h2")].find(e => e.innerText === "Recently viewed").parentElement.nextElementSibling.innerText`);
  check("…with badges", /Nothing flagged|concern|carcinogen/.test(badge), badge.replace(/\n/g, " / "));

  await send("Page.reload"); await sleep(4000); await helpers();
  check("welcome doesn't show again on this device", (await run(`__guest()`)) === false); await sleep(800);
  names = await recentNames();
  check("a reload keeps them", names?.length === 2, JSON.stringify(names));

  await run(`(async () => { __btn("See all").click(); await __sleep(500); })()`);
  const saved = await run(`document.body.innerText`);
  check("See all → Saved › Viewed shows the same list", saved.includes("Coca-Cola Zero") && saved.includes("Oreo") && !saved.includes("No viewed products"));
  await run(`(async () => { __btn("Oreo Original").click(); await __sleep(600); return true; })()`);
  await back();
  const scannedTab = await run(`[...document.querySelectorAll("button")].find(b => b.innerText === "Viewed")?.className.includes("bg-white")`);
  check("054 K-19: Back from a product opened in Saved › Viewed stays on Viewed", scannedTab === true && (await run(`document.body.innerText`)).includes("Coca-Cola Zero"));
  await home();

  for (const [name, title] of [[LEARN[0], HEALTHY], [LEARN[1], LEARN[1]]]) {
    await run(`(async () => { __btn(${JSON.stringify(name)}).click(); await __sleep(500); })()`); // a click, not focus (as a Safari tap)
    const e = await run(`document.body.innerText`);
    // 054 ACCESS-01: focus moves to the article's heading; the Home screen behind it can't be reached by Tab.
    const focus = await run(`({ tag: document.activeElement?.tagName, text: document.activeElement?.innerText,
      covered: !!document.querySelector(${JSON.stringify(`button[aria-label="${name}"]`)})?.closest("[inert]") })`);
    check(`ACCESS-01: opening "${title}" focuses its heading; Home behind it is inert`, focus.tag === "H1" && focus.text === title && focus.covered, JSON.stringify(focus));
    check(`explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    if (title === HEALTHY) check("075 C2 (Minh's words): the example names no product and no unsourced figure",
      e.includes("Example: a cookie can show “Nothing flagged” and still be high in added sugar. Check its Nutrition section.") && !e.includes("28% of the Daily Value")); // "Oreo" stays in Recently viewed behind it
    if (title === LEARN[1]) { // 053 W1, W2 (spec 2026-10-14-trust-wording-design.md)
      const b = e.replace(/’/g, "'");
      check("053 W1: the badge page says each level is the strongest official finding, not all about cancer", b.includes("Each level shows the strongest "
        + "official finding EcoGo matched, and the table says what kind it is. IARC's groups rate how strong the evidence is that something can cause "
        + "cancer. EU warning labels and EU or US bans are regulators' decisions, and not all of them are about cancer: the EU label on Red 40, for "
        + "example, warns about activity and attention in children. None of them measures how much harm one serving does. Processed meat and "
        + "tobacco are both IARC Group 1, but IARC says that doesn't make them equally dangerous.") && !b.includes("the levels describe how strong"));
      check("053 W2: the 'none' row says nothing matched EcoGo's list", b.includes("Nothing matched EcoGo's list of official findings (this doesn't mean none exist)")
        && !b.includes("No official finding for its additives"));
    }
    await back();
    const returned = await run(`document.activeElement?.getAttribute("aria-label")`);
    check(`ACCESS-01: Back returns focus to the "${title}" tile`, returned === name, returned);
  }

  // M12 (spec 2026-10-06-m12-home-tiles-design.md §2): the two badge explainers first, How EcoGo checks, then 064's page.
  const tiles = await learnTiles();
  check("Home lists 7 Learn tiles, in order", JSON.stringify(tiles) === JSON.stringify(LEARN), JSON.stringify(tiles));
  for (const title of [LEARN[2], LEARN[3], LEARN[4]]) {
    await run(`(async () => { __btn(${JSON.stringify(title)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`M7.1 explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    if (title.startsWith("Seed oils")) {
      // COPY-01 (decision 061 C1): the fat mix from USDA FoodData Central, with one USDA card; check-only entries add no card.
      const cards = await run(`[...document.querySelectorAll("li")].filter(l => l.innerText.includes("Read the source")).map(l => l.innerText.split(":")[0])`);
      check("C1: seed oils' first line is the USDA fat mix, with one USDA FoodData Central card (7 cards in all)",
        e.includes("Seed oils are mostly unsaturated fat, but the mix varies. In USDA's data, soybean and corn oil are more than half polyunsaturated fat (including omega‑6); canola oil is mostly monounsaturated; sunflower oil can be either, depending on the type.")
        && !e.includes("are mostly polyunsaturated fat, including omega") && cards.filter(c => c === "USDA").length === 1 && cards.length === 7, JSON.stringify(cards));
    }
    if (title.startsWith("Ultra-processed")) {
      // Decision 061 (Minh): no unquotable "it hasn't been published" in the text or on the HHS card.
      check("061: ultra-processed says HHS sent the proposed definition for final review, with no 'not published' claim",
        e.includes("The FDA and USDA asked for input in July 2025. In August 2026 HHS sent the first proposed definition for final review.")
        && !/hasn’t been published|not yet published/.test(e), e.replace(/\n/g, " / ").slice(0, 300));
    }
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

  // 064 (spec 2026-10-20-hidden-risks-design.md §2). H1: the 7th tile spans the row and opens the article with its cards.
  const wide = await run(`(() => { const b = __btn(${JSON.stringify(LEARN[6])}); return b && Math.abs(b.getBoundingClientRect().width - b.parentElement.getBoundingClientRect().width) < 2; })()`);
  check("064 G4: the 7th Learn tile is full width", wide === true);
  await run(`(async () => { __btn(${JSON.stringify(LEARN[6])}).click(); await __sleep(500); })()`);
  const hr = await run(`document.body.innerText`);
  const hrCards = await run(`[...document.querySelectorAll("li")].filter(l => l.innerText.includes("Read the source")).length`);
  check("064 H1: 'Risks a label can't show' covers its four risks, with Sources cards, and ends on what EcoGo can't do",
    ["Glycidyl esters", "Benzene in drinks", "2005 to May 2007", "Aflatoxins", "Celery-powder curing", "EcoGo can’t measure these from a label."].every(s => hr.includes(s))
    && hr.includes("Source checked") && hrCards >= 8, `${hrCards} cards`);
  await back();

  // M7.2: Profile shows only true things
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  const p = await run(`document.body.innerText`);
  check("Profile has no invented content", !/Alex|Level 4|Money Saved|CO₂|Ethical Purchases|Achievements|Notifications|Dark Mode/i.test(p));
  // M11: Your data is a closed accordion row; its summary carries the count.
  check("Profile: your data, sources and privacy", p.includes("2 recent products, on this device") && p.includes("Where results come from") && p.includes("Privacy"));
  check("053 W3: the Profile subtitle says what stays in this browser", p.includes("No account. Your saved products, lists and history stay in this browser. Privacy, below, lists what's sent.")
    && !p.includes("What you do stays on this device"));
  const privacy = await run(`(async () => { const b = [...document.querySelectorAll("button[aria-expanded]")].find(b => b.innerText.startsWith("Privacy"));
    b.click(); await __sleep(400); const t = document.body.innerText; b.click(); await __sleep(300); return t; })()`);
  check("053 W5: Privacy says OpenStreetMap's servers see the map area", privacy.includes("The map asks for your location only when you tap My location. "
    + "Your location stays on your phone. Map images load from OpenStreetMap's servers, which see the map area you're viewing, as with any web map."));
  check("066 R8: Privacy names Open Beauty Facts for barcodes and Photon for place addresses (as Minh approved)",
    privacy.includes("To find a product, its barcode or search words are sent to EcoGo's database (hosted on Supabase) and, if it isn't there, its barcode goes to Open Food Facts and then Open Beauty Facts.")
    && privacy.includes("When you suggest a place, the address you type is sent to Photon (photon.komoot.io), an address search built on OpenStreetMap, to suggest matches. "
      + "What you suggest or report is sent to EcoGo and read by its owner; it isn't shown in the app."));
  check("070 C4: Privacy says cloud help is off unless turned on, and what it sends (as Minh approved)",
    privacy.includes("Ingredient photos are read on your phone too; checking a list without a barcode sends nothing unless you turn on cloud help.")
    && privacy.includes("Cloud help is off unless you turn it on. When it's on, a hard-to-read label photo is sent through EcoGo's server to OCR.space, "
      + "which says it deletes uploaded documents after processing. Nothing else about you is sent."));
  check("075 M4 (Minh's words): Privacy says Open Food Facts gets the same anonymous ID",
    privacy.includes("EcoGo keeps an anonymous ID and a log of your submissions (barcode, time, result). Open Food Facts gets that same anonymous ID with each product you add."));
  // 066 R8 (fonts, Minh's yes): Plus Jakarta Sans comes from EcoGo's own site; opening the app sends nothing to Google.
  const font = await run(`document.fonts.ready.then(() => [...document.fonts].filter(f => f.family.includes("Plus Jakarta Sans") && f.status === "loaded").length)`);
  check("066 R8: the font loads from EcoGo's own site; nothing goes to Google Fonts", font > 0
    && !requests.some(u => /fonts\.(googleapis|gstatic)\.com/.test(u)) && requests.some(u => u.startsWith(new URL(URL_).origin) && u.endsWith(".woff2")),
    `${font} loaded; ${requests.filter(u => /woff2|fonts\./.test(u)).join(" ")}`);
  const gh = await run(`(() => { const a = [...document.querySelectorAll("a")].find(a => a.innerText.includes("Source code")); return a ? a.href + " " + a.target : null; })()`);
  check("Profile: source-code link opens GitHub in a new tab", gh === "https://github.com/skynetrebel42/ecogo _blank", gh);
  await home();

  await run(`(async () => { __btn("Clear recently viewed").click(); await __sleep(400); })()`);
  const after = await run(`document.body.innerText`);
  check("Clear empties the list", JSON.stringify(await learnTiles()) === JSON.stringify(LEARN) && !after.includes("Recently viewed"));
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  check("…and Profile says Nothing viewed yet", (await run(`document.body.innerText`)).includes("Nothing viewed yet"));

  // 064 H3 (after the recent-list checks): the catalog's Oscar Mayer Uncured Franks (celery juice on the label) keeps one
  // Known processed-meat finding, now with the celery context and a link to H1.
  await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("oscar mayer");
  await run(`(async () => { (await __until(() => __btn("Oscar Mayer Classic Uncured")))?.click(); await __sleep(800); })()`);
  const om = await run(`(async () => { const g = [...document.querySelectorAll("div")].find(d => d.innerText === "The food itself")?.parentElement;
    const rows = g ? [...g.querySelectorAll("button[aria-expanded]")] : []; rows[0]?.click(); await __sleep(300);
    return { rows: rows.length, text: document.body.innerText }; })()`);
  check("064 H3: Oscar Mayer Uncured Franks: one Known processed-meat finding, with the celery context and a Learn link",
    om.rows === 1 && om.text.includes("Known carcinogen · 1 finding") && om.text.includes("USDA calls celery powder a natural source of nitrite")
    && om.text.includes("Read: Risks a label can’t show"), `${om.rows} rows`);
  await back(); await back(); // product → search → home

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
  // 064 H2: Crush Lime (USDA "Soda": sodium benzoate and ascorbic acid; Yellow 5 sets "Some concern"). The grey row sits
  // under "Good to know", the badge stays the additive's, and its Learn link opens H1 over the page and returns focus.
  const crush = await scanTyped("041710394027", "Crush");
  const row = await run(`(async () => { const g = [...document.querySelectorAll("div")].find(d => d.innerText === "Good to know")?.parentElement;
    const b = g && [...g.querySelectorAll("button[aria-expanded]")].find(b => b.innerText.includes("Benzene can form")); if (!b) return null;
    const collapsed = b.innerText; b.click(); await __sleep(300); const link = __btn("Read: Risks a label can’t show"); link?.click(); await __sleep(500);
    const h1 = document.activeElement?.tagName === "H1" ? document.activeElement.innerText : null;
    const covered = !!b.closest("[inert]"); [...document.querySelectorAll('button[aria-label="Back"]')].pop()?.click(); await __sleep(500); // the article's Back
    return { collapsed, h1, covered, back: document.activeElement?.innerText }; })()`);
  check("064 H2: a drink with sodium benzoate and ascorbic acid shows the grey benzene row; the badge stays the additive's",
    crush.includes("Some concern") && !!row && row.collapsed.includes("Info")
    && row.collapsed.includes("In some drinks, these two can form benzene at very low levels; heat and light can speed this up.* Not measured in this product.")
    && row.collapsed.includes("\n*FDA\n")
    && row.collapsed.includes("Listed as “SODIUM BENZOATE” and “ASCORBIC ACID”"), JSON.stringify(row)?.slice(0, 200));
  check("064 G5: the row's Learn link opens H1 over the product (page inert), Back returns focus to the link",
    row?.h1 === "Risks a label can’t show" && row.covered && row.back === "Read: Risks a label can’t show", JSON.stringify(row)?.slice(0, 200));
  await back(); await home();
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("granola");
  const more = await run(`(async () => { const first = () => [...document.querySelectorAll("p")].find(e => e.innerText === "More from USDA FoodData Central")?.parentElement.querySelector("button");
    return !!(await __until(first, 20000)); })()`);
  check("a text search lists more products from our USDA copy", more);
  check("USDA's own API is never called",!requests.some(u => u.includes("api.nal.usda.gov")), requests.filter(u => u.includes("usda")).slice(0, 3).join(" "));
  check("no console errors", errors.length === 0, errors.join(" | "));
} catch (err) {
  check("the script ran to the end", false, String(err?.stack ?? err).slice(0, 300)); // a crash must not read as a pass
} finally {
  await closeAndCheck(check);
  console.log(`${ok}/${total} checks passed`);
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until its timeout
}

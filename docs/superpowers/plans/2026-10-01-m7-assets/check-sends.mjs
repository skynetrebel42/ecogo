// The send checks split out of check-home.mjs (planner, 2026-10-16: check-home's run neared its 420 s budget). Headless
// Edge, a crowd-sourced OFF product (OFF's answer faked, CDP Fetch): M8 follow-up 5 (051: "Add the ingredients", "Send
// new photos", J2b), decision 058 ("Check the label yourself", L1–L4) and 055's send endings (E1–E3). Turnstile's script,
// the sign-in and off-submit are all answered here: nothing reaches Cloudflare, Supabase or OFF.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-sends.mjs <url>  (a build with VITE_TURNSTILE_SITE_KEY set,
// e.g. Cloudflare's public test key 1x00000000000000000000AA)
import { startEdge } from "./edge.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const URL_ = process.argv[2];
// ~120 s here; 300 s leaves room for a slow run.
const { PORT, closeAndCheck } = startEdge("sends", 9600, "900,1000", 300000);
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
  // Turnstile's script is replaced by a stub that hands over a token at once (the real one fails in headless Edge).
  const TURNSTILE_STUB = 'window.turnstile = { render: (el, o) => { setTimeout(() => o.callback("stub-token"), 50); return "stub"; }, remove: () => {} };';

  await send("Runtime.enable");
  await send("Network.enable");
  // The bar checks need motion on, whatever this PC's animation setting is (reduced motion is tested on its own below).
  const MOTION = { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] };
  await send("Emulation.setEmulatedMedia", MOTION);
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  await run(`__guest()`); await sleep(800);
  const scanTyped = (code, text) => run(`(async () => {
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click();
    await __until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes(${JSON.stringify(text)}), 15000);
    await __sleep(800); return document.body.innerText; })()`);
  const tos = await scanTyped("028400064057", "Tostitos"); await back(); await home();
  const dor = await scanTyped("028400335799", "Doritos"); await back(); await home();
  const LABEL_PNG = fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url)); // 1000 × 400
  const CORS = [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" },
    { name: "Access-Control-Allow-Methods", value: "POST, OPTIONS" }, { name: "Content-Type", value: "application/json" }];
  // M8 follow-up 5 (spec 2026-10-09-m8-followup5-fix-off-products-design.md §2): a crowd-sourced OFF product with no
  // ingredients (OFF's answer is faked here, CDP Fetch) offers "Add the ingredients" and "Send new photos". OFF's
  // product read, auth and off-submit (its failed answers, J2b) are all answered here: nothing reaches OFF or is sent.
  const FAKE_OFF = "4006381333931";
  const offAsked = [];
  let offReply = { status: 400, reason: "invalid" };
  const heldIds = []; // 055 E1b: off-submit requests held unanswered
  onPaused = p => {
    const url = p.request.url.split("?")[0], post = p.request.method === "POST";
    if (url.includes("challenges.cloudflare.com")) return send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/javascript" }], body: Buffer.from(TURNSTILE_STUB).toString("base64") });
    offAsked.push(`${p.request.method} ${url}`);
    if (offReply === "drop" && post && url.includes("/functions/v1/off-submit")) return send("Fetch.failRequest", { requestId: p.requestId, errorReason: "ConnectionReset" });
    if (offReply === "hold" && post && url.includes("/functions/v1/off-submit")) return void heldIds.push(p.requestId);
    const [status, body] = p.request.method === "OPTIONS" ? [200, ""]
      : url.includes("/functions/v1/off-submit") ? [offReply.status, JSON.stringify(offReply.status === 200 ? { ok: true } : { ok: false, reason: offReply.reason })]
      // M15 C5: the reads after an ok send; this barcode's one sent row and no approved map fix (Content-Range below)
      : url.includes("/rest/v1/contributions") ? [200, JSON.stringify([{ barcode: FAKE_OFF }])]
      : url.includes("/rest/v1/place_reports") ? [200, ""]
      : url.includes("/auth/v1/") && post ? [200, JSON.stringify({ access_token: "fake", token_type: "bearer", expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "fake",
        user: { id: "00000000-0000-4000-8000-000000000048", aud: "authenticated", role: "authenticated", is_anonymous: true } })]
      : [200, JSON.stringify({ status: "success", code: FAKE_OFF, product: { code: FAKE_OFF, product_name: "Test granola bar", brands: "Test", lang: "en" } })];
    send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: status, body: Buffer.from(body).toString("base64"),
      responseHeaders: [...CORS, { name: "Access-Control-Expose-Headers", value: "Content-Range" }, { name: "Content-Range", value: "*/0" }] });
  };
  await send("Fetch.enable", { patterns: [{ urlPattern: "*world.openfoodfacts.org/api/*" }, { urlPattern: "*/auth/v1/*" }, { urlPattern: "*/functions/v1/*" },
    { urlPattern: "*/rest/v1/contributions*" }, { urlPattern: "*/rest/v1/place_reports*" }, { urlPattern: "*challenges.cloudflare.com/*" }] });
  const offPage = await scanTyped(FAKE_OFF, "Test granola bar");
  check("Follow-up 5: an OFF product with no ingredients shows 'Add the ingredients' and 'Send new photos'",
    offPage.includes("No ingredient list available.") && offPage.includes("Add the ingredients") && offPage.includes("Send new photos"));
  check("…a USDA product shows neither", ![tos, dor].some(t => t.includes("Add the ingredients") || t.includes("Send new photos")));
  const j1 = await run(`(async () => { __btn("Add the ingredients").click(); await __sleep(400); return document.body.innerText; })()`);
  const j1Back = await run(`(async () => { __btn("Close").click(); await __sleep(500); return document.body.innerText; })()`);
  check("J1: 'Add the ingredients' opens the add flow for that barcode; Close returns to the product",
    j1.includes("Add the ingredients") && j1.includes(`Barcode ${FAKE_OFF}`) && j1.includes("Front photo") && j1Back.includes("Test granola bar"));
  // Decision 058 (spec 2026-10-15-check-label-yourself-design.md): "Check the label yourself" on crowd-sourced OFF
  // products (L1), the optional photos send (L2), the product page unchanged by a self-check (L3), account-free first (L4).
  const pickLabel = async () => {
    const { root } = (await send("DOM.getDocument")).result;
    const input = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
    await send("DOM.setFileInputFiles", { nodeId: input, files: [LABEL_PNG] });
  };
  const EDIT_THERE = "Have an Open Food Facts account? Edit there.";
  const l1 = await run(`(() => { const bg = s => { const b = __btn(s); return b ? getComputedStyle(b).backgroundColor : "none"; };
    return { text: document.body.innerText, check: !!__btn("Check the label yourself"), sendBg: bg("Send new photos"), addBg: bg("Add the ingredients"),
      links: [...document.querySelectorAll("a")].filter(a => a.innerText.trim().startsWith("${EDIT_THERE}")).map(a => a.href + " " + a.target) }; })()`);
  check("058 L1: an OFF product shows 'Doesn't match your package?' with 'Check the label yourself'; a USDA product doesn't",
    l1.text.includes("Doesn't match your package?") && l1.check && ![tos, dor].some(t => t.includes("Check the label yourself") || t.includes("Doesn't match your package?")));
  check("058 L4: 'Send new photos' and 'Add the ingredients' are the main (green) buttons; no 'Update info'; a small 'Edit there' link to OFF's edit form",
    l1.sendBg === "rgb(26, 92, 57)" && l1.addBg === "rgb(26, 92, 57)" && !l1.text.includes("Update info") && l1.links.length >= 1
    && l1.links.every(l => l === `https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${FAKE_OFF} _blank`)
    && ![tos, dor].some(t => t.includes(EDIT_THERE)), JSON.stringify({ ...l1, text: undefined }));
  const pageBefore = await run(`document.body.innerText`);
  const askedBefore = offAsked.length; // the self-check sends nothing (L1): no auth, no off-submit
  const typed = await run(`(async () => { __btn("Check the label yourself").click(); await __sleep(400);
    const head = document.body.innerText; const focus = document.activeElement?.tagName;
    __btn("Type it").click(); await __sleep(200);
    const box = document.getElementById("ingredients"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "Water, sugar, Red 40");
    box.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(400);
    return { head, focus, text: document.body.innerText, l2: !!__btn("Also send these photos to Open Food Facts") }; })()`);
  check("058 L1: it opens the check named for the product ('Check the label yourself', Test granola bar), title focused",
    typed.head.includes("Check the label yourself") && typed.head.includes("Test granola bar") && typed.focus === "H1", typed.head.slice(0, 120));
  check("…a typed check says it's from what you typed, not from Open Food Facts, and offers no send (L2 is for photos)",
    typed.text.includes("From what you typed, not from Open Food Facts.") && !typed.l2);
  await run(`(async () => { __btn("Take a photo").click(); await __sleep(300); return true; })()`);
  await pickLabel();
  const photoed = await run(`(async () => { await __until(() => { const u = __btn("Use it anyway"); if (u) u.click();
      return document.body.innerText.includes("From your photo, not from Open Food Facts."); }, 60000);
    return { text: document.body.innerText, l2: !!__btn("Also send these photos to Open Food Facts") }; })()`);
  check("058 L2: a photo check says it's from your photo, not from Open Food Facts, and offers 'Also send these photos to Open Food Facts'",
    photoed.text.includes("From your photo, not from Open Food Facts.") && photoed.l2, photoed.text.slice(0, 200));
  const pageAfter = await run(`(async () => { __btn("Close").click(); await __sleep(500); return { text: document.body.innerText, focus: document.activeElement?.innerText }; })()`);
  check("058 L3: Close returns to the product exactly as it was, focus on 'Check the label yourself'",
    pageAfter.text === pageBefore && pageAfter.focus === "Check the label yourself", pageAfter.focus);
  await run(`(async () => { __btn("Check the label yourself").click(); await __sleep(400); return true; })()`);
  await pickLabel();
  const l2 = await run(`(async () => { const go = await __until(() => { const u = __btn("Use it anyway"); if (u) u.click();
      return __btn("Also send these photos to Open Food Facts"); }, 60000);
    go.click(); await __sleep(500); const front = document.body.innerText;
    __btn("Skip").click(); await __sleep(400); const keep = !!__btn("Keep the photo I took");
    __btn("Keep the photo I took")?.click(); await __sleep(400); __btn("Skip")?.click(); await __sleep(400);
    const img = document.querySelector('img[alt="Ingredients photo"]'); const thumb = img ? (await (await fetch(img.src)).blob()).type : "none";
    document.querySelector('input[type="checkbox"]').click(); await __sleep(200); const sendOn = __btn("Send")?.disabled === false;
    __btn("Close").click(); await __sleep(500); return { front, keep, thumb, sendOn, back: document.body.innerText }; })()`);
  check("058 L2: 'Also send these photos' opens Send new photos for that barcode with the ingredients photo in place; Close returns to the product",
    l2.front.includes("Send new photos") && l2.front.includes(`Barcode ${FAKE_OFF}`) && l2.front.includes("Front photo") && l2.keep && l2.thumb === "image/jpeg" && l2.sendOn
    && l2.back.includes("Test granola bar"), JSON.stringify({ ...l2, front: l2.front.slice(0, 120), back: l2.back.slice(0, 60) }));
  check("058: the self-checks and the L2 hand-over sent nothing (no auth, no off-submit)", offAsked.length === askedBefore, offAsked.slice(askedBefore).join(", "));
  const j2 = await run(`(async () => { __btn("Send new photos").click(); await __sleep(400); return document.body.innerText; })()`);
  const pickPhoto = async () => {
    const { root } = (await send("DOM.getDocument")).result;
    const input = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
    await send("DOM.setFileInputFiles", { nodeId: input, files: [LABEL_PNG] });
  };
  await pickPhoto();
  const j2Step = await run(`(async () => { await __until(() => document.body.innerText.includes("Ingredients photo"), 15000);
    return [__btn("No ingredients list? Type it") ? "type-it" : "ingredients photo", __btn("Back") ? "with Back" : "no Back",
      document.querySelector('ol[aria-label="Photos"] li [aria-label="done"]') ? "front done" : "front not done"].join(", "); })()`);
  await pickPhoto(); // the ingredients photo: not read, straight to the nutrition photo
  const j2Flow = await run(`(async () => { const s = [];
    s.push(await __until(() => document.body.innerText.includes("Nutrition photo"), 15000) ? "nutrition photo" : "not nutrition");
    __btn("Skip").click(); await __sleep(400);
    const off = __btn("Send")?.disabled; document.querySelector('input[type="checkbox"]').click(); await __sleep(200);
    return { s: s.join(" → "), off, on: __btn("Send")?.disabled === false, name: !!document.querySelector("#product-name"),
      crops: [...document.querySelectorAll("button")].filter(b => b.innerText === "Crop").map(b => b.getAttribute("aria-label")).join(", "),
      text: document.body.innerText }; })()`);
  check("J2: 'Send new photos' opens a photos-only flow with its intro line, for that barcode", j2.includes("Send new photos") && j2.includes(`Barcode ${FAKE_OFF}`)
    && j2.includes("Photos of the current label help Open Food Facts fix wrong or missing details. EcoGo never changes the text itself."));
  check("…no text step: front → ingredients photo (with Back) → nutrition photo → Send, no name field; Send needs the tick",
    j2Step === "ingredients photo, with Back, front done" && j2Flow.s === "nutrition photo" && !j2Flow.name && j2Flow.text.includes("Plus the barcode.")
    && j2Flow.off === true && j2Flow.on, `${j2Step} | ${JSON.stringify({ ...j2Flow, text: undefined })}`);
  check("…on Send both photos taken can be cropped, the ingredients one too", j2Flow.crops === "Crop the front photo, Crop the ingredients photo", j2Flow.crops);
  // J2b (decision 051 C): a failed photos-only send speaks of photos, and Try again goes back to the front photo instead
  // of sending the same photos again.
  const invalid = await run(`(async () => { __btn("Send").click(); await __until(() => document.body.innerText.includes("Not sent"), 15000);
    const t = document.body.innerText; __btn("Try again").click(); await __sleep(400); return [t, document.body.innerText]; })()`);
  check("J2b: a photos-only send OFF can't take gets its own line; Try again goes back to the front photo",
    invalid[0].includes("Open Food Facts couldn't take these photos. Try other photos.") && invalid[0].includes("Your photos are still here.")
    && !invalid[0].includes("Check the ingredients") && invalid[1].includes("Front photo") && invalid[1].includes("Photos of the current label help"),
    invalid.map(t => t.replace(/\n/g, " / ").slice(0, 160)).join(" → "));
  offReply = { status: 409, reason: "nothing-new" };
  const nothing = await run(`(async () => { __btn("Keep the photo I took").click(); await __sleep(300); __btn("Keep the photo I took").click(); await __sleep(300);
    __btn("Skip").click(); await __sleep(400); __btn("Send").click(); await __until(() => document.body.innerText.includes("Not sent"), 15000);
    return document.body.innerText; })()`);
  check("…and one with nothing new speaks of the photos only", nothing.includes("Open Food Facts already has these photos, so there was nothing new to send.")
    && !nothing.includes("these ingredients"), nothing.replace(/\n/g, " / ").slice(0, 160));
  // 055 E3: a photo OFF refused has its own line, and Try again goes back to the front photo.
  offReply = { status: 409, reason: "photo-rejected" };
  const rejected = await run(`(async () => { __btn("Try again").click(); await __sleep(400); __btn("Keep the photo I took").click(); await __sleep(300);
    __btn("Keep the photo I took").click(); await __sleep(300); __btn("Skip").click(); await __sleep(400); __btn("Send").click();
    await __until(() => document.body.innerText.includes("Not sent"), 15000); const t = document.body.innerText;
    __btn("Try again").click(); await __sleep(400); return [t, document.body.innerText]; })()`);
  check("055 E3: a photo-rejected answer says 'couldn't use this photo'; Try again lands on the front photo",
    rejected[0].includes("Open Food Facts couldn't use this photo. Try another one.") && !rejected[0].includes("already has")
    && rejected[1].includes("Front photo") && !rejected[1].includes("Not sent"), rejected.map(t => t.replace(/\n/g, " / ").slice(0, 160)).join(" → "));
  // 055 E2: a dropped reply (the connection reset) isn't "Not sent": EcoGo can't know, so no Try again.
  offReply = "drop";
  const lost = await run(`(async () => { __btn("Keep the photo I took").click(); await __sleep(300);
    __btn("Keep the photo I took").click(); await __sleep(300); __btn("Skip").click(); await __sleep(400); __btn("Send").click();
    await __until(() => document.body.innerText.includes("Not sure it arrived"), 15000);
    const a = [...document.querySelectorAll("a")].find(a => a.innerText === "Open on Open Food Facts");
    return { text: document.body.innerText, link: a ? a.href + " " + a.target : null, retry: !!__btn("Try again"), close: __btn("Close")?.disabled === false }; })()`);
  check("055 E2: a dropped reply shows 'Not sure it arrived', its text and the OFF link; no Try again, Close works",
    lost.text.includes("Not sure it arrived") && !lost.text.includes("Not sent")
    && lost.text.includes("We didn't hear back from Open Food Facts. It may have arrived. Check the product in a few minutes before sending again.")
    && lost.link === `https://world.openfoodfacts.org/product/${FAKE_OFF} _blank` && !lost.retry && lost.close,
    `${lost.link} | retry ${lost.retry} | close ${lost.close}`);
  // 055 E1a/E1b: a send whose request is held forever (never answered, never failed) still ends. The app's 60 s and
  // 90 s waits run 3 s here (this check only); the held request is failed afterwards, so it never leaves.
  offReply = "hold";
  await run(`(async () => { __btn("Close").click(); await __sleep(500); __btn("Send new photos").click(); await __sleep(400); return true; })()`);
  await pickPhoto();
  const held = await run(`(async () => { await __until(() => document.body.innerText.includes("Ingredients photo"), 15000);
    __btn("Skip").click(); await __sleep(300); __btn("Skip").click(); await __sleep(400); document.querySelector('input[type="checkbox"]').click(); await __sleep(200);
    const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 60000 || ms === 90000 ? 3000 : ms, ...a);
    try { __btn("Send").click(); return !!(await __until(() => document.body.innerText.includes("Not sure it arrived"), 20000)); }
    finally { window.setTimeout = st; } })()`);
  for (const id of heldIds) await send("Fetch.failRequest", { requestId: id, errorReason: "Aborted" });
  check("055 E1b: a send held forever ends on 'Not sure it arrived' after its wait (Close unlocked)", held === true, String(held));
  await run(`(async () => { __btn("Close").click(); await __sleep(500); return true; })()`);
  // M15 C5: an ok send that is this person's first counted help says so on the Sent screen.
  offReply = { status: 200 };
  await run(`(async () => { __btn("Send new photos").click(); await __sleep(400); return true; })()`);
  await pickPhoto();
  const first = await run(`(async () => { await __until(() => document.body.innerText.includes("Ingredients photo"), 15000);
    __btn("Skip").click(); await __sleep(300); __btn("Skip").click(); await __sleep(400); document.querySelector('input[type="checkbox"]').click(); await __sleep(200);
    __btn("Send").click(); await __until(() => document.body.innerText.includes("You reached"), 10000); return document.body.innerText; })()`);
  check("M15 C5: an ok send that reached a milestone says 'You reached First help. See Profile.' on the Sent screen",
    first.includes("Sent to Open Food Facts") && first.includes("You reached First help. See Profile."), first.replace(/\n/g, " / ").slice(0, 200));
  await send("Fetch.disable");
  check("…and nothing left the page: OFF's product read, the six sends and the counts after the ok one were answered, dropped or held here",
    offAsked.filter(u => u.startsWith("POST ") && u.endsWith("/functions/v1/off-submit")).length === 6
    && offAsked.filter(u => /\/rest\/v1\/(contributions|place_reports)$/.test(u) && !u.startsWith("OPTIONS")).length === 2
    && offAsked.every(u => /world\.openfoodfacts\.org\/api\/v3\/product\/|\/auth\/v1\/|\/functions\/v1\/off-submit$|\/rest\/v1\/(contributions|place_reports)$/.test(u)), offAsked.join(", "));
  check("USDA's own API is never called",!requests.some(u => u.includes("api.nal.usda.gov")), requests.filter(u => u.includes("usda")).slice(0, 3).join(" "));
  check("no console errors", errors.length === 0, errors.join(" | "));
} catch (err) {
  check("the script ran to the end", false, String(err?.stack ?? err).slice(0, 300)); // a crash must not read as a pass
} finally {
  await closeAndCheck(check);
  console.log(`${ok}/${total} checks passed`);
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until its timeout
}

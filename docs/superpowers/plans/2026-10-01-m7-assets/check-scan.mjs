// Split out of check-home.mjs (073, 2026-10-23): the Scan drawer's no-barcode check and adding a product, on a fresh
// profile. USDA's own API is never called.
// M8: the Scan drawer (not Home) offers the no-barcode check, where typed Red 40 shows Some concern; the not-found screen
// offers "Add this product"; Send stays disabled until the consent box is ticked; Turnstile loads only when Send is pressed (075 P3).
// M8 follow-ups (K4 crop, P1/P2 bar, G2/H1 send endings), 055 E1, 066 R9; 053 W4 offline banner last.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-scan.mjs <url>
// Build with a Turnstile site key (locally Cloudflare's public test key: VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA).
// The send checks stub the widget, answer the sign-in themselves (CDP Fetch) and route off-submit to a local stub
// server, so nothing is sent.
import { startEdge } from "./edge.mjs";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const URL_ = process.argv[2];
// 360 s: ~170–190 s (the crop and photo reads are most of it).
const { PORT, closeAndCheck } = startEdge("scan", 9600, "900,1000", 360000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const requests = []; // every URL the page asked for (Network events)
let onPaused = () => {}, turnstileStub = () => {}; // Fetch interception (M8 follow-up 2): set where it's used
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
    if (m.method === "Fetch.requestPaused") (m.params.request.url.includes("challenges.cloudflare.com") ? turnstileStub : onPaused)(m.params);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
  });
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const helpers = () => run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.includes(s) || b.getAttribute("aria-label") === s);
    window.__exact = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s);
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
  await send("Runtime.enable");
  await send("Network.enable");
  // M16: a barcode nobody has is also asked of Open Beauty Facts; it answers "not found" here, never over the network.
  // The X-User-Agent header makes the browser send a CORS preflight first: that one gets a 200, the GET the 404.
  const obf404 = p => send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: p.request.method === "OPTIONS" ? 200 : 404,
    responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" }, { name: "Access-Control-Allow-Headers", value: "*" }, { name: "Content-Type", value: "application/json" }],
    body: Buffer.from(p.request.method === "OPTIONS" ? "" : JSON.stringify({ status: 0, status_verbose: "product not found" })).toString("base64") });
  const OBF_PATTERN = { urlPattern: "*openbeautyfacts.org/*" };
  // 075 P3: Turnstile's script loads only when Send is pressed, so it is served here (nothing reaches Cloudflare); each send
  // check sets window.__turnstileRender.
  const TURNSTILE = { urlPattern: "*challenges.cloudflare.com/*" };
  turnstileStub = p => send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/javascript" }],
    body: Buffer.from("window.turnstile = { render: (el, o) => window.__turnstileRender(el, o), remove: () => {} };").toString("base64") });
  onPaused = obf404;
  await send("Fetch.enable", { patterns: [OBF_PATTERN, TURNSTILE] });
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
  // M8 (spec 2026-10-02-m8-add-product-design.md §7; the photo reader has its own check, check-ocr.mjs).
  check("M8: Home has no no-barcode entry", !(await run(`document.body.innerText`)).includes("No barcode"));
  // 068 S1: the camera's Barcode / Ingredients switch; the check it opens has the camera off (G8); closing goes back.
  const sw = await run(`(async () => { __btn("Scan").click(); await __until(() => __exact("Barcode") || __btn("Close camera"));
    const on = () => [__exact("Barcode")?.getAttribute("aria-pressed"), __exact("Ingredients")?.getAttribute("aria-pressed")].join();
    const before = on(); __exact("Ingredients")?.click(); await __sleep(400);
    const open = { title: document.querySelector("#check-title")?.innerText, food: __exact("Food")?.getAttribute("aria-pressed"),
      camera: !!document.querySelector("video") || document.body.innerText.includes("Scanning happens on your phone") };
    if (open.title) __btn("Close").click(); await __until(() => __exact("Barcode") || __btn("Close camera")); return { before, open, after: on() }; })()`);
  check("068 S1: the camera has a 'Barcode · Ingredients' switch, Barcode on", sw?.before === "true,false", JSON.stringify(sw));
  check("068 S1, G8: Ingredients opens the check on Food, with the camera off", sw?.open.title === "Check ingredients" && sw.open.food === "true"
    && !sw.open.camera, JSON.stringify(sw?.open));
  check("068 S1: closing the check goes back to the camera on Barcode", sw?.open.title && sw.after === "true,false", sw?.after);
  await run(`(async () => { __btn("Close camera")?.click(); await __sleep(800); return true; })()`);
  check("068 S1: the Scan drawer says 'Check ingredients', never 'No barcode?'",
    !!(await run(`!!__exact("Check ingredients") && !document.body.innerText.includes("No barcode")`)));
  // 075 A2 (audit): faded white text on the Scan screen's dark green (#0F1F16) is at least 4.5:1 (WCAG 1.4.3), demo
  // barcodes included. A canvas blends each colour over the green, whatever syntax the browser reports it in.
  const faint = await run(`(async () => { __btn("Demo barcodes")?.click(); await __sleep(300);
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const px = col => { cv.fillStyle = "#0F1F16"; cv.fillRect(0, 0, 1, 1); cv.fillStyle = col; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const L = c => c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = col => (L(px(col)) + 0.05) / (L(px("#0F1F16")) + 0.05);
    const texts = [...document.querySelectorAll('[class*="text-white/"]')].filter(e => e.tagName !== "svg" && e.checkVisibility() && e.innerText.trim());
    const out = { n: texts.length, low: texts.map(e => [e.innerText.slice(0, 24), +ratio(getComputedStyle(e).color).toFixed(2)]).filter(([, r]) => r < 4.5),
      placeholder: +ratio(getComputedStyle(document.querySelector('input[aria-label="Barcode number"]'), "::placeholder").color).toFixed(2) };
    __btn("Demo barcodes")?.click(); await __sleep(300); return out; })()`);
  check("075 A2: faded text on the Scan screen (footer, demo barcodes, the box's placeholder) is at least 4.5:1",
    faint?.n > 5 && faint.low.length === 0 && faint.placeholder >= 4.5, JSON.stringify(faint));
  const typeIngredients = async text => {
    await run(`(() => { const t = document.querySelector("#ingredients"); t.focus(); t.select(); return true; })()`);
    await send("Input.insertText", { text }); await sleep(300);
    return run(`document.querySelector('[role="status"]')?.innerText ?? ""`);
  };
  await run(`(async () => { (__exact("Check ingredients") ?? __btn("No barcode? Check ingredients")).click(); await __sleep(400); __btn("Type it").click(); await __sleep(300); return true; })()`);
  // 068 S2: Paste from Photos, with the clipboard allowed (fills the box), then refused (the box gets focus).
  const origin = new URL(URL_).origin;
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Browser.grantPermissions", { origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
  const pasted = await run(`(async () => { await navigator.clipboard.writeText("Water, Formaldehyde"); __exact("Paste")?.click(); await __sleep(300);
    return { box: document.querySelector("#ingredients")?.value,
      tip: document.body.innerText.includes("On iPhone: open the photo, press and hold the words, tap Copy, then tap Paste here.") }; })()`);
  check("068 S2: under 'Type it', the iPhone tip and Paste, which fills the box", pasted?.tip && pasted.box === "Water, Formaldehyde", JSON.stringify(pasted));
  await send("Browser.setPermission", { origin, permission: { name: "clipboard-read" }, setting: "denied" });
  const refused = await run(`(async () => { document.activeElement?.blur(); __exact("Paste")?.click(); await __sleep(300);
    return { focus: document.activeElement?.id, box: document.querySelector("#ingredients")?.value }; })()`);
  check("068 S2: refused, Paste leaves the box as it was and gives it focus", refused?.focus === "ingredients" && refused.box === "Water, Formaldehyde",
    JSON.stringify(refused));
  check("M8: typing a list containing Red 40 shows Some concern", (await typeIngredients("Sugar, corn syrup, Red 40")).includes("Some concern"));
  // 075 M3 (audit A1), as on Home: the article over the check focuses its heading, the check behind it is inert, and Back
  // returns focus to the link that opened it.
  await typeIngredients("Water, salt");
  const why = await run(`(async () => { const link = await __until(() => __btn('Why "Nothing flagged"'), 3000); if (!link) return null;
    const inert = () => [document.querySelector('button[aria-label="Close"]'), document.querySelector("#ingredients")].map(e => !!e?.closest("[inert]")).join();
    link.click(); await __sleep(500);
    const open = { h1: document.activeElement?.tagName === "H1" ? document.activeElement.innerText : null, inert: inert() };
    [...document.querySelectorAll('button[aria-label="Back"]')].pop()?.click(); await __sleep(500);
    const back = document.activeElement?.innerText, after = inert();
    // Escape closes the article only (handoff: overlays close on Escape), not the check under it.
    link.click(); await __sleep(500);
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await __sleep(500);
    return { ...open, back, after, esc: [!!document.querySelector("#check-title"), document.activeElement === link].join() }; })()`);
  check("075 M3: the 'Nothing flagged' article over the check: heading focused, check behind inert, Back or Escape returns focus to its link",
    why?.h1 === "“Nothing flagged” isn’t “healthy”" && why.inert === "true,true" && why.back === 'Why "Nothing flagged" isn\'t "healthy"' && why.after === "false,false"
    && why.esc === "true,true", JSON.stringify(why));
  await run(`(async () => { __btn("Close").click(); await __sleep(600); return true; })()`);
  const nf = await scanTyped("3017620429996", "We couldn't find this barcode yet");
  check("M8: the not-found screen shows 'Add this product', the OFF website link stays as a fallback",
    nf.includes("Add this product") && nf.includes("Or add it on the Open Food Facts website"));
  // 068 S3: no dead end for cleaners: Cleaning product → the label check on a cleaner kind, IARC findings only.
  const CLEANER = "EcoGo's cleaner checks are just starting: for now it looks for cancer findings (IARC). More official lists are coming.";
  const cl = await run(`(async () => { __exact("Cleaning product").click(); await __sleep(300); const t = document.body.innerText;
    __btn("Check the label yourself")?.click(); await __sleep(400); __exact("Type it")?.click(); await __sleep(300);
    return { t, title: document.querySelector("#check-title")?.innerText, kind: __exact("Cleaning product")?.getAttribute("aria-pressed") }; })()`);
  check("068 S3: Cleaning product says what the check covers, keeps the California line and offers 'Check the label yourself'",
    cl.t.includes(CLEANER) && cl.t.includes("California law requires") && cl.t.includes("Check the label yourself") && !cl.t.includes("maker's website"));
  const clv = cl.title ? await typeIngredients("Water, Formaldehyde, Zinc Pyrithione, Talc") : "";
  check("068 S3: the check opens on Cleaning product and shows IARC findings only, with the cleaner line",
    cl.title === "Check ingredients" && cl.kind === "true" && clv.includes("2 findings") && clv.includes("Formaldehyde") && clv.includes("Talc")
    && clv.includes(CLEANER) && !/Zinc|EU|FDA|[Bb]anned/.test(clv), JSON.stringify({ ...cl, t: undefined, clv }));
  // Closing the check goes back to the camera (as for personal care), so the add flow below scans the code again.
  if (cl.title) { await run(`(async () => { __btn("Close").click(); await __sleep(600); return true; })()`); await scanTyped("3017620429996", "We couldn't find this barcode yet"); }
  await run(`(async () => { __exact("Food")?.click(); await __sleep(300); return true; })()`);
  const turnstile = () => requests.some(u => u.includes("challenges.cloudflare.com"));
  // RW1-01: picks a photo in the page itself, so the next click lands while the photo is still being prepared.
  const pickJs = file => `(() => { const b = Uint8Array.from(atob("${readFileSync(file).toString("base64")}"), c => c.charCodeAt(0)), dt = new DataTransfer();
    dt.items.add(new File([b], "label.png", { type: "image/png" })); const i = document.querySelector('input[data-photo="library"]');
    i.files = dt.files; i.dispatchEvent(new Event("change", { bubbles: true })); })();`;
  const tipsStep = await run(`(async () => { __btn("Add this product").click(); await __sleep(400); __btn("Skip").click(); await __sleep(300);
    const front = document.querySelector('ol[aria-label="Photos"] li'); window.__skippedStep = [front.innerText.replace(/\\s+/g, " "), !!front.querySelector("svg")];
    const t = document.body.innerText; ${pickJs(fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url)))}
    __btn("No ingredients list? Type it").click(); await __sleep(300); return t; })()`);
  const skippedStep = await run(`__skippedStep`);
  check("056 R2-04: a skipped photo step says 'Skipped', with no checkmark", skippedStep[0] === "1 Front Skipped" && !skippedStep[1], JSON.stringify(skippedStep));
  check("M8 H3: the ingredients photo step shows the numbered tips", ["Lay it flat", "Close & sharp", "Only the ingredients", "No glare"]
    .every(t => tipsStep.includes(t)));
  const typeIt = await run(`({ box: document.querySelector("#ingredients")?.value, ph: document.querySelector("#ingredients")?.placeholder })`);
  check("K3: 'No ingredients list? Type it' (no skip link) goes straight to an empty check box", !tipsStep.includes("Skip the photo")
    && typeIt.box === "" && typeIt.ph?.startsWith("e.g."), JSON.stringify(typeIt));
  await typeIngredients("Water, sugar, Red 40");
  await sleep(3000); // longer than preparing and blur-checking the photo picked just before "Type it"
  const late = await run(`({ box: document.querySelector("#ingredients")?.value, photo: !!document.querySelector('img[alt="Ingredients photo"]'),
    reading: document.body.innerText.includes("Reading the label") })`);
  check("RW1-01 (a): a photo picked just before 'Type it' never lands: the typed text and the check step stay",
    late.box === "Water, sugar, Red 40" && !late.photo && !late.reading, JSON.stringify(late));
  const beforeSend = turnstile();
  await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); __btn("Skip").click(); await __sleep(600); return true; })()`);
  const sendOff = await run(`__btn("Send")?.disabled`);
  await run(`(async () => { document.querySelector('input[type="checkbox"]').click(); await __sleep(200); return true; })()`);
  const sendOn = await run(`__btn("Send")?.disabled === false`);
  check("M8: Send stays disabled until the checkbox is ticked", sendOff === true && sendOn === true, `before ${sendOff}, after tick disabled=${!sendOn}`);
  const sendBox = await run(`document.body.innerText`);
  check("066 R8: the 'This will be public' box says 'Photograph only the label, never anything private.' (Minh's words)",
    sendBox.includes("Photograph only the label, never anything private.") && !sendBox.includes("Make sure no faces"));
  check("075 P3: the human check isn't loaded before Send is pressed, on the Send screen either", !beforeSend && !turnstile());
  const backed = await run(`(async () => { __btn("Back").click(); await __sleep(300); const nutrition = !!__btn("Skip");
    __btn("Back").click(); await __sleep(300); return nutrition && document.querySelector("#ingredients")?.value; })()`);
  check("M8: Back from Send goes to the nutrition photo, then to the check, keeping the text", backed === "Water, sugar, Red 40", String(backed));
  // M8 follow-up 6, K4: crop the ingredients photo on the check step (read again), then the nutrition photo on Send.
  const LABEL_PNG = fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url)); // 1000 × 400
  const dragHandle = async (sel, share) => { // drags a handle left by `share` of the photo's width
    const [x, y, w] = await run(`(() => { const b = document.querySelector('${sel}').getBoundingClientRect(), f = document.querySelector("[data-crop]").parentElement.getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2, f.width]; })()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 5; i++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x - share * w * i / 5, y, button: "left", buttons: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x - share * w, y, button: "left", clickCount: 1 });
    await sleep(200);
  };
  const done = () => run(`(async () => { __btn("Done").click(); // until the crop screen closes, or shows its message
    await __until(() => !__btn("Done") || document.querySelector('[role="alert"]'), 30000); return true; })()`);
  const natural = alt => run(`__until(() => { const i = document.querySelector('img[alt="${alt}"]'); return i?.complete && i.naturalWidth ? i.naturalWidth + "×" + i.naturalHeight : null; }, 15000)`);
  const upload = async () => {
    const { root } = (await send("DOM.getDocument")).result;
    const input = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
    await send("DOM.setFileInputFiles", { nodeId: input, files: [LABEL_PNG] });
  };
  await run(`(async () => { __btn("Retake").click(); await __sleep(300); return true; })()`);
  await upload();
  await run(`__until(() => __btn("Crop") && document.querySelector("#ingredients"), 60000)`);
  const fullSize = await natural("Ingredients photo");
  await run(`(async () => { __btn("Crop").click(); await __sleep(500); return true; })()`);
  const cropScreen = await run(`({ text: document.body.innerText, handles: [...document.querySelectorAll("[data-handle]")].map(h => Math.round(Math.min(h.offsetWidth, h.offsetHeight))) })`);
  check("K4: Crop on the check step opens the crop screen with four corner handles of at least 44 px, Done and Cancel",
    cropScreen.text.includes("Crop the ingredients photo") && cropScreen.handles.length === 4 && cropScreen.handles.every(s => s >= 44)
    && !!(await run(`!!__btn("Done") && !!__btn("Cancel")`)), JSON.stringify(cropScreen.handles));
  await dragHandle('[data-handle="se"]', 0.2);
  // Watches for "Reading the label…" until it shows, then stops (innerText on every DOM change slows the whole page).
  await run(`(() => { window.__sawReading = false; const o = window.__readWatch = new MutationObserver(() => {
    if (document.body.innerText.includes("Reading the label")) { window.__sawReading = true; o.disconnect(); } });
    o.observe(document.body, { subtree: true, childList: true, characterData: true }); __btn("Done").click(); return true; })()`);
  await run(`(async () => { await __until(() => __btn("Crop") && document.querySelector("#ingredients"), 60000); __readWatch.disconnect(); return true; })()`);
  const croppedSize = await natural("Ingredients photo");
  check("…Done gives a smaller ingredients photo and reads it again", fullSize === "1000×400" && croppedSize === "800×400" && await run(`window.__sawReading`),
    `${fullSize} → ${croppedSize}, read again: ${await run(`window.__sawReading`)}`);
  // 066 R9: the check step offers "Add another photo"; the full label joins the cropped one's text, and Crop goes
  // (cropping reads the first photo again and would drop the joined text). Only the first photo is sent (planner).
  const r9 = await run(`(async () => { const t = document.body.innerText; ${pickJs(LABEL_PNG).replace(`'input[data-photo="library"]'`, `'input[data-photo="another"]'`)}
    await __until(() => /Joined 2 photos|Added the new photo/.test(document.body.innerText), 60000);
    return { hint: t.includes("Curvy label? Cut off? Add more pics."), button: !!__btn("Add another photo"),
      note: document.body.innerText.includes("Joined 2 photos. Check where they meet."), crop: !!__btn("Crop") }; })()`);
  check("066 R9: the check step offers 'Add another photo'; a second photo of the label joins the text, and Crop goes",
    r9.hint && r9.button && r9.note && !r9.crop, JSON.stringify(r9));
  await typeIngredients("Water, sugar, Red 40");
  await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); return true; })()`);
  await upload();
  await run(`__until(() => __btn("Send") && document.querySelector('img[alt="Nutrition photo"]'), 15000)`);
  const cropButtons = await run(`[...document.querySelectorAll("button")].filter(b => b.innerText === "Crop").length`);
  await run(`(async () => { [...document.querySelectorAll("button")].find(b => b.innerText === "Crop").click(); await __sleep(500); return true; })()`);
  await dragHandle('[data-handle="se"]', 1);
  await done();
  const small = await run(`document.querySelector('[role="alert"]')?.innerText ?? ""`);
  check("K4: on Send, Crop is under the nutrition photo (the only one taken), and a crop under OFF's minimum gets the usual message",
    cropButtons === 1 && small === "This photo is too small for Open Food Facts. Take it closer, or choose a bigger one.", `${cropButtons} | ${small}`);
  await run(`(async () => { __btn("Cancel").click(); await __sleep(400); return true; })()`);
  const kept = await natural("Nutrition photo");
  await run(`(async () => { [...document.querySelectorAll("button")].find(b => b.innerText === "Crop").click(); await __sleep(500); return true; })()`);
  await dragHandle('[data-handle="se"]', 0.2);
  await done();
  check("…Cancel keeps the photo; Done replaces it with the crop", kept === "1000×400" && (await natural("Nutrition photo")) === "800×400" && !!(await run(`!!__btn("Send")`)),
    `${kept} → ${await natural("Nutrition photo")}`);
  // K4 accessibility: each corner is a named button; Shift+← moves the focused one 50 px.
  await run(`(async () => { [...document.querySelectorAll("button")].find(b => b.innerText === "Crop").click(); await __sleep(500);
    await __until(() => document.querySelector("[data-crop]")?.parentElement.offsetWidth > 0); document.querySelector('[data-handle="se"]').focus(); return true; })()`);
  const corners = await run(`[...document.querySelectorAll("[data-handle]")].map(h => h.tagName + " " + h.getAttribute("aria-label")).join(", ")`);
  for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, modifiers: 8 });
  await done();
  const keyed = await natural("Nutrition photo");
  check("K4: the corners are buttons named for screen readers, and Shift+← moves the focused corner",
    corners === "BUTTON Top-left corner, BUTTON Top-right corner, BUTTON Bottom-left corner, BUTTON Bottom-right corner"
    && parseInt(keyed) < 800 && parseInt(keyed) >= 640, `${corners} | 800×400 → ${keyed}`);
  await run(`(async () => { __btn("Back").click(); await __sleep(300); __btn("Back").click(); await __sleep(300); return true; })()`);
  // M8 follow-up 4, P2: a stubbed human check that never answers keeps the send at its first stage: a moving bar with
  // no percent, which reduced motion stills.
  await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); return true; })()`);
  const { root: docRoot } = (await send("DOM.getDocument")).result;
  const lib = (await send("DOM.querySelector", { nodeId: docRoot.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib, files: [fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url))] });
  const waiting = await run(`(async () => { await __until(() => __btn("Send") && document.querySelector('img[alt="Nutrition photo"]'), 10000);
    window.__turnstileRender = () => "stub";
    // 055 E1a: the app's 60 s wait for a human-check token runs 5 s here (this check only; any other 60 s timer too,
    // for these few seconds).
    const st = window.__setTimeout = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 60000 ? 5000 : ms, ...a);
    __btn("Send").click(); await __sleep(300);
    const b = [...document.querySelectorAll("button")].find(b => b.innerText.startsWith("Sending")), bar = document.querySelector('[role="progressbar"]');
    return [b?.innerText, b?.disabled, bar?.getAttribute("aria-valuetext"), bar?.hasAttribute("aria-valuenow"),
      getComputedStyle(document.querySelector("[data-moving]")).animationName].join(" | "); })()`);
  check("M8 P2: while the human check runs: 'Checking you're human…' on a moving bar with no percent, button 'Sending…'",
    waiting === "Sending… | true | Checking you're human… | false | ecogo-indeterminate", waiting);
  check("075 P3: pressing Send loads the human check", turnstile());
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const still = await run(`getComputedStyle(document.querySelector("[data-moving]")).animationName`);
  await send("Emulation.setEmulatedMedia", MOTION);
  check("…with reduced motion the bar doesn't move", still === "none", still);
  // 055 E1: while sending, Close and every field that feeds the send are locked (Back is gone, Crop was already locked).
  const locked = await run(`(async () => { const close = __btn("Close"); close.click(); await __sleep(300); // a render after the click
    const crops = [...document.querySelectorAll("button")].filter(b => b.innerText === "Crop");
    return { close: close.disabled, name: document.querySelector("#product-name").disabled, consent: document.querySelector('input[type="checkbox"]').disabled,
      crop: crops.length > 0 && crops.every(b => b.disabled), back: !!__btn("Back"), still: !!__btn("Sending…") }; })()`);
  check("055 E1: while sending, Close, the name, the consent box and Crop are disabled; a Close click does nothing",
    locked.close && locked.name && locked.consent && locked.crop && !locked.back && locked.still, JSON.stringify(locked));
  const ended = await run(`(async () => { await __until(() => document.body.innerText.includes("Not sent"), 15000); if (window.__setTimeout) window.setTimeout = __setTimeout;
    const t = document.body.innerText; const close = __btn("Close"); const ok = close && !close.disabled; close?.click(); await __sleep(600);
    return { captcha: t.includes("Couldn't confirm you're not a robot. Try again."), close: ok, gone: !__btn("Try again") }; })()`);
  check("055 E1a: a human check that never answers ends as Not sent (captcha) after its wait; Close works again",
    ended.captcha && ended.close && ended.gone, JSON.stringify(ended));
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
  let countReads = 0; // M15 C5: the reads after an ok send, failed here (no line), so nothing reaches Supabase
  onPaused = p => {
    if (p.request.url.includes("openbeautyfacts.org")) return obf404(p);
    if (/\/rest\/v1\/(contributions|place_reports)/.test(p.request.url)) { countReads++; return send("Fetch.failRequest", { requestId: p.requestId, errorReason: "InternetDisconnected" }); }
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
  await send("Fetch.enable", { patterns: [OBF_PATTERN, { urlPattern: "*/auth/v1/*" }, { urlPattern: "*/functions/v1/*" }, { urlPattern: "*/rest/v1/contributions*" }, { urlPattern: "*/rest/v1/place_reports*" }, TURNSTILE] });
  await scanTyped("3017620429996", "We couldn't find this barcode yet");
  await run(`(async () => { __btn("Add this product").click(); await __sleep(400); __btn("Skip").click(); await __sleep(300);
    __btn("No ingredients list? Type it").click(); await __sleep(300); return true; })()`);
  await typeIngredients("Water, sugar, Red 40");
  const nutritionStep = await run(`(async () => { __btn("Next: nutrition photo").click(); await __sleep(300); return document.body.innerText; })()`);
  check("M8 H3: the nutrition photo step's tips say 'Only the nutrition table'", ["Lay it flat", "Close & sharp", "Only the nutrition table", "No glare"]
    .every(t => nutritionStep.includes(t)) && !nutritionStep.includes("Only the ingredients"));
  const { root: docRoot2 } = (await send("DOM.getDocument")).result;
  const lib2 = (await send("DOM.querySelector", { nodeId: docRoot2.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib2, files: [fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url))] });
  // ~40 KB/s up, by rule (the plain command is deprecated in Edge 155); an empty pattern matches every request. A rejected
  // call throws, so the bar check can't silently run unthrottled. The bar is recorded by a MutationObserver below: a
  // 20 ms poll missed steps on Edge 155 while the page was busy.
  const throttle = async uploadThroughput => {
    const r = await send("Network.emulateNetworkConditionsByRule", { matchedNetworkConditions: uploadThroughput < 0 ? []
      : [{ urlPattern: "", latency: 0, downloadThroughput: -1, uploadThroughput }] });
    if (r.error) throw new Error(`throttle: ${r.error.message}`);
  };
  await throttle(40_000);
  const sent = await run(`(async () => { await __until(() => __btn("Send") && document.querySelector('img[alt="Nutrition photo"]'), 10000);
    document.querySelector('input[type="checkbox"]').click(); await __sleep(200);
    window.__turnstileRender = (el, o) => { setTimeout(() => o.callback("stub-token"), 50); return "stub"; };
    const live = document.querySelector('p.sr-only[aria-live="polite"]'); window.__said = [live ? JSON.stringify(live.innerText) : "no live region"];
    window.__bar = []; const seen = new MutationObserver(() => { const b = document.querySelector('[role="progressbar"]');
      const s = b && b.getAttribute("aria-valuetext") + "/" + (b.getAttribute("aria-valuenow") ?? "-"); if (s && __bar.at(-1) !== s) __bar.push(s);
      const t = live?.innerText; if (t && __said.at(-1) !== t) __said.push(t); }); // every DOM change, however busy the page
    seen.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    __btn("Send").click(); await __until(() => document.body.innerText.includes("Sent to Open Food Facts"), 20000); seen.disconnect();
    const a = [...document.querySelectorAll("a")].find(a => a.innerText === "Open Food Facts website");
    return document.body.innerText + "|" + (a?.href ?? "no link"); })()`);
  for (let t = 0; t < 30 && countReads < 2; t++) await sleep(100); // let the C5 reads arrive before interception stops
  await send("Fetch.disable");
  await throttle(-1);
  stub.close();
  const bar = await run(`__bar`);
  const pct = bar.filter(s => s.startsWith("Uploading photos")).map(s => Number(s.split("/")[1]));
  check("M8 P1/P2: the bar shows the real upload percent rising, then 'Open Food Facts is saving it…', then Sent",
    pct.length >= 3 && pct.every((p, i) => i === 0 || p >= pct[i - 1]) && pct.some(p => p > 0 && p < 100)
    && bar.at(-1) === "Open Food Facts is saving it…/-" && bar.every(s => s.startsWith("Uploading photos") || !/\/\d/.test(s)), bar.join(" → "));
  const said = await run(`__said`);
  check("…and the live region, there and empty before Send, announces each stage once (no percents)",
    JSON.stringify(said) === JSON.stringify(['""', "Checking you're human…", "Uploading photos…", "Open Food Facts is saving it…"]), said.join(" → "));
  check("M8 G2/H1: a send where the nutrition photo failed says Sent, names it, links to OFF, and says the others are still uploading",
    sent.includes("Sent to Open Food Facts") && sent.includes("The nutrition photo didn't go through. You can add it later on the Open Food Facts website.")
    && sent.includes("Your other photos are still uploading to Open Food Facts.")
    && sent.includes("|https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=3017620429996")
    && faked.some(f => f.startsWith("POST") && f.includes("signup")) && faked.some(f => f.startsWith("POST") && f.includes("off-submit"))
    && faked.every(f => /^(OPTIONS|POST) v1\/(signup|off-submit)$/.test(f)),
    `${sent.split("|")[1]}; answered here: ${faked.join(", ")}`);
  await run(`(async () => { __btn("Scan another product").click(); await __sleep(600); return true; })()`);
  // The send checks for crowd-sourced OFF products (051, 058, 055 E1–E3) are in check-sends.mjs.
  check("USDA's own API is never called",!requests.some(u => u.includes("api.nal.usda.gov")), requests.filter(u => u.includes("usda")).slice(0, 3).join(" "));
  check("no console errors", errors.length === 0, errors.join(" | "));
  // 053 W4: with Supabase unreachable the offline banner still shows (after the console check: blocked reads log errors).
  await send("Network.setBlockedURLs", { urls: ["*supabase.co*"] });
  await send("Page.reload"); await sleep(4000); await helpers();
  const off = await run(`__until(() => document.body.innerText.includes("Offline — showing the built-in catalog"), 15000).then(() => document.body.innerText)`);
  await send("Network.setBlockedURLs", { urls: [] });
  check("053 W4: Supabase unreachable → the offline banner still shows, and no 'Live data'", off.includes("Offline — showing the built-in catalog") && !off.includes("Live data"));
} catch (err) {
  check("the script ran to the end", false, String(err?.stack ?? err).slice(0, 300)); // a crash must not read as a pass
} finally {
  await closeAndCheck(check);
  console.log(`${ok}/${total} checks passed`);
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until its timeout
}

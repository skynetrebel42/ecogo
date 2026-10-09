// M8 (headless Edge, spec docs/superpowers/specs/2026-10-02-m8-add-product-design.md §7): the no-barcode check.
// Home has no entry (D13); the Scan drawer's "No barcode? Check ingredients" opens it; the recorded label photo
// (ingredients-label.jpg, beside this file) is read on the phone with the self-hosted reader (no CDN) into text with its
// known words and a "Some concern" badge; typed text gets the same live badge, and "Nothing flagged" links its explainer.
// Prints the reader's first-use download size.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-ocr.mjs <url>
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const PHOTO = fileURLToPath(new URL("./ingredients-label.jpg", import.meta.url));
const FULL = fileURLToPath(new URL("./ingredients-label-full.png", import.meta.url));
const BAG = fileURLToPath(new URL("./ingredients-bag-curved.png", import.meta.url));
const PORT = 9600 + Math.floor(Math.random() * 90);
const PROFILE = `${process.env.TEMP}\\ecogo-ocr-${PORT}`;
rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=375,812",
  `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
setTimeout(() => { console.log("TIMEOUT"); edge.kill(); process.exit(1); }, 180000).unref?.();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const requests = []; // every URL the page (and its workers' fetches) asked for
const urls = new Map(), bytes = new Map(); // requestId → URL, URL → bytes on the wire
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
    // The reader runs in a Web Worker: its downloads are reported on the worker's own (auto-attached) session.
    if (m.method === "Target.attachedToTarget") send("Network.enable", {}, m.params.sessionId);
    if (m.method === "Network.requestWillBeSent") { requests.push(m.params.request.url); urls.set(m.params.requestId, m.params.request.url); }
    if (m.method === "Network.loadingFinished") bytes.set(urls.get(m.params.requestId), m.params.encodedDataLength);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160));
  });
  const send = (method, params = {}, sessionId) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
  const run = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const helpers = () => run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.includes(s) || b.getAttribute("aria-label") === s);
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Scan a product"));
      if (b?.innerText.includes("Look around first")) { b.click(); await __sleep(400); } }; true`);
  const typeInto = async text => {
    await run(`(() => { const t = document.querySelector("#ingredients"); t.focus(); t.select(); return true; })()`);
    await send("Input.insertText", { text });
    await sleep(300);
  };
  const badge = () => run(`document.querySelector('[role="status"]')?.innerText ?? ""`);

  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Runtime.enable");
  await send("Network.enable");
  await send("DOM.enable");
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  await run(`__guest()`); await sleep(800);
  check("Home has no no-barcode entry (D13)", !(await run(`document.body.innerText`)).includes("No barcode"));

  await run(`(async () => { __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); return true; })()`);
  check("the Scan drawer offers 'No barcode? Check ingredients'", !!(await run(`!!__btn("No barcode? Check ingredients")`)));
  await run(`(async () => { __btn("No barcode? Check ingredients").click(); await __sleep(500); return true; })()`);
  const opened = await run(`document.body.innerText`);
  check("it opens Check ingredients with the 'nothing saved or sent' note", opened.includes("Check ingredients")
    && opened.includes("Without a barcode there's no nutrition label to look up, so this checks ingredients only. Nothing is saved or sent."));

  const { root } = (await send("DOM.getDocument")).result;
  const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[data-photo="library"]' })).result;
  await send("DOM.setFileInputFiles", { nodeId, files: [PHOTO] });
  const read = await run(`__until(() => document.querySelector("#ingredients")?.value, 90000)`);
  check("the label photo is read on the phone into its words", !!read && ["SUGAR", "CORN SYRUP", "CITRIC ACID", "RED 40", "YELLOW 5", "CARNAUBA"]
    .every(w => read.toUpperCase().includes(w)), read ?? "nothing read");
  check("…without the 'Ingredients:' label", !!read && !/^ingredients/i.test(read));
  check("…and the badge says Some concern", (await badge()).includes("Some concern"), (await badge()).split("\n")[0]);
  // M8 follow-up 2, G4/G6: the share of kept words read unsure (underlined) — the retake hint shows at 25 %.
  const SHARE = `(() => { const words = (document.querySelector("#ingredients").value.match(/[\\p{L}\\p{N}]+/gu) ?? []).length;
    const u = document.querySelectorAll('div[aria-hidden="true"] span[style*="wavy"]').length;
    return \`\${u}/\${words} = \${words ? Math.round(100 * u / words) : 0}%\`; })()`;
  check("…a clear label gets no retake hint", !(await run(`document.body.innerText`)).includes("This photo is hard to read."), `unsure share ${await run(SHARE)}`);
  const ocr = [...bytes].filter(([u]) => u?.includes("/tesseract/"));
  const kb = Math.round(ocr.reduce((s, [, n]) => s + n, 0) / 1024);
  check("the reader comes from EcoGo's own site, never a CDN", ocr.length >= 3 && !requests.some(u => /jsdelivr|unpkg|cdnjs/.test(u)),
    `first use: ${kb} KB over ${ocr.length} files (${ocr.map(([u, n]) => `${u.split("/").pop()} ${Math.round(n / 1024)} KB`).join(", ")})`);

  // M8 follow-up F1–F3 (docs/superpowers/specs/2026-10-08-m8-followup-label-trim-design.md §3): a label with a brand line
  // above and "Distributed by …" below (ingredients-label-full.png, rendered from HTML in headless Edge).
  await run(`(async () => { __btn("Check another").click(); await __sleep(300); return true; })()`);
  const { root: root2 } = (await send("DOM.getDocument")).result;
  const lib2 = (await send("DOM.querySelector", { nodeId: root2.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib2, files: [FULL] });
  const LIST = `[...document.querySelectorAll('ul[aria-label="Lines read from the photo"] li')].map(li => ({ text: li.innerText, on: li.querySelector("input").checked }))`;
  const kept = await run(`__until(() => { const l = ${LIST}; return l.length ? l : null; }, 60000)`) ?? [];
  const more = await run(`__btn("more line")?.innerText ?? "no button"`);
  check("M8 G5: only the kept lines are listed; the rest wait behind 'Show 3 more lines we left out'",
    kept.length === 2 && kept.every(l => l.on) && more === "Show 3 more lines we left out", `${JSON.stringify(kept)} | ${more}`);
  await run(`(async () => { __btn("more line").click(); await __sleep(300); return true; })()`);
  const lines = await run(LIST);
  check("…which opens them, ticks unchanged", lines.length === 5 && lines.filter(l => l.on).length === 2, JSON.stringify(lines));
  const box = () => run(`document.querySelector("#ingredients").value`);
  console.log(`      full label: unsure share ${await run(SHARE)}`);
  const off = lines.filter(l => !l.on).map(l => l.text.toUpperCase());
  check("the full label shows its lines; the brand and distributor lines start unticked", off.some(t => t.includes("FRUITY"))
    && off.some(t => t.includes("DISTRIBUTED")) && lines.filter(l => l.on).length >= 2, JSON.stringify(lines));
  const full = (await box()).toUpperCase();
  check("…the text box has the ingredients without them", ["SUGAR", "CORN SYRUP", "CITRIC ACID", "CARNAUBA"].every(w => full.includes(w))
    && !/FRUITY|DISTRIBUTED|CONTAINS|ALLERGENS/.test(full), full);
  check("…and the note names the words found", (await run(`document.body.innerText`)).includes(`We kept the part from "Ingredients" to "Contains". Tick or untick lines, or edit the text below.`));
  await run(`(async () => { [...document.querySelectorAll('ul[aria-label="Lines read from the photo"] li')].find(li => li.innerText.toUpperCase().includes("CITRIC")).querySelector("input").click(); await __sleep(300); return true; })()`);
  const unticked = (await box()).toUpperCase();
  check("unticking a kept line removes it from the text box", !unticked.includes("CITRIC") && unticked.includes("SUGAR"), unticked);
  await typeInto("Sugar, corn syrup");
  check("typing in the box hides the lines", (await run(`${LIST}.length`)) === 0
    && (await run(`document.body.innerText`)).includes("You're editing the text directly"));

  // M8 follow-up 2, G4: a curved, shiny bag (ingredients-bag-curved.png, rendered from HTML) gets the retake hint.
  await run(`(async () => { __btn("Check another").click(); await __sleep(300); return true; })()`);
  const { root: root3 } = (await send("DOM.getDocument")).result;
  const lib3 = (await send("DOM.querySelector", { nodeId: root3.nodeId, selector: 'input[data-photo="library"]' })).result.nodeId;
  await send("DOM.setFileInputFiles", { nodeId: lib3, files: [BAG] });
  const hard = await run(`__until(() => document.querySelector("#ingredients") || [...document.querySelectorAll('[role="alert"]')].find(e => e.innerText.includes("hard to read")), 60000)
    .then(e => e?.innerText ?? "")`);
  check("M8 G4: a curved, shiny bag opens with 'This photo is hard to read.', the tips, Retake photo and Use it anyway",
    hard.includes("This photo is hard to read.") && hard.includes("Flatten the bag.") && hard.includes("Retake photo") && hard.includes("Use it anyway"), hard.slice(0, 80));
  await run(`(async () => { __btn("Use it anyway")?.click(); await __sleep(400); return true; })()`);
  check("…Use it anyway shows the normal check", !!(await run(`!!document.querySelector("#ingredients")`)), `bag: unsure share ${await run(SHARE)}; read: ${(await run(`document.querySelector("#ingredients")?.value ?? ""`)).slice(0, 400)}`);
  const note = await run(`document.querySelector("#unsure-note")?.innerText ?? ""`);
  check("M8 G6: the note counts the underlined words instead of listing them", /^\d+ words? underlined: check (them|it)\.$/.test(note), note);

  await run(`(async () => { __btn("Check another").click(); await __sleep(300); __btn("Type it").click(); await __sleep(300); return true; })()`);
  await typeInto("Enriched flour, water, Red 40");
  check("typing a list with Red 40 shows Some concern", (await badge()).includes("Some concern"));
  await typeInto("Enriched flour, water, sugar, yeast, salt");
  check("a list with nothing flagged says so and isn't called healthy", (await badge()).includes("Nothing flagged")
    && (await badge()).includes(`That isn't the same as "healthy"`));
  await run(`(async () => { __btn("Why \\"Nothing flagged\\" isn't \\"healthy\\"").click(); await __sleep(400); return true; })()`);
  const ex = await run(`[...document.querySelectorAll("h1")].map(h => h.innerText)`);
  await run(`(async () => { __btn("Back").click(); await __sleep(300); return true; })()`);
  check("…and its explainer opens, Back returns to the check", ex.some(t => t.includes("isn’t “healthy”")) && !!(await run(`!!document.querySelector("#ingredients")`)),
    JSON.stringify(ex));
  await run(`(async () => { __btn("Close").click(); await __sleep(600); return true; })()`);
  check("Close returns to Scan", !!(await run(`!!(__btn("No barcode? Check ingredients") || __btn("Close camera"))`)));
  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1);
}

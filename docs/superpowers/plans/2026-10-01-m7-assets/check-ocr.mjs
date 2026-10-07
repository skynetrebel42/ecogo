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
  const ocr = [...bytes].filter(([u]) => u?.includes("/tesseract/"));
  const kb = Math.round(ocr.reduce((s, [, n]) => s + n, 0) / 1024);
  check("the reader comes from EcoGo's own site, never a CDN", ocr.length >= 3 && !requests.some(u => /jsdelivr|unpkg|cdnjs/.test(u)),
    `first use: ${kb} KB over ${ocr.length} files (${ocr.map(([u, n]) => `${u.split("/").pop()} ${Math.round(n / 1024)} KB`).join(", ")})`);

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

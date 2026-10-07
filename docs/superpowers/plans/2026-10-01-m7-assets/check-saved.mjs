// M14 Collections (headless Edge, same CDP setup as check-home): spec docs/superpowers/specs/2026-10-07-m14-collections-design.md.
// Save a catalog product and a looked-up one, reload, both still saved; the looked-up snapshot's size is printed.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-saved.mjs <url> [shotDir]
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const SHOTS = process.argv[3];
const PORT = 9600 + Math.floor(Math.random() * 90);
const PROFILE = `${process.env.TEMP}\\ecogo-saved-${PORT}`;
rmSync(PROFILE, { recursive: true, force: true });
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=375,812",
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
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s || b.getAttribute("aria-label") === s);
    window.__guest = async () => { const b = await __until(() => __btn("Look around first") || __btn("Home")); if (b?.innerText.includes("Look around first")) { b.click(); await __sleep(400); } };
    window.__store = () => JSON.parse(localStorage.getItem("ecogo.saved.v1") || "null"); true`);
  const click = s => run(`(async () => { const b = await __until(() => __btn(${JSON.stringify(s)}), 5000); b?.click(); await __sleep(400); return !!b; })()`);
  const key = async (k, code = k) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: k === "Escape" ? 27 : 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: k === "Escape" ? 27 : 13 });
  };
  const back = () => run(`(async () => { document.querySelector("button svg.lucide-arrow-left")?.closest("button").click(); await __sleep(400); })()`);
  const home = () => click("Home");
  const scanTyped = (code, text) => run(`(async () => {
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click();
    await __until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.querySelector("h1")?.innerText.includes(${JSON.stringify(text)}), 15000);
    await __sleep(600); return document.querySelector("h1")?.innerText; })()`);
  const favorites = () => run(`(async () => { __btn("Saved").click(); await __sleep(500); return document.body.innerText; })()`);

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  await run(`__guest()`); await sleep(500);

  // Part 1: a catalog product (Oreo Original, from search) and a looked-up one (Tostitos, by barcode) survive a reload.
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await send("Input.insertText", { text: "oreo" }); await key("Enter");
  await run(`(async () => { (await __until(() => [...document.querySelectorAll("button")].find(b => b.innerText.includes("Oreo Original"))))?.click(); await __sleep(600); })()`);
  const coke = await run(`document.querySelector("h1")?.innerText`);
  await click("Save"); await key("Escape");
  await back(); await back(); // product → search → home
  const tos = await scanTyped("028400064057", "Tostitos");
  await click("Save"); await key("Escape");
  await back(); await home();
  const store = await run(`__store()`);
  const snap = store?.items?.find(i => i.id < 0);
  const cat = store?.items?.find(i => i.id > 0);
  check("catalog product stored by id, looked-up one with a snapshot", store?.items?.length === 2 && !!snap?.product && !!cat && !cat.product,
    JSON.stringify(store?.items?.map(i => i.id)));
  if (snap) console.log(`INFO  one looked-up snapshot: ${new TextEncoder().encode(JSON.stringify(snap)).length} bytes`);

  await send("Page.reload"); await sleep(4000); await helpers(); await run(`__guest()`); await sleep(500);
  const fav = await favorites();
  check("after a reload both are still in Saved", !!coke && !!tos && fav.includes(coke) && fav.includes(tos), `${coke} / ${tos}`);

  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1);
}

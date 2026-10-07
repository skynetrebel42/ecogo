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
    // Enter needs its "\r" text, or a form's implicit submit doesn't fire.
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: k === "Escape" ? 27 : 13, ...(k === "Enter" ? { text: "\r" } : {}) });
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
  // The spec's 3 views at 375×812, 1x, only when a folder is given.
  const shot = async name => { if (!SHOTS) return; await sleep(300);
    const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.result.data, "base64")); };
  const favorites = () => run(`(async () => { __btn("Saved").click(); await __sleep(500); return document.body.innerText; })()`);

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.bringToFront");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
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

  // Part 2: the save sheet (open Oreo again: it's saved, so unsave first, then save to open the sheet).
  await click("Home");
  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await send("Input.insertText", { text: "oreo" }); await key("Enter");
  await run(`(async () => { (await __until(() => [...document.querySelectorAll("button")].find(b => b.innerText.includes("Oreo Original"))))?.click(); await __sleep(600); })()`);
  await click("Remove from saved");
  const note = await run(`document.querySelector('[role="status"]')?.innerText ?? ""`);
  check("filled bookmark unsaves, with a 'Removed · Undo' note", note.includes("Removed") && note.includes("Undo") && !(await run(`__store().items.some(i => i.id > 0)`)), note);
  await click("Undo");
  check("Undo puts it back", await run(`__store().items.some(i => i.id > 0) && !!__btn("Remove from saved")`));
  await click("Remove from saved"); await click("Save");
  const dlg = await run(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null;
    return { modal: d.getAttribute("aria-modal"), title: document.getElementById(d.getAttribute("aria-labelledby"))?.innerText,
      focusIn: d.contains(document.activeElement), chips: [...d.querySelectorAll("button[aria-pressed]")].map(b => b.innerText) }; })()`);
  check("save opens the sheet: modal dialog titled Saved, focus inside, preset chips", dlg?.modal === "true" && dlg.title.trim() === "Saved" && dlg.focusIn
    && JSON.stringify(dlg.chips) === '["Breakfast","Lunch","Dinner","Dessert","Snacks"]', JSON.stringify(dlg));
  await run(`__btn("Snacks").focus(); true`); await click("Snacks"); // a scripted click doesn't focus; a tap does
  const snacks = await run(`(() => { const b = [...document.querySelectorAll('[role="dialog"] button[aria-pressed]')]; return b.map(x => x.innerText + ":" + x.getAttribute("aria-pressed")); })()`);
  check("the Snacks chip creates the list with this product; no chip moves, Snacks is pressed and keeps focus",
    JSON.stringify(snacks) === '["Breakfast:false","Lunch:false","Dinner:false","Dessert:false","Snacks:true"]'
    && await run(`document.activeElement?.innerText === "Snacks"`), JSON.stringify(snacks));
  await shot("1-save-sheet");
  await click("New list");
  await send("Input.insertText", { text: "Road trip" }); await key("Enter");
  const chips2 = await run(`[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].map(x => x.innerText)`);
  check("a new list goes last, just before + New list; focus stays in the sheet", JSON.stringify(chips2) === '["Breakfast","Lunch","Dinner","Dessert","Snacks","Road trip"]'
    && await run(`document.querySelector('[role="dialog"]').contains(document.activeElement)`)
    && await run(`(() => { const b = [...document.querySelectorAll('[role="dialog"] .flex-wrap button')]; return b.at(-1).innerText.trim() === "New list"; })()`), JSON.stringify(chips2));
  await click("Road trip"); // take Oreo back out: Road trip stays as an empty list the user named
  await click("New list");
  await send("Input.insertText", { text: "snacks" }); await key("Enter");
  const err = await run(`document.querySelector('[role="alert"]')?.innerText ?? ""`);
  check("a duplicate name shows an inline error", err.includes("already have a list"), err);
  await key("Escape");
  check("Escape closes the sheet and focus returns to the bookmark", await run(`!document.querySelector('[role="dialog"]') && document.activeElement?.getAttribute("aria-label") === "Remove from saved"`));
  await back(); await back();
  await send("Page.reload"); await sleep(4000); await helpers(); await run(`__guest()`); await sleep(500);
  const st = await run(`__store()`);
  check("after a reload, Snacks still holds 1 product", st?.lists?.length === 2 && st.lists[0].name === "Snacks" && st.lists[0].ids.length === 1 && st.lists[1].ids.length === 0, JSON.stringify(st?.lists));

  // Part 3: Saved › Favorites shows folders; a list screen renames, removes, deletes with Undo.
  const rows = () => run(`[...document.querySelectorAll("button[aria-label]")].map(b => b.getAttribute("aria-label")).filter(l => /, \\d+ products?$/.test(l))`);
  await favorites();
  const r1 = await rows();
  check("with lists, Favorites shows All saved then each list with its count", JSON.stringify(r1) === '["All saved, 2 products","Snacks, 1 product","Road trip, 0 products"]', JSON.stringify(r1));
  await shot("2-saved-with-lists");
  await click("Snacks, 1 product");
  const oreoX = await run(`[...document.querySelectorAll("button[aria-label]")].map(b => b.getAttribute("aria-label")).find(l => l.startsWith("Remove Oreo"))`);
  check("a list screen: its name and a labelled × per product", (await run(`document.querySelector("h1")?.innerText`)) === "Snacks" && /^Remove Oreo Original.* from Snacks$/.test(oreoX ?? ""), oreoX);
  await shot("3-list-screen");
  await click("Snacks options"); await click("Rename");
  await run(`(() => { const i = document.querySelector('input[aria-label="List name"]'); i.select(); return true; })()`);
  await send("Input.insertText", { text: "Movie night" }); await key("Enter");
  check("Rename changes the list's name", (await run(`document.querySelector("h1")?.innerText`)) === "Movie night");
  await click(oreoX.replace("Snacks", "Movie night"));
  check("× removes the product from the list but keeps it saved", (await run(`document.body.innerText`)).includes("Nothing in this list yet")
    && await run(`__store().items.length === 2`));
  await back();
  await click("Road trip, 0 products"); await click("Road trip options"); await click("Delete");
  const del = await run(`({ note: document.querySelector('[role="status"]')?.innerText ?? "", rows: [...document.querySelectorAll("button[aria-label]")].map(b => b.getAttribute("aria-label")).filter(l => /, \\d+ products?$/.test(l)) })`);
  check("Delete returns to Saved with a 'Deleted · Undo' note", del.note.includes("Deleted") && !del.rows.some(r => r.startsWith("Road trip")), JSON.stringify(del));
  await click("Undo");
  check("Undo brings the list back", JSON.stringify(await rows()) === '["All saved, 2 products","Movie night, 0 products","Road trip, 0 products"]', JSON.stringify(await rows()));
  await click("All saved, 2 products");
  check("All saved has no menu and no ×", await run(`document.querySelector("h1")?.innerText === "All saved" && ![...document.querySelectorAll("button[aria-label]")].some(b => /^Remove |options$/.test(b.getAttribute("aria-label")))`));

  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1);
}

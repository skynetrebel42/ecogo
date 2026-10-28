// 071 Round 2 F (headless Edge, spec docs/superpowers/specs/2026-10-28-label-reader-v3-071-design.md): a label photo
// taken sideways (Coppertone's Drug Facts) reads like the upright one. The label is drawn in the page (no photo of
// Minh's is used): upright, turned a quarter clockwise and counter-clockwise; each is picked as a photo on Check
// ingredients (Personal care) and read by the stronger reader. Its Drug Facts layout also shows 071 M in the browser:
// the active line and the inactive list are both kept. New photo checks go here: check-ocr is near its 180 s budget.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-label.mjs <url>
import { startEdge } from "./edge.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const URL_ = process.argv[2];
const { PORT, closeAndCheck } = startEdge("label", 9800, "375,812", 120000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
let ok = 0, total = 0;
const check = (name, pass, detail = "") => { total++; if (pass) ok++; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const LINES = ["Drug Facts", "Active ingredient", "Zinc pyrithione 1%", "Purpose", "Antidandruff", "Warnings", "For external use only",
  "Inactive ingredients: water, sodium laureth", "sulfate, formaldehyde, fragrance"];
const LIST = "Zinc pyrithione 1%, water, sodium laureth sulfate, formaldehyde, fragrance";
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
  await send("Page.bringToFront");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await run(`window.__sleep = ms => new Promise(r => setTimeout(r, ms));
    window.__until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 100) { const v = fn(); if (v) return v; await __sleep(100); } return null; };
    window.__btn = s => [...document.querySelectorAll("button")].find(b => b.innerText.trim() === s || b.getAttribute("aria-label") === s); true`);
  await run(`(async () => { const b = await __until(() => __btn("Look around first") || __btn("Scan")); if (b.innerText.includes("Look around first")) { b.click(); await __sleep(400); }
    __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); (await __until(() => __btn("Check ingredients"))).click(); await __sleep(500); return true; })()`);

  // The label as PNGs drawn in the page: upright, a quarter clockwise, a quarter counter-clockwise.
  const pngs = JSON.parse(await run(`(async () => {
    const lines = ${JSON.stringify(LINES)};
    const up = document.createElement("canvas"); up.width = 760; up.height = 40 + lines.length * 46;
    const g = up.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, up.width, up.height); g.fillStyle = "#111"; g.font = "bold 30px Arial";
    lines.forEach((l, i) => g.fillText(l, 24, 46 + i * 46));
    const turn = way => { const c = document.createElement("canvas"); c.width = up.height; c.height = up.width; const x = c.getContext("2d");
      x.translate(c.width / 2, c.height / 2); x.rotate(way * Math.PI / 2); x.drawImage(up, -up.width / 2, -up.height / 2); return c; };
    return JSON.stringify([up, turn(1), turn(-1)].map(c => c.toDataURL("image/png").split(",")[1])); })()`));
  const dir = mkdtempSync(join(tmpdir(), "ecogo-label-"));
  const files = ["upright", "clockwise", "counter-clockwise"].map((name, i) => { const f = join(dir, `${name}.png`); writeFileSync(f, Buffer.from(pngs[i], "base64")); return f; });

  const reads = [];
  for (const [i, file] of files.entries()) {
    if (i) await run(`(async () => { __btn("Check another").click(); await __sleep(400); return true; })()`);
    await run(`(async () => { __btn("Personal care").click(); await __sleep(300); return true; })()`);
    const { root } = (await send("DOM.getDocument")).result;
    const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[data-photo="library"]' })).result;
    const t = Date.now();
    await send("DOM.setFileInputFiles", { nodeId, files: [file] });
    // Ends on the text read, or on a read too poor to fill the box (hard to read, couldn't read).
    const box = await run(`(async () => { await __until(() => document.querySelector("#ingredients")?.value
      || /This photo is hard to read|Couldn't read it/.test(document.body.innerText), 60000); return document.querySelector("#ingredients")?.value; })()`);
    reads.push({ box, ms: Date.now() - t, badge: (await run(`document.querySelector('[role="status"]')?.innerText ?? ""`)).split("\n")[0] });
  }
  const [up, cw, ccw] = reads;
  console.log(`      reads: ${reads.map(r => `${Math.round(r.ms / 100) / 10} s`).join(", ")} (upright, clockwise, counter-clockwise)`);
  check("071 M: the upright Drug Facts label keeps its active line and its inactive list", up.box === LIST, up.box ?? "nothing read");
  check("…and formaldehyde (IARC Group 1) makes it a known carcinogen", up.badge.startsWith("Known carcinogen"), up.badge);
  check("071 F: turned a quarter clockwise, it reads like the upright one", cw.box === up.box && cw.badge === up.badge, `${cw.box} | ${cw.badge}`);
  check("071 F: turned a quarter counter-clockwise, it reads like the upright one", ccw.box === up.box && ccw.badge === up.badge, `${ccw.box} | ${ccw.badge}`);
  check("no console errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("the check script ran to the end", false, String(e?.stack ?? e).slice(0, 400));
} finally {
  await closeAndCheck(check);
  console.log(`${ok}/${total} checks passed`);
  process.exit(total > 0 && ok === total ? 0 : 1);
}

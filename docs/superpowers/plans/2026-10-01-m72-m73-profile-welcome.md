# M7.2 + M7.3 Profile and Welcome Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last invented content outside the Map is gone. Profile shows only true things (your data on this
device, where results come from, privacy). The first launch shows one honest welcome screen, once per device.

**Architecture:** two `App.tsx` changes, each replacing one component with a tested block below, plus small wiring
edits. No new files, no new dependencies, no database changes. M7's headless check (`check-home.mjs`) is extended to
cover both.

**Tech Stack:** React 18 + Vite 6, Node `node --test` (156 tests, unchanged: there's no new pure logic).

**Specs:** read both first.
- `docs/superpowers/specs/2026-10-01-m72-profile-cleanup-design.md` (layout A; mockup
  https://claude.ai/artifact/CMxtUdUwwMsP1LnD9Pr2Nk, left artboard).
- `docs/superpowers/specs/2026-10-01-m73-welcome-cleanup-design.md`.

**How this plan was checked:** every block below was applied to a clean copy of `main` (`668b21f`, M7 + M7.1 built)
on 2026-10-01. `npm test` passed 156/156, `vite build` succeeded, and the extended `check-home.mjs` passed **24/24**
against `vite preview`, including:
- the welcome shows "Know what's in your food" with no Sign In, prices or Amazon/Walmart, and doesn't show after a
  reload;
- Profile has no "Alex", "Level 4", stats, achievements or dead settings; it shows "2 products, saved in this browser
  only", the sources and privacy sections, and a GitHub link with `target="_blank"`;
- after Clear on Home, Profile says "Nothing scanned yet";
- all 18 earlier M7/M7.1 checks still pass.

The very first run after starting Edge once printed only `TIMEOUT` (a cold start); the rerun passed. If that happens,
run it again before investigating.

## Global Constraints

- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Line endings:** repo files have CRLF. Use one-line `old_string`s or the exact blocks below.
- **Facts:** Profile and the welcome say only what the specs say. Don't claim "no tracking" or "no cookies".
- **Out of scope:** the Map's demo places, accounts, real prices, favorites persistence (K-16).
- **Commits:** commit per task on `main`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Ask the owner before any push: it redeploys the live site.
- **Fixes log:** any fix found during review that isn't in this plan gets an entry in `FIXES_AND_UPDATES.md`.
- **Suite:** `npm test` and `npm run build` stay green after every task.

## Review Focus

1. **Nothing invented left** on Profile or the welcome. Pinned by `check-home.mjs` ("Profile has no invented
   content", "welcome is honest").
2. **Blocked storage** must not trap anyone on the welcome screen: `wasWelcomed`/`markWelcomed` wrap `localStorage` in
   `try/catch`, so the worst case is seeing the welcome again.
3. **Privacy wording** must stay true: barcodes and search words do go to USDA and Open Food Facts; the catalog loads
   from Supabase.

---

## File structure

| File | Change |
|---|---|
| `src/app/App.tsx` | New `ProfileTab` and `WelcomeScreen`; onboarding removed; welcome-once state; unused icons removed |
| `docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs` | Replaced: + welcome and Profile checks (24 in all) |
| Docs | `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, both specs' status |

---

### Task 1: Profile shows only true things (M7.2)

**Files:** modify `src/app/App.tsx`.

- [ ] **Step 1: Replace `ProfileTab`.** Replace everything from `// ── Profile Tab ──…` down to (not including)
  `// ── Bottom Nav ──…` with:
```tsx
// ── Profile Tab ───────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m72-profile-cleanup-design.md (layout A). Only true things; no account yet.
const SOURCES_INFO = [
  { name: "USDA FoodData Central", text: "Label data supplied by the makers. Checked first." },
  { name: "Open Food Facts", text: "Crowd-sourced, used when USDA has no match, and always marked." },
  { name: "IARC, EU, FDA, EFSA, WHO", text: "The official findings behind every badge, each linked on the product page." },
  { name: "FDA % Daily Value", text: "Sugar, saturated fat and salt per serving, by the FDA's 5/20 rule." },
];

function ProfileTab({ recentCount, onClearRecent }: { recentCount: number; onClearRecent: () => void }) {
  const card = "bg-card border border-border rounded-2xl p-3.5 space-y-2.5";
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-3.5" style={{ scrollbarWidth: "none" }}>
      <div>
        <h1 className="text-xl font-extrabold leading-tight text-primary">Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">No account yet. What you do stays on this device.</p>
      </div>

      <section className={card}>
        <h2 className="font-bold text-base">Your data</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Recently scanned</p>
            <p className="text-xs text-muted-foreground">
              {recentCount === 0 ? "Nothing scanned yet" : `${recentCount} product${recentCount === 1 ? "" : "s"}, saved in this browser only`}
            </p>
          </div>
          {recentCount > 0 && (
            <button onClick={onClearRecent} aria-label="Clear recently scanned"
              className="px-3.5 rounded-xl border border-border text-xs font-bold flex-shrink-0" style={{ minHeight: 44 }}>Clear</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">Favorites are kept until you close EcoGo. Saving them for good comes with accounts.</p>
      </section>

      <section className={card}>
        <h2 className="font-bold text-base">Where results come from</h2>
        {SOURCES_INFO.map(s => (
          <div key={s.name}>
            <p className="text-sm font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
          </div>
        ))}
      </section>

      <section className={card}>
        <h2 className="font-bold text-base">Privacy</h2>
        <p className="text-xs text-foreground/80 leading-relaxed">The camera reads barcodes on your phone. No images are uploaded.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">To find a product, its barcode or search words are sent to USDA or Open Food Facts.</p>
        <p className="text-xs text-foreground/80 leading-relaxed">The product catalog loads from EcoGo's database. Your recently scanned list stays in this browser.</p>
      </section>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        A student project. Not medical advice.{" "}
        <a href="https://github.com/skynetrebel42/ecogo" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">Source code and updates</a>
      </p>
    </div>
  );
}
```
- [ ] **Step 2: Wire it.** Replace `{activeTab === "profile" && <ProfileTab />}` with:
```tsx
{activeTab === "profile" && <ProfileTab recentCount={recentProducts.length} onClearRecent={() => setRecent([])} />}
```
- [ ] **Step 3: Run.** `npm test` (156 pass) and `npm run build` (success).
- [ ] **Step 4: Commit.**
```bash
git add src/app/App.tsx
git commit -m "Profile: only true things (your data, sources, privacy); fake user, stats, badges and dead buttons removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One honest welcome screen, shown once (M7.3)

**Files:** modify `src/app/App.tsx`.

- [ ] **Step 1: Replace the welcome and onboarding screens.** Replace everything from `// ── Welcome Screen ──…`
  down to (not including) `// ── Product Card (mini) ──…` (this removes `OnboardingScreen` too) with:
```tsx
// ── Welcome Screen ────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m73-welcome-cleanup-design.md. Shown once per device; promises only what
// EcoGo does today.
const WELCOMED_KEY = "ecogo.welcomed.v1";
const wasWelcomed = () => { try { return localStorage.getItem(WELCOMED_KEY) === "1"; } catch { return false; } };
const markWelcomed = () => { try { localStorage.setItem(WELCOMED_KEY, "1"); } catch { /* shows again next visit */ } };

function WelcomeScreen({ onScan, onLookAround }: { onScan: () => void; onLookAround: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#1A5C39" }}>
      <StatusBar light />
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10" style={{ background: "white", transform: "translate(-30%, 30%)" }} />
        <svg viewBox="0 0 280 240" className="w-72" aria-hidden="true">
          <circle cx="140" cy="115" r="105" fill="rgba(255,255,255,0.08)" />
          <circle cx="140" cy="115" r="75" fill="rgba(255,255,255,0.06)" />
          <rect x="90" y="95" width="100" height="90" rx="14" fill="white" opacity="0.95" />
          <path d="M112 95 Q112 72 140 72 Q168 72 168 95" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.95" />
          <rect x="105" y="122" width="70" height="5" rx="2.5" fill="#1A5C39" opacity="0.3" />
          <rect x="105" y="133" width="50" height="5" rx="2.5" fill="#1A5C39" opacity="0.2" />
          <rect x="105" y="144" width="60" height="5" rx="2.5" fill="#1A5C39" opacity="0.2" />
          <ellipse cx="72" cy="88" rx="18" ry="26" fill="#34D399" opacity="0.8" transform="rotate(-28 72 88)" />
          <ellipse cx="72" cy="78" rx="8" ry="4" fill="#6EE7B7" opacity="0.5" transform="rotate(-28 72 78)" />
          <ellipse cx="210" cy="100" rx="15" ry="22" fill="#6EE7B7" opacity="0.65" transform="rotate(22 210 100)" />
          <circle cx="60" cy="145" r="6" fill="#10B981" opacity="0.7" />
          <circle cx="220" cy="75" r="5" fill="#34D399" opacity="0.6" />
          <circle cx="205" cy="155" r="4" fill="#6EE7B7" opacity="0.5" />
        </svg>
      </div>
      <div className="bg-background rounded-t-[36px] px-6 pt-7 pb-10 flex-shrink-0">
        <h1 className="text-[26px] font-extrabold text-foreground leading-tight text-center mb-2">
          Know what's in your food
        </h1>
        <p className="text-muted-foreground text-sm text-center mb-7 leading-relaxed">
          Scan a barcode. See official health findings, with sources.
        </p>
        <button onClick={onScan} className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base mb-3 shadow-lg active:scale-98 transition-transform">
          Start scanning
        </button>
        <button onClick={onLookAround} className="w-full text-muted-foreground text-sm py-3">
          Look around first
        </button>
      </div>
    </div>
  );
}
```
- [ ] **Step 2: Delete `ONBOARDING`.** Delete the whole `const ONBOARDING = [ … ];` block (5 lines, from `const ONBOARDING = [` to its
  closing `];`).
- [ ] **Step 3: App state.**
  - `type AppState = "welcome" | "onboarding" | "main";` → `type AppState = "welcome" | "main";`
  - Replace the two lines `const [appState, setAppState] = useState<AppState>("welcome");` and
    `const [onbSlide, setOnbSlide] = useState(0);` with:
```tsx
  const [appState, setAppState] = useState<AppState>(() => wasWelcomed() ? "main" : "welcome");
```
- [ ] **Step 4: Render.** Replace everything from `{/* Welcome */}` down to (not including) `{/* Main app */}` with:
```tsx
        {/* Welcome: first visit on this device only */}
        {appState === "welcome" && (
          <WelcomeScreen
            onScan={() => { markWelcomed(); setActiveTab("scan"); setAppState("main"); }}
            onLookAround={() => { markWelcomed(); setAppState("main"); }}
          />
        )}

```
- [ ] **Step 5: Imports.** The `lucide-react` import becomes:
```tsx
import {
  Home, Map, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Bookmark, Package, Shirt, Bike, Building2, Wifi, Utensils, Plus, QrCode
} from "lucide-react";
```
  (Removed: `Shield`, `DollarSign`, `Star`, `Leaf`, `Bell`, `Moon`, `Award`, `Settings`, all used only by the deleted
  code.)
- [ ] **Step 6: Check nothing is left.** Run:
```bash
grep -n "onboarding\|OnboardingScreen\|onbSlide\|Alex\|Sign In\|Save Money\|STATS\|BADGES" src/app/App.tsx
```
  Expected: no output.
- [ ] **Step 7: Run.** `npm test` (156 pass) and `npm run build` (success).
- [ ] **Step 8: Commit.**
```bash
git add src/app/App.tsx
git commit -m "Welcome: one honest screen, shown once per device; onboarding slides, Sign In and price promises removed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Browser check

- [ ] **Step 1: Replace** `docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs` with:
```js
// M7 (headless Edge): Home has no fake content; first visit shows "How EcoGo checks"; Scan card opens Scan;
// Oreo (search) then Diet Coke (typed barcode) appear newest first; survives reload; Clear; explainers; Saved › Scanned.
// M7.1: Home lists 5 explainer cards (M7's two first); seed oils, pesticides and ultra-processed open with sources;
// the pesticides page's "What the badge levels mean" link opens it and Back returns.
// M7.2/M7.3: the welcome screen is honest and shows once per device; Profile shows only true things.
// Usage: node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs <url>  (M7 plan Task 4; M7.1)
import { spawn } from "node:child_process";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const URL_ = process.argv[2];
const PORT = 9600 + Math.floor(Math.random() * 90);
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=900,1000",
  `--user-data-dir=${process.env.TEMP}\\ecogo-home-${PORT}`, "about:blank"], { stdio: "ignore" });
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
  const recentNames = () => run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Recently scanned");
    return h ? [...h.parentElement.nextElementSibling.querySelectorAll("button")].map(b => b.innerText.split("\\n")[0]) : null; })()`);

  await send("Runtime.enable");
  await send("Page.navigate", { url: URL_ });
  await sleep(4000);
  await helpers();
  const w = await run(`(async () => { await __until(() => __btn("Look around first")); return document.body.innerText; })()`);
  check("welcome is honest: what EcoGo does, no fake promises", w.includes("Know what's in your food") && w.includes("Start scanning")
    && !/Sign In|Save Money|better prices|Best Price|Amazon|Walmart|Get Started/i.test(w));
  await run(`__guest()`); await sleep(800);

  const t = await run(`document.body.innerText`);
  check("Home has no invented content", !/Alex|Chicago|Rating|Why Recommended|Deals|Nearby Resources/i.test(t));
  const h = new Date().getHours(), g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  check("greeting matches the time", t.includes(g) && t.includes("What are you eating?"), g);
  check("first visit shows How EcoGo checks a product", t.includes("How EcoGo checks a product") && !t.includes("Recently scanned"));

  await run(`__btn("Scan a product").click(); true`); await sleep(600);
  check("Scan card opens the Scan tab", !!(await run(`(async () => !!(await __until(() => __btn("Close camera") || document.querySelector('input[aria-label="Barcode number"]'), 5000)))()`)));
  await home();

  await run(`document.querySelector('input[placeholder^="Search products"]').focus(); true`);
  await type("oreo"); await sleep(800);
  await run(`(async () => { (await __until(() => __btn("Oreo Original"))).click(); await __sleep(600); })()`);
  await back(); await back(); // product → search → home
  await run(`(async () => { __btn("Scan").click(); await __until(() => document.querySelector('input[aria-label="Barcode number"]') || __btn("Close camera"));
    __btn("Close camera")?.click(); await __sleep(800); const i = await __until(() => document.querySelector('input[aria-label="Barcode number"]'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "049000042566");
    i.dispatchEvent(new Event("input", { bubbles: true })); await __sleep(200); __btn("Look up").click(); })()`);
  await run(`__until(() => !document.querySelector('input[aria-label="Barcode number"]') && document.body.innerText.includes("Coca-Cola Zero"), 15000)`); await sleep(500);
  await back(); await home();
  let names = await recentNames();
  check("Recently scanned: Coke Zero then Oreo, newest first", names?.[0]?.includes("Coca-Cola Zero") && names?.[1]?.includes("Oreo"), JSON.stringify(names));
  const badge = await run(`[...document.querySelectorAll("h2")].find(e => e.innerText === "Recently scanned").parentElement.nextElementSibling.innerText`);
  check("…with badges", /Nothing flagged|concern|carcinogen/.test(badge), badge.replace(/\n/g, " / "));

  await send("Page.reload"); await sleep(4000); await helpers();
  check("welcome doesn't show again on this device", (await run(`__guest()`)) === false); await sleep(800);
  names = await recentNames();
  check("a reload keeps them", names?.length === 2, JSON.stringify(names));

  await run(`(async () => { __btn("See all").click(); await __sleep(500); })()`);
  const saved = await run(`document.body.innerText`);
  check("See all → Saved › Scanned shows the same list", saved.includes("Coca-Cola Zero") && saved.includes("Oreo") && !saved.includes("No scanned products"));
  await home();

  for (const title of ["isn’t “healthy”", "What the badge levels mean"]) {
    await run(`(async () => { __btn(${JSON.stringify(title)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
    await back();
  }

  // M7.1: five cards, M7's two first, then seed oils, pesticides, ultra-processed (spec E1)
  const cards = await run(`(() => { const h = [...document.querySelectorAll("h2")].find(e => e.innerText === "Hidden risks, explained");
    return h ? [...h.nextElementSibling.querySelectorAll("button")].map(b => b.innerText.split("\\n")[0]) : []; })()`);
  check("Home lists 5 explainer cards, in order", cards.length === 5 && /isn’t “healthy”/.test(cards[0]) && /badge levels/.test(cards[1])
    && /^Seed oils/.test(cards[2]) && /^Pesticides/.test(cards[3]) && /^Ultra-processed/.test(cards[4]), JSON.stringify(cards));
  for (const title of ["Seed oils: what the evidence says", "Pesticides: what a label", "Ultra-processed foods: no official line yet"]) {
    await run(`(async () => { __btn(${JSON.stringify(title)}).click(); await __sleep(500); })()`);
    const e = await run(`document.body.innerText`);
    check(`M7.1 explainer opens with sources: ${title}`, e.includes("Sources") && e.includes("Source checked") && e.includes(title));
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

  // M7.2: Profile shows only true things
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  const p = await run(`document.body.innerText`);
  check("Profile has no invented content", !/Alex|Level 4|Money Saved|CO₂|Ethical Purchases|Achievements|Notifications|Dark Mode/i.test(p));
  check("Profile: your data, sources and privacy", p.includes("2 products, saved in this browser only") && p.includes("Where results come from") && p.includes("Privacy"));
  const gh = await run(`(() => { const a = [...document.querySelectorAll("a")].find(a => a.innerText.includes("Source code")); return a ? a.href + " " + a.target : null; })()`);
  check("Profile: source-code link opens GitHub in a new tab", gh === "https://github.com/skynetrebel42/ecogo _blank", gh);
  await home();

  await run(`(async () => { __btn("Clear recently scanned").click(); await __sleep(400); })()`);
  const after = await run(`document.body.innerText`);
  check("Clear empties the list", after.includes("How EcoGo checks a product") && !after.includes("Recently scanned"));
  await run(`(async () => { __btn("Profile").click(); await __sleep(500); })()`);
  check("…and Profile says Nothing scanned yet", (await run(`document.body.innerText`)).includes("Nothing scanned yet"));
  check("no console errors", errors.length === 0, errors.join(" | "));
} finally {
  console.log(`${ok}/${total} checks passed`);
  edge.kill();
  process.exit(total > 0 && ok === total ? 0 : 1); // the open DevTools socket would otherwise keep Node alive until the 120 s timeout
}
```
- [ ] **Step 2: Serve and run.** `npm run build`, then `npx vite preview --port 4317 --strictPort` in the background,
  then `node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs http://localhost:4317/`. Expected:
  `24/24 checks passed`.
- [ ] **Step 3: Look at it** at phone width: the welcome (clear site data first to see it again) and Profile against
  mockup A.
- [ ] **Step 4: Stop the preview server** (check that port 4317 is free afterwards; an orphaned `vite preview` has
  been left behind before).
- [ ] **Step 5: Commit.**
```bash
git add docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs
git commit -m "check-home: welcome and Profile checks (24)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs, push (ask first), then the owner's check

- [ ] **Step 1: Docs.**
  - **`KNOWN_ISSUES.md`:** Roadmap "M7.2 ✅" (Profile) and "M7.3 ✅" (welcome). Next: accounts and the real map. Note
    that the Map's demo places are now the only invented content left.
  - **`ARCHITECTURE.md`:** the feature inventory: Profile → your data, sources, privacy; the welcome → one screen,
    once per device (`ecogo.welcomed.v1`).
  - **`PROJECT_HANDOFF.md`:** decision log
    `| 024 | No invented content outside the Map: Profile and the welcome say only what EcoGo does today | Owner, 2026-10-01 | **Done** (M7.2, M7.3) |`.
  - **`SYNOPSIS.md`** and both specs' status → "Done".
- [ ] **Step 2: Commit.** Run `npm test`, then:
```bash
git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-10-01-m72-profile-cleanup-design.md docs/superpowers/specs/2026-10-01-m73-welcome-cleanup-design.md
git commit -m "Docs: M7.2 + M7.3 done (Profile, welcome)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 3: Push (ask first).** Ask the owner: "Push to GitHub? This updates the live site." On a yes, push and
  confirm the Actions run succeeds.
- [ ] **Step 4: The owner's check** (about 1 minute on https://skynetrebel42.github.io/ecogo/):
  1. Open the site in a private window: one welcome screen, "Know what's in your food", no Sign In.
  2. Tap "Start scanning": the Scan tab opens. Reload: no welcome this time.
  3. Open Profile: no made-up name, stats or badges. Check it shows your recent products count and tap the GitHub
     link.
  4. Reply with anything that looks off, and which phone and browser it was.

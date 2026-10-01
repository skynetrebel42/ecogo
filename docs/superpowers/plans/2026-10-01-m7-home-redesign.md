# M7 Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home shows only real things: a time-based greeting, a big Scan card, search, the products you recently
opened (real badges and nutrition chips), and two sourced explainers. Every invented place, score, deal and resource is
gone from Home, and Saved › Scanned uses the same recent list instead of its fake seed.

**Architecture:**
- **Pure logic** (`src/lib/recent.ts`: add, resolve, parse) is tested in Node. A thin `loadRecent`/`saveRecent` wrapper
  around `localStorage["ecogo.recent.v1"]` never throws.
- **`App.tsx`** holds `recent` in state, adds to it in `openProduct` (the one place every product page opens from), and
  passes resolved products to Home and Saved.
- **`Explainer.tsx`** is a sub-screen with plain text and a Sources list built from sources already in the code (FDA
  rule, `foodConcerns.ts`) plus one new WHO quote.

**Tech Stack:** React 18 + Vite 6, Node `node --test` (152 tests now, 156 after). No new dependencies, no database
changes.

**Spec:** `docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md`. Read it first. Mockup (layout A):
https://claude.ai/artifact/VVjduE8kRSBkUKimwFzEUf.

**How this plan was checked:** every code block below was applied to a clean copy of `main` (`e789c5a`) on
2026-10-01. The suite passed 156/156 and `vite build` succeeded. `check-home.mjs` (headless Edge against
`vite preview`) passed 12/12:
- no "Alex", "Chicago", "Rating", "Why Recommended", "Deals" or "Nearby Resources" on Home;
- the greeting matched the clock; the first visit showed "How EcoGo checks a product";
- the Scan card opened Scan;
- Oreo (search) then Coke Zero (typed barcode) showed as "Coca-Cola Zero Sugar · Some concern", then "Oreo · Nothing
  flagged · High sugar";
- a reload kept them, "See all" showed them in Saved › Scanned, and "Clear" emptied the list;
- both explainers opened with their sources; no console errors.

**Assets** in `docs/superpowers/plans/2026-10-01-m7-assets/`: `check-home.mjs` (the headless check above).

## Global Constraints

- **Writing files:** write code with the Write/Edit tools, never Bash heredocs (Windows collapses backslashes).
- **Line endings:** repo files have CRLF. Use one-line `old_string`s or the exact blocks below.
- **Facts:** the explainers say only what their sources say. Don't add claims, numbers or sources beyond this plan.
- **Privacy:** the recent list stays in this browser. Nothing is sent anywhere; no account.
- **Out of scope:** the Profile tab ("Alex Johnson", fake stats), the Map's demo resources, favorites persistence
  (K-16), and the M7.1 explainers (seed oils, pesticides, ultra-processed).
- **Commits:** commit per task on `main`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Ask the owner before any push: it redeploys the live site.
- **Fixes log:** any fix found during review that isn't in this plan gets an entry in `FIXES_AND_UPDATES.md`.
- **Suite:** `npm test` and `npm run build` stay green after every task.

## Review Focus

1. **Broken storage must not break the app** (private mode, full, corrupt JSON, old entries). Pinned by Task 1's
   `parseRecent` test; `loadRecent`/`saveRecent` wrap every storage call in `try/catch`.
2. **No invented content left on Home.** Pinned by Task 4's first check.
3. **Stale catalog data:** catalog products are stored by id and re-read from the current catalog, so a fixed
   ingredient list shows its new badge; a removed product drops out. Pinned by Task 1's `resolveRecent` test.
4. **Sources:** every quote shown is verbatim from its page. The FDA, IARC and acrylamide ones are reused from the code
   (already verified). The one new WHO quote was hand-checked (see Task 2).

## Deviations from the spec (decided while dry-running; tell the owner)

- **"Recently scanned" counts every product opened**, not only Scan and search: `openProduct` is the single place every
  product page opens from (Scan, search, USDA results, Saved, similar products), so the add lives there. This matches
  the spec's "looked at counts" default with no extra code paths.
- **The second "badge levels" quote is WHO's, not IARC's.** The spec's IARC sentence ("The IARC classifications
  describe the strength of the scientific evidence…") couldn't be read from the IARC PDF as text. The WHO Q&A page
  (the processed-meat source already in the code) says the same thing and was checked word for word on 2026-10-01:
  "The categories of the classification indicate the strength of the evidence as to whether a substance is capable of
  causing cancer".

---

## File structure

| File | Change |
|---|---|
| `src/lib/recent.ts` (new) + `recent.test.ts` (new) | `addRecent`, `resolveRecent`, `parseRecent`, `loadRecent`, `saveRecent` |
| `src/app/components/Explainer.tsx` (new) | The two explainer screens, `EXPLAINERS`, `ExplainerId` |
| `src/app/App.tsx` | Fakes removed; new `HomeTab`; `SavedTab` takes `scanned`; `recent` + explainer state |
| Docs | `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec status |

---

### Task 1: The recent-products store

**Files:** create `src/lib/recent.ts` and `src/lib/recent.test.ts`.

**Interfaces:**
- `RecentEntry = { id: number; barcode: string; product?: Product; at: number }`
- `addRecent(list, product, now): RecentEntry[]`, `resolveRecent(list, catalog): Product[]`,
  `parseRecent(raw: string | null): RecentEntry[]`, `loadRecent(): RecentEntry[]`, `saveRecent(list): void`

- [ ] **Step 1: Write the failing tests:** create `src/lib/recent.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addRecent, resolveRecent, parseRecent, RECENT_MAX, type RecentEntry } from "./recent.ts";
import type { Product } from "./productImporter.ts";

const prod = (id: number, name = `P${id}`): Product => ({ id, name, barcode: `000${Math.abs(id)}` } as Product);

test("addRecent puts the product first, removes its earlier entry, and caps at 10", () => {
  let list: RecentEntry[] = [];
  list = addRecent(list, prod(1), 1);
  list = addRecent(list, prod(2), 2);
  list = addRecent(list, prod(1), 3);
  assert.deepEqual(list.map(e => e.id), [1, 2]);
  assert.equal(list[0].at, 3);
  for (let i = 10; i < 30; i++) list = addRecent(list, prod(i), i);
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].id, 29);
});

test("catalog products are stored by id; looked-up products keep a snapshot", () => {
  const list = addRecent(addRecent([], prod(5), 1), prod(-7, "From USDA"), 2);
  assert.equal(list[1].product, undefined);
  assert.equal(list[0].product?.name, "From USDA");
});

test("resolveRecent re-reads catalog products, keeps snapshots, drops removed ones", () => {
  const list = addRecent(addRecent(addRecent([], prod(1), 1), prod(-2), 2), prod(99), 3);
  const catalog = [prod(1, "Fresh name")];
  assert.deepEqual(resolveRecent(list, catalog).map(p => p.name), ["P-2", "Fresh name"]);
});

test("parseRecent: missing or corrupt storage gives an empty list; malformed entries are skipped", () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent("{not json"), []);
  assert.deepEqual(parseRecent('{"id":1}'), []);
  const good = { id: 1, barcode: "0001", at: 1 };
  const snap = { id: -2, barcode: "0002", at: 2, product: prod(-2) };
  const raw = JSON.stringify([good, { id: "x" }, null, { id: -3, barcode: "3", at: 3, product: { id: -3 } }, snap]);
  assert.deepEqual(parseRecent(raw).map(e => e.id), [1, -2]);
});
```
- [ ] **Step 2: Run.** Run: `npm test`. Expected: FAIL with `Cannot find module …/recent.ts`.
- [ ] **Step 3: Implement:** create `src/lib/recent.ts`:
```ts
// recent.ts — "Recently scanned": the last 10 products opened, kept on this device only.
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.1.

import type { Product } from "./productImporter.ts";

export interface RecentEntry { id: number; barcode: string; product?: Product; at: number }

export const RECENT_KEY = "ecogo.recent.v1";
export const RECENT_MAX = 10;

/** Newest first, no duplicates, at most 10. Catalog products (id > 0) are stored by id only, so they stay fresh;
 *  looked-up ones (id < 0) keep a snapshot so they reopen without a request. */
export function addRecent(list: RecentEntry[], p: Product, now: number): RecentEntry[] {
  const entry: RecentEntry = { id: p.id, barcode: p.barcode, at: now, ...(p.id < 0 ? { product: p } : {}) };
  return [entry, ...list.filter(e => e.id !== p.id)].slice(0, RECENT_MAX);
}

/** Entries → products. A catalog id that's no longer in the catalog is dropped. */
export function resolveRecent(list: RecentEntry[], catalog: Product[]): Product[] {
  const byId = new Map(catalog.map(p => [p.id, p]));
  return list.flatMap(e => {
    const p = e.product ?? byId.get(e.id);
    return p ? [p] : [];
  });
}

const validProduct = (p: any) => p && typeof p.id === "number" && typeof p.name === "string" && typeof p.barcode === "string";

/** Stored JSON → entries. Corrupt JSON gives []; malformed entries (e.g. from an older version) are skipped. */
export function parseRecent(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(e => e && typeof e.id === "number" && typeof e.barcode === "string" && typeof e.at === "number"
      && (e.product === undefined || validProduct(e.product))).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

// Storage can be missing, blocked (private mode) or full: never let that break the app.
export function loadRecent(): RecentEntry[] {
  try { return parseRecent(localStorage.getItem(RECENT_KEY)); } catch { return []; }
}
export function saveRecent(list: RecentEntry[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* not saved; the list still works this visit */ }
}
```
- [ ] **Step 4: Run.** Run: `npm test`. Expected: 156 pass, 0 fail.
- [ ] **Step 5: Commit.**
```bash
git add src/lib/recent.ts src/lib/recent.test.ts
git commit -m "Recent products store (on this device, last 10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The explainer screens

**Files:** create `src/app/components/Explainer.tsx`.

**What's in it:** "“Nothing flagged” isn’t “healthy”" (FDA 5/20 rule, the Oreo example) and "What the badge levels
mean" (the four levels from M4's `deriveSeverity`, the 🔥 marker, and the key point that levels describe evidence
strength, not harm per serving). Sources are imported, not copied: `FDA_RULE`; `PROCESSED_MEAT.sources[2]` (IARC "this
does NOT mean that they are all equally dangerous") and `[0]` (WHO Group 1); `ACRYLAMIDE.sources[0]` (IARC 2A) and
`[4]` (FDA "golden yellow"). The one new source is `WHO_EVIDENCE` (see Deviations).

- [ ] **Step 1: Re-check the new quote.** Open
  https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat
  and confirm it contains, word for word: "The categories of the classification indicate the strength of the evidence
  as to whether a substance is capable of causing cancer". If it doesn't, stop and tell the owner.
- [ ] **Step 2: Create** `src/app/components/Explainer.tsx`:
```tsx
// Explainer.tsx — Home's "Hidden risks, explained" pages. Plain text over official sources only.
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.3.

import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { FDA_RULE } from "../../lib/nutrition";
import { PROCESSED_MEAT, ACRYLAMIDE } from "../../lib/safety/foodConcerns";
import { VERDICT_STYLE } from "./verdict";

export type ExplainerId = "not-healthy" | "badge-levels";

interface Cite { body: string; finding: string; url: string; quote: string; checkedOn: string }

const FDA: Cite = { body: "FDA", finding: "FDA's 5/20 rule for % Daily Value", url: FDA_RULE.url, quote: FDA_RULE.quote, checkedOn: FDA_RULE.checkedOn };
// Hand-checked 2026-10-01 on the WHO Q&A page (the IARC PDF's second sentence couldn't be read as text).
const WHO_EVIDENCE: Cite = {
  body: "WHO", finding: "The categories describe how strong the evidence is, not how likely harm is",
  url: PROCESSED_MEAT.sources[0].url, checkedOn: "2026-10-01",
  quote: "The categories of the classification indicate the strength of the evidence as to whether a substance is capable of causing cancer",
};

export const EXPLAINERS: Record<ExplainerId, { title: string; teaser: string; sources: Cite[] }> = {
  "not-healthy": {
    title: "“Nothing flagged” isn’t “healthy”",
    teaser: "The badge checks for official hazards, not sugar, fat or salt.",
    sources: [FDA],
  },
  "badge-levels": {
    title: "What the badge levels mean",
    teaser: "Levels show how strong the evidence is, not how much harm one serving does.",
    sources: [WHO_EVIDENCE, PROCESSED_MEAT.sources[2], PROCESSED_MEAT.sources[0], ACRYLAMIDE.sources[0], ACRYLAMIDE.sources[4]],
  },
};

const LEVELS = [
  { v: "none", basis: "No official finding for its additives or the food itself" },
  { v: "some", basis: "IARC Group 2B, or an EU warning label" },
  { v: "high", basis: "IARC Group 2A, a ban in the EU or US, or contains processed meat" },
  { v: "known", basis: "IARC Group 1 (for example, a processed meat product)" },
] as const;

function Body({ id }: { id: ExplainerId }): ReactNode {
  if (id === "not-healthy") return (
    <>
      <p>EcoGo’s badge looks for hazards with an official finding: additives (IARC, EU, FDA) and processed meat. It doesn’t rate nutrition.</p>
      <p>For that, look at the Nutrition section. By the FDA’s rule, 20% of the Daily Value or more per serving is high.</p>
      <p>Example: Oreo shows “Nothing flagged”, but one serving has 28% of the Daily Value for added sugar.</p>
    </>
  );
  return (
    <>
      <table className="w-full text-xs border-collapse">
        <tbody>
          {LEVELS.map(({ v, basis }) => {
            const s = VERDICT_STYLE[v];
            return (
              <tr key={v} className="border-b border-border">
                <td className="py-2 pr-3 align-top whitespace-nowrap font-bold" style={{ color: s.color }}>
                  <span className="inline-flex items-center gap-1"><s.Icon size={12} /> {s.label}</span>
                </td>
                <td className="py-2 align-top text-muted-foreground">{basis}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-2 pr-3 align-top whitespace-nowrap font-bold">🔥 Forms when cooked</td>
            <td className="py-2 align-top text-muted-foreground">Acrylamide can form when starchy food is fried or baked. A marker only: it never changes the badge.</td>
          </tr>
        </tbody>
      </table>
      <p><strong>The key point:</strong> the levels describe how strong the evidence is that something can cause cancer, not how much harm one serving does. Processed meat and tobacco are both Group 1, but IARC says that doesn’t make them equally dangerous.</p>
    </>
  );
}

export default function Explainer({ id, onBack }: { id: ExplainerId; onBack: () => void }) {
  const e = EXPLAINERS[id];
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-extrabold leading-tight">{e.title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm leading-relaxed" style={{ scrollbarWidth: "none" }}>
        <Body id={id} />
        <h2 className="font-bold text-sm pt-2">Sources</h2>
        <ul className="space-y-2.5">
          {e.sources.map(s => (
            <li key={s.quote} className="bg-card border border-border rounded-2xl p-3 text-xs">
              <p className="font-bold">{s.body}: {s.finding}</p>
              <p className="text-muted-foreground italic mt-1">“{s.quote}”</p>
              <div className="flex items-center justify-between mt-1.5">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold inline-flex items-center gap-1">
                  Read the source <ExternalLink size={10} />
                </a>
                <span className="text-[10px] text-muted-foreground">Source checked {s.checkedOn}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```
- [ ] **Step 3: Build.** Run: `npm run build`. Expected: success (the file isn't used yet).
- [ ] **Step 4: Commit.**
```bash
git add src/app/components/Explainer.tsx
git commit -m "Explainers: 'Nothing flagged' isn't 'healthy', and what the badge levels mean

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: New Home, fakes removed, Saved › Scanned on the same store

**Files:** modify `src/app/App.tsx`.

- [ ] **Step 1: Imports.** Replace the `lucide-react` import (and add two lines above it) so the block after
  `import { searchCatalog } from "../lib/search";` reads:
```tsx
import { addRecent, resolveRecent, loadRecent, saveRecent, type RecentEntry } from "../lib/recent";
import Explainer, { EXPLAINERS, type ExplainerId } from "./components/Explainer";
import {
  Home, Map, Camera, Heart, User, Search, ArrowLeft, ChevronRight,
  Bookmark, Shield, DollarSign, Star,
  Leaf, Package, Shirt, Bike, Building2, Wifi, Utensils,
  Plus, Bell, Moon, QrCode, Award, Settings
} from "lucide-react";
```
  (Removed icons: `CheckCircle`, `ShoppingBag`, `Sparkles`, `MapPin`, used only by the deleted code.)
- [ ] **Step 2: Delete the fakes.**
  - The whole `const DEALS = [ … ];` block, and the `// ── Helpers` comment plus `scoreColor` with its doc comment after it. Keep
    `IS_PHONE`.
  - Everything from `// ── Recommendation data ──…` down to (not including) `// ── Product Card (mini) ──…`:
    `Recommendation`, `DEFAULT_SCORE_THRESHOLD`, `RECOMMENDATIONS`, `RecommendationCard`, `WhyModal`,
    `RecommendationSection`.
- [ ] **Step 3: Replace `HomeTab`.** Replace everything from `// ── Home Tab ──…` down to (not including)
  `// ── Search Results ──…` with:
```tsx
// ── Home Tab ──────────────────────────────────────────────────────────────────
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.2 (layout A, real content only).
const greeting = (h = new Date().getHours()) => h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

const HOW_STEPS = [
  "Reads the real label from USDA (the maker's own data), or Open Food Facts, clearly marked crowd-sourced.",
  "Checks ingredients and the food itself against official findings from IARC, the EU and the FDA.",
  "Shows the strongest finding, with its source, plus sugar, fat and salt per serving.",
];

function RecentCard({ product, onSelect }: { product: Product; onSelect: (p: Product) => void }) {
  const look = VERDICT_STYLE[safeAnalyze(product).verdict];
  const high = topHigh(product.nutrition ?? knownNutrition(product.barcode));
  return (
    <button onClick={() => onSelect(product)}
      className="flex-shrink-0 w-28 bg-card border border-border rounded-2xl p-2.5 text-left shadow-sm flex flex-col gap-1.5">
      <span className="text-xs font-bold leading-tight line-clamp-2">{product.name}</span>
      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: look.color }}>
        <look.Icon size={10} /> {look.short}
      </span>
      {high && <NutritionChip text={high.short} />}
    </button>
  );
}

function HomeTab({ onSearch, onSelectProduct, onGoScan, onSeeAllRecent, onClearRecent, onOpenExplainer, recent }: {
  onSearch: (q: string) => void; onSelectProduct: (p: Product) => void; onGoScan: () => void;
  onSeeAllRecent: () => void; onClearRecent: () => void; onOpenExplainer: (id: ExplainerId) => void; recent: Product[];
}) {
  const [q, setQ] = useState("");
  return (
    <div className="h-full overflow-y-auto bg-background px-5 pt-4 pb-8 space-y-4" style={{ scrollbarWidth: "none" }}>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{greeting()}</p>
        <h1 className="text-xl font-extrabold leading-tight text-primary">What are you eating?</h1>
      </div>

      <button onClick={onGoScan} className="w-full flex items-center gap-3.5 p-4 rounded-3xl bg-primary text-white text-left shadow-md active:scale-98 transition-transform">
        <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0"><QrCode size={24} /></span>
        <span className="flex flex-col">
          <span className="text-base font-extrabold">Scan a product</span>
          <span className="text-xs text-white/85">Point your camera at the barcode</span>
        </span>
      </button>

      <div className="flex items-center gap-2.5 bg-muted rounded-2xl px-4 py-3">
        <Search size={15} className="text-muted-foreground flex-shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          placeholder="Search products, brands…"
          aria-label="Search products"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && q.trim() && onSearch(q)}
        />
      </div>

      {recent.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-bold text-base">Recently scanned</h2>
            <span className="flex gap-3">
              <button onClick={onClearRecent} aria-label="Clear recently scanned" className="text-xs font-semibold text-muted-foreground">Clear</button>
              <button onClick={onSeeAllRecent} className="text-xs font-bold text-primary">See all</button>
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
            {recent.map(p => <RecentCard key={p.id} product={p} onSelect={onSelectProduct} />)}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5">
          <h2 className="font-bold text-base">How EcoGo checks a product</h2>
          {HOW_STEPS.map((s, i) => (
            <div key={i} className="flex gap-2.5 items-start text-xs leading-relaxed text-foreground/80">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-bold text-base mb-2">Hidden risks, explained</h2>
        <div className="space-y-2.5">
          {(Object.keys(EXPLAINERS) as ExplainerId[]).map(id => (
            <button key={id} onClick={() => onOpenExplainer(id)}
              className="w-full bg-card border border-border rounded-2xl p-3.5 text-left shadow-sm flex items-center gap-3">
              <span className="flex-1">
                <span className="block text-sm font-extrabold">{EXPLAINERS[id].title}</span>
                <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{EXPLAINERS[id].teaser}</span>
              </span>
              <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```
- [ ] **Step 4: `SavedTab` takes the recent list.** Replace its first six lines (signature through `const scanned = …`)
  with:
```tsx
function SavedTab({ savedIds, scanned, initialTab = "favorites", onSelectProduct, products }: {
  savedIds: number[]; scanned: Product[]; initialTab?: "favorites" | "scanned";
  onSelectProduct: (p: Product) => void; products: Product[];
}) {
  const [tab, setTab] = useState<"favorites" | "scanned" | "lists">(initialTab);
  const favs = products.filter(p => savedIds.includes(p.id));
```
- [ ] **Step 5: App state.** In `App()`, replace `const [scannedIds, setScannedIds] = useState<number[]>([2, 6]);` with:
```tsx
  // Recently scanned / looked at: on this device only (M7 spec §4.1).
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  useEffect(() => saveRecent(recent), [recent]);
  const [savedInitialTab, setSavedInitialTab] = useState<"favorites" | "scanned">("favorites");
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);
```
  and replace the one-line `const openProduct = …` with:
```tsx
  // Every product opened counts as "looked at": Scan, search (catalog or USDA), and the lists.
  const openProduct = (p: Product) => {
    setRecent(prev => addRecent(prev, p, Date.now()));
    setSelectedProduct(p); setSubScreen("product-detail");
  };
  const recentProducts = resolveRecent(recent, products);
```
- [ ] **Step 6: Wire the screens.**
  - `<HomeTab …>`: replace the props `onGoMap`, `products`, `resources` with:
```tsx
                      onGoScan={() => setActiveTab("scan")}
                      onSeeAllRecent={() => { setSavedInitialTab("scanned"); setActiveTab("saved"); }}
                      onClearRecent={() => setRecent([])}
                      onOpenExplainer={setExplainer}
                      recent={recentProducts}
```
    (keep `onSearch={openSearch}` and `onSelectProduct={openProduct}`).
  - In `ScanTab`'s `onScanResult`, delete the line `setScannedIds(prev => …);` (`openProduct` now records it).
  - `<SavedTab savedIds={savedIds} scannedIds={scannedIds} onSelectProduct…`: replace `scannedIds={scannedIds}` with
    `scanned={recentProducts} initialTab={savedInitialTab}`.
  - Right after the comment `{/* Sub-screen overlays — fill content area, slide over tab content */}`, add:
```tsx
              {explainer && !subScreen && <Explainer id={explainer} onBack={() => setExplainer(null)} />}
```
  - Replace the `BottomNav` line with:
```tsx
            {!subScreen && !explainer && <BottomNav activeTab={activeTab} onTabChange={(t) => { setSavedInitialTab("favorites"); setActiveTab(t); }} />}
```
- [ ] **Step 7: Check nothing is left.** Run:
```bash
grep -n "RECOMMEND\|DEALS\|scoreColor\|WhyModal\|scannedIds\|Chicago\|onGoMap" src/app/App.tsx
```
  Expected: no output. (`Alex Johnson` in `ProfileTab` stays; it's out of scope.)
- [ ] **Step 8: Run.** `npm test` (156 pass) and `npm run build` (success).
- [ ] **Step 9: Commit.**
```bash
git add src/app/App.tsx
git commit -m "Home redesign: scan first, recently scanned on this device, two explainers; fakes removed

Saved > Scanned reads the same recent list (replaces the fake seed [2, 6]).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser check

- [ ] **Step 1: Serve the build.** Run `npm run build`, then `npx vite preview --port 4317 --strictPort` in the
  background.
- [ ] **Step 2: Run** `node docs/superpowers/plans/2026-10-01-m7-assets/check-home.mjs http://localhost:4317/`.
  Expected: `12/12 checks passed`. It uses headless Edge at
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` and needs network (Supabase).
- [ ] **Step 3: Look at it.** Open the app at phone width (or on a phone) and compare with mockup A: greeting, green
  Scan card, search, the recent row (or the 3 steps on a first visit), and the two explainer cards. Note any visual fix
  in `FIXES_AND_UPDATES.md` if it isn't in this plan.
- [ ] **Step 4: Stop the preview server.**

---

### Task 5: Docs, push (ask first), then the owner's check

**Files:** `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `PROJECT_HANDOFF.md`, `SYNOPSIS.md`, the spec.

- [ ] **Step 1: Docs.**
  - **`KNOWN_ISSUES.md`:** Roadmap "M7 ✅ <date>": Home redesign (scan first, recent on device, two explainers; fakes
    removed). Next: **M7.1** explainers (seed oils, pesticides, ultra-processed; sources researched first), then
    accounts and the real map. Note the Profile tab's fake content as the next cleanup candidate.
  - **`ARCHITECTURE.md`:** file map entries for `recent.ts` and `Explainer.tsx`; the feature inventory: Home → real
    content; Saved › Scanned → recent products on this device.
  - **`PROJECT_HANDOFF.md`:** decision log
    `| 023 | Home shows only real content; recent products kept on the device (localStorage, last 10), no account | Owner, 2026-10-01 | **Done** (M7) |`.
  - **`SYNOPSIS.md`** and the spec status → "Done".
- [ ] **Step 2: Commit.** Run `npm test`, then:
```bash
git add KNOWN_ISSUES.md ARCHITECTURE.md PROJECT_HANDOFF.md SYNOPSIS.md docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md
git commit -m "Docs: M7 done (Home redesign)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 3: Push (ask first).** Ask the owner: "Push to GitHub? This updates the live site." On a yes, push and
  confirm the Actions run succeeds.
- [ ] **Step 4: The owner's check.** Send them this, about 2 minutes on https://skynetrebel42.github.io/ecogo/:
  1. Open Home: no made-up places, scores or deals; the greeting fits the time of day.
  2. Scan or search two products, go back to Home: both show under "Recently scanned", newest first.
  3. Close and reopen the site: they're still there. Tap "Clear": they're gone.
  4. Open both "Hidden risks, explained" cards and tap a source link.
  5. Reply with anything that looks off, and which phone and browser it was.

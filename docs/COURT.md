# The Court of EcoGo: ledger

Kept by **The Court Jester 🃏 (auditor)**. The Jester observes, audits and advises. It assigns nothing and approves
nothing: chats take orders only from the King or the Founder. This file links to the history, it doesn't copy it:
[PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) · [KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md) ·
[FIXES_AND_UPDATES.md](../FIXES_AND_UPDATES.md) · [specs](superpowers/specs/) · [plans](superpowers/plans/).

**Updated:** 2026-10-02, patrol 1 · `main` at `63d2e2a` · live site (`origin/main`) at `6313412`, 12 local commits ahead.

## 1. Roster

| Chat | Role | Now (patrol 1) |
|---|---|---|
| The Founder | The human. Above the King, final say. Only the Founder says yes to a push (it redeploys the live site) | n/a |
| His Majesty the King 👑 `local_63f48cc9…` | PM. Owns milestone order and decisions | Idle |
| The Royal Advisor 📜 `local_32f24225…` | Planning and review | Idle |
| The Lord Chancellor ⚖️ `local_2e63694f…` | Spec architect. Wrote the M7.4 spec; the M7.5 build prompt is due from it | Busy |
| The Royal Cartographer 🗺️ `local_4ca5b751…` | Spec architect for M9 real map (spec approved) | Busy |
| The Court Alchemist ⚗️ `local_7202eae1…` | Spec architect for M8 add-a-product (spec approved) | Idle. Its M8 plan waits until M9 lands |
| The Master Builder 🏰 `local_a4fbdabe…` | Builder | Idle, on standby |
| The Royal Knight 🛡️ `local_5418148a…` | Debugger and builder. Built M7.4 and the cleanup | Waiting on a question to the Founder |
| The Court Scholar 📚 `local_75b9452a…` | Research | Idle, on standby |
| The Court Jester 🃏 `local_0ad577eb…` | Auditor: this ledger and the patrols | Running |

Message chats by name (`SendMessage` reaches running chats; the session tools wake idle ones). The founding brief
listed the Royal Advisor as `local_8c90aa95…`; that session no longer exists, the live one is `local_32f24225…`.

## 2. The King's current orders

As recorded in the repo docs on 2026-10-02 ([KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md), [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md)):

1. **M7.4 trust cleanup.** Built by the Knight and pushed at 02:50 (`1462e8b`…`6313412`; deploy green). A header fix and the
   cleanup (`06ab0d7`…`63d2e2a`) are local only.
   [spec](superpowers/specs/2026-10-02-m74-trust-cleanup-design.md) · [plan](superpowers/plans/2026-10-02-m74-trust-cleanup.md)
2. **M7.5 USDA key relay.** Spec awaiting the Founder's approval (no spec file in `docs/` yet).
3. **M9 real map** (Los Angeles, OpenStreetMap). [Spec](superpowers/specs/2026-10-02-m9-real-map-design.md) approved. Plan and
   dry-run after M7.4 lands; its build prompt goes to the Knight only after M7.5 is pushed.
4. **M8 add-a-product.** [Spec](superpowers/specs/2026-10-02-m8-add-product-design.md) approved. Its plan waits until M9 lands.

Not yet ordered: **data ownership** (a read-only USDA copy in Supabase; the King's chat calls it M10). The Founder approved
the design in chat. Its [spec](superpowers/specs/2026-10-02-data-ownership-design.md) and a plan are uncommitted.

Later: EU/FDA ingredient lists (their own milestone after M8); accounts.

## 3. Build lock (`src/`, `scripts/`)

**Holder: nobody.** The Knight's last commit is `63d2e2a` (03:05) and it is waiting on the Founder; no uncommitted `src/` or
`scripts/` changes at patrol 1. Next in line: the Knight, for M7.5, once the King hands it the prompt.

## 4. Decisions on record (King or Founder only)

| Date | Decided by | Decision | Source |
|---|---|---|---|
| 2026-10-02 | Founder | Nothing the app shows is invented: prices out of the UI, Map tab hidden until it has real places, no fake favorites, Lists or Share (M7.4) | [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) decision 025 |
| 2026-10-02 | Founder, at the PM's team meeting | Order M7.4 → M9 → M8. The M8 spec stays as approved. EU/FDA ingredient lists get their own milestone after M8. EPA Safer Choice not scheduled | Chat reports (Scholar, Alchemist) |
| 2026-10-02 | Founder | Add M7.5 USDA key relay. New order M7.4 → M7.5 → M9 → M8 | [KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md), [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) |
| 2026-10-02 | King | Plan and dry-run M9 only after M7.4 lands; give the Knight the M9 build prompt only after M7.5 is pushed | Chat reports (Cartographer, Alchemist) |
| 2026-10-02 | Founder | The Knight builds M7.4; the Builder stands by; the standing rules below apply | Master Builder's report |
| 2026-10-02 | Founder | M7.2, M7.3 and the `recent.ts` cleanup pushed live (live at `51c7a10` until 02:50) | `git reflog origin/main` |
| 2026-10-02 | Founder | Shrink the product-page header (the empty band where the price was), before the next push | [FIXES_AND_UPDATES.md](../FIXES_AND_UPDATES.md), `06ab0d7` |
| 2026-10-02 | King relayed, Founder approved | A no-behaviour-change over-engineering cleanup before M7.5 (-1,066 lines, one dependency fewer; Leaflet and `MapTab.tsx` stay for M9) | [FIXES_AND_UPDATES.md](../FIXES_AND_UPDATES.md) |
| 2026-10-02 | Founder | Data ownership: keep a slim read-only copy of USDA Branded Foods in Supabase. Number and order are the King's to assign | Spec header (the author's account) |
| 2026-10-02 | Founder | The Court Jester chat and this ledger | Royal Advisor's note to the King |
| 2026-10-02 | Founder | Commit this ledger (it goes public with the next push). Patrols hourly at :50; quiet patrols aren't sent to the King | The Founder's answers to the Jester |

Rows sourced from chat reports or a spec header are second-hand until the King confirms them.

## 5. Incidents and audits

| When | What | Status |
|---|---|---|
| 02:11 | `494e167` ("Spec M8: approved by the owner") also holds the M7.4 spec and the research doc, which belonged to other chats (the Scholar says Cartographer's commit swept them up). Content intact | Known to the King and the Scholar. Can't be rewritten on `main`; the standing rules came from this kind of collision |
| 02:50:10 | `main` pushed through `6313412` (M7.4); the deploy ran and succeeded. No approval found in the repo, and the `06ab0d7` log says the owner wanted the header fix made "before pushing", which landed 5 minutes after this push | **Open:** the Founder to confirm it was theirs |
| 02:53 | `docs/COURT.md` was in the local `.git/info/exclude` (not added by the Jester). Committed with `git add -f`, by path, on the Founder's yes | Closed. The line does nothing once the file is tracked |
| Patrol 0-1 | **Jester error:** the first notes said M7.4 was unpushed and the live site 12-13 commits behind. `origin/main` had moved at 02:50:10; the Jester read it once, just before, and never again | Corrected here and to the King. Every patrol now re-reads `origin/main` |
| Patrol 1 | Audit of M7.4 (`1462e8b`…`06ab0d7`) and the cleanup (`5ea0ce8`…`63d2e2a`), claims re-run by the Jester at `63d2e2a` on a clean tree: tests 157/157, build exit 0 (JS 565 kB), `check-home` 32/32; the old and new CSV parsers give identical output for all 51 products (checked at `3b5db9e`); `package-lock.json` matches `package.json` (CI runs `npm ci`); no class, token or font removed is still used | Claims hold. `ponytail-review`: lean, nothing left to cut before M9 |

Left on purpose until M9: the `resources` fetch and realtime listener, `MapTab.tsx` (593 lines, unimported), Leaflet.
Not re-run: the barcode script's SQL output.

Patrols 0 and 1: every commit since `494e167` holds only its owner's files.

## 6. Open items

- **Founder:** was the 02:50 push yours? (§5.) The 12 local commits (header fix, cleanup, this ledger) still need your yes
  before any push, and the repo is public, so `docs/COURT.md` would go public with them.
- **King:** confirm the order in §2 (the Jester's brief said M7.4 → M9 → M8, before M7.5 existed) and the decisions in §4.
- **King:** the data-ownership spec and plan are uncommitted; a stray `git add -A docs` would sweep them into someone
  else's commit, as happened in `494e167`.

## 7. Standing rules

- Commit by exact path only: never `git add -A` or `commit -a`.
- No `git reset`, `rebase`, `amend` or `stash` on `main`.
- Only builder and debugger chats edit `src/` and `scripts/`, one at a time. Planners write only under `docs/`.
- Ask the Founder before every push (it redeploys the live site).
- Facts first: no claim without an official source, no invented content.
- Every non-milestone fix goes in [FIXES_AND_UPDATES.md](../FIXES_AND_UPDATES.md).
- End milestone reports with multiple-choice next-step questions. Recaps for the Founder in plain language.

## 8. Patrol routine

Every hour at :50 (the Founder asked for 45 minutes; one cron can't repeat that evenly), paused when the Founder is away:
1. `git log`, `git status` and `git rev-parse origin/main` on `main` (a push can land between patrols), plus each chat's
   latest activity, read-only.
2. Drift check: work nobody ordered, two chats in `src/`, a commit with another chat's files, a spec committed unapproved,
   the forbidden git commands, a push nobody asked about, a chat gone quiet or losing context.
3. `ponytail-review` on new code commits; re-run any claimed "tests pass" or "checks pass": `npm test`, then
   `npx vite build --outDir <scratch> --emptyOutDir` and `vite preview --outDir <scratch> --port 4399`, then
   `check-home.mjs <url>` (the repo's `dist/` stays untouched).
4. One short note to the King when something changed. A quiet patrol says "All quiet in the halls." in the Jester's own chat
   only. The Founder hears only about rule breaks and decisions.
5. A chat is messaged directly only for a rule break, never mid-build, with encouragement and a joke.

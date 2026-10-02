# The Court of EcoGo: ledger

Kept by **The Court Jester 🃏 (auditor)**. The Jester observes, audits and advises. It assigns nothing and approves
nothing: chats take orders only from the King or the Founder. This file links to the history, it doesn't copy it:
[PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) · [KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md) ·
[FIXES_AND_UPDATES.md](../FIXES_AND_UPDATES.md) · [specs](superpowers/specs/) · [plans](superpowers/plans/).

**Updated:** 2026-10-02, patrol 1 · `main` at `06ab0d7` · live site (`origin/main`) at `51c7a10`, 13 commits behind.

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
| The Royal Knight 🛡️ `local_5418148a…` | Debugger and builder. Built M7.4 | Busy. Holds the build lock (§3) |
| The Court Scholar 📚 `local_75b9452a…` | Research | Idle, on standby |
| The Court Jester 🃏 `local_0ad577eb…` | Auditor: this ledger and the patrols | Running |

Message chats by name (`SendMessage` reaches running chats; the session tools wake idle ones). The founding brief
listed the Royal Advisor as `local_8c90aa95…`; that session no longer exists, the live one is `local_32f24225…`.

## 2. The King's current orders

As recorded in the repo docs on 2026-10-02 ([KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md), [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md)):

1. **M7.4 trust cleanup.** Built by the Knight (`1462e8b`…`06ab0d7`), **not pushed**.
   [spec](superpowers/specs/2026-10-02-m74-trust-cleanup-design.md) · [plan](superpowers/plans/2026-10-02-m74-trust-cleanup.md)
2. **M7.5 USDA key relay.** Spec awaiting the Founder's approval (no spec file in `docs/` yet).
3. **M9 real map** (Los Angeles, OpenStreetMap). [Spec](superpowers/specs/2026-10-02-m9-real-map-design.md) approved. Plan and
   dry-run after M7.4 lands; its build prompt goes to the Knight only after M7.5 is pushed.
4. **M8 add-a-product.** [Spec](superpowers/specs/2026-10-02-m8-add-product-design.md) approved. Its plan waits until M9 lands.

Not yet ordered: **data ownership** (a read-only USDA copy in Supabase). The Founder approved the design in chat; it has no
milestone number or place in the order yet, and its [spec](superpowers/specs/2026-10-02-data-ownership-design.md) is uncommitted.

Later: EU/FDA ingredient lists (their own milestone after M8); accounts.

## 3. Build lock (`src/`, `scripts/`)

**Holder: the Royal Knight.** Busy; last commit `06ab0d7` (02:55, one line in `ProductDetailScreen.tsx`: the Founder asked for
the product-page header to shrink, per the commit message). No uncommitted `src/` changes at patrol 1; nobody else is
editing `src/` or `scripts/`. Next in line: the Knight, for M7.5, once the King hands it the prompt.

## 4. Decisions on record (King or Founder only)

| Date | Decided by | Decision | Source |
|---|---|---|---|
| 2026-10-02 | Founder | Nothing the app shows is invented: prices out of the UI, Map tab hidden until it has real places, no fake favorites, Lists or Share (M7.4) | [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) decision 025 |
| 2026-10-02 | Founder, at the PM's team meeting | Order M7.4 → M9 → M8. The M8 spec stays as approved. EU/FDA ingredient lists get their own milestone after M8. EPA Safer Choice not scheduled | Chat reports (Scholar, Alchemist) |
| 2026-10-02 | Founder | Add M7.5 USDA key relay. New order M7.4 → M7.5 → M9 → M8 | [KNOWN_ISSUES.md §3](../KNOWN_ISSUES.md), [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) |
| 2026-10-02 | King | Plan and dry-run M9 only after M7.4 lands; give the Knight the M9 build prompt only after M7.5 is pushed | Chat reports (Cartographer, Alchemist) |
| 2026-10-02 | Founder | The Knight builds M7.4; the Builder stands by; the standing rules below apply | Master Builder's report |
| 2026-10-02 | Founder | M7.2, M7.3 and the `recent.ts` cleanup pushed live (live at `51c7a10`) | `git log origin/main` |
| 2026-10-02 | Founder | Shrink the product-page header (the empty band where the price was) | `06ab0d7` commit message |
| 2026-10-02 | Founder | Data ownership: keep a slim read-only copy of USDA Branded Foods in Supabase. Number and order are the King's to assign | Spec header (the author's account) |
| 2026-10-02 | Founder | The Court Jester chat and this ledger | Royal Advisor's note to the King |
| 2026-10-02 | Founder | Commit this ledger (it goes public with the next push). Patrols hourly at :50; quiet patrols aren't sent to the King | The Founder's answers to the Jester |

Rows sourced from chat reports or a spec header are second-hand until the King confirms them.

## 5. Incidents and audits

| When | What | Status |
|---|---|---|
| 2026-10-02 02:11 | `494e167` ("Spec M8: approved by the owner") also holds the M7.4 spec and the research doc, which belonged to other chats (the Scholar says Cartographer's commit swept them up). Content intact | Known to the King and the Scholar. Can't be rewritten on `main`; the standing rules came from this kind of collision |
| Patrol 1 | M7.4 (`1462e8b`…`06ab0d7`) audited, the Knight's claims re-run by the Jester at `06ab0d7`: tests 157/157, build exit 0 (JS 570 kB), `check-home` 32/32 | Claims hold. `ponytail-review`: the diff is lean; three dead leftovers, none urgent (below) |

Dead leftovers from M7.4: `bestPrice` in `productImporter.ts` (no callers); the `resources` fetch in `catalog.ts` and the
realtime listeners for `resources` and `product_prices` in `App.tsx` (no screen shows either; M9 reuses `resources`);
`MapTab.tsx`, 593 lines unimported on purpose until M9.

Patrols 0 and 1: every commit since `494e167` holds only its owner's files.

## 6. Open items

- **Founder:** pushing the 13 local commits needs your yes. The repo is public, so `docs/COURT.md` would be public with them.
- **King:** confirm the order in §2 (the Jester's brief said M7.4 → M9 → M8, before M7.5 existed) and the decisions in §4.
- **King:** give the data-ownership spec a number and a place. Its author hasn't committed it, and a stray `git add -A docs`
  would sweep it into someone else's commit, as happened in `494e167`.
- **King:** decide whether the Knight sweeps the dead leftovers in §5 now or they ride along with M7.5 and M9.

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
1. `git log` and `git status` on `main`, plus each chat's latest activity, read-only.
2. Drift check: work nobody ordered, two chats in `src/`, a commit with another chat's files, a spec committed unapproved,
   the forbidden git commands, a push nobody asked about, a chat gone quiet or losing context.
3. `ponytail-review` on new code commits; re-run any claimed "tests pass" or "checks pass" (`npm test`, `npm run build`,
   `check-home.mjs` on a local `vite preview`, port 4399).
4. One short note to the King when something changed. A quiet patrol says "All quiet in the halls." in the Jester's own chat
   only. The Founder hears only about rule breaks and decisions.
5. A chat is messaged directly only for a rule break, never mid-build, with encouragement and a joke.

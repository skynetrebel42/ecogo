# EcoGo!

Barcode scan → sourced ingredient concerns (food, personal care, cleaners). React 18 + Vite 6 + Tailwind 4 + Supabase.
Personal project of Minh (non-technical owner). Decisions live only in `PROJECT_HANDOFF.md`'s log (42 KB): read the
top 40 lines, then `grep -n "^| 0NN |"` for the rows you need; never the whole file.

## Commands (run before claiming done)
- `npm test` (node --test: safety engine, 51-product check, lookup) · `npm run build` (must pass)
- Browser gates: `docs/superpowers/plans/2026-10-01-m7-assets/check-*.mjs` (how to run: `.claude/handoff-knight.md`)
- `npm run verify:sources` after editing `src/lib/safety/{library,foodConcerns,personalCare}.ts`, `src/lib/saferChoice.ts`
  or `src/lib/learnSources.ts` (internet; fails on an unverifiable source without a dated hand check)
- Owner-run only: `npm run import:usda` (empty `foods` first), `npm run import:saferchoice`

## Where to look (cheapest first)
1. Structure → `graphify-out/GRAPH_REPORT.md` / `/graphify query "…"` if it's newer than the last `src/` commit, else
`ARCHITECTURE.md` (grep it). 2. File map + "safe to edit" → `ARCHITECTURE.md`.
3. Bugs/backlog → `KNOWN_ISSUES.md`. 4. Milestone steps → `docs/MILESTONES.md`.
- Active specs: `docs/superpowers/specs/` only. Never read `docs/archive/`, `src/lib/fixtures/**`, `*.json` data or
  lockfiles unless the task names them.

## Rules
- Nothing the app shows may be invented: every claim has a verbatim official quote (`verify:sources`). No match = no claim.
- The browser writes no Supabase rows. Its only Supabase calls: read `foods`; anonymous sign-in at the first Send;
  invoke `off-submit` (sole writer of `contributions`) and `place-submit` (sole writer of `place_reports`); read the
  person's own counts. No secret keys in client code (the Turnstile site key is public). Every push to `main` deploys.
- Git: commit by exact path; never `add -A`, `commit -a`, amend, reset, rebase, stash or force-push on `main` (hook
  enforces). Before any push show `git log --oneline origin/main..HEAD` (own vs others); the owner approves that list.

## Roles
- **Daedalus** (planner): talks to Minh, writes specs and the decision log, spawns one fresh **Headsman** (builder) per
  milestone with a full brief (`docs/WORKFLOW_PLAYBOOK.md` §2.4), verifies live, closes out. Writes docs, never `src/`.
- **Headsman**: builds one spec in its own worktree, test-first; questions go to Daedalus with options; asks Minh only
  right before a push, download, deploy or live DB change. Retired when its milestone ships.
- Every ask to Minh is tagged 🔒 rule call (A follows the rules) or 🎨 your call (Minh answers first), says what yes
  does, and ends reports with "In plain terms:". When Minh mentions an idea, ask "now or later?" with Daedalus's
pick (foundations first); later ideas go to `docs/MILESTONES.md` Future features. Roster: memory note `feedback_team_meeting.md`.

## Skills
graphify (structure) · diagnosing-bugs (bugs) · tdd (spec'd features) · code-review + ponytail-review (before a push) ·
verification-before-completion (before a report) · pr (PR text). Skip brainstorming / writing-plans /
subagent-driven-development unless Minh invokes them. Tiny edits: no skill. Subagents only for big read-only searches
(≤15-line summary).

## Upkeep (checklists: `docs/WORKFLOW_PLAYBOOK.md` §9)
- Milestone done → the close-out checklist (§9.1). Maintenance triggers (usage, weekly) → §9.2.
- Size caps: this file ≤ 4 KB; handoff notes ≤ 6 KB; memory notes ≤ 3 KB each. Over a cap: prune before adding.
- **State** is replaced, never appended to.

## Current state (replace at each close-out; ≤ 3 lines)
- Live: origin/main f23f876 (M1–M17, 063, 064, 066; 430,127 USDA foods, engine_rev 4; off-submit v11, place-submit v2).
- Building: nothing; next brief 070 cloud help (Minh's OCR.space key goes in as a server secret).
- Then (decision 071, label first): 070 cloud help → check split → 068 scan screen → 071 reader v3 → 072 ingredient knowledge → 069.

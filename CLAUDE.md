# EcoGo!

Barcode scan → sourced ingredient concerns. React 18 + Vite 6 + Tailwind 4 + Supabase. Personal project. Start with `PROJECT_HANDOFF.md`.

## Commands (run before claiming done)
- `npm test` — safety engine, 51-product check, lookup client (node --test)
- `npm run build` — must pass
- `npm run verify:sources` — only after editing `src/lib/safety/library.ts` or `foodConcerns.ts` (needs internet)

## Where to look (cheapest first)
1. Structure/relationships question → `graphify-out/GRAPH_REPORT.md`, then `/graphify query "<question>"`. Don't grep the whole tree first.
2. File map and "safe to edit" levels → `ARCHITECTURE.md`.
3. Open bugs/roadmap → `KNOWN_ISSUES.md`.
- Do NOT read `docs/archive/` (finished M1–M9 plans/specs; history is in git). Active work is only `docs/superpowers/` (M8, M10).
- Never read `src/lib/fixtures/**`, `*.json` data, or lockfiles unless the task names them.

## Rules
- Nothing the app shows may be invented. Every safety flag needs a verbatim source (`verify:sources`).
- Browser writes nothing to Supabase. No API key in client code: lookups read EcoGo's own `foods` table (M10); only the owner's `.env.local` holds the service-role key for `npm run import:usda`.
- Every push to `main` deploys to GitHub Pages.

## Current state (update when a milestone ships)
- M1–M11 live on `origin/main` (M11: food icons, Update info, Profile rows, text size + high contrast). M12 (Home "Learn" tiles) building. **M10**: own USDA copy, 430,127 products in Supabase `foods` (engine_rev 4, after the M10.1–M10.3 processed-meat rules); the app never calls USDA. Re-import: empty the table first (a reload over a full one doubles its size).
- Order after M10 (owner, 2026-10-05): `docs/superpowers/ideas/2026-10-05-owner-app-review.md` (quick wins → Home redesign → Map near me → Collections → M8 add-a-product → …).
- Active specs: `docs/superpowers/specs/` (m10, m101–m103, m8, m12). Decisions live ONLY in the `PROJECT_HANDOFF.md` decision log; don't re-open them.

## Multi-chat rules
- Commit by exact path. Never `add -A`, `commit -a`, amend, reset, rebase, stash, or force-push on `main` (hook enforces). Builds happen on worktree branches.
- Before any push show `git log --oneline origin/main..HEAD` (mark own vs others' commits); owner approves that exact list.
- Planners write only in `docs/`; one builder at a time works in `src/`.
- Two chats: the planner (specs, plans, order, the owner's decisions) and the builder (one at a time in `src/`). The builder sends decision questions to the planner with options, then stops; it asks the owner directly only right before a push, deploy, or live DB change.
- Detailed versions: memory notes `feedback_team_meeting.md`, `feedback_parallel_chats_git.md`.

## Working agreement (agents)
- One task per chat. Start from this file + the named spec; don't load other plans.
- Default: do the task directly. Use a subagent only for big independent searches or parallel work; it returns a ≤15-line summary with `file:line`.
- Skills: use the one that matches the task, don't chain several.
  | Task | Skill |
  |---|---|
  | architecture / "where is X" | graphify (query graph first) |
  | bug | diagnosing-bugs |
  | new feature with a spec | tdd, against the spec in `docs/superpowers/specs/` |
  | review changes | code-review |
  | PR text | pr |
  Tiny edits (copy, styling, one-file fixes): no skill, no plan.
- Keep graph current: after big refactors run `/graphify --update`.
- When a milestone ships: move its plan/spec to `docs/archive/`, add one line to `PROJECT_HANDOFF.md`, update this file only if a command or rule changed.

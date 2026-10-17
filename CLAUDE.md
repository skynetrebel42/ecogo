# EcoGo!

Barcode scan → sourced ingredient concerns. React 18 + Vite 6 + Tailwind 4 + Supabase. Personal project. Start with `PROJECT_HANDOFF.md`.

## Commands (run before claiming done)
- `npm test` — safety engine, 51-product check, lookup client (node --test)
- `npm run build` — must pass
- `npm run verify:sources` — only after editing `src/lib/safety/library.ts`, `foodConcerns.ts` or the Learn citations list (`learnSources.ts`) (needs internet; fails on unverifiable sources without a dated hand check)

## Where to look (cheapest first)
1. Structure/relationships question → `graphify-out/GRAPH_REPORT.md`, then `/graphify query "<question>"`. Don't grep the whole tree first.
2. File map and "safe to edit" levels → `ARCHITECTURE.md`.
3. Open bugs/roadmap → `KNOWN_ISSUES.md`.
- Do NOT read `docs/archive/` (finished M1–M9 plans/specs; history is in git). Active work is only `docs/superpowers/` (M10; M8.1 next).
- Never read `src/lib/fixtures/**`, `*.json` data, or lockfiles unless the task names them.

## Rules
- Nothing the app shows may be invented. Every safety flag needs a verbatim source (`verify:sources`).
- The browser writes no Supabase table rows: beyond reading `foods`, its only Supabase calls are the anonymous sign-in at the first Send and invoking `off-submit` (which alone writes `contributions`) and `place-submit` (M8.1; which alone writes `place_reports`), and reads the person's own `contributions` / `place_reports` counts (M15). No API key in client code (the Turnstile site key is public): lookups read EcoGo's own `foods` table (M10); only the owner's `.env.local` holds the service-role key for `npm run import:usda`.
- Every push to `main` deploys to GitHub Pages.

## Current state (update when a milestone ships)
- M1–M14 and M8 live on `origin/main` (M11 quick wins; M12 Home "Learn" tiles; M13 Map near me: ZIP/radius, 183 OSM places + 191 LA County sites, report a problem; M14 Collections: save sheet + lists on this device; M8 add a product to Open Food Facts via the `off-submit` Edge Function (real OFF since 2026-10-09, owner swapped the secrets), + no-barcode ingredient check). M8 follow-ups 1–4 and 6 live (047–050, 052; progress bar, blur check, label trim, crop, no junk prefill). RW1-01 (latest photo wins) and trust wording (053) live 2026-10-14. Bug batch 054 live (a57df5b). Follow-up 5 (051, add missing ingredients / send new photos for existing OFF products) live 2026-10-14 (219fe37). Send edge cases (055: lock while sending, "Not sure it arrived", photo-rejected) live 2026-10-15 (ba60f47, off-submit v11). R2-03/04 batch (056) live 01c4075. M8.1 (057, in-app Suggest a place + Report a problem, place-submit + place_reports) live 2026-10-15 (772814c). "Check the label yourself" + account-free sends first (058) live 33f1737. Map feedback batch (059: Suggest up top, County search + 211, OSM links demoted, Photon address suggestions) live b6e52cd. M15 "Your contributions" (060: private counts + milestones on Profile; place-submit v2) live 2026-10-16 (3e5ee30). Next: SOURCE-01 + COPY-01 (061, Knight IX), then owner picks (R5, non-food products). **M10**: own USDA copy, 430,127 products in Supabase `foods` (engine_rev 4, after the M10.1–M10.3 processed-meat rules); the app never calls USDA. Re-import: empty the table first (a reload over a full one doubles its size).
- Order after M10 (owner, 2026-10-05): `docs/superpowers/ideas/2026-10-05-owner-app-review.md` (quick wins → Home redesign → Map near me → Collections → M8 add-a-product → …).
- Active specs: `docs/superpowers/specs/` (m10, m101–m103, source-copy). Decisions live ONLY in the `PROJECT_HANDOFF.md` decision log; don't re-open them.

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
  | over-engineering check, builder, before asking for a push | ponytail-review |
- Superpowers (loads every session): CLAUDE.md wins. The builder uses `verification-before-completion` before a report; skip `brainstorming`, `writing-plans` and `subagent-driven-development` (the planner's mockups + spec + one builder replace them).
  | PR text | pr |
  Tiny edits (copy, styling, one-file fixes): no skill, no plan.
- Keep graph current: after big refactors run `/graphify --update`.
- When a milestone ships: move its plan/spec to `docs/archive/`, add one line to `PROJECT_HANDOFF.md`, update this file only if a command or rule changed.

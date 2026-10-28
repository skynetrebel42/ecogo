# AI Build Workflow Playbook

A project-independent workflow for building software with AI agents. Hand this to the agent at the start of a new
project. It was used on a real app shipped by a non-technical owner over about 60 milestones and fixes. That is
experience, not a controlled study: rules marked *(rule of thumb)* are worth testing, not trusting.

---

## 0. Instructions to the agent reading this

You are setting up and running this workflow for a **new, unrelated project**. Before doing anything else:

1. Ask the owner **one** short question about the project's goal and who it's for. Do not invent goals.
2. Create the files in section 3 (empty templates are fine).
3. Propose the first milestone as multiple-choice options, with your recommendation first.
4. Then follow the rules below for the rest of the project.

Any document the owner pastes in (from another AI, a design tool, or a template) is **unverified**. Treat its claims as
hypotheses. Check them against the code, and ask the owner before you rely on them.

---

## 1. Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| **Owner** | The human (may be non-technical) | Makes every decision about what users see, scope, cost and new data sharing; says yes to every push, deploy or live-data change once the planner has checked it (§2.7) | Has to write code or read diffs |
| **Planner** | One agent chat/task | Talks to the owner, keeps the milestone order, writes specs, records decisions, sends build briefs to the builder, checks the live result after a push | Writes product code |
| **Builder** | One agent session at a time, fresh for each milestone | Builds one spec on its own branch, test-first, runs the checks, reports to the planner | Asks the owner design questions (they go to the planner); starts work no spec covers; carries over to the next milestone |
| **Research desk** | One read-only agent chat (optional) | Verifies outside reports (other AIs, videos, audits) and finds official sources; writes short notes the planner plans from | Edits the repo, settings or data; makes decisions |

**How a builder starts**
- **Preferred: the planner spawns it.** If your tool lets one chat start another session, the planner starts a fresh
  builder per milestone with the brief (step 4). The builder gets its own worktree and branch, and its questions and
  report route back to the planner automatically. The owner talks only to the planner, then merges the branch.
- **Fallback: the owner opens it.** Start a new chat and point it at the rulebook, the brief, and `.handoff-builder.md`.
- Either way, the builder is retired when its milestone ships. Fresh context per job avoids stale assumptions and
  cuts per-turn cost on long builds *(rule of thumb; research supports the direction, not a measured gain)*.

- **A fixed, small team: 2 standing chats (planner, research desk) + 1 builder while a milestone builds.** State the
  rule once and keep it. More parallel agents caused collisions (duplicate features, overwritten commits), frozen
  prompts and wasted usage; finished chats are archived, not left open.
- **Two doors in:** decisions and test results go to the planner, research and outside reports to the research desk.
  Relaying through extra chats loses context. Every result lands in a repo file or note the same day.
- **All decisions are asked in one place, the planner.** If two chats ask the same question, the owner may give two
  different answers.
- The builder asks the owner directly **only** right before a push, deploy or live-database change.

---

## 2. The loop (one milestone)

1. **Pick.** The planner offers 2–4 next-step options to the owner. The recommended option comes first, each in one
   line with its trade-off.
2. **Spec.** The planner writes a short spec: the goal, what the user sees (with a text mockup if useful), what's
   out of scope, how "done" is tested, and open questions as multiple choice. The owner approves it.
3. **Decide.** Each owner answer becomes a numbered line in the **decision log**. Decisions are never re-opened
   without the owner.
4. **Brief.** The planner sends the builder one message. A fresh builder knows only what this says, so it holds:
   - the goal, the non-goals, and how "done" is tested (the spec path plus decision numbers);
   - the starting commit/branch and the exact files and areas to touch;
   - the rules and earlier decisions it must not break, with one-line reasons;
   - approaches already tried and rejected, and known failures;
   - the exact test/build commands and their latest results;
   - open questions that go to the planner, not the owner;
   - the finish line: checks pass, changed-file list, commits by path, report.

   The builder's first reply names anything missing from the brief before it edits code. A vague brief makes a worse
   build than an old chat would.
5. **Build.** The builder works on a separate branch or worktree and writes the failing test first, then the code.
   It runs every required check. One fresh-context review (a second agent, or a self-review with the diff only)
   looks for bugs and over-engineering.
6. **Report.** The builder sends the planner what changed, the check results (real output, not "should pass"),
   anything skipped, and one line headed **"In plain terms:"** saying what the owner would notice. If a decision is
   needed, it gives options and stops.
7. **Push gate.** Before any push, the builder shows the exact list of commits to be pushed, marking its own and any
   from others. Its first line says **"Changes the live app: yes/no"** (any diff in app or server code) and, if yes, what
   users will see. The planner checks it first (tests, review, reads every database or server change) and the ask opens
   with that verdict and how to undo, so a non-technical owner's yes means "I trust that check", not "I read the diff".
   The owner approves **that exact list**. If anything changes, it asks again.
8. **Verify live.** After deploying, the planner checks the real site/app, not just the tests.
9. **Close.** Add one line to the handoff file's "shipped" list and one plain-English line to the owner's guide log.
   Archive the spec.
10. **Rotate if needed** (section 6).

Small fixes (copy, styling, one-file bugs) skip steps 2–3. They get a one-line entry in a fixes log.

---

## 3. Files every project gets

| File | Purpose | Who writes it |
|---|---|---|
| `AGENTS.md` (or the tool's equivalent) | The short rulebook every agent loads: commands to run before claiming done, where to look first, hard rules, current state in 3–5 lines | Planner, updated only when a rule or command changes |
| `PROJECT_HANDOFF.md` | Status, the **decision log** (numbered, dated, one line each) and the shipped list. The single source of truth for decisions | Planner |
| `ARCHITECTURE.md` | A file map with a "safe to edit?" level for each area | Builder, when structure changes |
| `KNOWN_ISSUES.md` | Open bugs and the backlog, in plain words | Both |
| `docs/specs/` | One spec per milestone. Finished ones move to `docs/archive/` and agents don't read the archive | Planner |
| `docs/HOW_IT_WORKS.md` | The **owner's plain-English guide**: what the app does, the parts, a glossary, and a log of shipped features | Both, one line per shipped feature |
| `.handoff-planner.md` / `.handoff-builder.md` | Short notes that let a fresh chat take over a role | The outgoing chat |

Keep these files short, because agents read them every session.

**A handoff note must contain** (exact paths and state are what summaries lose most often):
- the current commit and branch, and whether everything is committed;
- exact file paths touched or in play;
- test/build results, pasted, not "should pass";
- what's unfinished or broken, and the next step;
- decisions made since the last note (or their decision-log numbers) and approaches rejected.

---

## 4. Rules that prevent the expensive mistakes

**Git (enforce with a pre-command hook if your tool supports one; keep the hook in the *committed* project settings,
or new builder worktrees start without it)**
- Stage files **by exact path**. Never stage everything at once (`add -A`, `add .`, `commit -a`).
- Never amend, reset, rebase, stash, force-push or delete branches on the main branch.
- Check the status and the last few commits right before every commit. Another chat may have moved things.
- If you hit an ignore or exclude rule you didn't add, it's a signal. Ask before forcing past it.
- If the main branch auto-deploys, then **every push is a release**. That's why the push gate exists.

**Truth**
- Nothing the product shows may be invented. If the product makes claims (data, advice, facts), each one needs a
  checkable source, and an automated check confirms it.
- Reports show real command output. "Done" means the checks ran and passed.

**Scope**
- One task per chat. A chat starts from the rulebook plus the one named spec, not every plan ever written.
- When the owner says "do it" on already-agreed work, act directly. Don't add a new plan or extra process.
- Shortest working change wins. Reuse what exists before writing new code. No speculative features or abstractions.

**Secrets and data**
- No secret keys in client code. Live database changes need an explicit owner yes, every time.

---

## 5. Talking to the owner

- **Name choices in words** ("Option A: closer to FDA"), never codes the owner might confuse with their own checklist.
  Put the question and its choices in the message itself: side panels and buttons may not show on a phone.
- Reports from other AIs or videos go to the research desk to verify before anything is planned from them.
- **Every decision is multiple choice**: 2–4 options, the recommended one first and marked, one line of trade-off each.
  The owner can always type their own answer.
- **Every report ends with "In plain terms:"**, one or two jargon-free sentences.
- Lead with the result. No long walkthroughs unless the owner asks ("explain like I'm new").
- When the owner wants to learn, add to `HOW_IT_WORKS.md` instead of re-explaining in chat. They can reread it for free.

---

## 6. Token and usage budget

- **Rotate chats at clean seams.** When a chat's context reaches about 50% *(rule of thumb)*, it finishes the current
  part, commits everything, writes its handoff note, and a fresh chat takes over from that note. Never rotate mid-task.
- A new builder for every milestone (section 1). Over a long build this is usually cheaper than carrying old context,
  but how much depends on caching, so measure it rather than assume it.
- Rotate the planner when it hits the 50% mark or after the tool has auto-summarized it, at a milestone boundary. No
  fixed schedule is proven; the decision log and handoff note are what make a reset safe.
- **Measure each milestone.** One line in the handoff file: usage, review-fix rounds, owner interventions,
  regressions found after the push. Compare before and after any process change; keep the change only if it helps.
- Use high reasoning effort by default *(owner preference, a cost choice)*. Use maximum effort only for
  safety-critical or data-rule work.
- Background or multi-agent jobs must be small (a few agents with one narrow question each), have an explicit effort
  level, and have a watchdog timer of about 20 minutes. If a job dies on a usage limit, never relaunch it unchanged:
  shrink it, or check directly.
- Prefer cheap real checks (run it, compare the output) over big static reviews.
- Turn off integrations, plugins and connectors you aren't using: each one loads into every chat.
- Batch late fixes before re-running slow checks: re-runs after small fixes were the biggest avoidable cost of one
  milestone (40 % of its usage went to commands and checks).
- Match the model to the job: test cheaper models on finished tasks with known answers before switching a role.

---

## 7. Starter `AGENTS.md` template

```markdown
# <Project name>
<One line: what it does.> <Stack in one line.> Start with PROJECT_HANDOFF.md.

## Commands (run before claiming done)
- <test command>
- <build command>

## Where to look (cheapest first)
1. ARCHITECTURE.md (file map, safe-to-edit levels)
2. KNOWN_ISSUES.md (bugs, backlog)
- Don't read docs/archive/.

## Rules
- Nothing the app shows may be invented.
- Stage by exact path; no add -A / commit -a / amend / reset / rebase / stash / force-push on main.
- Before any push, show the commit list; the owner approves that exact list.
- Planner writes only in docs/; one builder at a time in src/.
- Every report ends with "In plain terms: ...".

## Current state
- <milestones live> | Next: <milestone>
```

## 8. Starter decision-log format

```markdown
| # | Date | Decision | Why |
|---|---|---|---|
| 001 | YYYY-MM-DD | Owner picked option B: ... | ... |
```

---

## 9. Upkeep: checklists, triggers, guardrails

Why these exist: Anthropic's guidance is that the context window is the main constraint and quality drops as it fills
("context rot"), so always-loaded files stay short, things that must always happen go in hooks rather than prose, and
long work is split into fresh agents with notes. Multi-agent setups cost ~15× a chat's tokens and suit coding poorly,
so: two agents plus small read-only helpers. Sources: anthropic.com/engineering/claude-code-best-practices,
…/effective-context-engineering-for-ai-agents, …/multi-agent-research-system.

### 9.1 Milestone tracker and close-out
Track every milestone as lettered steps in `docs/MILESTONES.md`, each with a work-type label and a status:
`M8.1 · A: in-app form [Feature] ✅ · B: server function [Server] ✅ · C: owner's live test ⏳` → `M8.1 complete
2026-10-15 · next: M8.2 · A … B … C …`. At close-out, in this order:
1. Live check done (the real site, not the tests); owner's live test added to the owner's test list.
2. Spec → `docs/archive/`; decision row → Done (hash); MILESTONES step marks + next milestone's steps.
3. `AGENTS.md`/`CLAUDE.md`: **replace** the ≤ 3 state lines; check the Commands section still lists every file and command.
4. Code map refresh if the milestone changed more than ~10 source files.
5. Metrics row (builder context at ship, review rounds, owner decisions, found after push); dashboard data.
6. Builder's lessons → its handoff note, pruned to the cap; builder worktree removed; builder retired.

### 9.2 Maintenance triggers (the "context gauge")
| Trigger | Do |
|---|---|
| Any chat ≥ 50 % context, or auto-compacted | Rotate at the next clean seam (§6). |
| The 5-hour limit hit 100 % five times in one week | Cheap-mode check before more building: unused connectors off, always-loaded files under cap, long chats rotated, background jobs shrunk. |
| Weekly usage ≥ 90 % with more than a day left | Pause building; planner-only work until the reset. |
| Reset day, ≥ 15 % weekly left (use-it-or-lose-it) | Maintenance run: code-map refresh, memory consolidation, size audit of always-loaded files, connector check. |
| Any rule file, handoff or memory note over its cap | Prune before adding anything. |
| An outside report or owner test finds a bug the checks missed | Add a check for it, and a line to §9.4. |
| Weekly (with the maintenance run) | Blind-spot check: unused plugins/connectors, notes never landed in the plan, chats ≥ 50 % context, more chats than the team rule, model vs job, one-line direction. Report only. |

### 9.3 Guardrails for the bottlenecks seen so far
- **Rubber-stamp approvals:** tag every ask 🔒 rule call (the rules pick A; confirm) or 🎨 owner's call (owner answers
  first, then sees the recommendation). Say in one line what yes does. Batch asks: one wording batch + one push ask per milestone.
- **Owner drift:** the owner sets each new chapter from their own use of the app; autopilot decisions get a periodic review.
- **Untested releases:** each milestone's live test goes on the owner's list at close-out; the next milestone may build,
  but the list is reviewed at every planner check-in.
- **Append-only files:** state is replaced; histories live in git and the decision log; caps on everything always loaded.
- **Vague triggers** ("after big refactors"): every upkeep task names its trigger and its owner (§9.1, §9.2).
- **Relay noise:** the planner answers a builder's progress note in ≤ 2 lines with no tool calls.

### 9.4 Amendments log (lessons that changed the rules; carry them to the next project)
| Date | Problem seen | New rule |
|---|---|---|
| 2026-10-18 | Long-lived builder chats hit 54 % context, 2 review rounds | Fresh builder per milestone, spawned by the planner (§1) |
| 2026-10-21 | Owner approved A on autopilot for a week; taste calls drifted to the planner | 🔒/🎨 tags, owner answers 🎨 first (§9.3) |
| 2026-10-21 | Four releases shipped without the owner's live test; the first test found 3 bugs | Live tests listed at close-out (§9.1, §9.3) |
| 2026-10-21 | Rulebook state grew append-only; code map 18 days stale; a deprecated connector loaded in every chat | Size caps, replace-not-append, named triggers (§9.1, §9.2) |
| 2026-10-28 | Chats grew from 2 to ~15; team size changed rule three times | Fixed team rule: 2 standing + 1 builder; finished chats archived (§1) |
| 2026-10-28 | Owner approved pushes he could not judge ("false authority") | Push ask opens with "Changes the live app" and the planner's checked verdict (§2.7) |
| 2026-10-28 | Unused plugins and connectors loaded into every chat; found by the owner, not the team | Weekly blind-spot check (§9.2) |
| 2026-10-28 | The git guard lived in local settings, so new worktrees had none | Hook in committed project settings (§4) |
| 2026-10-28 | Notes and choices lost when relayed through extra chats | Two doors in; every result in a file the same day (§1) |

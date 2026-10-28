# Workflow and token audit brief

For a stronger model to run a full workflow audit. Written 2026-10-25 from a short read-only audit. Nothing has been changed yet.

## Goal

Cut tokens per session and per milestone without breaking the team workflow (Daedalus plans; a fresh Headsman builds one milestone) or the rules in CLAUDE.md. The owner's weekly budget is tight until Tuesday 27 Oct (weekly usage was at 94%, see CLAUDE.md "Current state").

## Ground rules

- Read-only first. Deliver a report and a proposed change list. Do not edit `src/`, commit, push, delete or move files until Minh approves each item.
- Verify every claim with a command before reporting it. Mark anything unverified.
- Minh is not a developer. End the report with "In plain terms:". Use labels in words, not codes (see memory `feedback_plain_terms`, `feedback_choice_labels`).
- Keep `CLAUDE.md` at or under 4 KB (it is 4,079 bytes now, at the cap).

## Measured facts (2026-10-25)

Always loaded at session start:

| Item | Size / state |
|---|---|
| `CLAUDE.md` | 4,079 B |
| memory `MEMORY.md` index | 1,676 B (13 notes, 752 to 3,702 B each, read only when relevant) |
| Skill list | global skills (8), plus enabled plugin skills |
| ponytail SessionStart activation | injected at session start (seen in context) |

Read on demand (cost only when opened):

| File | Size |
|---|---|
| `KNOWN_ISSUES.md` | 55,115 B |
| `PROJECT_HANDOFF.md` | 47,234 B |
| `ARCHITECTURE.md` | 44,641 B |
| `FIXES_AND_UPDATES.md` | 23,580 B (not named in CLAUDE.md or the playbook) |
| `SYNOPSIS.md` | 10,211 B (not named in CLAUDE.md or the playbook) |
| `docs/WORKFLOW_PLAYBOOK.md` | 15,163 B |
| `docs/COURT.md` | 14,789 B |
| `docs/MILESTONES.md` | 9,932 B |
| `docs/HOW_ECOGO_WORKS.md` | 9,292 B |
| `.claude/handoff-planner.md` | 5,803 B |
| `.claude/handoff-knight.md` | 5,557 B |
| `docs/OWNER_TESTS.md` | 7,293 B |
| `docs/SESSION_SUMMARY_2026-10-21.md` | 4,294 B |
| `docs/superpowers/plans/2026-10-02-data-ownership.md` | 123,831 B (not in the CLAUDE.md skip list) |
| `graphify-out/GRAPH_REPORT.md` | 33,710 B |

Plugins and skills:

- `claude-obsidian` 3.0.1: 15 skills, enabled at user scope. Not referenced by EcoGo rules.
- `ponytail` 4.10.0: 6 skills. CLAUDE.md requires `ponytail-review` before a push, so disabling the whole plugin removes that step.
- `superpowers` 7.0.0: 15 skills. Disabled for EcoGo in `.claude/settings.local.json`. CLAUDE.md still names `verification-before-completion` (a superpowers skill), so that rule cannot be followed here as written.
- Two superpowers versions are cached (6.4.1 and 7.0.0).
- Global skills: caveman, code-review, diagnosing-bugs, graphify, pr, prompt-master, resolving-merge-conflicts, tdd. Caveman and prompt-master were installed this week.
- Most of the skill list appears to come from the desktop app, not from user config. Not verified; check whether any can be turned off per project.

Hooks (`.claude/settings.local.json`):

- SessionStart: `checkup-reminder.mjs` (small).
- PreToolUse on `Bash|PowerShell`: `block-risky-git.mjs`. Runs on every shell call (latency, not tokens).

Scheduled tasks:

- `ecogo-owner-todo-reminder`: daily at 20:01, enabled. Each run is a full session. Last run 2026-10-25 06:37 UTC.
- `ecogo-weekly-maintenance`: Tuesdays about 16:44 (scheduler local time), enabled. Next run 27 Oct. Its job covers usage, code map, size caps, stale docs, agent setup, audit due date, connectors and memory. It will start right at the budget reset.
- `ecogo-demo-reminder`: one-time, disabled. No action needed.

Worktrees and leftovers:

- `.claude/worktrees/audit-fixes-075-f4e33a`: branch `claude/audit-fixes-075-f4e33a`, 17 commits not in origin/main. Active. Keep until 075 ships.
- `.claude/worktrees/welcome-redesign`: clean, all commits already in origin/main. Removable with `git worktree remove` (no force) after approval.
- `.claude/worktrees/m16-personal-care`: empty folder, not a registered worktree. Removable after approval.
- `skills-lock.json` at repo root: untracked, created 2026-10-25 00:20. It is the caveman install record. Decide whether to keep and track it.
- `.gitignore` does not list `.claude/worktrees/`. Not verified whether Grep/Glob results include the worktree copies. If they do, duplicate docs and `node_modules` files pollute searches.

Broken references (the files do not exist):

| Where | Says | Real location |
|---|---|---|
| `docs/WORKFLOW_PLAYBOOK.md` lines 35, 93 | `.handoff-builder.md` | none |
| `docs/WORKFLOW_PLAYBOOK.md` lines 93 | `.handoff-planner.md` (root) | `.claude/handoff-planner.md` |
| `docs/WORKFLOW_PLAYBOOK.md` lines 87, 160, 210 | `AGENTS.md` | none (CLAUDE.md duplicates the role) |
| `docs/WORKFLOW_PLAYBOOK.md` lines 92, 136 | `docs/HOW_IT_WORKS.md` | `docs/HOW_ECOGO_WORKS.md` |

## Bottlenecks (ranked, to verify)

1. **Multi-agent milestones.** Each fresh Headsman gets a full brief and re-reads context. Cost scales with milestone count. Not measured. Measure one milestone session first.
2. **Scheduled tasks spend budget.** The daily reminder starts a full session every evening. The weekly job runs a broad audit on reset day.
3. **Broken references.** Agents search for files that do not exist.
4. **Rules that cannot be followed as written.** `verification-before-completion` is off in EcoGo. `ponytail-review` is required.
5. **Large docs read in full.** `KNOWN_ISSUES`, `PROJECT_HANDOFF`, `ARCHITECTURE`, and the 124 KB plan. The rules say grep, but nothing enforces it.
6. **Worktree copies in searches.** Unverified; see above.
7. **Always-on overhead.** Skill descriptions and the ponytail activation text at session start.

## Work items

A. Measure each bottleneck. Check which plugin hooks inject text on which events (`hooks.json` in each plugin cache). Measure one milestone's token use with the `explain-usage` skill.
B. Fix the broken references above. Decide whether `AGENTS.md` is needed or whether CLAUDE.md should be the single rulebook.
C. Decide the file layout. Move closed plans and specs, and `FIXES_AND_UPDATES.md` and `SYNOPSIS.md` if unused, into `docs/archive/`. Close resolved entries in `KNOWN_ISSUES.md` and keep the open list short. Add `docs/superpowers/plans/` to the CLAUDE.md skip list or move it.
D. Move on-demand content into project skills, which load only when invoked: the Headsman brief template (playbook section 2.4) and the close-out checklist (section 9.1).
E. Add a PreToolUse hook, modeled on `block-risky-git.mjs`, that denies full reads of `docs/archive/**`, `src/lib/fixtures/**` and `*.json` data unless `offset` or `limit` is given. Exclude `.claude/worktrees/` from searches if verified.
F. Add a read-only doc-finder subagent that returns at most 15 lines, with a cheaper model. Keep Daedalus on the strong model. Consider a cheaper model for builders on simple milestones.
G. Propose pausing `ecogo-owner-todo-reminder` until Tuesday. Shrink `ecogo-weekly-maintenance` to size caps, stale docs and usage. Do usage checks with a script where possible.
H. Plugins: turn off `claude-obsidian` for EcoGo (no conflict found). For `ponytail`, either keep it, or copy only `ponytail-review` into project skills and then disable the plugin. Needs approval.
I. Worktrees: remove `welcome-redesign` and the empty `m16-personal-care` folder after approval. Keep `audit-fixes-075`.
J. Decide whether to keep `skills-lock.json`.

## Acceptance criteria

- `CLAUDE.md` stays at or under 4 KB, and every path it names exists.
- Every file the playbook names exists, or the reference is removed.
- A typical milestone reads fewer bytes. Show the before and after measurement method.
- Minh gets a one-page change list: what changes, the risk, and how to undo it.

## Questions for Minh

1. Pause the daily owner-todo reminder until Tuesday?
2. Keep ponytail (it enforces `ponytail-review` before pushes), or replace it with a project skill?
3. Move unused docs to `docs/archive/`, or delete them?
4. Keep `skills-lock.json`?

## Corrections to the first audit

- An earlier suggestion was to disable `ponytail`. That conflicts with the CLAUDE.md rule that requires `ponytail-review`, so it needs a decision first.
- Earlier worktree staleness came from folder names and dates. Checked with git: `welcome-redesign` is clean and merged, and `audit-fixes-075` has 17 unmerged commits.

## Not verified

- Whether searches include the worktree copies.
- The token cost of a milestone.
- Which app-provided skills can be turned off per project.

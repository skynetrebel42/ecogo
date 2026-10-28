# Workflow audit: change list for Minh (2026-10-28)

Read-only audit for Daedalus III. Nothing was changed, deleted or committed. Every fact below was checked with a command today unless marked *unverified*.

**How I measured.** `/context` and `/usage` are terminal-only, so I used the app's `get_usage`, which reports the same numbers. This session at about 109k tokens: system tools 36.7k, MCP tools 20.1k, skills 10.0k, system prompt 10.4k, MCP server instructions 2.1k. Weekly usage is 4% (resets 3 Nov). Plugin costs come from file sizes (`wc -c` on each skill's header and on each hook's output). **After:** open a fresh EcoGo chat, run `get_usage` (or `/context` in a terminal) before the first message, and compare the Skills, MCP tools and MCP instructions lines.

## Status (updated 2026-10-28 after Daedalus III replied; commits checked with `git log`)

- **Done:** item 4 (commits 5f0660e and ac6aca1) and item 5 Option A (commit e06d229). CLAUDE.md is now 4,024 B.
- **Asked by Daedalus:** items 1, 2, 3 and 8, sent to Minh as one batch. Don't ask about them again.
- **Skipped:** item 7. The playbook is a portable template, so its generic file names are on purpose.
- **Decided by Minh:** item 6, keep ponytail as it is (Option A). Nothing changes.
- **Done:** item 2, replaced by a full uninstall. Minh doesn't use Obsidian, so `claude plugin uninstall` and `marketplace remove` were run, and no settings mention it now. Its old download folder is still in the plugin cache; it isn't loaded. Undo: install it again from GitHub AgriciDaniel/claude-obsidian.
- **Done:** item 9, Option A. `skills-lock.json` is now in `.git/info/exclude` (local only). Undo: delete that line.
- Any change to CLAUDE.md is a proposal for Daedalus to apply.

## Changes, biggest saving first

| # | What changes | Saving | Risk | Undo | Ask |
|---|---|---|---|---|---|
| 1 | **Turn off the Claude for Nonprofits plugin.** Your account installed it automatically (`installedBy: auto`). EcoGo uses none of it. It loads 14 skills (12.5 KB of descriptions), 5 connected tools (Gmail, Calendar, Drive, Granted, Kindora: 62 tool names, about 2k tokens of instructions) and 15 "needs sign-in" lines. **Option A:** turn it off in the desktop app's plugin settings, for every project. **Option B:** add `"claude-for-nonprofits@claude-for-nonprofits": false` to EcoGo's `.claude/settings.local.json` (*unverified*: an account plugin may ignore this). | About 5k tokens per chat | Gmail and Drive tools go away. Nothing in EcoGo uses them. | Turn it back on, or remove the line | 🎨 your call (A or B) |
| 2 | **Turn off claude-obsidian for EcoGo.** Add `"claude-obsidian@agricidaniel-claude-obsidian": false` to `.claude/settings.local.json`. It adds 15 skills (5.8 KB). Its hooks run on every chat start and every reply, but `python3` here is the Windows Store stub, so they do nothing. | About 1.5k tokens per chat, and one wasted process per reply | None found. No EcoGo rule uses it. | Remove the line | 🔒 rule call |
| 3 | **Make the git guard reach every worktree.** All of `.claude/` is excluded in `.git/info/exclude` line 19, so the hook is not in git. Copying it to `settings.json` alone would not fix that. Worktrees get a copy of the settings only when they are created, and the copy goes stale. The 075 worktree has the guard, but superpowers is still on there, so each Headsman chat loads 3.6 KB of superpowers text plus 15 skills. `welcome-redesign` points at a hooks folder that does not exist, so it has no guard. **Option A:** commit `.claude/settings.json` (git guard plus superpowers off) and `.claude/hooks/`, and un-exclude those two paths. **Option B:** keep them local, and add one line to the Headsman brief: copy `.claude/settings.local.json` and `.claude/hooks/` into the new worktree. | 3.6 KB per Headsman chat, and the guard is always present | A: the hooks run in any clone (wanted). B: depends on someone remembering. | A: `git revert` the commit. B: delete the line. | 🔒 rule call (A) |
| 4 | **Replace the stale "Building" line in CLAUDE.md** ("paused … until 27 Oct"; weekly usage is now 4%). New line: `- Building: 075 audit fixes (Headsman IX; H1–H3, M1 done), resumes now.` The new line is shorter, so CLAUDE.md stays under 4,079 B. The "Live" line (46a86d9) still matches origin/main. | Prevents a wrong "paused" call | None | Restore the old line | 🔒 rule call |
| 5 | **Fix the rule that cannot be followed.** CLAUDE.md line 40 names `verification-before-completion`, a superpowers skill that is off in EcoGo. **Option A:** remove the name. The Commands section already says "run before claiming done". **Option B:** turn superpowers back on (+3.6 KB and 15 skills in every chat). | A saves about 30 B | A: none | Restore the text | 🔒 rule call (A) |
| 6 | **Ponytail.** It adds 5.2 KB at every chat start and 5.4 KB to every subagent (each Explore or helper). **Option A:** keep it as it is. **Option B:** copy its `ponytail-review` skill (2.4 KB, MIT license) into `.claude/skills/`, then turn the plugin off for EcoGo. The CLAUDE.md rule still works, but the "lazy senior dev" coding voice goes away. | B: about 1.3k tokens per chat, plus 1.4k per subagent | B: builders lose the keep-it-small coding voice | Turn it back on | 🎨 your call |
| 7 | **Fix the playbook's broken file names.** Lines 35 and 93: `.handoff-builder.md` → `.claude/handoff-knight.md`, and `.handoff-planner.md` → `.claude/handoff-planner.md`. Lines 92 and 136: `HOW_IT_WORKS.md` → `HOW_ECOGO_WORKS.md`. Lines 87, 160 and 210: `AGENTS.md` → `CLAUDE.md` (CLAUDE.md stays the one rulebook). | Agents stop looking for files that do not exist | None | `git revert` | 🔒 rule call |
| 8 | **Remove two leftover worktrees.** `welcome-redesign` has no changes and 0 commits outside main: `git worktree remove` (no force). The `m16-personal-care` folder is empty and not registered. Today, file-name searches (Glob) return worktree copies, for example `node_modules/react` twice. Text searches (Grep) skip all of `.claude/`, including the handoff notes. Keep `audit-fixes-075` (17 unmerged commits). | Cleaner searches | None. Both are already merged or empty. | `git worktree add` the branch again | 🔒 rule call |
| 9 | **`skills-lock.json`** (267 B, the caveman install record, untracked). **Option A:** add it to `.git/info/exclude` (kept, out of git status). **Option B:** delete it. | Cleaner `git status` | None | Re-create it or remove the line | 🎨 your call |

## New skills Minh installed this week (checked 2026-10-28)

| Skill | Safe? | Useful for EcoGo? |
|---|---|---|
| caveman (25 Oct) | Yes. Text only, no code. | Little. It makes replies terse, which works against the "plain terms" rule. It loads only when asked for. It mentions two companion skills (`ultracave`, `megacave`) that are not installed. |
| prompt-master (25 Oct) | Yes. Text only (3 files plus a git copy), no code. | Some. It helps when writing prompts for ChatGPT or Figma. |
| claude-obsidian plugin (25 Oct) | Looks safe. I searched its 95 scripts for internet libraries and found none. PRIVACY.md says it stays on this computer, and its hooks stay silent unless you opt in. I did not do a full code review. | No, unless you keep notes in Obsidian. Item 2 already turns it off for EcoGo. |
| 38 skills in `~/.agents/skills` | Not loaded. Only 5 are linked into Claude (code-review, diagnosing-bugs, pr, resolving-merge-conflicts, tdd). The other 33 cost nothing. | No action. |

**Graphify (the code map) is out of date.** The last full rebuild was 21 Oct. `src/` has had 23 commits since then, and today's check-up only did a partial scan. The last rebuild cost about 366k input tokens. Rebuild once after 075 merges, not before, so it isn't paid for twice.

## Corrections to today's check-up and the brief

- The three "missing paths" are not missing. `make-board.mjs` is in `.claude/board/`. `edge.mjs` is in `docs/superpowers/plans/2026-10-01-m7-assets/`. `livecheck.mjs` is described as a scratch file on purpose.
- The daily owner-todo reminder is already **off** (the brief says on). Weekly maintenance ran today and next runs on 3 Nov (local time).
- The nonprofits plugin is not in `~/.claude/settings.json`. It comes from the claude.ai account, so a settings line may not reach it (see item 1).

## Not measured or left alone

- The token cost of one milestone (biggest suspected cost). Next step: run `explain-usage` in the 075 Headsman chat when it finishes.
- Brief items C–F (moving docs to the archive, project skills, a read-guard hook, a doc-finder subagent). These are bigger changes. Decide them after items 1–3 show how much the cheap fixes save.
- The 124 KB plan `docs/superpowers/plans/2026-10-02-data-ownership.md` is not on the CLAUDE.md skip list. Moving it to `docs/archive/` costs 0 bytes in CLAUDE.md.
- Old superpowers 6.4.1 cache (2.5 MB on disk, no token cost).

In plain terms: two add-ons you never use (Nonprofits and Obsidian) are loaded into every EcoGo chat. Turning them off saves about 6,500 tokens each time, and nothing is lost. The safety lock that stops risky git commands lives only on this computer and goes stale in new workspaces; item 3 fixes that. The rest is housekeeping: a stale "paused" line, a rule naming a tool that is switched off, wrong file names in the playbook, and two empty old workspaces. Each item needs your yes, and each one can be undone.

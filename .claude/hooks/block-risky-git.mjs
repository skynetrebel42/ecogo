// PreToolUse hook (Bash + PowerShell): blocks the git commands the EcoGo court's standing rules forbid on the shared
// main. Exit 2 = blocked; Claude sees the stderr message. Normal `git push` stays allowed (asked of Minh in chat first).
// Self-check: node .claude/hooks/block-risky-git.mjs --test
import { readFileSync } from "node:fs";

const G = String.raw`\bgit(?:\s+-[Cc]\s+(?:"[^"]*"|\S+))*\s+`; // "git ", also "git -C <dir> "
const RULES = [
  [`${G}add\\b.*\\s(-A|--all|\\.)(\\s|$)`, "add everything: commit by exact path"],
  [`${G}add\\b.*\\s(-f|--force)\\b`, "force-add an ignored file"],
  [`${G}commit\\b.*\\s(-(?!-)[a-zA-Z]*a[a-zA-Z]*|--all)\\b`, "commit -a: commit by exact path"],
  [`${G}commit\\b.*\\s--amend\\b`, "amend"],
  [`${G}reset\\s+(--hard|--soft|--mixed|--merge|--keep|HEAD[~^]|[0-9a-f]{7,}|origin/)`, "reset"],
  [`${G}rebase\\b`, "rebase"],
  [`${G}stash\\b`, "stash"],
  [`${G}push\\b.*(\\s--force(-with-lease)?\\b|\\s-f\\b|\\s\\+\\S)`, "force-push"],
  [`${G}clean\\b.*\\s-[a-zA-Z]*f`, "clean -f"],
  [`${G}branch\\b.*\\s-D\\b`, "branch -D"],
  [`${G}(checkout|restore)\\s+(--\\s+)?\\.(\\s|$)`, "discard all changes"],
  [`${G}filter-(branch|repo)\\b`, "history rewrite"],
].map(([re, why]) => [new RegExp(re), why]);

// Quoted text (commit messages, paths) can't trigger a rule: "-all" in a message isn't a flag.
export const blocked = (cmd) => {
  const bare = cmd.replace(/"[^"]*"|'[^']*'/g, '""');
  return RULES.find(([re]) => re.test(bare))?.[1] ?? null;
};

if (process.argv[2] === "--test") {
  const no = ["git add -A", "git add .", "git -C x add --all", 'git commit -am "x"', "git commit --amend -m x",
    "git reset --hard", "git reset HEAD~1", "git rebase main", "git stash list", "git push --force", "git push -f origin main",
    "git push origin +main", "git clean -fd", "git branch -D m9", "git checkout .", "git add -f docs/COURT.md"];
  const ok = ["git add src/a.ts docs/b.md", "git commit -m \"fix: no -all here\" -- src/a.ts", "git commit --author=x -m y",
    "git push origin main", "git reset -- src/a.ts", "git status --short", "git worktree add .worktrees/m9 -b m9", "git merge m9"];
  for (const c of no) if (!blocked(c)) throw new Error(`should block: ${c}`);
  for (const c of ok) if (blocked(c)) throw new Error(`should allow: ${c} (${blocked(c)})`);
  console.log(`ok: ${no.length} blocked, ${ok.length} allowed`);
} else {
  let cmd = "";
  try { cmd = JSON.parse(readFileSync(0, "utf8")).tool_input?.command ?? ""; } catch { process.exit(0); }
  const why = blocked(cmd);
  if (why) {
    console.error(`BLOCKED (EcoGo team rule: ${why}): '${cmd}'. Shared main forbids this. If it's truly needed, tell the King; only Minh can run it.`);
    process.exit(2);
  }
}

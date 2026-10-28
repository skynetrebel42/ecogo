// SessionStart: one line when EcoGo's weekly check-up is overdue (date written by the ecogo-weekly-maintenance task).
import { readFileSync } from "node:fs";

const dir = process.env.CLAUDE_PROJECT_DIR ?? ".";
let days = Infinity;
try { days = Math.floor((Date.now() - Date.parse(readFileSync(`${dir}/.claude/last-checkup.txt`, "utf8").trim())) / 864e5); } catch {}
if (days > 8) {
  const msg = `EcoGo check-up due: ${Number.isFinite(days) ? `last one ${days} days ago` : "none recorded yet"} (Tuesday task "ecogo-weekly-maintenance"; Minh can press Run now). Quick look meanwhile: /usage and /context.`;
  console.log(JSON.stringify({ systemMessage: msg, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg } }));
}

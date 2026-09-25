// parse.ts — raw ingredient text → flat list of ingredient items (original letter case kept for display).
// Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §6.

const OPEN = "([{";
const CLOSE = ")]}";

/** Label filler that prefixes real ingredients; the items after it are kept. */
const FILLER_PREFIXES: RegExp[] = [
  /^ingredients?\s*:\s*/i,
  /^(?:contains\s+)?(?:less\s+than\s+)?\d+(?:\.\d+)?\s*%\s+(?:or\s+less\s+)?of(?:\s+(?:each\s+of\s+)?the\s+following)?\s*:?\s*/i,
  /^(?:in)?active(?:\s+ingredients?)?\s*:\s*/i,
];

/** "no titanium dioxide", "free from aspartame", "nitrite-free" state an absence, not an ingredient. */
const NEGATION = /^(?:no|free\s+from|without)\s|\b[a-z0-9]+-free\b/i;

export function parseIngredients(text: string): string[] {
  if (typeof text !== "string") return [];
  const cleaned = text
    .replace(/[   ]/g, " ")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\bmay\s+contain\b[^.]*(?:\.|$)/gi, " ")
    .replace(/(^|\.)\s*contains\s*:[^.]*(?:\.|$)/gi, "$1 ")
    .replace(/\band\s*\/\s*or\b/gi, ",");
  const out: string[] = [];
  for (const part of splitTopLevel(cleaned)) expand(part, out);
  return out;
}

/** Split on commas and semicolons outside brackets; a comma between two digits ("1,4-dioxane") is not a separator. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    const digitComma = ch === "," && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "");
    if (depth === 0 && (ch === ";" || (ch === "," && !digitComma))) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/** "parent (a, b) rest" → parent + rest, then a and b — at every nesting depth; unclosed brackets run to the end. */
function expand(raw: string, out: string[]): void {
  const item = stripFiller(raw.trim());
  const open = item.search(/[([{]/);
  if (open === -1) {
    emit(item, out);
    return;
  }
  let depth = 0;
  let close = -1;
  for (let i = open; i < item.length; i++) {
    if (OPEN.includes(item[i])) depth++;
    else if (CLOSE.includes(item[i]) && --depth === 0) {
      close = i;
      break;
    }
  }
  const inner = item.slice(open + 1, close === -1 ? item.length : close);
  const rest = close === -1 ? "" : item.slice(close + 1);
  expand(`${item.slice(0, open)} ${rest}`, out);
  for (const sub of splitTopLevel(inner)) expand(sub, out);
}

function emit(raw: string, out: string[]): void {
  const item = stripFiller(raw.replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim())
    .replace(/^[\s.,:;*•-]+|[\s.,:;*•]+$/g, "");
  if (item && !NEGATION.test(item)) out.push(item);
}

function stripFiller(s: string): string {
  let prev: string;
  do {
    prev = s;
    for (const re of FILLER_PREFIXES) s = s.replace(re, "");
  } while (s !== prev);
  return s.trim();
}

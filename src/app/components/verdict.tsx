// verdict.tsx — how a concern level looks, shared by the product page and product lists.
// Spec: docs/superpowers/specs/2026-09-30-m4-concern-levels-design.md §4.4: one hue that darkens with the official
// level, always word + icon + shade (never colour alone), and no green.

import type { CSSProperties } from "react";
import { HelpCircle } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { VERDICT_RANK, type Verdict } from "../../lib/safety/analyze";
import { assessProduct, type Assessment } from "../../lib/safety/assess";

type IconProps = { size?: number; style?: CSSProperties; className?: string };

/** A circle filled by level: ○ empty, ◔ quarter, ◑ half, ● full. */
function levelIcon(fill: 0 | 0.25 | 0.5 | 1) {
  return function LevelIcon({ size = 16, style, className }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        style={style} className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill={fill === 1 ? "currentColor" : "none"} />
        {fill === 0.25 && <path d="M12 12 L12 3 A9 9 0 0 1 21 12 Z" fill="currentColor" stroke="none" />}
        {fill === 0.5 && <path d="M12 12 L12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" stroke="none" />}
      </svg>
    );
  };
}

export const VERDICT_STYLE: Record<Verdict, {
  label: string; short: string; color: string; bg: string; gradient: string; Icon: (p: IconProps) => JSX.Element;
}> = {
  none:       { label: "Nothing flagged",  short: "Nothing flagged",  color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: levelIcon(0) },
  some:       { label: "Some concern",     short: "Some concern",     color: "#BE123C", bg: "#FFE4E6", gradient: "linear-gradient(160deg, #4c0519, #e11d48)", Icon: levelIcon(0.25) },
  high:       { label: "High concern",     short: "High concern",     color: "#9F1239", bg: "#FECDD3", gradient: "linear-gradient(160deg, #3b0414, #be123c)", Icon: levelIcon(0.5) },
  known:      { label: "Known carcinogen", short: "Known carcinogen", color: "#881337", bg: "#FDA4AF", gradient: "linear-gradient(160deg, #1f020a, #881337)", Icon: levelIcon(1) },
  "no-data":  { label: "Not enough data",  short: "No data",          color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
  "non-food": { label: "Ingredient check covers food & drinks for now", short: "Food only", color: "#4B5563", bg: "#F3F4F6", gradient: "linear-gradient(160deg, #1f2937, #6b7280)", Icon: HelpCircle },
};

const NO_DATA: Assessment = { verdict: "no-data", flags: [], checkedCount: 0, concerns: [] };

/** Never let the engine blank a screen: an unexpected error shows "Not enough data" and is logged. */
export function safeAnalyze(p: Product): Assessment {
  try {
    return assessProduct({ ...p, additiveCodes: p.source?.additiveCodes });
  } catch (err) {
    console.error("[safety] assessment failed for product", p.id, err);
    return NO_DATA;
  }
}

/** True when the product gets the 🔥 "forms when cooked" marker. */
/** "Fewest concerns" order (search results, alternatives): lower level first, then fewer flagged ingredients. */
export const fewestConcerns = (x: Assessment, y: Assessment) =>
  VERDICT_RANK[x.verdict] - VERDICT_RANK[y.verdict] || x.flags.length - y.flags.length;

export const formsWhenCooked =(a: Assessment) => a.concerns.some(c => c.kind === "cooking");

/** "Known carcinogen · 2 findings", "Some concern · 1 finding", or the plain label. */
export function verdictHeadline(a: Assessment): string {
  const n = a.flags.length + a.concerns.filter(c => c.kind === "food").length;
  if (a.verdict === "known" || a.verdict === "high" || a.verdict === "some") return `${VERDICT_STYLE[a.verdict].label} · ${n} finding${n === 1 ? "" : "s"}`;
  if (a.verdict === "none") return `Nothing flagged among ${a.checkedCount} additives with an official finding`;
  return VERDICT_STYLE[a.verdict].label;
}

/** Small category icon for neutral product cards (decision L3: no colour per food type). */
const CATEGORY_ICON: Record<string, string> = {
  Beverages: "🥤", Bread: "🍞", Breakfast: "🥣", Condiments: "🧂", Dairy: "🧀", Frozen: "🧊", Meat: "🥩", Snacks: "🍪",
  Cleaning: "🧽", "Personal Care": "🧴", "Baby Care": "🍼", Medicine: "💊", "Pet Food": "🐾",
};
export const categoryIcon = (category: string) => CATEGORY_ICON[category] ?? "🛒";

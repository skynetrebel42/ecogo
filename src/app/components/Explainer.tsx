// Explainer.tsx — Home's "Hidden risks, explained" pages. Plain text over official sources only.
// Spec: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.3.

import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { FDA_RULE } from "../../lib/nutrition";
import { PROCESSED_MEAT, ACRYLAMIDE } from "../../lib/safety/foodConcerns";
import { VERDICT_STYLE } from "./verdict";

export type ExplainerId = "not-healthy" | "badge-levels";

interface Cite { body: string; finding: string; url: string; quote: string; checkedOn: string }

const FDA: Cite = { body: "FDA", finding: "FDA's 5/20 rule for % Daily Value", url: FDA_RULE.url, quote: FDA_RULE.quote, checkedOn: FDA_RULE.checkedOn };
// Hand-checked 2026-10-01 on the WHO Q&A page (the IARC PDF's second sentence couldn't be read as text).
const WHO_EVIDENCE: Cite = {
  body: "WHO", finding: "The categories describe how strong the evidence is, not how likely harm is",
  url: PROCESSED_MEAT.sources[0].url, checkedOn: "2026-10-01",
  quote: "The categories of the classification indicate the strength of the evidence as to whether a substance is capable of causing cancer",
};

export const EXPLAINERS: Record<ExplainerId, { title: string; teaser: string; sources: Cite[] }> = {
  "not-healthy": {
    title: "“Nothing flagged” isn’t “healthy”",
    teaser: "The badge checks for official hazards, not sugar, fat or salt.",
    sources: [FDA],
  },
  "badge-levels": {
    title: "What the badge levels mean",
    teaser: "Levels show how strong the evidence is, not how much harm one serving does.",
    sources: [WHO_EVIDENCE, PROCESSED_MEAT.sources[2], PROCESSED_MEAT.sources[0], ACRYLAMIDE.sources[0], ACRYLAMIDE.sources[4]],
  },
};

const LEVELS = [
  { v: "none", basis: "No official finding for its additives or the food itself" },
  { v: "some", basis: "IARC Group 2B, or an EU warning label" },
  { v: "high", basis: "IARC Group 2A, a ban in the EU or US, or contains processed meat" },
  { v: "known", basis: "IARC Group 1 (for example, a processed meat product)" },
] as const;

function Body({ id }: { id: ExplainerId }): ReactNode {
  if (id === "not-healthy") return (
    <>
      <p>EcoGo’s badge looks for hazards with an official finding: additives (IARC, EU, FDA) and processed meat. It doesn’t rate nutrition.</p>
      <p>For that, look at the Nutrition section. By the FDA’s rule, 20% of the Daily Value or more per serving is high.</p>
      <p>Example: Oreo shows “Nothing flagged”, but one serving has 28% of the Daily Value for added sugar.</p>
    </>
  );
  return (
    <>
      <table className="w-full text-xs border-collapse">
        <tbody>
          {LEVELS.map(({ v, basis }) => {
            const s = VERDICT_STYLE[v];
            return (
              <tr key={v} className="border-b border-border">
                <td className="py-2 pr-3 align-top whitespace-nowrap font-bold" style={{ color: s.color }}>
                  <span className="inline-flex items-center gap-1"><s.Icon size={12} /> {s.label}</span>
                </td>
                <td className="py-2 align-top text-muted-foreground">{basis}</td>
              </tr>
            );
          })}
          <tr>
            <td className="py-2 pr-3 align-top whitespace-nowrap font-bold">🔥 Forms when cooked</td>
            <td className="py-2 align-top text-muted-foreground">Acrylamide can form when starchy food is fried or baked. A marker only: it never changes the badge.</td>
          </tr>
        </tbody>
      </table>
      <p><strong>The key point:</strong> the levels describe how strong the evidence is that something can cause cancer, not how much harm one serving does. Processed meat and tobacco are both Group 1, but IARC says that doesn’t make them equally dangerous.</p>
    </>
  );
}

export default function Explainer({ id, onBack }: { id: ExplainerId; onBack: () => void }) {
  const e = EXPLAINERS[id];
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-extrabold leading-tight">{e.title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm leading-relaxed" style={{ scrollbarWidth: "none" }}>
        <Body id={id} />
        <h2 className="font-bold text-sm pt-2">Sources</h2>
        <ul className="space-y-2.5">
          {e.sources.map(s => (
            <li key={s.quote} className="bg-card border border-border rounded-2xl p-3 text-xs">
              <p className="font-bold">{s.body}: {s.finding}</p>
              <p className="text-muted-foreground italic mt-1">“{s.quote}”</p>
              <div className="flex items-center justify-between mt-1.5">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold inline-flex items-center gap-1">
                  Read the source <ExternalLink size={10} />
                </a>
                <span className="text-[10px] text-muted-foreground">Source checked {s.checkedOn}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

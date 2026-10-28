// Findings.tsx — the finding rows with their sources, as the product page shows them; 071 O (GA-09): the ingredient
// check shows the same rows for a photo, a paste or a typed list.

import { useState } from "react";
import { ChevronDown, ExternalLink, Flame, Info } from "lucide-react";
import { MORE_DATA_MEANING, isMoreData, type CareAnalysis } from "../../lib/safety/personalCare";
import type { Severity, Source } from "../../lib/safety/library";
import type { Assessment } from "../../lib/safety/assess";
import { BENZENE_NOTE } from "../../lib/safety/foodConcerns";
import { EXPLAINERS, type ExplainerId } from "./Explainer";
import { VERDICT_STYLE } from "./verdict";

/** 063 F3: FDA's own reading of "more data needed", once, when any sunscreen row says it. */
function MoreDataLine({ notes, className = "" }: { notes: CareAnalysis["notes"]; className?: string }) {
  if (!notes.some(n => isMoreData(n.note))) return null;
  const [s] = MORE_DATA_MEANING.sources;
  return (
    <p className={`text-xs leading-snug text-gray-700 ${className}`}>
      {MORE_DATA_MEANING.text} <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.body}, sunscreen Q&amp;A (Q9)</a>
    </p>
  );
}

/** One row: an additive flag, a food-level concern, or an info note (M16 personal care, 064 H2 benzene; `info`).
 *  `learn`: a Learn page the open row links to (064). */
export interface Finding { id: string; name: string; severity?: Severity; info?: boolean; concern: string; cite?: string; detail: string; context?: string; sources: Source[]; learn?: ExplainerId }

/** 064 H2: the benzene info row for the two label words benzeneNote found. */
export const benzeneFinding = (m: [string, string]): Finding =>
  ({ id: "note-benzene", name: BENZENE_NOTE.name, info: true, concern: BENZENE_NOTE.text, cite: BENZENE_NOTE.cite, detail: `Listed as “${m[0]}” and “${m[1]}”`, sources: BENZENE_NOTE.sources, learn: "hidden-risks" });

/** Findings grouped by where they come from; empty groups are dropped. `care`: regulator context (FDA's dandruff-drug
 *  line, 063 F4) shows in the row next to the EU ban, not behind it. `foodNotes`: food info rows (064 H2). */
export function findingGroups(a: Pick<Assessment, "flags" | "concerns">, notes: CareAnalysis["notes"] = [], care = false, foodNotes: Finding[] = []): { title: string; findings: Finding[] }[] {
  const fromConcerns = (kind: "food" | "cooking") => a.concerns.filter(c => c.kind === kind).map(c => ({
    id: c.id, name: c.name, severity: c.severity, concern: c.concern, detail: c.reason, context: c.context, sources: c.sources, learn: c.learn,
  }));
  return [
    { title: "In the ingredients", findings: a.flags.map(({ entry, matchedText }) => ({
      id: entry.id, name: entry.name, severity: entry.severity, detail: `Listed as “${matchedText}”`, sources: entry.sources,
      ...(care && entry.context ? { concern: `${entry.concern} ${entry.context}` } : { concern: entry.concern, context: entry.context }),
    })) },
    { title: "The food itself", findings: fromConcerns("food") },
    { title: "Formed when cooked", findings: fromConcerns("cooking") },
    // M16 N3–N5: info rows; they don't change the badge.
    { title: "Good to know", findings: [...notes.map(({ note, matchedText }) => ({
      id: `note-${note.id}`, name: note.name, info: true, concern: note.text, detail: `Listed as “${matchedText}”`, sources: note.sources,
    })), ...foodNotes] },
  ].filter(g => g.findings.length > 0);
}

const COOKING_LOOK = { short: "Forms when cooked", color: "#4B5563", bg: "#F3F4F6", Icon: Flame };
const INFO_LOOK = { short: "Info", color: "#4B5563", bg: "#F3F4F6", Icon: Info }; // never changes the badge

function FindingRow({ finding: entry, open, onToggle, onLearn }: { finding: Finding; open: boolean; onToggle: () => void; onLearn: (id: ExplainerId, from: HTMLElement) => void }) {
  const look = entry.info ? INFO_LOOK : entry.severity ? VERDICT_STYLE[entry.severity] : COOKING_LOOK;
  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <look.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: look.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{entry.name}</span>
            <span className="text-nano font-bold px-1.5 py-0.5 rounded-full" style={{ background: look.bg, color: look.color }}>{look.short}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{entry.concern}</p>
          {entry.cite && <p className="text-nano text-gray-500">{entry.cite}</p>}
          <p className="text-micro text-gray-500 mt-0.5">{entry.detail}</p>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 ml-7 space-y-2">
          {entry.context && (
            <p className="text-mini text-gray-600 bg-gray-50 rounded-xl p-2.5 leading-snug">
              <strong>Regulator context:</strong> {entry.context}
            </p>
          )}
          {entry.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-mini leading-snug text-primary">
              <span className="font-bold">{s.body}:</span> {s.finding} <ExternalLink size={9} className="inline" />
              <span className="block text-nano text-gray-500">Source checked {s.checkedOn}</span>
            </a>
          ))}
          {entry.learn && (
            <button onClick={e => onLearn(entry.learn!, e.currentTarget)} className="text-mini font-bold text-primary underline text-left">
              Read: {EXPLAINERS[entry.learn].title}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The groups as cards of rows, one row open at a time; FDA's "more data" line closes "Good to know". */
export default function Findings({ groups, notes = [], onLearn }: {
  groups: ReturnType<typeof findingGroups>; notes?: CareAnalysis["notes"]; onLearn: (id: ExplainerId, from: HTMLElement) => void;
}) {
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  return <>
    {groups.map(g => (
      <div key={g.title} className="bg-white text-gray-900 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">{g.title}</div>
        <div className="divide-y divide-gray-50">
          {g.findings.map(f => (
            <FindingRow key={f.id} finding={f} open={openFlag === f.id} onLearn={onLearn}
              onToggle={() => setOpenFlag(openFlag === f.id ? null : f.id)} />
          ))}
        </div>
        {g.title === "Good to know" && <MoreDataLine notes={notes} className="px-4 pb-3" />}
      </div>
    ))}
  </>;
}

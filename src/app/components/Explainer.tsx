// Explainer.tsx — Home's Learn pages. Plain text over official sources only; "How EcoGo checks" describes the app itself.
// Specs: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.3; seed oils, pesticides and ultra-processed
// foods: docs/superpowers/specs/2026-10-01-m71-explainers-design.md (sources §3, text §4); the Learn tiles and
// "How EcoGo checks": docs/superpowers/specs/2026-10-06-m12-home-tiles-design.md.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Apple, Gauge, Droplet, Sprout, Factory, ListChecks, type LucideIcon } from "lucide-react";
import { LEARN_SOURCES, type ExplainerId } from "../../lib/learnSources";
import { VERDICT_STYLE } from "./verdict";

export type { ExplainerId };

/** Home's Learn tiles read these, in this order (M12 spec §2): a short `label`, a `tile` colour at 7:1+ with white text
 *  (no red or pink: those mean "concern"), an icon. The page keeps the full `title`, which is also the tile's accessible name.
 *  Sources: lib/learnSources.ts (SOURCE-01); "How EcoGo checks" describes EcoGo itself, so it has none (spec D2). */
export const EXPLAINERS: Record<ExplainerId, { title: string; label: string; tile: string; Icon: LucideIcon }> = {
  "not-healthy": { title: "“Nothing flagged” isn’t “healthy”", label: "Not a health score", tile: "#0E5E4A", Icon: Apple },
  "badge-levels": { title: "What the badge levels mean", label: "Badge levels", tile: "#14538F", Icon: Gauge },
  "seed-oils": { title: "Seed oils: what the evidence says", label: "Seed oils", tile: "#7A480A", Icon: Droplet },
  "pesticides": { title: "Pesticides: what a label can’t tell you", label: "Pesticides", tile: "#33600F", Icon: Sprout },
  "ultra-processed": { title: "Ultra-processed foods: no official line yet", label: "Ultra-processed", tile: "#4A42A6", Icon: Factory },
  "how-it-works": { title: "How EcoGo checks a product", label: "How EcoGo checks", tile: "#4F4E4A", Icon: ListChecks },
};

// Moved word for word from Home's old empty-state box (M12 D2).
const HOW_STEPS = [
  "Reads the real label from USDA (the maker's own data), or Open Food Facts, clearly marked crowd-sourced.",
  "Checks ingredients and the food itself against official findings from IARC, the EU and the FDA.",
  "Shows the strongest finding, with its source, plus sugar, fat and salt per serving.",
];

const LEVELS = [
  { v: "none", basis: "Nothing matched EcoGo’s list of official findings (this doesn’t mean none exist)" },
  { v: "some", basis: "IARC Group 2B, or an EU warning label" },
  { v: "high", basis: "IARC Group 2A, a ban in the EU or US, or contains processed meat" },
  { v: "known", basis: "IARC Group 1 (for example, a processed meat product)" },
] as const;

function Body({ id, onOpen }: { id: ExplainerId; onOpen: (id: ExplainerId) => void }): ReactNode {
  if (id === "seed-oils") return (
    <>
      <p>Seed oils are mostly unsaturated fat, but the mix varies. In USDA's data, soybean and corn oil are more than half polyunsaturated fat (including omega‑6); canola oil is mostly monounsaturated; sunflower oil can be either, depending on the type.</p>
      <p>The American Heart Association (2024) supports omega‑6 as part of a healthy diet: polyunsaturated fats lower bad cholesterol and the risk of heart disease and stroke. The popular claim that they cause inflammation isn’t supported.</p>
      <p><strong>The documented concern:</strong> refining oils at high heat can create contaminants (glycidyl esters, 3‑MCPD). EFSA (2016) found glycidol genotoxic and carcinogenic. Levels are highest in palm oil (not a seed oil), and the EU has set legal maximum levels since 2018.</p>
      <p><strong>What EcoGo can do:</strong> contaminant levels aren’t on a label, so EcoGo doesn’t flag oils.</p>
    </>
  );
  if (id === "pesticides") return (
    <>
      <p>Pesticide residues aren’t listed on ingredient labels, so EcoGo can’t check them for any product.</p>
      <p>In the US, EPA sets legal limits and FDA tests food: in fiscal year 2023, 97.2% of domestic samples were within them.</p>
      <p><strong>Glyphosate (Roundup):</strong> IARC (2015) classified it “probably carcinogenic to humans” (Group 2A). EPA (2017) says it’s “not likely to be carcinogenic to humans”. In 2022 a court vacated the human health part of EPA’s review; EPA says that finding is still current. EFSA (2023) found no critical areas of concern.</p>
      <p>They disagree partly because IARC rates how strong the evidence of a hazard is, while EPA and EFSA judge the risk at real-world exposure. See{" "}
        <button onClick={() => onOpen("badge-levels")} aria-label="Open: What the badge levels mean" className="text-primary font-semibold underline">What the badge levels mean</button>.
      </p>
    </>
  );
  if (id === "ultra-processed") return (
    <>
      <p>The FDA says researchers have found links between ultra-processed foods and heart disease, obesity and some cancers.</p>
      <p>There’s no official US definition yet. The FDA and USDA asked for input in July 2025. In August 2026 HHS sent the first proposed definition for final review.</p>
      <p><strong>What EcoGo can do:</strong> without an official definition, EcoGo doesn’t label foods “ultra-processed”. It does flag what has official backing: processed meat (IARC Group 1), additives with official findings, and high sugar, saturated fat and salt by the FDA’s 5/20 rule.</p>
    </>
  );
  if (id === "how-it-works") return (
    <ol className="space-y-2.5">
      {HOW_STEPS.map((s, i) => (
        <li key={i} className="flex gap-2.5 items-start">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
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
      <p><strong>The key point:</strong> Each level shows the strongest official finding EcoGo matched, and the table says what kind it is. IARC’s groups rate how strong the evidence is that something can cause cancer. EU warning labels and EU or US bans are regulators’ decisions, and not all of them are about cancer: the EU label on Red 40, for example, warns about activity and attention in children. None of them measures how much harm one serving does. Processed meat and tobacco are both IARC Group 1, but IARC says that doesn’t make them equally dangerous.</p>
    </>
  );
}

export default function Explainer({ id, onBack }: { id: ExplainerId; onBack: () => void }) {
  // A link inside a page (pesticides → badge levels) opens that page here; Back returns to the page it came from.
  const [linked, setLinked] = useState<ExplainerId | null>(null);
  const shown = linked ?? id;
  const e = EXPLAINERS[shown];
  const cards = LEARN_SOURCES[shown].filter(s => s.card); // the rest back a claim without a card (S2a)
  // 054 ACCESS-01: focus starts at the page's heading, so screen readers and keyboards land in it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [shown]);
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => (linked ? setLinked(null) : onBack())} aria-label="Back" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <h1 ref={heading} tabIndex={-1} className="text-base font-extrabold leading-tight focus:outline-none">{e.title}</h1>
      </div>
      <div key={shown} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm leading-relaxed" style={{ scrollbarWidth: "none" }}>
        <Body id={shown} onOpen={setLinked} />
        {cards.length > 0 && <>
          <h2 className="font-bold text-sm pt-2">Sources</h2>
          <ul className="space-y-2.5">
            {cards.map(s => (
              <li key={s.quote} className="bg-card border border-border rounded-2xl p-3 text-xs">
                <p className="font-bold">{s.body}: {s.finding}</p>
                <p className="text-muted-foreground italic mt-1">“{s.quote}”</p>
                <div className="flex items-center justify-between mt-1.5">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold inline-flex items-center gap-1">
                    Read the source <ExternalLink size={10} />
                  </a>
                  <span className="text-micro text-muted-foreground">Source checked {s.checkedOn}</span>
                </div>
              </li>
            ))}
          </ul>
        </>}
      </div>
    </div>
  );
}

// Explainer.tsx — Home's Learn pages. Plain text over official sources only; "How EcoGo checks" describes the app itself.
// Specs: docs/superpowers/specs/2026-10-01-m7-home-redesign-design.md §4.3; seed oils, pesticides and ultra-processed
// foods: docs/superpowers/specs/2026-10-01-m71-explainers-design.md (sources §3, text §4); the Learn tiles and
// "How EcoGo checks": docs/superpowers/specs/2026-10-06-m12-home-tiles-design.md.

import { useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Apple, Gauge, Droplet, Sprout, Factory, ListChecks, type LucideIcon } from "lucide-react";
import { FDA_RULE } from "../../lib/nutrition";
import { PROCESSED_MEAT, ACRYLAMIDE } from "../../lib/safety/foodConcerns";
import { VERDICT_STYLE } from "./verdict";

export type ExplainerId = "not-healthy" | "badge-levels" | "seed-oils" | "pesticides" | "ultra-processed" | "how-it-works";

interface Cite { body: string; finding: string; url: string; quote: string; checkedOn: string }

const FDA: Cite = { body: "FDA", finding: "FDA's 5/20 rule for % Daily Value", url: FDA_RULE.url, quote: FDA_RULE.quote, checkedOn: FDA_RULE.checkedOn };
// Hand-checked 2026-10-01 on the WHO Q&A page (the IARC PDF's second sentence couldn't be read as text).
const WHO_EVIDENCE: Cite = {
  body: "WHO", finding: "The categories describe how strong the evidence is, not how likely harm is",
  url: PROCESSED_MEAT.sources[0].url, checkedOn: "2026-10-01",
  quote: "The categories of the classification indicate the strength of the evidence as to whether a substance is capable of causing cancer",
};

// M7.1 sources (spec §3). Every quote was re-checked word for word on its live page on 2026-10-01; heart.org (blocks
// scripts), EUR-Lex and HHS were read in a browser. Explainer-only: none of them changes the badge (spec E2).
const M71_CHECKED = "2026-10-01";
const AHA_URL = "https://www.heart.org/en/news/2024/08/20/theres-no-reason-to-avoid-seed-oils-and-plenty-of-reasons-to-eat-them";
const AHA_OMEGA6: Cite = { body: "AHA", finding: "American Heart Association News (2024): omega-6 fats belong in a healthy diet", url: AHA_URL, checkedOn: M71_CHECKED,
  quote: "The American Heart Association supports the inclusion of omega-6 fatty acids as part of a healthy diet." };
const AHA_POLY: Cite = { body: "AHA", finding: "Polyunsaturated fats lower bad cholesterol and the risk of heart disease and stroke", url: AHA_URL, checkedOn: M71_CHECKED,
  quote: "Polyunsaturated fats help the body reduce bad cholesterol, lowering the risk for heart disease and stroke." };
const AHA_INFLAMMATION: Cite = { body: "AHA", finding: "Stanford's Christopher Gardner, quoted by the AHA: calling omega-6 fats pro-inflammatory is wrong", url: AHA_URL, checkedOn: M71_CHECKED,
  quote: "But to flip that and suggest this means omega-6 fats are pro-inflammatory is wrong." };
const EFSA_2016 = "https://www.efsa.europa.eu/en/press/news/160503a";
const EFSA_GLYCIDOL: Cite = { body: "EFSA", finding: "2016 opinion: glycidol is genotoxic and carcinogenic", url: EFSA_2016, checkedOn: M71_CHECKED,
  quote: "There is sufficient evidence that glycidol is genotoxic and carcinogenic" };
const EFSA_PALM: Cite = { body: "EFSA", finding: "2016 opinion: the highest levels were in palm oils and palm fats", url: EFSA_2016, checkedOn: M71_CHECKED,
  quote: "The highest levels of GE, as well as 3-MCPD and 2-MCPD (including esters) were found in palm oils and palm fats" };
const EU_GE: Cite = { body: "EU", finding: "Regulation (EU) 2018/290 sets legal maximum levels for glycidyl esters in oils and fats",
  url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32018R0290", checkedOn: M71_CHECKED,
  quote: "Glycidyl fatty acid esters are food contaminants found at highest levels in refined vegetable oils and fats." };

const EPA_GLY_URL = "https://www.epa.gov/ingredients-used-pesticide-products/glyphosate";
const IARC_GLYPHOSATE: Cite = { body: "IARC", finding: "2015 (Monographs vol. 112): glyphosate is Group 2A",
  url: "https://www.iarc.who.int/featured-news/media-centre-iarc-news-glyphosate/", checkedOn: M71_CHECKED,
  quote: "probably carcinogenic to humans" };
const EPA_GLYPHOSATE: Cite = { body: "EPA", finding: "2017 assessment of glyphosate's cancer risk", url: EPA_GLY_URL, checkedOn: M71_CHECKED,
  quote: "glyphosate is not likely to be carcinogenic to humans" };
const EPA_COURT: Cite = { body: "EPA", finding: "June 2022: a court vacated the human health part of EPA's review; EPA says its finding is still current", url: EPA_GLY_URL, checkedOn: M71_CHECKED,
  quote: "The Ninth Circuit vacated the human health portion of EPA's ID" };
const EFSA_GLYPHOSATE: Cite = { body: "EFSA", finding: "2023 peer review of glyphosate",
  url: "https://www.efsa.europa.eu/en/news/glyphosate-no-critical-areas-concern-data-gaps-identified", checkedOn: M71_CHECKED,
  quote: "EFSA did not identify any critical areas of concern" };
const FDA_RESIDUES: Cite = { body: "FDA", finding: "FY 2023 residue monitoring: 97.2% of domestic samples were within EPA's limits",
  url: "https://www.fda.gov/food/hfp-constituent-updates/fda-releases-fy-2023-pesticide-residue-monitoring-report", checkedOn: M71_CHECKED,
  quote: "generally in compliance with EPA pesticide tolerances" };

const FDA_UPF_URL = "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/ultra-processed-foods";
const FDA_UPF_LINKS: Cite = { body: "FDA", finding: "Research links ultra-processed foods to heart disease, obesity and certain cancers", url: FDA_UPF_URL, checkedOn: M71_CHECKED,
  quote: "Researchers have found links between the consumption of highly processed foods (commonly called ultra-processed foods, or UPFs) and a range of negative health outcomes, including cardiovascular disease, obesity and certain cancers." };
const FDA_UPF_RFI: Cite = { body: "FDA", finding: "July 2025: the FDA and USDA asked for input toward a uniform definition of UPFs", url: FDA_UPF_URL, checkedOn: M71_CHECKED,
  quote: "On July 24, 2025, the FDA and USDA issued a Request for Information" };
const HHS_UPF: Cite = { body: "HHS", finding: "August 2026: the first proposed federal definition went for final review; not yet published",
  url: "https://www.hhs.gov/press-room/hhs-announces-ultra-processed-foods-gras-reforms.html", checkedOn: M71_CHECKED,
  quote: "HHS and USDA submitted for final review the federal government's first proposed definition of UPFs." };

/** Home's Learn tiles read these, in this order (M12 spec §2): a short `label`, a `tile` colour at 7:1+ with white text
 *  (no red or pink: those mean "concern"), an icon. The page keeps the full `title`, which is also the tile's accessible name. */
export const EXPLAINERS: Record<ExplainerId, { title: string; label: string; tile: string; Icon: LucideIcon; sources: Cite[] }> = {
  "not-healthy": {
    title: "“Nothing flagged” isn’t “healthy”", label: "Not a health score", tile: "#0E5E4A", Icon: Apple,
    sources: [FDA],
  },
  "badge-levels": {
    title: "What the badge levels mean", label: "Badge levels", tile: "#14538F", Icon: Gauge,
    sources: [WHO_EVIDENCE, PROCESSED_MEAT.sources[2], PROCESSED_MEAT.sources[0], ACRYLAMIDE.sources[0], ACRYLAMIDE.sources[4]],
  },
  "seed-oils": {
    title: "Seed oils: what the evidence says", label: "Seed oils", tile: "#7A480A", Icon: Droplet,
    sources: [AHA_OMEGA6, AHA_POLY, AHA_INFLAMMATION, EFSA_GLYCIDOL, EFSA_PALM, EU_GE],
  },
  "pesticides": {
    title: "Pesticides: what a label can’t tell you", label: "Pesticides", tile: "#33600F", Icon: Sprout,
    sources: [FDA_RESIDUES, IARC_GLYPHOSATE, EPA_GLYPHOSATE, EPA_COURT, EFSA_GLYPHOSATE],
  },
  "ultra-processed": {
    title: "Ultra-processed foods: no official line yet", label: "Ultra-processed", tile: "#4A42A6", Icon: Factory,
    sources: [FDA_UPF_LINKS, FDA_UPF_RFI, HHS_UPF],
  },
  // Describes EcoGo itself, so it has no sources (spec D2).
  "how-it-works": {
    title: "How EcoGo checks a product", label: "How EcoGo checks", tile: "#4F4E4A", Icon: ListChecks,
    sources: [],
  },
};

// Moved word for word from Home's old empty-state box (M12 D2).
const HOW_STEPS = [
  "Reads the real label from USDA (the maker's own data), or Open Food Facts, clearly marked crowd-sourced.",
  "Checks ingredients and the food itself against official findings from IARC, the EU and the FDA.",
  "Shows the strongest finding, with its source, plus sugar, fat and salt per serving.",
];

const LEVELS = [
  { v: "none", basis: "No official finding for its additives or the food itself" },
  { v: "some", basis: "IARC Group 2B, or an EU warning label" },
  { v: "high", basis: "IARC Group 2A, a ban in the EU or US, or contains processed meat" },
  { v: "known", basis: "IARC Group 1 (for example, a processed meat product)" },
] as const;

function Body({ id, onOpen }: { id: ExplainerId; onOpen: (id: ExplainerId) => void }): ReactNode {
  if (id === "seed-oils") return (
    <>
      <p>Seed oils (canola, corn, soy, sunflower and others) are mostly polyunsaturated fat, including omega‑6.</p>
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
      <p>There’s no official US definition yet. The FDA and USDA asked for input in July 2025, and in August 2026 HHS sent the first proposed definition for final review; it hasn’t been published.</p>
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
      <p><strong>The key point:</strong> the levels describe how strong the evidence is that something can cause cancer, not how much harm one serving does. Processed meat and tobacco are both Group 1, but IARC says that doesn’t make them equally dangerous.</p>
    </>
  );
}

export default function Explainer({ id, onBack }: { id: ExplainerId; onBack: () => void }) {
  // A link inside a page (pesticides → badge levels) opens that page here; Back returns to the page it came from.
  const [linked, setLinked] = useState<ExplainerId | null>(null);
  const shown = linked ?? id;
  const e = EXPLAINERS[shown];
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => (linked ? setLinked(null) : onBack())} aria-label="Back" className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-extrabold leading-tight">{e.title}</h1>
      </div>
      <div key={shown} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm leading-relaxed" style={{ scrollbarWidth: "none" }}>
        <Body id={shown} onOpen={setLinked} />
        {e.sources.length > 0 && <>
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

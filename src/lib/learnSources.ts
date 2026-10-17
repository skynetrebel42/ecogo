// learnSources.ts — every sourced claim in Home's Learn pages (SOURCE-01 S2, S2a; docs/superpowers/specs/2026-10-16-source-copy-design.md):
// one entry per claim, each checked word for word by `npm run verify:sources`. `card: true` entries are the page's
// Sources cards (components/Explainer.tsx); `card: false` ones back a claim without a card of their own.
// Plain data with no React, so the Node script and tests load it.
import { FDA_RULE } from "./nutrition.ts";
import { PROCESSED_MEAT, ACRYLAMIDE } from "./safety/foodConcerns.ts";
import { LIBRARY } from "./safety/library.ts";

export type ExplainerId = "not-healthy" | "badge-levels" | "seed-oils" | "pesticides" | "ultra-processed" | "how-it-works";

export interface Cite { body: string; finding: string; url: string; quote: string; checkedOn: string; checkedByHand?: string; card: boolean }

const TODAY = "2026-10-16"; // SOURCE-01: quotes added or hand-checked in this pass
const card = <T extends Omit<Cite, "card">>(c: T): Cite => ({ ...c, card: true });
const check = <T extends Omit<Cite, "card">>(c: T): Cite => ({ ...c, card: false });

const FDA = card({ body: "FDA", finding: "FDA's 5/20 rule for % Daily Value", url: FDA_RULE.url, quote: FDA_RULE.quote, checkedOn: FDA_RULE.checkedOn });
// Hand-checked 2026-10-01 on the WHO Q&A page (the IARC PDF's second sentence couldn't be read as text).
const WHO_EVIDENCE = card({
  body: "WHO", finding: "The categories describe how strong the evidence is, not how likely harm is",
  url: PROCESSED_MEAT.sources[0].url, checkedOn: "2026-10-01",
  quote: "The categories of the classification indicate the strength of the evidence as to whether a substance is capable of causing cancer",
});

// M7.1 sources (spec §3). Every quote was re-checked word for word on its live page on 2026-10-01; heart.org (blocks
// scripts), EUR-Lex and HHS were read in a browser. Explainer-only: none of them changes the badge (spec E2).
// heart.org answers a plain fetch with 403: its three quotes were confirmed again in the built-in browser (TODAY).
const M71_CHECKED = "2026-10-01";
const AHA_URL = "https://www.heart.org/en/news/2024/08/20/theres-no-reason-to-avoid-seed-oils-and-plenty-of-reasons-to-eat-them";
const AHA_OMEGA6 = card({ body: "AHA", finding: "American Heart Association News (2024): omega-6 fats belong in a healthy diet", url: AHA_URL, checkedOn: M71_CHECKED, checkedByHand: TODAY,
  quote: "The American Heart Association supports the inclusion of omega-6 fatty acids as part of a healthy diet." });
const AHA_POLY = card({ body: "AHA", finding: "Polyunsaturated fats lower bad cholesterol and the risk of heart disease and stroke", url: AHA_URL, checkedOn: M71_CHECKED, checkedByHand: TODAY,
  quote: "Polyunsaturated fats help the body reduce bad cholesterol, lowering the risk for heart disease and stroke." });
const AHA_INFLAMMATION = card({ body: "AHA", finding: "Stanford's Christopher Gardner, quoted by the AHA: calling omega-6 fats pro-inflammatory is wrong", url: AHA_URL, checkedOn: M71_CHECKED, checkedByHand: TODAY,
  quote: "But to flip that and suggest this means omega-6 fats are pro-inflammatory is wrong." });
const EFSA_2016 = "https://www.efsa.europa.eu/en/press/news/160503a";
const EFSA_GLYCIDOL = card({ body: "EFSA", finding: "2016 opinion: glycidol is genotoxic and carcinogenic", url: EFSA_2016, checkedOn: M71_CHECKED,
  quote: "There is sufficient evidence that glycidol is genotoxic and carcinogenic" });
const EFSA_PALM = card({ body: "EFSA", finding: "2016 opinion: the highest levels were in palm oils and palm fats", url: EFSA_2016, checkedOn: M71_CHECKED,
  quote: "The highest levels of GE, as well as 3-MCPD and 2-MCPD (including esters) were found in palm oils and palm fats" });
const EU_GE_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32018R0290";
// EUR-Lex prints "reﬁned" with a ligature; hand-checked in the built-in browser.
const EU_GE = card({ body: "EU", finding: "Regulation (EU) 2018/290 sets legal maximum levels for glycidyl esters in oils and fats",
  url: EU_GE_URL, checkedOn: M71_CHECKED, checkedByHand: TODAY,
  quote: "Glycidyl fatty acid esters are food contaminants found at highest levels in refined vegetable oils and fats." });

const EPA_GLY_URL = "https://www.epa.gov/ingredients-used-pesticide-products/glyphosate";
const IARC_GLY_URL = "https://www.iarc.who.int/featured-news/media-centre-iarc-news-glyphosate/";
const IARC_GLYPHOSATE = card({ body: "IARC", finding: "2015 (Monographs vol. 112): glyphosate is Group 2A", url: IARC_GLY_URL, checkedOn: M71_CHECKED,
  quote: "probably carcinogenic to humans" });
const EPA_GLYPHOSATE = card({ body: "EPA", finding: "2017 assessment of glyphosate's cancer risk", url: EPA_GLY_URL, checkedOn: M71_CHECKED,
  quote: "glyphosate is not likely to be carcinogenic to humans" });
const EPA_COURT = card({ body: "EPA", finding: "June 2022: a court vacated the human health part of EPA's review; EPA says its finding is still current", url: EPA_GLY_URL, checkedOn: M71_CHECKED,
  quote: "The Ninth Circuit vacated the human health portion of EPA's ID" });
const EFSA_GLY_URL = "https://www.efsa.europa.eu/en/news/glyphosate-no-critical-areas-concern-data-gaps-identified";
const EFSA_GLYPHOSATE = card({ body: "EFSA", finding: "2023 peer review of glyphosate", url: EFSA_GLY_URL, checkedOn: M71_CHECKED,
  quote: "EFSA did not identify any critical areas of concern" });
const FDA_RESIDUES_URL = "https://www.fda.gov/food/hfp-constituent-updates/fda-releases-fy-2023-pesticide-residue-monitoring-report";
const FDA_RESIDUES = card({ body: "FDA", finding: "FY 2023 residue monitoring: 97.2% of domestic samples were within EPA's limits", url: FDA_RESIDUES_URL, checkedOn: M71_CHECKED,
  quote: "generally in compliance with EPA pesticide tolerances" });

const FDA_UPF_URL = "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/ultra-processed-foods";
const FDA_UPF_LINKS = card({ body: "FDA", finding: "Research links ultra-processed foods to heart disease, obesity and certain cancers", url: FDA_UPF_URL, checkedOn: M71_CHECKED,
  quote: "Researchers have found links between the consumption of highly processed foods (commonly called ultra-processed foods, or UPFs) and a range of negative health outcomes, including cardiovascular disease, obesity and certain cancers." });
const FDA_UPF_RFI = card({ body: "FDA", finding: "July 2025: the FDA and USDA asked for input toward a uniform definition of UPFs", url: FDA_UPF_URL, checkedOn: M71_CHECKED,
  quote: "On July 24, 2025, the FDA and USDA issued a Request for Information" });
const HHS_UPF = card({ body: "HHS", finding: "August 2026: the first proposed federal definition went for final review; not yet published",
  url: "https://www.hhs.gov/press-room/hhs-announces-ultra-processed-foods-gras-reforms.html", checkedOn: M71_CHECKED,
  quote: "HHS and USDA submitted for final review the federal government's first proposed definition of UPFs." });

// COPY-01 (C1): USDA FoodData Central, SR Legacy, g per 100 g. The pages are script-rendered, so each value was read
// in the built-in browser; one card, the other values check-only.
const FDA_ACRYLAMIDE_QA = "https://www.fda.gov/food/process-contaminants-food/acrylamide-questions-and-answers";
const fdc = (id: number) => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`;
const usda = (food: string, id: number, quote: string) =>
  ({ body: "USDA", finding: `FoodData Central (SR Legacy), ${food}, per 100 g`, url: fdc(id), quote, checkedOn: TODAY, checkedByHand: TODAY });
const USDA_OILS = card({ ...usda("soybean oil", 171411, "Fatty acids, total polyunsaturated 57.7 g"),
  finding: "FoodData Central (SR Legacy), per 100 g: soybean oil 57.7 g and corn oil 54.7 g polyunsaturated; canola oil 63.3 g monounsaturated; sunflower oil 65.7 g polyunsaturated (linoleic) or 83.7 g monounsaturated (high oleic)" });

/** Every sourced Learn claim, by page. "how-it-works" describes EcoGo itself, so it has none (M12 spec D2). */
export const LEARN_SOURCES: Record<ExplainerId, Cite[]> = {
  "not-healthy": [FDA],
  "badge-levels": [
    WHO_EVIDENCE, card(PROCESSED_MEAT.sources[2]), card(PROCESSED_MEAT.sources[0]), card(ACRYLAMIDE.sources[0]), card(ACRYLAMIDE.sources[4]),
    // "Acrylamide can form when starchy food is fried or baked."
    check({ body: "FDA", finding: "Acrylamide forms in high-temperature cooking", checkedOn: TODAY, url: FDA_ACRYLAMIDE_QA,
      quote: "Acrylamide is a chemical that can form in some foods during high-temperature cooking processes, such as frying, roasting, and baking." }),
    check({ body: "FDA", finding: "Mainly in plant foods such as potato and grain products", checkedOn: TODAY, url: FDA_ACRYLAMIDE_QA,
      quote: "Acrylamide is found mainly in foods made from plants, such as potato products, grain products, or coffee." }),
    // "the EU label on Red 40, for example, warns about activity and attention in children"
    check(LIBRARY.find(e => e.id === "allura-red")!.sources[0]),
  ],
  "seed-oils": [
    USDA_OILS,
    check(usda("soybean oil", 171411, "PUFA 18:2 n-6 c,c 50.4 g")), // "(including omega‑6)"
    check(usda("corn oil", 171029, "PUFA 18:2 n-6 c,c 53.2 g")),
    check(usda("corn oil", 171029, "Fatty acids, total polyunsaturated 54.7 g")),
    check(usda("canola oil", 172336, "Fatty acids, total monounsaturated 63.3 g")),
    check(usda("sunflower oil, linoleic", 171025, "Fatty acids, total polyunsaturated 65.7 g")),
    check(usda("sunflower oil, high oleic", 172338, "Fatty acids, total monounsaturated 83.7 g")),
    AHA_OMEGA6, AHA_POLY, AHA_INFLAMMATION, EFSA_GLYCIDOL, EFSA_PALM, EU_GE,
    // "refining oils at high heat can create contaminants"
    check({ body: "EFSA", finding: "The contaminants form when oils are refined at high temperatures", url: EFSA_2016, checkedOn: TODAY,
      quote: "The substances form during food processing, in particular, when refining vegetable oils at high temperatures" }),
    // "the EU has set legal maximum levels since 2018"
    check({ body: "EU", finding: "Regulation (EU) 2018/290's title", url: EU_GE_URL, checkedOn: TODAY, checkedByHand: TODAY,
      quote: "as regards maximum levels of glycidyl fatty acid esters in vegetable oils and fats" }),
  ],
  "pesticides": [
    FDA_RESIDUES, IARC_GLYPHOSATE, EPA_GLYPHOSATE, EPA_COURT, EFSA_GLYPHOSATE,
    check({ body: "FDA", finding: "FY 2023: 97.2% of domestic samples within EPA's limits", url: FDA_RESIDUES_URL, checkedOn: TODAY,
      quote: "97.2% of domestic samples and 86.5% of import samples were compliant with federal regulations (below EPA tolerances)." }),
    // "EPA says that finding is still current"
    check({ body: "EPA", finding: "EPA's finding stands after the 2022 court decision", url: EPA_GLY_URL, checkedOn: TODAY,
      quote: "that does not automatically mean that EPA’s current scientific findings regarding glyphosate, including its longstanding finding that glyphosate is not likely to be carcinogenic to humans, is incorrect" }),
    // "IARC rates how strong the evidence of a hazard is, while EPA and EFSA judge the risk at real-world exposure"
    check({ body: "IARC", finding: "IARC's evaluation is a hazard classification", url: IARC_GLY_URL, checkedOn: TODAY,
      quote: "The IARC Monographs evaluation is a hazard classification." }),
    check({ body: "EPA", finding: "EPA's 2017 risk assessment covered real-world exposure", url: EPA_GLY_URL, checkedOn: TODAY,
      quote: "EPA's 2017 human health risk assessment did not identify risks of concern from glyphosate uses, including for cancer, dietary and drinking-water exposure, and residential exposure." }),
    check({ body: "EFSA", finding: "EFSA's 2023 review was a risk assessment", url: EFSA_GLY_URL, checkedOn: TODAY,
      quote: "in its peer review of the risk assessment of the active substance glyphosate" }),
  ],
  "ultra-processed": [
    FDA_UPF_LINKS, FDA_UPF_RFI, HHS_UPF,
    // "There's no official US definition yet."
    check({ body: "FDA", finding: "The FDA and USDA are working toward a uniform definition", url: FDA_UPF_URL, checkedOn: TODAY,
      quote: "as part of a joint effort to develop a uniform definition of UPFs." }),
    // "processed meat (IARC Group 1) … the FDA's 5/20 rule"
    check(PROCESSED_MEAT.sources[0]), check(FDA),
  ],
  "how-it-works": [],
};

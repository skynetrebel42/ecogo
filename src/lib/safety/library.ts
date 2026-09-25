// library.ts — the verified ingredient library for the safety engine.
// Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §5.
// Every entry must pass `npm run verify:sources` and the integrity test before it ships.

export type Severity = "high" | "some";

/** What a source establishes. "context" = a regulator's intake position; it never sets severity. */
export type Basis =
  | "iarc-1" | "iarc-2a" | "iarc-2b"
  | "banned-eu" | "banned-us"
  | "eu-warning-label"
  | "context";

export interface Source {
  body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO/JECFA";
  basis: Basis;
  finding: string;   // e.g. "Group 2B: possibly carcinogenic to humans"
  url: string;       // official page
  quote: string;     // short verbatim phrase from that page (checked by verify:sources)
  checkedOn: string; // YYYY-MM-DD
}

export interface LibraryEntry {
  id: string;          // slug, e.g. "sodium-nitrite"
  name: string;        // display name
  aliases: string[];   // lowercase label spellings, >= 3 characters, unique across the library
  eCodes: string[];    // e.g. ["E250"]
  severity: Severity;  // must equal deriveSeverity(sources)
  concern: string;     // one plain-English sentence
  context?: string;    // regulator intake position shown next to the flag
  sources: Source[];
}

const HIGH_BASES: ReadonlySet<Basis> = new Set(["iarc-1", "iarc-2a", "banned-eu", "banned-us"]);
const SOME_BASES: ReadonlySet<Basis> = new Set(["iarc-2b", "eu-warning-label"]);

/** Severity is mechanical: the strongest basis among an entry's sources. null = no severity-bearing source. */
export function deriveSeverity(sources: Source[]): Severity | null {
  if (sources.some(s => HIGH_BASES.has(s.basis))) return "high";
  if (sources.some(s => SOME_BASES.has(s.basis))) return "some";
  return null;
}

// ── Sources (official pages; quotes are verbatim) ────────────────────────────
const CHECKED = "2026-09-25";
const IARC_LIST = "https://monographs.iarc.who.int/list-of-classifications";
const EU_ADDITIVES_REG = "https://eur-lex.europa.eu/eli/reg/2008/1333/oj";

const iarcNitrosation: Source = {
  body: "IARC", basis: "iarc-2a",
  finding: "Group 2A (probably carcinogenic to humans): nitrate or nitrite ingested under conditions that result in endogenous nitrosation (IARC Monographs vol. 94)",
  url: IARC_LIST, quote: "Nitrate or nitrite (ingested) under conditions that result in endogenous nitrosation", checkedOn: CHECKED,
};
const efsaNitrites: Source = {
  body: "EFSA", basis: "context",
  finding: "EFSA's 2017 re-evaluation: existing safe levels for added nitrites and nitrates protect consumers",
  url: "https://www.efsa.europa.eu/en/press/news/170615",
  quote: "Existing safe levels for nitrites and nitrates intentionally added to meat and other foods are sufficiently protective for consumers",
  checkedOn: CHECKED,
};
const NITROSATION_CONCERN = "Classified by IARC as probably carcinogenic (Group 2A) when eaten under conditions that form N-nitroso compounds in the body, as in cured meats.";
const NITRITE_CONTEXT = "EFSA (2017) concluded that existing safe levels for nitrites and nitrates added to food are sufficiently protective for consumers.";

const euWarningLabel = (colour: string): Source => ({
  body: "EU", basis: "eu-warning-label",
  finding: `EU law (Regulation (EC) No 1333/2008, Annex V) requires foods containing ${colour} to carry a warning label`,
  url: EU_ADDITIVES_REG, quote: "may have an adverse effect on activity and attention in children", checkedOn: CHECKED,
});
const WARNING_LABEL_CONCERN = "EU law requires foods with this colour to warn that it may have an adverse effect on activity and attention in children.";

const iarc2b = (agent: string, quote: string, volumes: string): Source => ({
  body: "IARC", basis: "iarc-2b",
  finding: `Group 2B (possibly carcinogenic to humans): ${agent} (IARC Monographs ${volumes})`,
  url: IARC_LIST, quote, checkedOn: CHECKED,
});

export const LIBRARY: LibraryEntry[] = [
  // ── High concern ───────────────────────────────────────────────────────────
  {
    id: "sodium-nitrite", name: "Sodium nitrite", aliases: ["sodium nitrite"], eCodes: ["E250"], severity: "high",
    concern: NITROSATION_CONCERN, context: NITRITE_CONTEXT, sources: [iarcNitrosation, efsaNitrites],
  },
  {
    id: "potassium-nitrite", name: "Potassium nitrite", aliases: ["potassium nitrite"], eCodes: ["E249"], severity: "high",
    concern: NITROSATION_CONCERN, context: NITRITE_CONTEXT, sources: [iarcNitrosation, efsaNitrites],
  },
  {
    id: "sodium-nitrate", name: "Sodium nitrate", aliases: ["sodium nitrate"], eCodes: ["E251"], severity: "high",
    concern: NITROSATION_CONCERN, context: NITRITE_CONTEXT, sources: [iarcNitrosation, efsaNitrites],
  },
  {
    id: "potassium-nitrate", name: "Potassium nitrate", aliases: ["potassium nitrate"], eCodes: ["E252"], severity: "high",
    concern: NITROSATION_CONCERN, context: NITRITE_CONTEXT, sources: [iarcNitrosation, efsaNitrites],
  },
  {
    id: "titanium-dioxide", name: "Titanium dioxide", aliases: ["titanium dioxide"], eCodes: ["E171"], severity: "high",
    concern: "Banned as a food additive in the EU since 2022 because a concern for DNA damage (genotoxicity) could not be ruled out.",
    context: "EFSA (2021) concluded that titanium dioxide can no longer be considered safe as a food additive.",
    sources: [
      {
        body: "EU", basis: "banned-eu",
        finding: "Commission Regulation (EU) 2022/63 removed titanium dioxide (E 171) from the list of authorised food additives",
        url: "https://eur-lex.europa.eu/eli/reg/2022/63/oj",
        quote: "the entry for the food additive E 171 (Titanium dioxide) is deleted", checkedOn: CHECKED,
      },
      {
        body: "EFSA", basis: "context",
        finding: "EFSA's 2021 opinion: titanium dioxide can no longer be considered safe as a food additive",
        url: "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive",
        quote: "titanium dioxide can no longer be considered safe as a food additive", checkedOn: CHECKED,
      },
    ],
  },
  {
    id: "brominated-vegetable-oil", name: "Brominated vegetable oil (BVO)", aliases: ["brominated vegetable oil", "bvo"], eCodes: [], severity: "high",
    concern: "No longer allowed in US food: the FDA revoked its authorization in July 2024 after new safety studies.",
    sources: [
      {
        body: "FDA", basis: "banned-us",
        finding: "The FDA revoked the food additive regulation for BVO on July 3, 2024",
        url: "https://www.fda.gov/food/food-additives-petitions/brominated-vegetable-oil-bvo",
        quote: "The FDA no longer allows for the use of brominated vegetable oil (BVO) in food", checkedOn: CHECKED,
      },
    ],
  },
  {
    id: "erythrosine", name: "Erythrosine (Red No. 3)", aliases: ["erythrosine", "red 3"], eCodes: ["E127"], severity: "high",
    concern: "The FDA revoked its authorization for use in food in January 2025.",
    context: "US manufacturers have until January 15, 2027 to reformulate foods that use it.",
    sources: [
      {
        body: "FDA", basis: "banned-us",
        finding: "On January 15, 2025 the FDA issued an order revoking the authorization of FD&C Red No. 3 in food and ingested drugs",
        url: "https://www.fda.gov/industry/color-additives/fdc-red-no-3",
        quote: "The FDA will no longer allow for the use of FD&C Red No. 3 in food and ingested drugs", checkedOn: CHECKED,
      },
    ],
  },

  // ── Some concern ───────────────────────────────────────────────────────────
  {
    id: "aspartame", name: "Aspartame", aliases: ["aspartame"], eCodes: ["E951"], severity: "some",
    concern: "Classified by IARC as possibly carcinogenic to humans (Group 2B), based on limited evidence.",
    context: "The WHO/FAO expert committee (JECFA) kept the acceptable daily intake at 40 mg per kg of body weight.",
    sources: [
      {
        body: "IARC", basis: "iarc-2b",
        finding: "Group 2B (possibly carcinogenic to humans), IARC Monographs vol. 134 (2023)",
        url: "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released",
        quote: "IARC classified aspartame as possibly carcinogenic to humans (IARC Group 2B)", checkedOn: CHECKED,
      },
      {
        body: "WHO/JECFA", basis: "context",
        finding: "JECFA reaffirmed the acceptable daily intake of 40 mg/kg body weight (2023)",
        url: "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released",
        quote: "JECFA reaffirmed the acceptable daily intake of 40 mg/kg body weight", checkedOn: CHECKED,
      },
    ],
  },
  {
    id: "bha", name: "BHA (butylated hydroxyanisole)", aliases: ["bha", "butylated hydroxyanisole"], eCodes: ["E320"], severity: "some",
    concern: "Classified by IARC as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc2b("butylated hydroxyanisole (BHA)", "Butylated hydroxyanisole (BHA) 2B", "vol. 40, Suppl. 7")],
  },
  {
    id: "potassium-bromate", name: "Potassium bromate", aliases: ["potassium bromate", "bromated flour"], eCodes: ["E924"], severity: "some",
    concern: "Classified by IARC as possibly carcinogenic to humans (Group 2B); used in some bromated flours.",
    sources: [iarc2b("potassium bromate", "Potassium bromate 2B", "Suppl. 7, vol. 73")],
  },
  {
    id: "citrus-red-2", name: "Citrus Red No. 2", aliases: ["citrus red 2"], eCodes: ["E121"], severity: "some",
    concern: "Classified by IARC as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc2b("Citrus Red No. 2", "Citrus Red No. 2 2B", "vol. 8, Suppl. 7")],
  },
  {
    id: "tartrazine", name: "Tartrazine (Yellow 5)", aliases: ["tartrazine", "yellow 5"], eCodes: ["E102"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("tartrazine (E 102)")],
  },
  {
    id: "quinoline-yellow", name: "Quinoline yellow", aliases: ["quinoline yellow"], eCodes: ["E104"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("quinoline yellow (E 104)")],
  },
  {
    id: "sunset-yellow", name: "Sunset yellow (Yellow 6)", aliases: ["sunset yellow", "yellow 6"], eCodes: ["E110"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("sunset yellow (E 110)")],
  },
  {
    id: "carmoisine", name: "Carmoisine", aliases: ["carmoisine", "azorubine"], eCodes: ["E122"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("carmoisine (E 122)")],
  },
  {
    id: "ponceau-4r", name: "Ponceau 4R", aliases: ["ponceau 4r"], eCodes: ["E124"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("ponceau 4R (E 124)")],
  },
  {
    id: "allura-red", name: "Allura red (Red 40)", aliases: ["allura red", "red 40"], eCodes: ["E129"], severity: "some",
    concern: WARNING_LABEL_CONCERN, sources: [euWarningLabel("allura red (E 129)")],
  },
];

// personalCare.ts — the personal-care library (soap, shampoo, lotion, sunscreen). Spec:
// docs/superpowers/specs/2026-10-16-m16-personal-care-design.md N2–N5, N2a. Same rules as library.ts: official findings
// only, a verbatim quote per source, every entry in `npm run verify:sources`. Flags (N2) set the badge; notes (N3 EU
// fragrance allergens, N4 "fragrance", N5 FDA sunscreen status) are info rows that never change it.
// Matching is by whole INCI name (or a listed alias), never by a word inside a longer name: "Sodium Formaldehyde
// Sulfoxylate" is not formaldehyde.
import { deriveSeverity, SEVERITY_RANK, type LibraryEntry, type Source } from "./library.ts";
import { LEVELS, type Flag, type Verdict } from "./analyze.ts";
import { parseIngredients } from "./parse.ts";

export interface CareNote {
  id: string;
  kind: "allergen" | "fragrance" | "sunscreen" | "limited";
  name: string;
  aliases: string[]; // lowercase INCI / label names
  text: string;      // the info row
  sources: Source[];
}
type Found = { note: CareNote; matchedText: string };
/** `notes`: info rows; `limited`: EU Annex III ingredients for the one folded "Limited, not banned" row (N2b). */
export interface CareAnalysis { verdict: Verdict; flags: Flag[]; checkedCount: number; notes: Found[]; limited: Found[] }

/** 063 F7: the headline when nothing matched (N7's CARE_LIMITS says what that does and doesn't mean). */
export const CARE_NONE = "No matches in EcoGo's checked list.";
export const CARE_LIMITS = "EcoGo checks this list against FDA, EU and IARC findings only. Not finding a match doesn't mean a product is safe for you.";

// ── Sources ──────────────────────────────────────────────────────────────────
const CHECKED = "2026-10-16";
const HAND = "2026-10-16"; // EUR-Lex (bot-gated) and IARC's table (script-rendered), read in the built-in browser
const EU_COSMETICS = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02009R1223-20260518"; // consolidated 18.05.2026
const EU_ALLERGENS = "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1545";
const FDA_PROHIBITED = "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/prohibited-restricted-ingredients-cosmetics";
const FDA_FRAGRANCE = "https://www.fda.gov/cosmetics/cosmetic-ingredients/fragrances-cosmetics";
const FDA_MOCRA = "https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra";
const CHECKED_063 = "2026-10-20";
const FDA_SUNSCREEN = "https://www.fda.gov/drugs/understanding-over-counter-medicines/questions-and-answers-fdas-regulatory-actions-over-counter-sunscreen";
const FDA_HAIR_SMOOTHING = "https://www.fda.gov/cosmetics/cosmetic-products/hair-smoothing-products-release-formaldehyde-when-heated";
const CFR_METHYLENE_CHLORIDE = "https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-21?chapter=I&subchapter=G&part=700&subpart=B&section=700.19";
const CFR_DANDRUFF = "https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-21?chapter=I&subchapter=D&part=358&subpart=H&section=358.710";
const IARC_LIST = "https://monographs.iarc.who.int/list-of-classifications";

/** EU Regulation (EC) No 1223/2009, Annex II: substances prohibited in cosmetic products. */
const euBan = (entry: string, quote: string): Source => ({
  body: "EU", basis: "banned-eu", url: EU_COSMETICS, quote, checkedOn: CHECKED, checkedByHand: HAND,
  finding: `Regulation (EC) No 1223/2009, Annex II entry ${entry}: on the EU list of substances prohibited in cosmetic products`,
});
const fda = (basis: "banned-us" | "context", finding: string, quote: string): Source =>
  ({ body: "FDA", basis, finding, url: FDA_PROHIBITED, quote, checkedOn: CHECKED });
const iarc = (basis: "iarc-1" | "iarc-2a" | "iarc-2b", group: string, agent: string, volumes: string, quote: string): Source => ({
  body: "IARC", basis, url: IARC_LIST, quote, checkedOn: CHECKED, checkedByHand: HAND,
  finding: `Group ${group}: ${agent} (IARC Monographs ${volumes})`,
});
const IARC_1 = "carcinogenic to humans", IARC_2A = "probably carcinogenic to humans", IARC_2B = "possibly carcinogenic to humans";
const dandruffDrug = (quote: string): Source => ({
  body: "FDA", basis: "context", url: CFR_DANDRUFF, quote, checkedOn: CHECKED,
  finding: "21 CFR 358.710 lists it among the active ingredients for the control of dandruff",
});

const EU_BANNED = "Banned in cosmetics in the EU.";
const DANDRUFF_CONTEXT = "FDA allows it as a dandruff-shampoo drug ingredient.";

// ── N2: flags (set the badge) ────────────────────────────────────────────────
const ENTRIES: Omit<LibraryEntry, "severity">[] = [
  { id: "formaldehyde", name: "Formaldehyde", aliases: ["formaldehyde", "methylene glycol", "formalin"], eCodes: [],
    concern: "IARC classifies it as carcinogenic to humans (Group 1). Banned in cosmetics in the EU.",
    sources: [iarc("iarc-1", `1 (${IARC_1})`, "formaldehyde", "Sup 7, 62, 88, 100F", "Formaldehyde 1"), euBan("1577", "Formaldehyde 50-00-0"),
      { body: "FDA", basis: "context", url: FDA_HAIR_SMOOTHING, checkedOn: CHECKED,
        finding: "FDA: formaldehyde is also known as formalin and methylene glycol (hair smoothing products)",
        quote: "These products often contain formaldehyde, also known as formalin and methylene glycol." }] },
  { id: "paraformaldehyde", name: "Paraformaldehyde", aliases: ["paraformaldehyde"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1578", "Paraformaldehyde 30525-89-4")] },
  { id: "vinyl-chloride", name: "Vinyl chloride", aliases: ["vinyl chloride"], eCodes: [],
    concern: "IARC classifies it as carcinogenic to humans (Group 1). Banned in cosmetics in the EU; FDA bans it in aerosol products.",
    sources: [iarc("iarc-1", `1 (${IARC_1})`, "vinyl chloride", "Sup 7, 97, 100F", "Vinyl chloride 1"), euBan("334", "Vinyl chloride monomer"),
      fda("banned-us", "FDA prohibits vinyl chloride as an ingredient of aerosol products (21 CFR 700.14)", "The use of vinyl chloride is prohibited as an ingredient of aerosol products")] },
  { id: "methylene-chloride", name: "Methylene chloride", aliases: ["methylene chloride", "dichloromethane"], eCodes: [],
    concern: "Banned in cosmetics in the EU and the US. IARC classifies it as probably carcinogenic to humans (Group 2A).",
    sources: [euBan("1389", "Dichloromethane; methylene chloride"),
      { body: "FDA", basis: "banned-us", url: CFR_METHYLENE_CHLORIDE, checkedOn: CHECKED,
        finding: "21 CFR 700.19: a cosmetic containing methylene chloride as an ingredient is deemed adulterated",
        quote: "Any cosmetic product that contains methylene chloride as an ingredient is deemed adulterated" },
      iarc("iarc-2a", `2A (${IARC_2A})`, "dichloromethane (methylene chloride)", "Sup 7, 71, 110", "Dichloromethane (Methylene chloride) 2A")] },
  { id: "chloroform", name: "Chloroform", aliases: ["chloroform"], eCodes: [],
    concern: "Banned in cosmetics in the EU and the US. IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [euBan("366", "Chloroform 67-66-3"),
      fda("banned-us", "FDA prohibits chloroform in cosmetic products (21 CFR 700.18)", "The use of chloroform in cosmetic products is prohibited"),
      iarc("iarc-2b", `2B (${IARC_2B})`, "chloroform", "Sup 7, 73", "Chloroform 2B")] },
  { id: "bithionol", name: "Bithionol", aliases: ["bithionol"], eCodes: [],
    concern: "Banned in cosmetics in the EU and the US.",
    sources: [euBan("352", "Bithionol (INN)"), fda("banned-us", "FDA prohibits bithionol in cosmetics (21 CFR 700.11)", "The use of bithionol is prohibited")] },
  { id: "halogenated-salicylanilides", name: "Halogenated salicylanilides", eCodes: [],
    aliases: ["tribromsalan", "dibromsalan", "metabromsalan", "tetrachlorosalicylanilide"],
    concern: "Banned in cosmetics in the EU and the US.",
    sources: [euBan("373", "3,4',5-Tribromosalicylanilide (Tribromsalan (INN))"), euBan("351", "Dibromosalicylanilides"), euBan("348", "Tetrachlorosalicylanilides"),
      fda("banned-us", "FDA prohibits di-, tri- and metabromsalan and tetrachlorosalicylanilide in cosmetics (21 CFR 700.15)", "These are prohibited in cosmetic products because they may cause serious skin disorders")] },
  { id: "hexachlorophene", name: "Hexachlorophene", aliases: ["hexachlorophene"], eCodes: [],
    concern: "Banned in cosmetics in the EU. FDA allows it only as a preservative, up to 0.1%, when no other preservative works as well, and never in products applied to mucous membranes such as the lips.",
    sources: [euBan("371", "Hexachlorophene (INN)"),
      fda("context", "FDA limits hexachlorophene to a preservative at no more than 0.1 percent (21 CFR 250.250)", "The HCP concentration in a cosmetic may not exceed 0.1 percent"),
      fda("context", "FDA allows hexachlorophene only when no other preservative has been shown to be as effective (21 CFR 250.250)",
        "may be used only when no other preservative has been shown to be as effective"),
      fda("context", "FDA: hexachlorophene may not be used in cosmetics applied to mucous membranes (21 CFR 250.250)",
        "it may not be used in cosmetics that are applied to mucous membranes, such as the lips")] },
  { id: "mercury", name: "Mercury", aliases: ["mercury", "mercuric chloride", "mercurous chloride", "ammoniated mercury", "calomel"], eCodes: [],
    concern: "Banned in cosmetics in the EU. FDA allows it only in eye-area products, up to 65 parts per million, and only if no other effective and safe preservative is available; other cosmetics may hold only an unavoidable trace under 1 part per million.",
    sources: [euBan("221", "Mercury and its compounds, except those special cases included in Annex V"),
      fda("context", "FDA limits mercury compounds to eye-area products at no more than 65 ppm (21 CFR 700.13)", "The use of mercury compounds in cosmetics is limited to eye area products at no more than 65 parts per million"),
      fda("context", "FDA permits mercury in eye-area products only if no other effective and safe preservative is available (21 CFR 700.13)",
        "is permitted only if no other effective and safe preservative is available"),
      fda("context", "FDA: other cosmetics may contain mercury only as an unavoidable trace under 1 ppm (21 CFR 700.13)",
        "in a trace amount of less than 1 part per million (0.0001 percent) calculated as the metal and its presence is unavoidable")] },
  { id: "zinc-pyrithione", name: "Zinc pyrithione", aliases: ["zinc pyrithione", "pyrithione zinc"], eCodes: [],
    concern: EU_BANNED, context: DANDRUFF_CONTEXT,
    sources: [euBan("1670", "Pyrithione zinc"), dandruffDrug("Pyrithione zinc, 0.3 to 2 percent when formulated to be applied and then washed off after brief exposure")] },
  { id: "coal-tar", name: "Coal tar", aliases: ["coal tar", "coal tar solution"], eCodes: [],
    concern: EU_BANNED, context: DANDRUFF_CONTEXT,
    sources: [euBan("420", "Crude and refined coal tars"), dandruffDrug("Coal tar, 0.5 to 5 percent")] },
  { id: "hydroquinone", name: "Hydroquinone", aliases: ["hydroquinone"], eCodes: [],
    concern: "Banned in cosmetics in the EU, except in artificial nail systems.",
    sources: [euBan("1339", "1,4-Dihydroxybenzene (Hydroquinone), with the exception of entry 14 in Annex III"),
      { body: "EU", basis: "context", url: EU_COSMETICS, checkedOn: CHECKED, checkedByHand: HAND,
        finding: "Regulation (EC) No 1223/2009, Annex III entry 14: hydroquinone only in artificial nail systems",
        quote: "Hydroquinone Hydroquinone 123-31-9 204-617-8 Artificial nail systems" }] },
  { id: "butylphenyl-methylpropional", name: "Butylphenyl methylpropional (Lilial)", aliases: ["butylphenyl methylpropional"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1666", "2-(4-tert-butylbenzyl) propionaldehyde")] },
  { id: "hydroxyisohexyl-3-cyclohexene-carboxaldehyde", name: "Hydroxyisohexyl 3-cyclohexene carboxaldehyde (Lyral)", eCodes: [],
    aliases: ["hydroxyisohexyl 3-cyclohexene carboxaldehyde"],
    concern: EU_BANNED, sources: [euBan("1380", "3- and 4-(4-Hydroxy-4-methylpentyl) cyclohex-3-ene-1-carbaldehyde (HICC)")] },
  { id: "lead-acetate", name: "Lead acetate", aliases: ["lead acetate"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("289", "Lead and its compounds")] },
  { id: "cyclotetrasiloxane", name: "Cyclotetrasiloxane (D4)", aliases: ["cyclotetrasiloxane", "octamethylcyclotetrasiloxane"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1388", "Octamethylcyclotetrasiloxane")] },
  { id: "isopropylparaben", name: "Isopropylparaben", aliases: ["isopropylparaben"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1374", "Isopropyl 4-hydroxybenzoate (INCI: Isopropylparaben)")] },
  { id: "isobutylparaben", name: "Isobutylparaben", aliases: ["isobutylparaben"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1375", "Isobutyl 4-hydroxybenzoate (INCI: Isobutylparaben)")] },
  { id: "phenylparaben", name: "Phenylparaben", aliases: ["phenylparaben"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1376", "Phenyl 4-hydroxybenzoate (INCI: Phenylparaben)")] },
  { id: "benzylparaben", name: "Benzylparaben", aliases: ["benzylparaben"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1377", "Benzyl 4-hydroxybenzoate (INCI: Benzylparaben)")] },
  { id: "pentylparaben", name: "Pentylparaben", aliases: ["pentylparaben"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1378", "Pentyl 4-hydroxybenzoate (INCI: Pentylparaben)")] },
  { id: "dibutyl-phthalate", name: "Dibutyl phthalate", aliases: ["dibutyl phthalate"], eCodes: [],
    concern: "Banned in cosmetics in the EU. IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [euBan("675", "Dibutyl phthalate 84-74-2"), iarc("iarc-2b", `2B (${IARC_2B})`, "dibutyl phthalate", "142", "Dibutyl phthalate 2B")] },
  { id: "diethylhexyl-phthalate", name: "Diethylhexyl phthalate (DEHP)", aliases: ["diethylhexyl phthalate", "dehp"], eCodes: [],
    concern: "Banned in cosmetics in the EU. IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [euBan("677", "bis(2-Ethylhexyl) phthalate (Diethylhexyl phthalate)"),
      iarc("iarc-2b", `2B (${IARC_2B})`, "di(2-ethylhexyl)phthalate", "Sup 7, 77, 101", "Di(2-ethylhexyl)phthalate 2B")] },
  { id: "boric-acid", name: "Boric acid", aliases: ["boric acid"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1395", "1395 Boric acid")] },
  { id: "borates", name: "Borates", aliases: ["sodium borate", "borax", "potassium borate", "zinc borate"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1396", "Borates, tetraborates, octaborates and boric acid salts and esters")] },
  { id: "sodium-perborate", name: "Sodium perborate", aliases: ["sodium perborate"], eCodes: [],
    concern: EU_BANNED, sources: [euBan("1397", "Perboric acid (H3BO2(O2)), monosodium salt trihydrate")] },
  { id: "benzophenone", name: "Benzophenone", aliases: ["benzophenone"], eCodes: [],
    concern: "Banned in cosmetics in the EU. IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [euBan("1703", "Benzophenone 119-61-9"), iarc("iarc-2b", `2B (${IARC_2B})`, "benzophenone", "101", "Benzophenone 2B")] },

  // N2c: IARC names the exact substance (titanium dioxide and carbon black left out: their findings are about breathing in dust).
  { id: "talc", name: "Talc", aliases: ["talc"], eCodes: [],
    concern: "IARC classifies it as probably carcinogenic to humans (Group 2A).",
    sources: [iarc("iarc-2a", `2A (${IARC_2A})`, "talc", "42, Sup 7, 93, 136", "Talc 2A")] },
  { id: "methyleugenol", name: "Methyleugenol", aliases: ["methyleugenol", "methyl eugenol"], eCodes: [],
    concern: "IARC classifies it as probably carcinogenic to humans (Group 2A).",
    sources: [iarc("iarc-2a", `2A (${IARC_2A})`, "methyleugenol", "101, 134", "Methyleugenol 2A")] },
  { id: "diethanolamine", name: "Diethanolamine (DEA)", aliases: ["diethanolamine"], eCodes: [],
    concern: "IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc("iarc-2b", `2B (${IARC_2B})`, "diethanolamine", "77, 101", "Diethanolamine 2B")] },
  { id: "cocamide-dea", name: "Cocamide DEA", aliases: ["cocamide dea", "coconut oil diethanolamine condensate"], eCodes: [],
    concern: "IARC classifies coconut oil diethanolamine condensate (cocamide DEA) as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc("iarc-2b", `2B (${IARC_2B})`, "coconut oil diethanolamine condensate", "101", "Coconut oil diethanolamine condensate 2B")] },
  { id: "isoeugenol", name: "Isoeugenol", aliases: ["isoeugenol"], eCodes: [],
    concern: "IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc("iarc-2b", `2B (${IARC_2B})`, "isoeugenol", "134", "Isoeugenol 2B")] },
  { id: "pulegone", name: "Pulegone", aliases: ["pulegone"], eCodes: [],
    concern: "IARC classifies it as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc("iarc-2b", `2B (${IARC_2B})`, "pulegone", "108", "Pulegone 2B")] },
  { id: "myrcene", name: "Myrcene (β-myrcene)", aliases: ["myrcene", "beta-myrcene", "β-myrcene"], eCodes: [],
    concern: "IARC classifies β-myrcene as possibly carcinogenic to humans (Group 2B).",
    sources: [iarc("iarc-2b", `2B (${IARC_2B})`, "β-myrcene", "119", "β-Myrcene 2B")] },
];

// null only for an entry with context sources alone — personalCare.test.ts rejects that.
export const PERSONAL_CARE: LibraryEntry[] = ENTRIES.map(e => ({ ...e, severity: deriveSeverity(e.sources)! }));

// ── N3: EU fragrance allergens (Annex III entries that must be named on the label) ──
const ALLERGEN_TEXT = "Known skin allergen: EU law requires naming it on the label above a set level.";
const allergenWhy: Source = {
  body: "EU", basis: "context", url: EU_ALLERGENS, checkedOn: CHECKED, checkedByHand: HAND,
  finding: "Regulation (EU) 2023/1545: fragrance allergens are named on the label so people allergic to them can avoid them",
  quote: "so that sensitised persons can avoid contact with the substance to which they are allergic",
};
const allergenRow = (entry: string): Source => ({
  body: "EU", basis: "context", url: EU_COSMETICS, checkedOn: CHECKED, checkedByHand: HAND,
  finding: `Regulation (EC) No 1223/2009, Annex III entry ${entry}: must be named in the ingredient list above set levels`,
  quote: "indicated in the list of ingredients referred to in Article 19(1)",
});
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// [Annex III entry, name, ...other label names]. Names are the entry's INCI names and the name the EU says to label it by.
const ALLERGENS: [string, string, ...string[]][] = [
  ["45", "Benzyl Alcohol"], ["46", "6-Methyl Coumarin"], ["67", "Amyl Cinnamal"], ["69", "Cinnamyl Alcohol"], ["70", "Citral"],
  ["71", "Eugenol"], ["72", "Hydroxycitronellal"], ["73", "Isoeugenol"], ["74", "Amylcinnamyl Alcohol"], ["75", "Benzyl Salicylate"],
  ["76", "Cinnamal"], ["77", "Coumarin"], ["78", "Geraniol"], ["80", "Anise Alcohol"], ["81", "Benzyl Cinnamate"], ["82", "Farnesol"],
  ["84", "Linalool"], ["85", "Benzyl Benzoate"], ["86", "Citronellol"], ["87", "Hexyl Cinnamal"], ["88", "Limonene"],
  ["89", "Methyl 2-Octynoate"], ["90", "Alpha-Isomethyl Ionone"], ["91", "Evernia Prunastri Extract"], ["92", "Evernia Furfuracea Extract"],
  ["109", "Pinus Mugo", "Pinus Mugo Leaf Oil", "Pinus Mugo Twig Leaf Extract", "Pinus Mugo Twig Oil"],
  ["114", "Pinus Pumila", "Pinus Pumila Needle Extract", "Pinus Pumila Twig Leaf Extract", "Pinus Pumila Twig Leaf Oil"],
  ["122", "Cedrus Atlantica Oil/Extract", "Cedrus Atlantica Bark Extract", "Cedrus Atlantica Bark Oil", "Cedrus Atlantica Bark Water", "Cedrus Atlantica Leaf Extract", "Cedrus Atlantica Wood Extract", "Cedrus Atlantica Wood Oil"],
  ["124", "Turpentine"], ["131", "Alpha-Terpinene"], ["133", "Terpinolene"],
  ["154", "Myroxylon Pereirae Oil/Extract", "Myroxylon Balsamum Pereirae Balsam Extract", "Myroxylon Balsamum Pereirae Balsam Oil", "Myroxylon Pereirae Oil", "Myroxylon Pereirae Resin Extract", "Myroxylon Pereirae Resin"],
  ["157", "Rose Ketones", "Alpha-Damascone"], ["175", "3-Propylidenephthalide"], ["196", "Lippia Citriodora Absolute"],
  ["324", "Methyl Salicylate"], ["327", "Acetyl Cedrene"], ["328", "Amyl Salicylate"], ["329", "Anethole"], ["330", "Benzaldehyde"],
  ["331", "Camphor"], ["332", "Beta-Caryophyllene"], ["333", "Carvone"], ["334", "Dimethyl Phenethyl Acetate"], ["335", "Hexadecanolactone"],
  ["336", "Hexamethylindanopyran"], ["337", "Linalyl Acetate"], ["338", "Menthol"], ["339", "Trimethylcyclopentenyl Methylisopentenol"],
  ["340", "Salicylaldehyde"], ["341", "Santalol"], ["342", "Sclareol"], ["343", "Terpineol"], ["344", "Tetramethyl Acetyloctahydronaphthalenes"],
  ["345", "Trimethylbenzenepropanol"], ["346", "Vanillin"],
  ["347", "Cananga Odorata Oil/Extract", "Cananga Odorata Flower Extract", "Cananga Odorata Flower Oil"],
  ["348", "Cinnamomum Cassia Leaf Oil"], ["349", "Cinnamomum Zeylanicum Bark Oil"],
  ["350", "Citrus Aurantium Flower Oil", "Citrus Aurantium Amara Flower Oil"], ["351", "Citrus Aurantium Peel Oil", "Citrus Aurantium Amara Peel Oil"],
  ["352", "Citrus Aurantium Bergamia Peel Oil"], ["353", "Citrus Limon Peel Oil"], ["354", "Lemongrass Oil", "Cymbopogon Schoenanthus Oil"],
  ["355", "Eucalyptus Globulus Oil", "Eucalyptus Globulus Leaf Oil"], ["356", "Eugenia Caryophyllus Oil", "Eugenia Caryophyllus Leaf Oil"],
  ["357", "Jasmine Oil/Extract", "Jasminum Grandiflorum Flower Extract", "Jasminum Officinale Oil", "Jasminum Officinale Flower Extract"],
  ["358", "Juniperus Virginiana Oil", "Juniperus Virginiana Wood Oil"], ["359", "Laurus Nobilis Leaf Oil"],
  ["360", "Lavandula Oil/Extract", "Lavandula Hybrida Oil", "Lavandula Hybrida Extract", "Lavandula Hybrida Flower Extract"],
  ["361", "Mentha Piperita Oil"], ["362", "Mentha Viridis Leaf Oil"], ["363", "Narcissus Extract", "Narcissus Poeticus Extract"],
  ["364", "Pelargonium Graveolens Oil", "Pelargonium Graveolens Flower Oil", "Pelargonium Graveolens Leaf Oil"],
  ["365", "Pogostemon Cablin Oil", "Pogostemon Cablin Leaf Oil"], ["366", "Rose Flower Oil/Extract", "Rosa Damascena Flower Oil", "Rosa Damascena Flower Extract"],
  ["367", "Santalum Album Oil"], ["368", "Eugenyl Acetate"], ["369", "Geranyl Acetate"], ["370", "Isoeugenyl Acetate"], ["371", "Pinene"],
];
const allergenNotes: CareNote[] = ALLERGENS.map(([entry, name, ...others]) => ({
  id: slug(name), kind: "allergen", name, text: ALLERGEN_TEXT, sources: [allergenRow(entry), allergenWhy],
  // A slash label name ("Cananga Odorata Oil/Extract") is matched whole, as the EU writes it.
  aliases: [name, ...others].map(s => s.toLowerCase()),
}));

// ── N4: "fragrance" ──────────────────────────────────────────────────────────
const fragranceNote: CareNote = {
  id: "fragrance", kind: "fragrance", name: "Fragrance", aliases: ["fragrance", "parfum", "aroma"],
  text: "The label doesn't say what's in 'fragrance'. EU law requires naming listed fragrance allergens above set levels. A 2022 US law (MoCRA) requires FDA to make rules for labeling fragrance allergens.",
  sources: [
    { body: "EU", basis: "context", url: EU_ALLERGENS, checkedOn: CHECKED, checkedByHand: HAND,
      finding: "Regulation (EU) 2023/1545: listed fragrance allergens must be named on the label above set levels",
      quote: "when their concentration exceeds 0,001 % in leave-on products and 0,01 % in rinse-off products" },
    { body: "FDA", basis: "context", url: FDA_FRAGRANCE, checkedOn: CHECKED,
      finding: "FDA: under US regulations, fragrance ingredients can be listed simply as \"Fragrance\"",
      quote: "fragrance and flavor ingredients can be listed simply as “Fragrance” or “Flavor.”" },
    // FDA's MoCRA page gives no status for this rule (063 F1): EcoGo says only that the law requires it. The last two
    // quotes are a list heading and its item; read together in the built-in browser.
    { body: "FDA", basis: "context", url: FDA_MOCRA, checkedOn: CHECKED_063,
      finding: "MoCRA is the Modernization of Cosmetics Regulation Act of 2022", quote: "Modernization of Cosmetics Regulation Act of 2022 (MoCRA)" },
    { body: "FDA", basis: "context", url: FDA_MOCRA, checkedOn: CHECKED_063, checkedByHand: CHECKED_063,
      finding: "MoCRA requires FDA to establish regulations for fragrance allergen labeling", quote: "MoCRA requires FDA to establish regulations for" },
    { body: "FDA", basis: "context", url: FDA_MOCRA, checkedOn: CHECKED_063, checkedByHand: CHECKED_063,
      finding: "FDA's MoCRA page lists \"Fragrance allergen labeling requirements\" among those regulations", quote: "Fragrance allergen labeling requirements." },
  ],
};

// ── N5: sunscreen actives, FDA's own status ──────────────────────────────────
const PROPOSED: Source = { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED,
  finding: "FDA's 2021 proposed order (OTC000008) proposes zinc oxide and titanium dioxide as safe and effective (GRASE)",
  quote: "the proposed order proposes GRASE status for sunscreens containing zinc oxide and/or titanium dioxide" };
const MORE_DATA: Source[] = [
  { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED,
    finding: "FDA's 2021 proposed order: not GRASE because additional data are needed",
    quote: "Not GRASE for use in sunscreens because additional data needed" },
  { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED,
    finding: "The 12 actives FDA says need more data",
    quote: "Cinoxate, dioxybenzone, ensulizole, homosalate, meradimate, octinoxate, octisalate, octocrylene, padimate O, sulisobenzone, oxybenzone, avobenzone" },
];
const REMOVED: Source = { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED,
  finding: "FDA's final order of September 10, 2026 (OTC000008-1) removed PABA and trolamine salicylate as sunscreen actives",
  quote: "issued a final administrative order removing two active ingredients — aminobenzoic acid (PABA) and trolamine salicylate" };
const ADDED: Source = { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED,
  finding: "FDA's final order of June 10, 2026 (OTC000039) added bemotrizinol as a sunscreen active",
  quote: "adding bemotrizinol as a new active ingredient in the OTC monograph for sunscreens" };
const STATUS = {
  proposed: { text: "FDA: proposed as safe and effective.", sources: [PROPOSED] },
  "more-data": { text: "FDA says more data are needed.", sources: MORE_DATA },
  // FDA's Q&A gives no effective date for the order (063 F2), so none is shown.
  removed: { text: "FDA ordered its removal (September 10, 2026).", sources: [REMOVED] },
  added: { text: "FDA: added as a sunscreen active in 2026.", sources: [ADDED] },
};
/** 063 F3: shown once under the sunscreen rows when any of them is "more data". */
const MEANING: Source = { body: "FDA", basis: "context", url: FDA_SUNSCREEN, checkedOn: CHECKED_063,
  finding: "FDA (Q9): the 2021 proposed order is not a conclusion that the ingredients needing more data are unsafe",
  quote: "does not represent a conclusion by the FDA that the sunscreen active ingredients proposed as having insufficient data are unsafe for use in sunscreens" };
export const MORE_DATA_MEANING = { id: "sunscreen-more-data-meaning",
  text: "FDA says “more data needed” is not a conclusion that an ingredient is unsafe for use in sunscreens.", sources: [MEANING] };
export const isMoreData = (note: CareNote) => note.sources === MORE_DATA;
const sunscreen = (status: keyof typeof STATUS, name: string, ...aliases: string[]): CareNote => ({
  id: slug(name), kind: "sunscreen", name, aliases: [name.toLowerCase(), ...aliases],
  text: `As a sunscreen active: ${STATUS[status].text}`, sources: STATUS[status].sources,
});
// FDA's names first, then the INCI names an EU-style label uses.
const SUNSCREENS: CareNote[] = [
  sunscreen("proposed", "Zinc oxide"), sunscreen("proposed", "Titanium dioxide"),
  sunscreen("more-data", "Avobenzone", "butyl methoxydibenzoylmethane"), sunscreen("more-data", "Cinoxate"),
  sunscreen("more-data", "Dioxybenzone", "benzophenone-8"), sunscreen("more-data", "Ensulizole", "phenylbenzimidazole sulfonic acid"),
  sunscreen("more-data", "Homosalate"), sunscreen("more-data", "Meradimate", "menthyl anthranilate"),
  sunscreen("more-data", "Octinoxate", "ethylhexyl methoxycinnamate", "octyl methoxycinnamate"),
  sunscreen("more-data", "Octisalate", "ethylhexyl salicylate", "octyl salicylate"), sunscreen("more-data", "Octocrylene"),
  sunscreen("more-data", "Oxybenzone", "benzophenone-3"), sunscreen("more-data", "Padimate O", "ethylhexyl dimethyl paba", "octyl dimethyl paba"),
  sunscreen("more-data", "Sulisobenzone", "benzophenone-4"),
  sunscreen("removed", "Aminobenzoic acid", "paba", "p-aminobenzoic acid", "4-aminobenzoic acid"),
  sunscreen("removed", "Trolamine salicylate", "tea-salicylate"),
  sunscreen("added", "Bemotrizinol", "bis-ethylhexyloxyphenol methoxyphenyl triazine"),
];

export const CARE_NOTES: CareNote[] = [fragranceNote, ...allergenNotes, ...SUNSCREENS];

// ── N2b: EU Annex III, "limited, not banned" (one folded row; never changes the badge) ──
// Titanium dioxide (entry 321, powder with breathable particles) is left out: on a label it can't be told from sunscreen TiO2.
// Talc (entry 59) too: it is always flagged (IARC 2A), and a flagged ingredient isn't also "limited".
const LIMITED_TEXT = "The EU limits how this can be used (amount, product type or pH). EcoGo can't check that from a label.";
// 063 F6: what "(amount, product type or pH)" rests on: Annex III's own column heads, and a pH condition (entry 2a).
const ANNEX_III_HOW: Source[] = [
  { body: "EU", basis: "context", url: EU_COSMETICS, checkedOn: CHECKED_063, checkedByHand: CHECKED_063,
    finding: "Annex III sets each entry's product type and body parts, maximum concentration and other conditions",
    quote: "Product type, body parts Maximum concentration in ready for use preparation Other" },
  { body: "EU", basis: "context", url: EU_COSMETICS, checkedOn: CHECKED_063, checkedByHand: CHECKED_063,
    finding: "Some Annex III conditions are a pH range (entry 2a, thioglycolic acid)", quote: "ready for use pH 7 to 9,5" },
];
const limited = (entry: string, name: string, quote: string, ...aliases: string[]): CareNote => ({
  id: slug(name), kind: "limited", name, aliases: [name.toLowerCase(), ...aliases], text: LIMITED_TEXT,
  sources: [{ body: "EU", basis: "context", url: EU_COSMETICS, quote, checkedOn: CHECKED, checkedByHand: HAND,
    finding: `Regulation (EC) No 1223/2009, Annex III entry ${entry}: allowed in cosmetics only within set limits` }, ...ANNEX_III_HOW],
});
export const CARE_LIMITED: CareNote[] = [
  limited("98", "Salicylic acid", "Benzoic acid, 2-hydroxy- (9) Salicylic acid"),
  limited("100", "Triclocarban", "1-(4-Chlorophenyl)-3-(3,4-dichlorophenyl)urea (12) Triclocarban"),
  limited("376", "Retinol", "For any cosmetic product containing Retinol, Retinyl Acetate or Retinyl Palmitate", "retinyl acetate", "retinyl palmitate"),
  limited("375", "Kojic acid", "(44) Kojic Acid"),
  limited("377", "Alpha-arbutin", "4-Hydroxyphenyl-alpha-D-glucopyranoside (44) Alpha-Arbutin"),
  limited("378", "Arbutin", "4-Hydroxyphenyl-beta-D-glucopyranoside (44) Arbutin"),
  limited("8a", "p-Phenylenediamine", "p-Phenylenediamine; p-Phenylenediamine HCl; p-Phenylenediamine Sulphate",
    "p-phenylenediamine hcl", "p-phenylenediamine sulphate", "p-phenylenediamine sulfate"),
  limited("2a", "Thioglycolic acid", "Thioglycolic acid and its salts", "ammonium thioglycolate", "calcium thioglycolate",
    "potassium thioglycolate", "sodium thioglycolate"),
  limited("12", "Hydrogen peroxide", "including carbamide peroxide and zinc peroxide", "carbamide peroxide", "zinc peroxide"),
  limited("185", "Toluene", "Benzene, methyl- Toluene"),
  limited("96", "Musk xylene", "5-tert-Butyl-2,4,6-trinitro-m-xylene Musk xylene"),
  limited("97", "Musk ketone", "4'-tert-Butyl-2',6'-dimethyl-3',5'-dinitroacetophenone Musk ketone"),
  limited("49", "Selenium sulfide", "Selenium sulfide Selenium disulphide", "selenium disulphide", "selenium disulfide"),
  limited("310", "Climbazole", "(28) Climbazole"),
  limited("324", "Methyl salicylate", "Methyl 2-hydroxybenzoate (38) Methyl Salicylate"),
  limited("15a", "Sodium hydroxide", "Potassium or sodium hydroxide (20) Potassium hydroxide/sodium hydroxide"),
  limited("15a", "Potassium hydroxide", "Potassium or sodium hydroxide (20) Potassium hydroxide/sodium hydroxide"),
  limited("4", "Ammonia", "4 Ammonia Ammonia 7664-41-7"),
  limited("94", "Benzoyl peroxide", "Dibenzoyl peroxide Benzoyl peroxide"),
];

// ── Matching ────────────────────────────────────────────────────────────────
/** "Pyrithione zinc 1%", "100% Talc", "Limonene*", "ZINC OXIDE 20 %", "Lavandula Oil/ Extract" → the bare name, lowercase. */
const AMOUNT = /^\d+(?:[.,]\d+)?\s*%\s*|\s*\d+(?:[.,]\d+)?\s*%.*$/g;
const bare = (item: string) => item.toLowerCase().replace(AMOUNT, "").replace(/\s+usp$/, "").replace(/\s*\/\s*/g, "/").trim();
/** An item's names: itself and, for "Aqua/Water/Eau", each part. */
const names = (item: string) => { const b = bare(item); return b.includes("/") ? [b, ...b.split("/").map(s => s.trim())] : [b]; };
const FRAGRANCE_WORD = /(?<![a-z0-9])(?:fragrance|parfum|aroma)(?![a-z0-9])/;

const SUNSCREEN_WORD = /\bsun ?(?:screen|block)s?\b|\bspf\d*\b/i;
/** N2c item 2 (revised): a product page shows sunscreen rows only when the name or the OBF categories say sunscreen,
 *  sunblock or SPF (titanium dioxide in a toothpaste is a colour, not a sunscreen). */
export const isSunscreen = (name: string, categoryTags: string[] = []) => [name, ...categoryTags].some(s => SUNSCREEN_WORD.test(s));

/** `sunscreen: false` (a product page for a product that isn't a sunscreen) leaves the sunscreen rows out; a photo or
 *  typed list, which has no name, keeps them. */
export function analyzeCare(ingredients: string, { sunscreen = true }: { sunscreen?: boolean } = {}): CareAnalysis {
  const items = parseIngredients(typeof ingredients === "string" ? ingredients : "");
  const checkedCount = PERSONAL_CARE.length;
  if (items.length === 0) return { verdict: "no-data", flags: [], checkedCount, notes: [], limited: [] };
  const flags: Flag[] = [];
  const found: Found[] = [];
  const limited: Found[] = [];
  for (const item of items) {
    const n = names(item);
    const flagged = flags.length;
    for (const entry of PERSONAL_CARE)
      if (!flags.some(f => f.entry === entry) && entry.aliases.some(a => n.includes(a))) flags.push({ entry, matchedText: item });
    for (const note of CARE_NOTES) {
      if ((note.kind === "sunscreen" && !sunscreen) || found.some(f => f.note === note)) continue;
      // "fragrance" is a word anywhere in the item ("Natural Fragrance"); every other note is a whole name.
      const hit = note.kind === "fragrance" ? FRAGRANCE_WORD.test(bare(item)) : note.aliases.some(a => n.includes(a));
      if (hit) found.push({ note, matchedText: item });
    }
    // An ingredient already flagged here (talc) isn't also "limited".
    if (flags.length === flagged) for (const note of CARE_LIMITED)
      if (!limited.some(f => f.note === note) && note.aliases.some(a => n.includes(a))) limited.push({ note, matchedText: item });
  }
  flags.sort((a, b) => SEVERITY_RANK[b.entry.severity] - SEVERITY_RANK[a.entry.severity]);
  const top = Math.max(0, ...flags.map(f => SEVERITY_RANK[f.entry.severity]));
  return { verdict: LEVELS[top], flags, checkedCount, notes: found, limited };
}

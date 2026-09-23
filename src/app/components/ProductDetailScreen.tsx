// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailScreen.tsx — Explainable AI product evaluation
//
// Transparency pillars:
//   1. Weighted score breakdown — shows the math behind each overall score
//   2. Confidence indicator     — quantifies how much data backed this score
//   3. Data sources             — every claim is attributable to a named source
//   4. Positive attributes      — what the product does well
//   5. Areas for improvement    — actionable improvement points
//   6. Assumptions              — what we assumed when data was unavailable
//   7. Ingredient Explorer      — per-ingredient deep-dive with peer-reviewed citations
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import {
  ArrowLeft, Bookmark, Share2, Shield, Leaf, DollarSign, Star,
  AlertTriangle, CheckCircle, ChevronRight, X, FlaskConical,
  ShoppingBag, TrendingUp, Info, Eye, Zap, MapPin, Sparkles,
  ChevronDown, BookOpen, Database, Microscope, ThumbsUp, ThumbsDown,
  HelpCircle,
} from "lucide-react";
import type { Product } from "../../lib/productImporter";
import {
  scoreColorHex, gradeBadgeClass, gradeToVerdict, SCORE_WEIGHTS,
} from "../../lib/scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "high" | "medium" | "low" | "safe";

interface IngredientInfo {
  name: string; aliases: string[]; riskLevel: RiskLevel;
  purpose: string; shortDescription: string; scientificExplanation: string;
  healthEffects: string; research: string; alternatives: string[];
}
interface ParsedIngredient { displayName: string; info: IngredientInfo | null; }

interface DataSource {
  name: string;
  type: "regulatory" | "scientific" | "certification" | "ngo";
  description: string;
}

interface ScoreExplanation {
  confidence: number;        // 0–100 — how reliable this evaluation is
  confidenceReason: string;  // one-sentence explanation of confidence level
  positives: string[];       // what the product does well
  improvements: string[];    // actionable concerns
  assumptions: string[];     // what was assumed when data was unavailable
  sources: DataSource[];     // evidence base for this product specifically
}

// ─── Ingredient Database ──────────────────────────────────────────────────────
// (full database preserved — see previous version)

const INGREDIENT_DB: IngredientInfo[] = [
  { name: "Sodium Nitrite", aliases: ["sodium nitrite","nitrite"], riskLevel: "high", purpose: "Preservative / Color Fixative", shortDescription: "A curing salt that keeps processed meats pink and prevents bacterial growth. Classified as a known carcinogen in processed meat context.", scientificExplanation: "Sodium nitrite (NaNO₂) is added to processed meats to inhibit Clostridium botulinum growth and maintain the pink hue of cured products. In the acidic stomach environment, nitrites react with secondary amines from meat proteins to form N-nitrosamines.", healthEffects: "N-nitrosamines are IARC Group 1 carcinogens. Regular processed meat consumption is linked to a 17–18% increased relative risk of colorectal cancer per 50g daily serving. The World Health Organization classified processed meats as Group 1 carcinogens in 2015.", research: "The 2015 IARC Monographs Volume 114 evaluated 800 studies over 20 years. European Cancer Research found a dose-dependent relationship between processed meat intake and colorectal cancer incidence.", alternatives: ["Uncured meats (celery powder)","Fresh unprocessed meats","Plant-based protein alternatives","Meats labeled 'no nitrites added'"] },
  { name: "Aspartame", aliases: ["aspartame","nutrasweet","equal"], riskLevel: "high", purpose: "Artificial Sweetener", shortDescription: "A zero-calorie sweetener 200× sweeter than sugar. Reclassified as possibly carcinogenic by the IARC in 2023.", scientificExplanation: "Aspartame is a dipeptide methyl ester (phenylalanine + aspartic acid + methanol). It breaks down in the gut into its component amino acids and a small amount of methanol. The 2023 IARC review examined evidence from human epidemiological studies and animal studies.", healthEffects: "IARC Group 2B (possibly carcinogenic to humans) as of 2023, based on limited evidence of hepatocellular carcinoma in human studies. People with phenylketonuria (PKU) must avoid it entirely.", research: "The 2023 IARC Working Group found limited evidence in humans from three cohort studies, including a French NutriNet-Santé cohort study (n=102,865) showing associations with overall cancer risk.", alternatives: ["Monk fruit sweetener","Allulose","Stevia (pure leaf)","Small amounts of real sugar"] },
  { name: "Red 40 (Allura Red)", aliases: ["red 40","allura red","fd&c red 40","red no. 40"], riskLevel: "high", purpose: "Synthetic Food Dye", shortDescription: "A petroleum-derived red dye. IARC Group 2B (possible carcinogen). Requires warning labels in the EU.", scientificExplanation: "Red 40 is derived from petroleum. It passes through the gut relatively intact but metabolites may interact with cellular DNA.", healthEffects: "Animal studies show potential carcinogenicity. Multiple double-blind trials link Red 40 consumption to increased hyperactivity in children. In the EU, products must carry the label 'may have an adverse effect on activity and attention in children.'", research: "FDA requires a warning label on beverages with high dye content in California under Prop 65. The EU's EFSA re-evaluated Red 40 in 2010.", alternatives: ["Beet juice (natural red)","Annatto extract","Paprika extract","Dye-free product versions"] },
  { name: "Blue 1 (Brilliant Blue)", aliases: ["blue 1","brilliant blue","fd&c blue 1","fd&c blue no. 1"], riskLevel: "high", purpose: "Synthetic Food Dye", shortDescription: "A petroleum-based blue dye classified as IARC Group 2B (possible carcinogen). Banned in several countries.", scientificExplanation: "Blue 1 (triphenylmethane dye) is synthesized from petroleum derivatives. Some animal studies showed malignant tumor formation at high doses.", healthEffects: "IARC Group 2B. Some studies suggest it may cross the blood-brain barrier in cases of intestinal inflammation.", research: "Blue 1 was assessed by EFSA in 2010. Norway banned it; it remains restricted in several countries.", alternatives: ["Spirulina extract (natural blue-green)","Butterfly pea flower","Dye-free alternatives"] },
  { name: "Methylisothiazolinone (MI)", aliases: ["methylisothiazolinone","mi"], riskLevel: "high", purpose: "Preservative / Biocide", shortDescription: "A powerful antimicrobial preservative linked to skin sensitization and allergic contact dermatitis. Banned in EU leave-on products.", scientificExplanation: "Methylisothiazolinone is an isothiazolinone biocide that works by disrupting enzyme function in bacteria. It is highly effective at low concentrations but is a potent skin sensitizer.", healthEffects: "SCCS found MI unsafe even at 0.0015% in leave-on cosmetics. The EU restricted it and banned it entirely in leave-on products in 2016. Contact dermatitis cases caused by MI increased 900% between 2010–2013.", research: "The British Association of Dermatologists designated it the 2013 'Contact Allergen of the Year.' The European Contact Dermatitis Society declared a European epidemic.", alternatives: ["Sodium benzoate","Potassium sorbate","Phenoxyethanol (at safe concentrations)","Ethanol"] },
  { name: "1,4-Dioxane", aliases: ["1,4-dioxane","1,4 dioxane","dioxane"], riskLevel: "high", purpose: "Manufacturing Contaminant", shortDescription: "A likely carcinogen appearing as an unintended trace contaminant in products using ethoxylated surfactants. Not intentionally added.", scientificExplanation: "1,4-Dioxane is generated as a by-product when sodium laureth sulfate or other ethoxylated ingredients are manufactured. It is not listed on labels because it is a contaminant.", healthEffects: "Classified as a probable human carcinogen by the EPA and IARC Group 2B. Animal studies consistently show liver and nasal carcinogenicity.", research: "An EWG study (2007, updated 2019) found 1,4-dioxane in 46% of personal care products tested. New York State enacted regulations requiring disclosure in 2019.", alternatives: ["Products using non-ethoxylated surfactants","Certified organic cleansers","Seventh Generation or Method products"] },
  { name: "Fragrance (Undisclosed)", aliases: ["fragrance","parfum","natural and artificial fragrance","scent"], riskLevel: "medium", purpose: "Scent Masking / Consumer Appeal", shortDescription: "'Fragrance' is a trade secret loophole that can represent 100–300+ undisclosed synthetic chemicals in a single ingredient.", scientificExplanation: "Under US FDA rules, fragrance compounds are protected as trade secrets and do not need to be individually listed.", healthEffects: "Common fragrance chemicals include phthalates (hormone disruptors), benzophenone (possible carcinogen), synthetic musks (bioaccumulative), and various allergens.", research: "The Campaign for Safe Cosmetics found an average of 14 undisclosed chemicals per product in a fragrance analysis.", alternatives: ["Fragrance-free products","Products using essential oils with disclosed components"] },
  { name: "Caramel Color", aliases: ["caramel color","caramel colour","4-methylimidazole","4-mei"], riskLevel: "medium", purpose: "Colorant", shortDescription: "A brown food coloring. Class IV caramel (made with ammonia compounds) contains 4-MEI, a possible carcinogen listed under California Prop 65.", scientificExplanation: "There are four classes of caramel color. Class III and IV are made using ammonia or ammonia-sulfite processes, which produce 4-methylimidazole (4-MEI) as a by-product.", healthEffects: "4-MEI is IARC Group 2B and listed as a carcinogen under California Proposition 65.", research: "NTP animal studies found 4-MEI induced lung adenomas. Coca-Cola reformulated after California threatened mandatory warning labels.", alternatives: ["Clear sodas","Beverages colored with fruit juices","Water, sparkling water"] },
  { name: "Potassium Benzoate", aliases: ["potassium benzoate","sodium benzoate","benzoate"], riskLevel: "medium", purpose: "Preservative", shortDescription: "A common preservative. May form benzene, a known carcinogen, when combined with ascorbic acid (vitamin C).", scientificExplanation: "When combined with ascorbic acid in acidic beverages, benzoate can form benzene through a decarboxylation reaction.", healthEffects: "Benzene is an IARC Group 1 carcinogen. On its own, benzoate is considered low-risk at normal dietary exposure.", research: "FDA tested 200 beverages for benzene in 2007; 10 exceeded the 5 ppb drinking water standard.", alternatives: ["Rosemary extract","Vitamin E (tocopherols)","Citric acid alone as acidulant"] },
  { name: "Palm Kernel Oil", aliases: ["palm kernel oil","palm oil"], riskLevel: "medium", purpose: "Fat / Emulsifier / Texture Agent", shortDescription: "A saturated fat used for its stable texture. Major driver of tropical deforestation and biodiversity loss.", scientificExplanation: "Palm kernel oil is extracted from the kernel of oil palm fruits. Approximately 85–90% of the world's supply comes from Indonesia and Malaysia, where production has destroyed critical habitat.", healthEffects: "High in saturated fat (82%), which may raise LDL cholesterol. Not a direct human health hazard, but environmental harm has broader public health implications.", research: "Greenpeace estimates that deforestation for palm oil results in 2.8 billion metric tons of CO₂ equivalent annually.", alternatives: ["Coconut oil (with RSPO certification)","Shea butter","Certified RSPO palm oil"] },
  { name: "Sodium Lauryl Sulfate (SLS)", aliases: ["sodium lauryl sulfate","sls","sodium laureth sulfate","sles"], riskLevel: "medium", purpose: "Surfactant / Foaming Agent", shortDescription: "A common detergent surfactant found in shampoos and cleansers. Can irritate skin and mucous membranes, particularly with repeated use.", scientificExplanation: "SLS disrupts the skin barrier by denaturing proteins in the stratum corneum and can strip natural oils.", healthEffects: "Not considered carcinogenic, but classified as an irritant. Increases skin permeability potentially allowing other chemicals to penetrate more readily.", research: "SCCS considers SLS safe at ≤2% in rinse-off products. Multiple RCTs confirm increased canker sore frequency with SLS-containing toothpastes.", alternatives: ["Coco-glucoside","Decyl glucoside","Sodium cocoyl isethionate"] },
  { name: "Phosphoric Acid", aliases: ["phosphoric acid"], riskLevel: "medium", purpose: "Acidulant / Preservative", shortDescription: "Gives colas their tangy taste and acts as a preservative. At high intake, associated with lower bone mineral density.", scientificExplanation: "Phosphoric acid lowers pH to preserve flavor and inhibit microbial growth. It contributes to heavy soda drinkers' elevated dietary phosphorus load.", healthEffects: "Multiple epidemiological studies associate high cola intake with reduced bone density, particularly in women.", research: "Tucker et al. (2006) Osteoporosis International: cola was associated with lower bone density in women.", alternatives: ["Citric acid (less phosphorus)","Sparkling water","Fruit-infused water"] },
  { name: "Glucose Syrup", aliases: ["glucose syrup","corn syrup","high fructose corn syrup","fructose corn syrup"], riskLevel: "medium", purpose: "Sweetener / Binding Agent", shortDescription: "A refined sugar derived from starch. Regular consumption contributes to metabolic syndrome.", scientificExplanation: "Glucose syrup is produced by hydrolyzing starch into glucose. Metabolized identically to table sugar at tissue level.", healthEffects: "Not specifically carcinogenic. High sugar intake is strongly linked to obesity, type 2 diabetes, cardiovascular disease.", research: "WHO recommends limiting free sugars to <10% of daily caloric intake.", alternatives: ["Honey (lower glycemic index)","Maple syrup","Date syrup"] },
  { name: "Sodium Phosphates", aliases: ["sodium phosphates","sodium phosphate"], riskLevel: "medium", purpose: "Preservative / pH Buffer / Emulsifier", shortDescription: "Used in processed meats to retain moisture and bind water. At high intake, can disrupt the phosphate-calcium balance.", scientificExplanation: "Sodium phosphates serve multiple roles in processed foods: moisture retention, pH buffering, and emulsification.", healthEffects: "High dietary phosphorus is associated with cardiovascular mortality in people with chronic kidney disease.", research: "Selamet et al. (2016) found phosphate additives in processed foods more readily absorbed than organic phosphorus in whole foods.", alternatives: ["Fresh unprocessed meats","Plant-based proteins"] },
  { name: "Natural Flavors", aliases: ["natural flavor","natural flavors","natural and artificial flavors"], riskLevel: "medium", purpose: "Flavor Compound", shortDescription: "A regulatory catch-all for flavor chemicals derived from 'natural' sources. Can include hundreds of undisclosed compounds.", scientificExplanation: "FDA defines 'natural flavor' as any flavor derived from plant, animal, or microbial material. The designation says nothing about the safety of specific chemicals.", healthEffects: "Individual risk depends entirely on what is in the proprietary blend. Generally lower risk than 'fragrance' but similarly opaque.", research: "EWG Dirty Dozen Food Additives report identifies natural and artificial flavors as among the least transparent.", alternatives: ["Products listing specific flavor extracts","Whole food ingredients"] },
  { name: "Sodium Erythorbate", aliases: ["sodium erythorbate","erythorbate"], riskLevel: "low", purpose: "Antioxidant / Color Preservative", shortDescription: "A synthetic form of vitamin C used to preserve color in processed meats. Generally considered safe.", scientificExplanation: "Sodium erythorbate is the sodium salt of erythorbic acid. It also accelerates the conversion of nitrite to nitric oxide during meat curing.", healthEffects: "Generally recognized as safe (GRAS) by FDA. No known carcinogenic activity. Primary concern: its use with sodium nitrite may compound nitrosoamine formation.", research: "FDA GRAS Notice No. GRN 000032. No significant adverse findings in long-term animal studies.", alternatives: ["Not typically necessary to avoid specifically; focus on avoiding sodium nitrite"] },
  { name: "Citric Acid", aliases: ["citric acid"], riskLevel: "safe", purpose: "Acidulant / Preservative / Flavor Enhancer", shortDescription: "A naturally occurring organic acid found in citrus fruits. Safe and effective at preserving food and enhancing tartness.", scientificExplanation: "Citric acid (C₆H₈O₇) occurs naturally in all living organisms as part of the Krebs cycle. Commercial production is by fermentation of sugar with Aspergillus niger mold.", healthEffects: "No known health concerns at dietary levels. GRAS status in the US and EU.", research: "Extensively reviewed by JECFA and EFSA. ADI: 'not specified,' indicating minimal risk.", alternatives: ["Not necessary to avoid — one of the safer additives in food"] },
  { name: "Salt (Sodium Chloride)", aliases: ["salt","sodium chloride","sea salt"], riskLevel: "low", purpose: "Flavor / Preservative", shortDescription: "Common table salt. Essential for health in small amounts; excess intake raises blood pressure and cardiovascular disease risk.", scientificExplanation: "Sodium is essential for nerve conduction and fluid balance. Most Americans consume 3,400mg sodium/day vs. the recommended 2,300mg.", healthEffects: "Each 1,000mg increase in daily sodium is associated with a 17% higher risk of stroke and 23% higher risk of cardiovascular disease.", research: "Intersalt Study (1988, n=10,000 across 52 populations) established the dose-response between sodium and blood pressure.", alternatives: ["Herbs and spices for flavor","Potassium chloride (partial salt substitute)","Lemon juice"] },
  { name: "Caffeine", aliases: ["caffeine"], riskLevel: "low", purpose: "Stimulant", shortDescription: "A naturally occurring stimulant. Safe for most adults at moderate doses.", scientificExplanation: "Caffeine is a methylxanthine alkaloid that competitively blocks adenosine receptors. Each Diet Coke can contains ~46mg caffeine.", healthEffects: "FDA considers up to 400mg/day safe for healthy adults. Not carcinogenic; some studies suggest protective effects against Parkinson's disease.", research: "EFSA 2015 opinion: 200mg single dose is safe for most adults.", alternatives: ["Decaffeinated versions","Herbal teas","Water"] },
  { name: "Potatoes", aliases: ["potatoes","potato"], riskLevel: "safe", purpose: "Primary Ingredient", shortDescription: "A naturally occurring starchy vegetable. The cooking method largely determines the overall health profile.", scientificExplanation: "Potatoes are rich in potassium, vitamin C, and B vitamins. When fried at high temperatures, acrylamide forms — a concern separate from the potato itself.", healthEffects: "No inherent health concerns. The primary health concern in chips comes from high-temperature cooking (acrylamide) and added sodium.", research: "Potato consumption is included in dietary guidance of most countries.", alternatives: ["Not necessary to avoid — a natural whole food ingredient"] },
  { name: "Almonds", aliases: ["almonds","almond"], riskLevel: "safe", purpose: "Primary Ingredient / Protein Source", shortDescription: "Tree nuts rich in healthy fats, protein, and vitamin E. One of the most nutrient-dense whole food ingredients in packaged snacks.", scientificExplanation: "Almonds are rich in monounsaturated fatty acids, vitamin E, magnesium, and fiber.", healthEffects: "No health concerns. Regular nut consumption is consistently associated with reduced cardiovascular disease risk.", research: "PREDIMED trial (n=7,447) found Mediterranean diet including nuts reduced cardiovascular events by 30%.", alternatives: ["No substitution needed — a highly beneficial ingredient"] },
  { name: "Honey", aliases: ["honey"], riskLevel: "low", purpose: "Sweetener / Binder", shortDescription: "A natural sweetener with trace enzymes, antioxidants, and antimicrobial compounds. Still a high-sugar ingredient.", scientificExplanation: "Honey is 80% sugars (roughly 40% fructose, 30% glucose). It contains small amounts of vitamins, minerals, and antioxidants.", healthEffects: "Lower glycemic index than table sugar (58 vs 65). Not safe for infants under 12 months.", research: "A Cochrane review found no significant difference between honey and sugar in terms of glycemic response.", alternatives: ["Used in moderation, honey is preferable to refined sugar but should not be consumed freely"] },
  { name: "Soy Lecithin", aliases: ["soy lecithin","lecithin","sunflower lecithin"], riskLevel: "low", purpose: "Emulsifier", shortDescription: "A fat-like substance extracted from soybeans. Generally safe; may be an allergen for soy-sensitive individuals.", scientificExplanation: "Lecithin is a phospholipid that acts as an emulsifier. Soy lecithin is highly refined and most soy protein is removed.", healthEffects: "GRAS status. Very low allergenic potential for soy-allergic individuals.", research: "EFSA found soy lecithin safe at typical dietary exposure.", alternatives: ["Sunflower lecithin (for soy-sensitive individuals)"] },
  { name: "Water", aliases: ["water","carbonated water","sparkling water","purified water"], riskLevel: "safe", purpose: "Solvent / Base Ingredient", shortDescription: "The primary ingredient in most beverages. Universally safe.", scientificExplanation: "Water serves as the base solvent for most liquid products. Carbonated water contains dissolved CO₂.", healthEffects: "No health concerns. Carbonation may cause temporary bloating in sensitive individuals.", research: "Meta-analysis (Cuomo 2016): sparkling water does not affect bone mineral density.", alternatives: ["Not necessary to avoid"] },
  { name: "Sucrose", aliases: ["sucrose","sugar","cane sugar"], riskLevel: "low", purpose: "Sweetener", shortDescription: "Common table sugar. Excess consumption is a primary driver of obesity and metabolic disease.", scientificExplanation: "Sucrose is a disaccharide (glucose + fructose). It is rapidly absorbed, causing blood glucose spikes.", healthEffects: "WHO recommends free sugars stay below 10% of daily calorie intake. Excess sugar intake is causally linked to dental caries, obesity, type 2 diabetes, and cardiovascular disease.", research: "The PURE study (n=135,000) found highest tertile sugar intake associated with elevated cardiovascular mortality.", alternatives: ["Fruit (natural sugar with fiber)","Reduce quantity","Monk fruit sweetener for cooking"] },
  { name: "Sodium Gluconate", aliases: ["sodium gluconate"], riskLevel: "safe", purpose: "Chelating Agent / Water Softener", shortDescription: "A sodium salt of gluconic acid that binds to metal ions. Considered safe and biodegradable.", scientificExplanation: "Sodium gluconate is produced by fermentation of glucose. It acts as a chelating agent, sequestering calcium and magnesium ions.", healthEffects: "GRAS in food applications. No reproductive, developmental, or carcinogenic concerns.", research: "OECD screening: readily biodegradable (>70% in 28 days). EPA Safer Choice ingredient.", alternatives: ["Already a safe alternative to harsher chelating agents like EDTA"] },
  { name: "Lauramine Oxide", aliases: ["lauramine oxide","lauryl dimethyl amine oxide"], riskLevel: "low", purpose: "Surfactant / Foam Booster", shortDescription: "A mild amphoteric surfactant that enhances foam and boosts cleaning performance. Generally considered safe.", scientificExplanation: "Lauramine oxide is an amine oxide surfactant derived from lauric acid (typically from coconut).", healthEffects: "EPA Safer Choice listed. Low skin irritation potential. Readily biodegradable.", research: "EPA Design for Environment assessment: low acute toxicity, not carcinogenic, not genotoxic.", alternatives: ["Coco-betaine","Already a safer surfactant choice"] },
  { name: "Dextrose", aliases: ["dextrose"], riskLevel: "low", purpose: "Sweetener / Processing Aid", shortDescription: "A simple sugar (pure glucose) derived from corn. Metabolizes directly into blood glucose.", scientificExplanation: "Dextrose is the D-isomer of glucose, chemically identical to blood sugar. It has a glycemic index of 100.", healthEffects: "High glycemic index food. Not carcinogenic in isolation. Same metabolic concerns as sucrose at high dietary intake.", research: "JECFA: no ADI required; acceptable at current levels in food.", alternatives: ["Reducing total processed food intake","Products without added sugars"] },
  { name: "Enzymes", aliases: ["enzymes","amylase","protease","lipase","cellulase"], riskLevel: "safe", purpose: "Stain Removal / Cleaning Performance", shortDescription: "Biological catalysts that break down protein, starch, and fat stains. Safe and biodegradable.", scientificExplanation: "Laundry enzymes are proteins derived from microbial fermentation, are effective at low temperatures, and are biodegradable.", healthEffects: "Generally safe. Occupational asthma was observed in factory workers with prolonged airborne exposure to enzyme dust — not a consumer concern.", research: "EPA Safer Choice listed. OECD 301: readily biodegradable.", alternatives: ["Not necessary to avoid — among the 'green chemistry' success stories in cleaning products"] },
];

// ─── Score Explanations Database ──────────────────────────────────────────────

const SCORE_EXPLANATIONS: Record<number, ScoreExplanation> = {
  1: {
    confidence: 78,
    confidenceReason: "Short, simple ingredient list with one well-studied process-related concern (acrylamide). Corporate sustainability data is moderately documented.",
    positives: [
      "Minimal ingredient list — only 3 components with no synthetic additives or preservatives",
      "Primary ingredient (potatoes) is a whole food with no inherent safety concerns",
      "No synthetic dyes, artificial flavors, or undisclosed compound categories",
      "Affordability score is strong — among the lowest price-per-serving in the snack category",
    ],
    improvements: [
      "High-temperature frying creates acrylamide, a probable carcinogen (IARC Group 2A) — switch to baked versions to reduce exposure",
      "Single-use foil packaging is non-recyclable in most municipal programs",
      "High sodium content (170mg/serving) accumulates quickly with typical portion sizes (2+ servings)",
      "PepsiCo markets high-sodium snacks heavily to children through sponsorships and digital advertising",
    ],
    assumptions: [
      "Acrylamide content estimated from published averages for potato chips — not measured directly for this product",
      "Environmental score based on industry-average data for PepsiCo's operations, not product-specific LCA",
      "Ethics score reflects PepsiCo parent company; Frito-Lay operates semi-independently",
    ],
    sources: [
      { name: "IARC Monographs Vol. 114 (2015)", type: "scientific", description: "Acrylamide classified IARC Group 2A — probable human carcinogen based on sufficient evidence in animals and limited evidence in humans" },
      { name: "FDA Acrylamide in Food (2023)", type: "regulatory", description: "FDA monitors acrylamide levels across food categories; potato chips consistently among highest sources" },
      { name: "PepsiCo Sustainability Report (2022)", type: "certification", description: "Corporate reporting on packaging recyclability, water usage, and emission reduction targets" },
      { name: "EWG Food Scores Database", type: "ngo", description: "Nutritional and ingredient safety scoring for packaged food products" },
    ],
  },
  2: {
    confidence: 85,
    confidenceReason: "Multiple well-documented high-risk ingredients with extensive peer-reviewed research. Corporate transparency is notably limited, which itself lowers the transparency dimension.",
    positives: [
      "Effective cleaning performance across a wide range of temperatures — reduces energy needed for hot-water washing",
      "Concentrated formula reduces packaging volume relative to traditional detergents",
      "Contains enzymes (biodegradable and EPA-recognized safer chemistry)",
    ],
    improvements: [
      "Methylisothiazolinone (MI) is banned in EU leave-on products and caused a 900% spike in contact allergy cases across Europe 2010–2016",
      "1,4-Dioxane is a probable carcinogen (EPA classification) appearing as an unintended manufacturing contaminant",
      "Fragrance listed as a single undisclosed term — may represent hundreds of synthetic compounds",
      "Non-recyclable plastic pods (encapsulated in PVA film) are not accepted by most municipal recycling programs",
      "P&G has been slow to publish full ingredient biodegradability data despite repeated requests from environmental NGOs",
    ],
    assumptions: [
      "1,4-Dioxane concentration estimated from published EWG testing of similar P&G products — not independently tested for this batch",
      "Fragrance component risk rated as 'medium' using the EWG methodology for undisclosed fragrance categories",
      "Environmental score uses industry-average data for synthetic surfactant production energy and aquatic toxicity",
    ],
    sources: [
      { name: "EU SCCS Opinion MI (2016)", type: "regulatory", description: "Scientific Committee on Consumer Safety found MI unsafe at any level in leave-on products; restricted in rinse-off products" },
      { name: "EWG 1,4-Dioxane Study (2019)", type: "ngo", description: "Updated laboratory testing found 1,4-dioxane in 46% of personal care and cleaning products tested, including P&G brands" },
      { name: "British Association of Dermatologists (2013)", type: "scientific", description: "Designated methylisothiazolinone as Contact Allergen of the Year following a documented European epidemic" },
      { name: "California Prop 65 List", type: "regulatory", description: "1,4-Dioxane listed as a known carcinogen under California's Safe Drinking Water and Toxic Enforcement Act" },
    ],
  },
  3: {
    confidence: 88,
    confidenceReason: "Third-party certifications (Non-GMO, Gluten-Free) independently verify several claims. Full ingredient disclosure enables thorough analysis. Palm oil sustainability data carries known uncertainty.",
    positives: [
      "Whole-food, minimally processed ingredient list with no synthetic dyes or artificial preservatives",
      "Non-GMO Project Verified — independent third-party certification",
      "Gluten-free certified — independently audited, useful for celiac consumers",
      "No synthetic flavors, artificial colors, or mystery compound categories like 'fragrance'",
      "Mars has published a 2025 commitment to certified sustainable palm sourcing with measurable milestones",
    ],
    improvements: [
      "Palm kernel oil is a major driver of rainforest deforestation in Indonesia and Malaysia — RSPO-certified alternatives exist",
      "5g added sugar per bar — low but accumulates if consuming multiple bars as meal replacements",
      "Mars Inc. (parent company) maintains a mixed overall ethics record, particularly on cocoa supply chain labor",
      "Packaging is not widely recyclable despite the product's otherwise strong environmental profile",
    ],
    assumptions: [
      "Palm oil sustainability status assumed uncertain — Mars states commitment to RSPO certification but audit coverage is not fully disclosed",
      "Ethics score moderated slightly below KIND's pre-acquisition score to account for Mars parent company practices",
      "Environmental score uses published RSPO palm oil averages as the best available estimate",
    ],
    sources: [
      { name: "Non-GMO Project Verification", type: "certification", description: "Independent third-party verification that products meet rigorous non-GMO standards through annual audits" },
      { name: "Greenpeace Palm Oil Deforestation Report (2021)", type: "ngo", description: "Estimates 2.8 billion metric tons CO₂ equivalent annually from palm oil production deforestation" },
      { name: "Mars Sustainable in a Generation Plan (2022)", type: "certification", description: "Corporate sustainability report with targets for palm oil, cocoa, and packaging" },
      { name: "EWG Food Scores", type: "ngo", description: "Ingredient safety and nutritional quality scoring methodology for packaged food" },
    ],
  },
  4: {
    confidence: 82,
    confidenceReason: "Core functional claims (electrolyte replacement) are well-supported by sports science. Dye carcinogenicity evidence is limited but consistent across multiple studies.",
    positives: [
      "Core electrolyte formula (sodium, potassium, phosphate) is scientifically validated for hydration during prolonged exercise",
      "Aluminum-free option when served in plastic bottles — recyclable in most municipal programs",
      "Well-studied formula — active ingredient interactions are thoroughly documented in sports medicine literature",
      "PepsiCo removed Brominated Vegetable Oil (BVO) from the US formula following consumer pressure",
    ],
    improvements: [
      "Red 40 and Blue 1 are IARC Group 2B possible carcinogens — removing them has zero functional impact on the product",
      "34g sugar per 20oz bottle — appropriate during intense exercise only; routine consumption drives metabolic disease risk",
      "Marketing heavily targets children and casual consumers who are unlikely to be engaged in exercise intense enough to benefit",
      "PepsiCo lobbies against sugar taxes globally, undermining public health policy",
    ],
    assumptions: [
      "Dye-related cancer risk assessed using individual ingredient IARC classifications — combined exposure effects are not independently studied",
      "Environmental score uses PepsiCo system-wide plastic data divided proportionally — not product-specific lifecycle analysis",
      "Electrolyte benefit score is based on average active adult consuming product during appropriate exercise context",
    ],
    sources: [
      { name: "IARC Monographs Vol. 16 (Red 40, Blue 1)", type: "scientific", description: "Red 40 and Blue 1 classified Group 2B based on animal carcinogenicity studies" },
      { name: "Southampton Study — Lancet (2007)", type: "scientific", description: "Double-blind trial (n=297 children) found dye combinations including Red 40 significantly increased hyperactivity" },
      { name: "Journal of the International Society of Sports Nutrition (2010)", type: "scientific", description: "Systematic review confirming electrolyte beverage efficacy during exercise >1 hour at moderate-to-high intensity" },
      { name: "California Prop 65 Office", type: "regulatory", description: "Red 40 and Blue 1 are listed under Prop 65 for warning label consideration in California beverages" },
    ],
  },
  5: {
    confidence: 94,
    confidenceReason: "EPA Safer Choice certification provides independent regulatory verification. Full ingredient glossary published by company enables direct analysis. One of the most data-rich evaluations in our database.",
    positives: [
      "EPA Safer Choice certified — independent regulatory review of every ingredient for human and environmental safety",
      "All surfactants are plant-derived and independently verified as biodegradable",
      "No synthetic fragrances, dyes, optical brighteners, or phosphates",
      "Full ingredient glossary published by company with purpose of each component explained — exceptional transparency",
      "Leaping Bunny certified cruelty-free — no animal testing at any stage of production or by suppliers",
      "Post-consumer recycled packaging — closed-loop material recovery",
    ],
    improvements: [
      "Parent company Unilever has a mixed sustainability record, particularly on plastic pollution and fossil fuel-based ingredient sourcing",
      "Sodium lauryl sulfate (SLS) may cause skin irritation in individuals with sensitive skin or compromised barrier function",
      "Price premium over conventional detergents may limit accessibility for low-income households",
    ],
    assumptions: [
      "Ethics score slightly moderated to account for Unilever parent company practices — Seventh Generation operates with significant independence but is not wholly isolated from corporate decisions",
      "Environmental score uses Seventh Generation's published lifecycle data, which is third-party verified but specific to 2021 reporting year",
    ],
    sources: [
      { name: "EPA Safer Choice Program", type: "regulatory", description: "Federal regulatory program requiring ingredient-by-ingredient safety review against a restricted substance list of over 600 chemicals of concern" },
      { name: "Seventh Generation Ingredient Glossary", type: "certification", description: "Publicly available documentation of every ingredient, its source, and its function — reviewed against EPA Safer Choice and EWG standards" },
      { name: "Leaping Bunny Certification", type: "certification", description: "Independent cruelty-free certification requiring annual supply chain audits to verify no animal testing" },
      { name: "SCCS Opinion on SLS (2015)", type: "scientific", description: "Scientific Committee on Consumer Safety established safe concentration limits for SLS in rinse-off and leave-on cosmetics" },
    ],
  },
  6: {
    confidence: 92,
    confidenceReason: "Sodium nitrite's carcinogenic mechanism in processed meat is among the most extensively studied food safety topics in modern epidemiology, reviewed by 800+ studies across 20 years.",
    positives: [
      "Affordable price point — accessible to low-income households",
      "Long shelf life reduces food waste compared to fresh unprocessed proteins",
      "Widely available — present in most US retail grocery outlets",
    ],
    improvements: [
      "Sodium nitrite is IARC Group 1 (same category as tobacco) as a known cause of colorectal cancer when consumed in processed meat — the evidence base is comprehensive and consistent",
      "Processed meat as a category is IARC Group 1 — a classification supported by 800 independent studies",
      "Beef production generates approximately 20× more greenhouse gas per gram of protein than plant-based alternatives",
      "High sodium content (570mg/serving) is 25% of the daily recommended limit in a single serving",
      "Kraft Heinz has not published comprehensive animal welfare standards or third-party supply chain audits",
      "Mechanically separated turkey is a highly processed, low-transparency ingredient",
    ],
    assumptions: [
      "Cancer risk increment based on IARC's meta-analysis of population studies — individual risk will vary based on consumption frequency, genetics, and overall diet",
      "Environmental score uses beef industry averages (FAO data) — Kraft Heinz has not published product-specific lifecycle data",
      "Ethics score reflects Kraft Heinz's published data (or lack thereof) — absence of transparency itself contributes to the lower score",
    ],
    sources: [
      { name: "IARC Monographs Vol. 114 (2015)", type: "scientific", description: "Processed meat classified Group 1 carcinogen; sodium nitrite as key mechanistic contributor. Based on 800 studies over 20 years." },
      { name: "WHO Carcinogenicity of Red and Processed Meat (2015)", type: "regulatory", description: "WHO press release confirming IARC classification, noting 18% increased relative colorectal cancer risk per 50g processed meat daily" },
      { name: "FAO Livestock's Long Shadow (2006)", type: "scientific", description: "Life cycle analysis of livestock's environmental impact — beef estimated at 65kg CO₂-eq per kg beef protein" },
      { name: "Harvard School of Public Health Red Meat Studies", type: "scientific", description: "Prospective cohort studies (NHS, HPFS) consistently linking red and processed meat consumption to colorectal, pancreatic, and prostate cancer risk" },
    ],
  },
  7: {
    confidence: 81,
    confidenceReason: "Aspartame data was updated in 2023 — some uncertainty remains as this represents a recent reclassification. Caramel color and benzene formation mechanisms are well-established.",
    positives: [
      "Zero sugar — genuinely beneficial for people managing blood glucose, diabetes, or caloric intake",
      "Aluminum cans have the highest recycling rate of any beverage container (~75% in the US)",
      "No phosphoric acid contributing to bone density concerns (unlike colas with both phosphoric acid AND aspartame)",
      "Caffeine dose (~46mg/can) is well within the 400mg/day safe limit for healthy adults",
    ],
    improvements: [
      "Aspartame reclassified to IARC Group 2B in 2023 — while evidence is limited, the precautionary principle applies given daily consumption patterns",
      "Caramel Color Class IV (4-MEI) is a Prop 65 listed possible carcinogen — reformulated in California but not necessarily elsewhere",
      "Coca-Cola is ranked among the world's top three plastic polluters by Break Free From Plastic's annual brand audit",
      "Potassium benzoate can form trace benzene (a Group 1 carcinogen) if the product is stored in heat or light with residual vitamin C",
    ],
    assumptions: [
      "Aspartame cancer risk assessed using the 2023 IARC Group 2B designation — the JECFA continues to consider intake below ADI safe, creating a genuine scientific tension",
      "4-MEI levels assumed at US-market formulation — Coca-Cola has not publicly disclosed 4-MEI content per can consistently",
      "Environmental score uses Coca-Cola's 2022 sustainability report data adjusted for plastic pollution audit findings",
    ],
    sources: [
      { name: "IARC Monographs Vol. 134 (2023) — Aspartame", type: "scientific", description: "New IARC assessment classified aspartame Group 2B based on limited human evidence and sufficient animal evidence, particularly from the NutriNet-Santé cohort" },
      { name: "California Prop 65 (4-MEI listing)", type: "regulatory", description: "4-methylimidazole listed as a known carcinogen; prompting Coca-Cola to reformulate California-sold products" },
      { name: "Break Free From Plastic Brand Audit (2022)", type: "ngo", description: "Annual global audit ranking Coca-Cola as the world's #1 plastic polluter for the 5th consecutive year" },
      { name: "EFSA Re-evaluation of Aspartame (2013)", type: "regulatory", description: "Previous assessment that maintained ADI of 40mg/kg body weight — predates the 2023 IARC reclassification" },
    ],
  },
};

const DIMENSION_EXPLANATIONS: Record<number, { health: string; environment: string; ethics: string; transparency: string }> = {
  1: { health: "Minimal ingredient list, but high-temperature frying forms acrylamide (IARC Group 2A). Each serving contains 17% of the daily sodium limit.", environment: "Single-use foil packaging is non-recyclable in most systems. Large-scale crop monoculture for potatoes has soil health implications.", ethics: "PepsiCo has moderate sustainability programs but faces scrutiny over labor practices and aggressive marketing of unhealthy snacks.", transparency: "Ingredient list is short and clear. No undisclosed compound categories. PepsiCo publishes an annual sustainability report." },
  2: { health: "Contains methylisothiazolinone (banned in EU leave-on products) and trace 1,4-dioxane. Undisclosed fragrance chemicals add to the concern.", environment: "Non-recyclable plastic pods. Synthetic surfactant manufacturing requires significant energy.", ethics: "P&G has faced criticism over animal testing and has been slow to publish full ingredient biodegradability data.", transparency: "Fragrance listed as a single undisclosed term. No publicly available full ingredient glossary." },
  3: { health: "Whole-food based ingredients with no synthetic dyes or preservatives. Moderate added sugar (5g/bar). Main concern: palm kernel oil's deforestation impact.", environment: "Palm kernel oil sourcing is a critical issue — sustainability certification coverage remains insufficient. Mars has committed to certified palm by 2025.", ethics: "Mars has made public human rights and supply chain commitments. Pre-acquisition KIND standards have largely been preserved.", transparency: "Full ingredient disclosure, third-party certifications (Non-GMO, Gluten-Free). Mars publishes sustainability reports with specific targets." },
  4: { health: "Functional electrolyte formula for athletes, undermined by synthetic dyes Red 40 and Blue 1 (IARC Group 2B) and 34g of sugar per bottle.", environment: "Plastic bottles are recyclable in theory, but collection rates are low. PepsiCo has pledged 100% recyclable packaging but implementation is lagging.", ethics: "PepsiCo has faced criticism for marketing high-sugar products to children and for lobbying against sugar taxes globally.", transparency: "Core ingredients are listed clearly. 'Natural flavor' provides no detail on specific compounds." },
  5: { health: "Plant-derived formula with no synthetic fragrances, dyes, or carcinogenic preservatives. SLS may cause skin irritation in some individuals at higher concentrations.", environment: "Biodegradable formula, concentrated packaging, recycled post-consumer resin packaging. B Corp parent company.", ethics: "EPA Safer Choice certified, Leaping Bunny cruelty-free certified. Unilever parent company has mixed ethics record.", transparency: "Publishes complete ingredient glossary explaining each component's purpose — one of the most transparent major cleaning brands." },
  6: { health: "Sodium nitrite — a known Group 1 carcinogen in processed meat context — is a serious concern. High sodium (570mg/serving) compounds cardiovascular risk.", environment: "Beef production is among the most emissions-intensive foods. Factory farming practices have significant water, land, and biodiversity impacts.", ethics: "Kraft Heinz has limited published data on animal welfare standards or labor practices. Factory farming model raises significant welfare concerns.", transparency: "'Natural flavors' and 'mechanically separated turkey' are opaque terms. Limited supply chain transparency published publicly." },
  7: { health: "Aspartame reclassified to IARC Group 2B in 2023. Caramel Color IV contains 4-MEI (Prop 65 listed). Zero sugar is the main positive health feature.", environment: "Aluminum cans are highly recyclable (75%+ recycling rate). Coca-Cola is one of the world's largest plastic polluters based on audit data.", ethics: "Coca-Cola faces ongoing lawsuits and regulatory actions over plastic pollution, water usage in water-stressed regions, and marketing to minors.", transparency: "Full ingredient list disclosed. No proprietary blends. However, 'natural flavors' lacks compound-level disclosure." },
};

const PRODUCT_EVALUATIONS: Record<number, string> = {
  1: `Lay's Classic chips keep their ingredient list short — potatoes, oil, and salt — but the manufacturing process creates a hidden concern. When starchy foods are cooked above 120°C, a chemical called acrylamide forms naturally; the IARC classifies it as a probable human carcinogen (Group 2A). Nutritionally, one serving delivers 170mg of sodium. Frito-Lay's parent company PepsiCo has modest sustainability programs but produces billions of single-use foil bags annually that are nearly impossible to recycle in most municipalities. Affordability is a genuine strength. As an occasional treat this product is acceptable, but the acrylamide exposure and sodium load make it a poor daily choice.`,
  2: `Tide PODS scored among the lowest in our database due to serious transparency failures. The formula contains methylisothiazolinone — a potent skin sensitizer that caused an epidemic of contact allergy across Europe and is banned from EU leave-on products — alongside trace 1,4-dioxane, a probable carcinogen produced as a manufacturing by-product. Fragrances are listed as a single undisclosed term that can represent hundreds of synthetic compounds. The plastic pods are not recyclable in most municipal programs. Multiple certified-clean alternatives exist at comparable prices. If you currently use Tide PODS, switching to a fragrance-free, plant-derived detergent is one of the highest-impact household product changes you can make.`,
  3: `KIND Bars are a standout in the packaged snack category. The ingredient list is short, whole-food based, and largely free of synthetic additives. The two main areas of concern are palm kernel oil — whose cultivation is a major driver of deforestation in Southeast Asia and West Africa — and the moderate added-sugar content of 5 grams per bar. Mars Inc., which acquired KIND in 2020, has made public sustainability pledges, but follow-through has been mixed. Transparency is notably strong: full ingredient disclosure, Non-GMO and gluten-free certifications, and published sustainability reports. For a convenient packaged snack, KIND performs well on nearly every dimension.`,
  4: `Gatorade sits in the middle of our scoring range. The core formula — water, sugar, and electrolytes — makes physiological sense for athletes engaged in intense, prolonged exercise. However, the use of synthetic dyes Red 40 and Blue 1, both IARC Group 2B possible carcinogens and linked to hyperactivity in children, is difficult to justify when colorless versions work identically. Each 20oz bottle contains 34 grams of sugar — equivalent to 8.5 teaspoons. PepsiCo has made sustainability commitments but faces ongoing criticism over plastic pollution. For serious endurance sports, Gatorade serves its purpose. For casual or sedentary consumption, water and electrolyte-rich foods are significantly better.`,
  5: `Seventh Generation Free & Clear is one of the cleanest widely available cleaning products we've evaluated. Every ingredient is plant-derived, fully disclosed, and the formula contains no synthetic fragrances, dyes, or optical brighteners. The company publishes a complete ingredient glossary explaining the purpose of every component — a rare level of transparency. The product is EPA Safer Choice certified, meaning independent scientists reviewed the entire formula. The one reservation is that parent company Unilever, which acquired Seventh Generation in 2016, has a mixed sustainability record at the corporate level. For consumers seeking high performance without health trade-offs, this is one of the best options on the market.`,
  6: `Oscar Mayer Beef Hot Dogs score among the lowest in our database across every dimension. Sodium nitrite places this product in IARC Group 1 — the same carcinogen category as tobacco smoke and asbestos — as a known cause of colorectal cancer when consumed as processed meat. The environmental footprint is severe: beef production generates roughly 20x more greenhouse gas emissions per gram of protein than plant sources, and feedlot practices have significant water and land impacts. Kraft Heinz has limited public transparency on ingredient sourcing. Affordability is the one meaningful strength. If hot dogs are a regular part of your diet, choosing uncured meats without sodium nitrite is the single most impactful switch you can make.`,
  7: `Diet Coke's main concern is aspartame, which the IARC reclassified in 2023 as possibly carcinogenic to humans (Group 2B), based on limited but suggestive evidence from human cohort studies. The formula also contains Caramel Color Class IV, a source of 4-MEI — a compound listed under California Prop 65. On the positive side, zero sugar is genuinely beneficial for people managing blood glucose or weight. Coca-Cola has invested in packaging sustainability but remains one of the world's top contributors to plastic pollution. Occasional consumption carries low risk; daily high-volume intake is harder to recommend given the ingredient uncertainties.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEvaluation(p: Product): string {
  return PRODUCT_EVALUATIONS[p.id] ?? `${p.name} received an overall score of ${p.overallScore}/100. Review the category breakdown below for details.`;
}
function getDimExpl(p: Product) {
  return DIMENSION_EXPLANATIONS[p.id] ?? {
    health: `Score of ${p.healthScore}/100 reflects the ingredient safety profile relative to known health standards.`,
    environment: `Score of ${p.environmentScore}/100 based on packaging, production methods, and corporate sustainability commitments.`,
    ethics: `Score of ${p.ethicsScore}/100 reflects labor practices, animal welfare, and corporate accountability.`,
    transparency: `Score of ${p.transparencyScore}/100 based on ingredient disclosure, certifications, and public reporting.`,
  };
}
function getExplanation(p: Product): ScoreExplanation {
  return SCORE_EXPLANATIONS[p.id] ?? {
    confidence: 65,
    confidenceReason: "Limited product-specific data available. Score computed from available ingredient and corporate data.",
    positives: [`Overall score of ${p.overallScore}/100`],
    improvements: ["Consult the ingredient breakdown for specific concerns"],
    assumptions: ["Dimension scores estimated from category averages where product-specific data is unavailable"],
    sources: [
      { name: "IARC Monographs", type: "scientific", description: "International Agency for Research on Cancer carcinogen classifications" },
      { name: "FDA GRAS Database", type: "regulatory", description: "Generally Recognized as Safe determinations for food ingredients" },
    ],
  };
}

function parseIngredientList(str: string): string[] {
  const result: string[] = []; let current = ""; let depth = 0;
  for (const ch of str) {
    if (ch === "(") { depth++; current += ch; }
    else if (ch === ")") { depth--; current += ch; }
    else if (ch === "," && depth === 0) { if (current.trim()) result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
function matchIngredient(name: string): IngredientInfo | null {
  const key = name.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
  return INGREDIENT_DB.find(info => info.aliases.some(alias => key.includes(alias) || alias.includes(key.split(" ")[0]))) ?? null;
}
function getIngredients(p: Product): ParsedIngredient[] {
  return parseIngredientList(p.ingredients).map(raw => ({ displayName: raw, info: matchIngredient(raw) }));
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: "High Risk",       color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  medium: { label: "Moderate Risk",   color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  low:    { label: "Low Risk",        color: "#ca8a04", bg: "#fefce8", border: "#fde68a" },
  safe:   { label: "Generally Safe",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

const SOURCE_CONFIG: Record<DataSource["type"], { icon: string; color: string; bg: string; label: string }> = {
  regulatory:   { icon: "🏛️", color: "#1d4ed8", bg: "#eff6ff", label: "Regulatory" },
  scientific:   { icon: "🔬", color: "#7c3aed", bg: "#f5f3ff", label: "Scientific"  },
  certification:{ icon: "✅", color: "#047857", bg: "#ecfdf5", label: "Certification" },
  ngo:          { icon: "🌍", color: "#0369a1", bg: "#f0f9ff", label: "NGO / Watchdog" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRingLarge({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 16) / 2; const circ = 2 * Math.PI * r;
  const color = scoreColorHex(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={circ - (score/100)*circ} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x={size/2} y={size/2-4} textAnchor="middle" dominantBaseline="middle"
        fontSize={size*0.26} fontWeight="900" fill="white" fontFamily="DM Mono, monospace">{score}</text>
      <text x={size/2} y={size/2+size*0.18} textAnchor="middle" dominantBaseline="middle"
        fontSize={size*0.13} fill="rgba(255,255,255,0.7)" fontFamily="sans-serif">/ 100</text>
    </svg>
  );
}

// ── Confidence Indicator ──────────────────────────────────────────────────────
function ConfidenceIndicator({ confidence, reason }: { confidence: number; reason: string }) {
  const color = confidence >= 85 ? "#16a34a" : confidence >= 70 ? "#ca8a04" : "#ea580c";
  const label = confidence >= 85 ? "High Confidence" : confidence >= 70 ? "Moderate Confidence" : "Limited Confidence";
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-2xl" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <div className="flex-shrink-0 pt-0.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Database size={14} style={{ color }} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color }}>{label}</span>
          <span className="text-[10px] font-bold font-mono ml-auto" style={{ color }}>{confidence}%</span>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-1.5">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${confidence}%`, background: color }} />
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed">{reason}</p>
      </div>
    </div>
  );
}

// ── Weighted Score Breakdown ──────────────────────────────────────────────────
function WeightedBreakdown({ product }: { product: Product }) {
  const dims = [
    { key: "health",       label: "Health & Safety",   score: product.healthScore,       icon: Leaf,   color: scoreColorHex(product.healthScore)       },
    { key: "environment",  label: "Environmental",     score: product.environmentScore,  icon: Zap,    color: scoreColorHex(product.environmentScore)  },
    { key: "ethics",       label: "Ethical Practices", score: product.ethicsScore,       icon: Shield, color: scoreColorHex(product.ethicsScore)       },
    { key: "transparency", label: "Transparency",      score: product.transparencyScore, icon: Eye,    color: scoreColorHex(product.transparencyScore) },
  ] as const;

  const totalContrib = dims.reduce((sum, d) => {
    const w = SCORE_WEIGHTS[d.key as keyof typeof SCORE_WEIGHTS];
    return sum + d.score * w;
  }, 0);

  return (
    <div className="px-4 pb-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-3">How the overall score is computed</p>
      {dims.map(({ key, label, score, icon: Icon, color }) => {
        const weight = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS];
        const contribution = +(score * weight).toFixed(1);
        const maxContrib = 100 * weight;
        return (
          <div key={key} className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                <Icon size={11} style={{ color }} />
              </div>
              <span className="text-xs font-bold flex-1">{label}</span>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-gray-400">{score}</span>
                <span className="text-gray-300">×</span>
                <span className="text-gray-400">{(weight*100).toFixed(0)}%</span>
                <span className="text-gray-300">=</span>
                <span className="font-extrabold" style={{ color }}>{contribution}</span>
                <span className="text-gray-300">/ {maxContrib.toFixed(0)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
              </div>
            </div>
          </div>
        );
      })}
      {/* Total row */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Weighted sum (rounded)</span>
        <div className="flex items-center gap-1.5 text-sm font-extrabold font-mono">
          <span className="text-gray-300">{totalContrib.toFixed(1)}</span>
          <span className="text-gray-300">→</span>
          <span style={{ color: scoreColorHex(product.overallScore) }}>{product.overallScore}</span>
          <span className="text-gray-400 text-xs font-normal">/ 100</span>
        </div>
      </div>
    </div>
  );
}

// ── "Why This Score?" Expandable ──────────────────────────────────────────────
function WhyThisScore({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const explanation = getExplanation(product);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Always-visible header / toggle */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-100"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#8b5cf618" }}>
          <HelpCircle size={15} className="text-violet-600" />
        </div>
        <div className="flex-1">
          <span className="font-bold text-sm text-gray-900">Why This Score?</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Methodology · Positives · Concerns · Assumptions · Sources</p>
        </div>
        <ChevronDown size={15} className="text-gray-400 flex-shrink-0 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>

      {open && (
        <div className="divide-y divide-gray-50">
          {/* 1. Weighted score math */}
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-3 px-4">
              <Sparkles size={13} className="text-violet-600" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Score Calculation</span>
            </div>
            <WeightedBreakdown product={product} />
          </div>

          {/* 2. Confidence */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Database size={13} className="text-blue-600" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Confidence Level</span>
            </div>
            <ConfidenceIndicator confidence={explanation.confidence} reason={explanation.confidenceReason} />
          </div>

          {/* 3. Positive attributes */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp size={13} className="text-green-600" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Positive Attributes</span>
            </div>
            <ul className="space-y-2">
              {explanation.positives.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed bg-green-50 rounded-xl p-2.5">
                  <CheckCircle size={12} className="text-green-600 flex-shrink-0 mt-0.5" />{p}
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Areas for improvement */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown size={13} className="text-orange-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Areas for Improvement</span>
            </div>
            <ul className="space-y-2">
              {explanation.improvements.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed bg-orange-50 rounded-xl p-2.5">
                  <AlertTriangle size={12} className="text-orange-500 flex-shrink-0 mt-0.5" />{p}
                </li>
              ))}
            </ul>
          </div>

          {/* 5. Assumptions */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={13} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Assumptions Made</span>
            </div>
            <ul className="space-y-2">
              {explanation.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-xl p-2.5">
                  <span className="text-blue-400 flex-shrink-0 mt-0.5 font-bold text-[10px]">{i+1}.</span>{a}
                </li>
              ))}
            </ul>
          </div>

          {/* 6. Data sources */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={13} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Data Sources</span>
            </div>
            <div className="space-y-2">
              {explanation.sources.map((src, i) => {
                const cfg = SOURCE_CONFIG[src.type];
                return (
                  <div key={i} className="rounded-xl p-2.5" style={{ background: cfg.bg }}>
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0 leading-none mt-0.5">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[11px] font-bold leading-tight" style={{ color: cfg.color }}>{src.name}</p>
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: cfg.color, color: "white" }}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed">{src.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-gray-400 mt-3 text-center leading-relaxed">
              Scores are computed algorithmically and reviewed for accuracy. This is not medical or legal advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category Dimension Bar ────────────────────────────────────────────────────
function DimensionBar({ icon: Icon, label, score, explanation, color, weight }: {
  icon: React.ElementType; label: string; score: number; explanation: string; color: string; weight: number;
}) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <span className="text-sm font-bold">{label}</span>
            <span className="ml-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">{(weight*100).toFixed(0)}% weight</span>
          </div>
        </div>
        <span className="text-base font-extrabold font-mono" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{explanation}</p>
    </div>
  );
}

// ── Ingredient Deep Dive ──────────────────────────────────────────────────────
function IngredientLearnMore({ info, displayName, onClose }: { info: IngredientInfo; displayName: string; onClose: () => void }) {
  const risk = RISK_CONFIG[info.riskLevel];
  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-white">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Ingredient Deep Dive</p>
          <h2 className="font-extrabold text-base leading-tight truncate">{info.name}</h2>
        </div>
        <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold flex-shrink-0" style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
          {risk.label}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="px-4 pb-8 space-y-4">
          <div className="pt-4">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Purpose in Product</span>
            <p className="mt-1 text-sm font-semibold text-primary">{info.purpose}</p>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{info.shortDescription}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2"><FlaskConical size={14} className="text-blue-600" /><span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Scientific Explanation</span></div>
            <p className="text-xs text-blue-900 leading-relaxed">{info.scientificExplanation}</p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ background: risk.bg, borderColor: risk.border }}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} style={{ color: risk.color }} /><span className="text-xs font-bold uppercase tracking-wider" style={{ color: risk.color }}>Health Effects</span></div>
            <p className="text-xs leading-relaxed text-gray-700">{info.healthEffects}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2"><Microscope size={14} className="text-gray-500" /><span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Research Summary</span></div>
            <p className="text-xs text-gray-600 leading-relaxed">{info.research}</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
            <div className="flex items-center gap-2 mb-2"><CheckCircle size={14} className="text-green-600" /><span className="text-xs font-bold text-green-700 uppercase tracking-wider">Safer Alternatives</span></div>
            <ul className="space-y-1">
              {info.alternatives.map((alt, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-green-800"><span className="text-green-500 flex-shrink-0 mt-0.5">→</span>{alt}</li>
              ))}
            </ul>
          </div>
          <p className="text-[10px] text-gray-400 text-center">Listed as "{displayName}" in this product.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProductDetailScreenProps {
  product: Product; onBack: () => void; saved: boolean; onToggleSave: () => void; products: Product[];
}

export default function ProductDetailScreen({ product, onBack, saved, onToggleSave, products }: ProductDetailScreenProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<{ info: IngredientInfo; displayName: string } | null>(null);

  const dims = getDimExpl(product);
  const ingredients = useMemo(() => getIngredients(product), [product]);
  const bestPrice = Math.min(product.amazon?.price ?? 9999, product.walmart?.price ?? 9999, product.facebook?.price ?? 9999);
  const alternatives = useMemo(
    () => products.filter(p => p.id !== product.id && p.overallScore > product.overallScore).sort((a, b) => b.overallScore - a.overallScore).slice(0, 3),
    [products, product]
  );

  const heroGradient =
    product.overallScore >= 80 ? "linear-gradient(160deg, #064e3b, #10b981)" :
    product.overallScore >= 65 ? "linear-gradient(160deg, #1e3a5f, #2563eb)" :
    product.overallScore >= 50 ? "linear-gradient(160deg, #78350f, #d97706)" :
    product.overallScore >= 35 ? "linear-gradient(160deg, #7c2d12, #ea580c)" :
                                 "linear-gradient(160deg, #450a0a, #dc2626)";

  const stores = [
    product.amazon   ? { name: "Amazon",        icon: "📦", price: product.amazon.price,   color: "#FF9900", distance: "Online (2-day)",  avail: "In Stock",               rating: product.amazon.rating  } : null,
    product.walmart  ? { name: "Walmart",        icon: "🛒", price: product.walmart.price,  color: "#0071CE", distance: "0.8 mi away",     avail: "In Stock",               rating: product.walmart.rating } : null,
    product.facebook ? { name: "FB Marketplace", icon: "👥", price: product.facebook.price, color: "#1877F2", distance: "1.2 mi away",     avail: product.facebook.condition, rating: null               } : null,
  ].filter(Boolean) as NonNullable<(typeof stores)[number]>[];

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Ingredient deep-dive overlay */}
      {selectedIngredient && (
        <IngredientLearnMore info={selectedIngredient.info} displayName={selectedIngredient.displayName} onClose={() => setSelectedIngredient(null)} />
      )}

      {/* ── Hero ── */}
      <div className="flex-shrink-0 relative" style={{ background: heroGradient, minHeight: 268 }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft size={18} color="white" />
          </button>
          <div className="flex gap-2">
            <button onClick={onToggleSave} className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Bookmark size={16} fill={saved ? "white" : "none"} color="white" />
            </button>
            <button className="w-10 h-10 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
              <Share2 size={16} color="white" />
            </button>
          </div>
        </div>

        <div className="pt-16 pb-5 px-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xl">
            <ShoppingBag size={36} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.brand}</span>
              <span className="text-white/30">·</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">{product.category}</span>
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight mb-2">{product.name}</h1>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-extrabold text-white">${bestPrice.toFixed(2)}</span>
              <span className="text-sm text-white/60">best price</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {stores.map(s => (
                <span key={s.name} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {s.icon} {s.name === "FB Marketplace" ? "FB" : s.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <ScoreRingLarge score={product.overallScore} size={84} />
            <div className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${gradeBadgeClass(product.ethicalScore)}`}>
              Grade {product.ethicalScore}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
        <div className="px-4 py-4 space-y-3 pb-10">

          {/* ── AI Evaluation Summary ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center">
                <Sparkles size={14} className="text-violet-600" />
              </div>
              <span className="font-bold text-sm">AI Evaluation Summary</span>
              <span className="ml-auto text-[9px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">SmartScore™</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{getEvaluation(product)}</p>
          </div>

          {/* ── Why This Score? (full transparency module) ── */}
          <WhyThisScore product={product} />

          {/* ── Category Breakdown ── */}
          <div className="bg-white rounded-2xl px-4 shadow-sm">
            <div className="flex items-center gap-2 py-3 border-b border-gray-100">
              <Shield size={15} className="text-primary" />
              <span className="font-bold text-sm">Category Scores</span>
              <span className="ml-auto text-[9px] text-gray-400">Overall: <strong className="text-gray-700">{product.overallScore}/100</strong></span>
            </div>
            <DimensionBar icon={Leaf}   label="Health & Safety"    score={product.healthScore}       explanation={dims.health}       color={scoreColorHex(product.healthScore)}       weight={SCORE_WEIGHTS.health} />
            <DimensionBar icon={Zap}    label="Environmental"      score={product.environmentScore}  explanation={dims.environment}  color={scoreColorHex(product.environmentScore)}  weight={SCORE_WEIGHTS.environment} />
            <DimensionBar icon={Shield} label="Ethical Practices"  score={product.ethicsScore}       explanation={dims.ethics}       color={scoreColorHex(product.ethicsScore)}       weight={SCORE_WEIGHTS.ethics} />
            <DimensionBar icon={Eye}    label="Transparency"       score={product.transparencyScore} explanation={dims.transparency} color={scoreColorHex(product.transparencyScore)} weight={SCORE_WEIGHTS.transparency} />
          </div>

          {/* ── Ingredient Explorer ── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <FlaskConical size={15} className="text-primary" />
              <span className="font-bold text-sm">Ingredient Explorer</span>
              <span className="ml-auto text-[10px] font-bold text-gray-400">{ingredients.length} ingredients</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ingredients.map((ing, i) => {
                const risk = ing.info ? RISK_CONFIG[ing.info.riskLevel] : null;
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold leading-tight truncate">{ing.displayName}</p>
                          {risk && <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>{risk.label}</span>}
                        </div>
                        {ing.info && <p className="text-[10px] text-gray-400 font-medium">{ing.info.purpose}</p>}
                        {ing.info && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{ing.info.shortDescription}</p>}
                        {!ing.info && <p className="text-[11px] text-gray-400 mt-0.5 italic">No detailed data available for this ingredient.</p>}
                      </div>
                      {ing.info && (
                        <button onClick={() => setSelectedIngredient({ info: ing.info!, displayName: ing.displayName })}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/8 px-2.5 py-1.5 rounded-xl hover:bg-primary/15 transition-colors">
                          <Info size={9} /> Learn More
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Price Comparison ── */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <DollarSign size={15} className="text-primary" />
              <span className="font-bold text-sm">Price Comparison</span>
              <span className="ml-auto text-primary font-extrabold text-sm">${bestPrice.toFixed(2)} best</span>
            </div>
            <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 border-b border-gray-100">
              {["Store","Price","Distance","Availability"].map(h => (
                <span key={h} className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{h}</span>
              ))}
            </div>
            {stores.map((store, i) => (
              <div key={i} className="grid grid-cols-4 px-4 py-3 border-b last:border-0 border-gray-50 items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{store.icon}</span>
                  <div>
                    <p className="text-[11px] font-bold leading-tight">{store.name}</p>
                    {store.rating && <div className="flex items-center gap-0.5 mt-0.5"><Star size={8} className="fill-amber-400 text-amber-400" /><span className="text-[9px] text-gray-400">{store.rating}</span></div>}
                  </div>
                </div>
                <span className="text-sm font-extrabold" style={{ color: store.color }}>${store.price.toFixed(2)}</span>
                <div className="flex items-center gap-1"><MapPin size={9} className="text-gray-400 flex-shrink-0" /><span className="text-[10px] text-gray-500 leading-tight">{store.distance}</span></div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${store.avail === "In Stock" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{store.avail}</span>
              </div>
            ))}
          </div>

          {/* ── Healthier Alternatives ── */}
          {alternatives.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <TrendingUp size={15} className="text-green-600" />
                <span className="font-bold text-sm">Healthier Alternatives</span>
                <span className="ml-auto text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Better choices</span>
              </div>
              <div className="divide-y divide-gray-50">
                {alternatives.map(alt => {
                  const altBest = Math.min(alt.amazon?.price ?? 9999, alt.walmart?.price ?? 9999, alt.facebook?.price ?? 9999);
                  return (
                    <div key={alt.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${scoreColorHex(alt.overallScore)}18` }}>
                        <ShoppingBag size={20} style={{ color: scoreColorHex(alt.overallScore) }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">{alt.brand}</p>
                        <p className="text-sm font-semibold leading-tight">{alt.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-extrabold" style={{ color: scoreColorHex(alt.overallScore) }}>{alt.overallScore}/100</span>
                          <span className="text-[10px] text-gray-400">·</span>
                          {altBest < 9999 && <span className="text-xs text-gray-500">from ${altBest.toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gradeBadgeClass(alt.ethicalScore)}`}>Grade {alt.ethicalScore}</span>
                        <span className="text-[9px] text-green-600 font-bold">+{alt.overallScore - product.overallScore} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

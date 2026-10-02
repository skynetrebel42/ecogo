# Ingredient quality and safety databases: what exists and what fits EcoGo

- **Date:** 2026-10-02
- **Question:** which databases and data sources can be used to judge ingredient safety in (a) sunscreen and other
  cosmetics, (b) laundry detergent and other cleaning products, and (c) food ingredients and additives?
- **Method:** primary sources only: each database's own site, API docs, license or terms page, and government agency
  pages. Every claim cites a URL (see the dated list at the end). Where a page could not be read, or a fact came only
  from a search-result snippet of the primary page, it is marked **unverified** or **snippet only**.
- **Already in EcoGo:** USDA FoodData Central (main food lookup) and Open Food Facts (labelled crowd-sourced fallback;
  its additive codes feed the check) per `docs/superpowers/specs/2026-09-28-m2-usda-lookup-design.md`. The safety
  engine (`docs/superpowers/specs/2026-09-24-safety-engine-design.md`) uses a hand-built, source-checked library of
  about 30 to 50 food additives. Severity comes from IARC classifications, EU bans and warning labels, and FDA bans and
  revocations. Non-food products currently get "Ingredient check covers food & drinks for now". Everything below is
  new unless marked **in place**.

## Summary table

| Source | Run by | Category | Data type | Access | License / reuse | Fit for EcoGo |
|---|---|---|---|---|---|---|
| EWG Skin Deep | EWG (nonprofit) | Cosmetics | Own 1–10 hazard score + data-availability rating | Website only | All rights reserved; reproduction needs written permission, noncommercial only [S1][S2] | **No.** Can't reuse, and it's an advocacy score, not an official finding |
| EWG Guide to Healthy Cleaning | EWG | Cleaning | Own A–F grades | Website only | Same as above [S2] | **No** |
| EWG Food Scores | EWG | Food | Own 1–10 score (nutrition, ingredient concerns, processing) | Website only | Same as above [S2] | **No** |
| INCIDecoder (now "INKEEDecoder") | Private site, founder Judit Rácz | Cosmetics (skincare) | Ingredient function + explanations | Website only; no API found | No published terms found; "Copyright 2026" [S4] | **No.** Possibly useful to read, not as data |
| EU CosIng | European Commission | Cosmetics | INCI names, functions, EU restrictions/annexes, SCCS opinions | Website search (download **unverified**) | EC content generally CC BY 4.0 [S7]; CosIng "has no legal value" [S5] | **Yes, as a reference** for EU-banned/restricted cosmetic ingredients |
| Open Beauty Facts | Open Food Facts (nonprofit) | Cosmetics | Crowd-sourced products + ingredient lists | API + nightly dumps | ODbL / DbCL; images CC BY-SA [S8] | **Yes, as the barcode lookup** for cosmetics (thin US coverage) |
| Open Products Facts | Open Food Facts | Other products (not food/cosmetics) | Crowd-sourced products | API + nightly dumps | ODbL / DbCL [S10] | **Weak.** Few cleaning products with ingredients |
| FDA sunscreen monograph (M020) | US FDA | Sunscreen actives | Legal status (GRASE) per active ingredient | Website / orders | Public domain [S13] | **Yes.** Small, official, high value |
| FDA prohibited & restricted cosmetic ingredients | US FDA | Cosmetics | Short list of US bans/limits | Website | Public domain [S13] | **Yes.** Tiny list, hand-enter it |
| Health Canada Cosmetic Ingredient Hotlist | Health Canada | Cosmetics | Prohibited / restricted tables | Website | Not checked | Optional extra |
| California "Chemicals in Cosmetics" (CSCP) | California Dept. of Public Health | Cosmetics | Products reported to contain carcinogens/reproductive toxicants | CSV download | Free to download and use under CalHHS terms [S27][S28] | **Yes.** Real US product-level data |
| EPA Safer Choice certified products | US EPA | Cleaning (+ some personal care) | Certified product list **with UPCs** | CSV/JSON/Excel via Envirofacts API | US federal data [S16] | **Yes. Best cleaning-product fit** |
| EPA Safer Chemical Ingredients List (SCIL) | US EPA | Cleaning ingredients | ~1,000 chemicals, color-coded "safer" tiers by function | Excel download | US federal data | **Yes**, for positive ("safer") ingredient notes |
| FDA Substances Added to Food | US FDA | Food | Regulatory status per substance (incl. PROHIBITED, DELISTED) | Searchable + Excel download | Public domain [S13] | **Yes.** Strengthens the existing food check |
| FDA GRAS Notice Inventory | US FDA | Food | GRAS notices + FDA response letters | Searchable + Excel download | Public domain [S13] | **Partly.** Context, not hazard |
| FDA chemicals under review list | US FDA | Food | Chemicals FDA is re-reviewing (e.g. BHT) | Website table | Public domain | **Context only.** "Under review" isn't a finding |
| EU food additives database | European Commission (DG SANTE) | Food | ~400 EU-approved additives (E-numbers) and conditions of use | **Open JSON API, no key** + website | "All data is freely available" [S21] | **Yes.** Machine-readable EU approval status |
| EFSA OpenFoodTox 3.0 | EFSA | Food (+ pesticides, contaminants) | Toxicological reference values (ADI, TDI), hazard studies | Excel + IUCLID download (Zenodo) | **CC BY-ND 4.0** [S24] | **Yes, with care.** Cite values, don't remix |
| PubChem | NIH / NLM | All | Aggregator: includes CPID, FDA, EFSA, ECHA, IARC, CIR sections | REST API (PUG REST/View) | NLM-made content public domain; depositor data may carry rights [S30] | **Yes, as a lookup glue layer** |
| EPA CompTox Dashboard / CTX APIs | US EPA | All chemicals | Hazard, exposure, product-use data for >1M chemicals | API (free key by email) | US federal data | **Later.** Research-grade, too raw for consumers |
| ECHA candidate list (SVHC) / ECHA CHEM | European Chemicals Agency | All chemicals | 253 substances of very high concern | Website with XLS/CSV/XML export | Reuse allowed with credit, but **no copying whole/substantial databases**; CAS data owned by ACS [S33] | **Yes, small subset only**, hand-curated with credit |
| California Prop 65 list | California OEHHA | All | ~900 chemicals known to cause cancer or reproductive harm | PDF (dated July 31, 2026) | **Unverified** | **Yes, as a flag source**, with care about what it means |
| CPID (Consumer Product Information Database) | DeLima Associates | Household products | Product ingredients + health effects | Website (was down when checked); also inside PubChem | **Unverified** (site returned 503) | **Via PubChem only** |
| NIH Household Products Database | (was NLM) | Household | — | **Retired.** Content moved to CPID [S31] | — | **Gone** |
| USDA FoodData Central | USDA | Food | Branded product labels | API | Public domain | **In place** |
| Open Food Facts | Open Food Facts | Food | Crowd-sourced products, additive tags | API | ODbL | **In place** (fallback) |

## (a) Sunscreen and other cosmetics

### EWG Skin Deep

- **Who:** Environmental Working Group, a 501(c)(3) nonprofit [S2].
- **Coverage:** "ingredients in over 100,000 products", 8,892 personal care ingredients, 2,099 brands, 130 product
  categories in 10 groups including sun protection [S1].
- **Data:** a two-part score, one for hazard and one for data availability. Ingredients are compared against "nearly
  60 toxicity and regulatory databases" [S1]. The score is EWG's own judgement, not a regulatory finding.
- **Access:** website only. I found no API or data download. EWG's site blocks plain automated fetching (HTTP 403 to
  the fetch tool); a browser-like request worked.
- **License:** content "is the property of EWG". Copies beyond personal use need "prior written permission", which
  EWG grants case by case. Reproduction is limited to "educational, noncommercial purposes only" [S2]. The user
  agreement says EWG's scores may not be used "in marketing materials and/or on product labeling" [S3].
- **Fit:** **no.** Reuse needs permission, and a single advocacy score goes against the safety engine's rule of
  "verdict + flagged ingredients with sources, no 0–100 number". At most, link out to it.

### INCIDecoder (renamed INKEEDecoder)

- **Who:** a small private site. Its founder, Judit Rácz, describes herself as "a computer scientist turned cosmetic
  formulator". The about page discloses that she co-owns a skincare shop and a skincare brand [S4]. `incidecoder.com`
  now 301-redirects to `inkeedecoder.com` [S4].
- **Data:** ingredient functions and plain-language explanations; products are user-uploaded and checked by admins [S4].
  Counts **unverified**.
- **Access / license:** website only. I found no terms, license or API page; `/terms`, `/terms-of-use`, `/legal` and
  `/api` all returned 404. The footer says "Copyright 2026" [S4]. Reuse rights are **unverified**, so treat them as
  all rights reserved.
- **Fit:** **no** as a data source; the commercial ties also make it a poor citation for "official" claims.

### EU CosIng

- **Who:** European Commission (DG GROW) [S5].
- **Coverage:** cosmetic substances and ingredients under Cosmetics Regulation (EC) No 1223/2009, the INCI labelling
  glossary, and links to SCCS opinions. Searchable by INCI, CAS and EC numbers. Includes all data since 1976, with
  "active" and "not active" status [S5].
- **Data:** names, functions, and regulatory status (restrictions, bans, allowed UV filters and so on) under the EU
  regulation. The EC says CosIng "has informative purpose and no legal value" and is "non-legally binding". Only the
  regulation itself is authoritative. An INCI name being listed does not mean the ingredient is approved [S5].
- **Access:** a web app [S6]. A user manual PDF exists, but I couldn't read it [S6]. A CSV on data.europa.eu was
  suggested by a search result, but I couldn't confirm it in the portal's API, so a bulk download is **unverified**.
- **License:** the Commission's general reuse policy is CC BY 4.0 for EU-owned content "unless otherwise
  indicated" [S7]. Whether that covers CosIng specifically is **unverified**. INCI names come from the Personal Care
  Products Council, a third party [S5].
- **Fit:** **yes, as the reference** for EU cosmetic bans and restrictions. This is the cosmetic version of the food
  engine's "banned in the EU" rule. Hand-curate entries with links to the regulation, the same way as the food library.

### Open Beauty Facts

- **Who:** the Open Food Facts nonprofit, same platform [S8].
- **Coverage (API counts on 2026-10-02):** 76,867 products in total; 21,335 with the "ingredients completed" state;
  5,140 tagged United States; 614 in the "sunscreens" category [S9].
- **Data:** crowd-sourced product names, barcodes and ingredient lists. In my sample record (an L'Oréal foundation),
  `ingredients_text` was empty [S9], so coverage is patchy.
- **Access:** the same API style EcoGo already uses for OFF, plus nightly MongoDB/CSV dumps [S8].
- **License:** database ODbL, contents DbCL, images CC BY-SA [S8], the same terms EcoGo already credits for OFF.
- **Fit:** **yes, as the barcode → ingredient-list step** for cosmetics. Judgement must come from official lists
  (CosIng, FDA, CSCP, Prop 65), not from OBF.

### FDA sunscreen monograph (OTC Monograph M020) and GRASE status

- **Who:** US FDA. Sunscreens are regulated as OTC drugs [S11].
- **Current state (verified on the FDA page, 2026-10-02):**
  - The **deemed final order** (OTC000006, posted 2021-09-24) treats 16 active ingredients as GRASE, in line with
    the 1999 monograph [S11].
  - The **2021 proposed order** (OTC000008) proposes [S11]:
    - **GRASE:** zinc oxide and titanium dioxide.
    - **Not GRASE for safety reasons:** PABA and trolamine salicylate.
    - **Not GRASE "because additional data is needed":** cinoxate, dioxybenzone, ensulizole, homosalate, meradimate,
      octinoxate, octisalate, octocrylene, padimate O, sulisobenzone, oxybenzone and avobenzone.
  - **2026-06-10:** final order OTC000039 **added bemotrizinol** as an allowed sunscreen active [S11].
  - **2026-09-10:** final order OTC000008-1 **removed PABA and trolamine salicylate**. FDA found that their risks
    "outweigh their benefits" and said it was not aware of any US products that still contain them [S11].
  - The rest of the 2021 proposal (labelling, dosage forms, maximum SPF, and status of the 12 "more data needed"
    actives) is **still not final** [S11].
- **Access:** FDA web pages and OTC Monographs@FDA. No dataset is needed; it's under 20 ingredients.
- **License:** FDA website content is public domain [S13].
- **Fit:** **strong.** A sunscreen check can say, with an FDA citation, "FDA proposes this active as safe and
  effective" (zinc oxide, titanium dioxide) or "FDA says more safety data is needed" (oxybenzone and the others). The
  second is a data gap, not a finding of harm, and the UI wording must say so.

### FDA prohibited and restricted cosmetic ingredients

- **Who / what:** US FDA's short list of ingredients banned or limited by regulation. It includes bithionol,
  chlorofluorocarbon propellants, chloroform, halogenated salicylanilides, hexachlorophene (restricted), mercury
  compounds (eye-area limit of 65 ppm), methylene chloride, prohibited cattle materials, vinyl chloride and
  zirconium-containing complexes in aerosols [S12].
- **Access / license:** a web page, public domain [S13].
- **Fit:** **yes.** It's small enough to hand-enter into a cosmetics library.

### Health Canada Cosmetic Ingredient Hotlist

- **Who / what:** Health Canada's "administrative tool" with two tables, prohibited and restricted. Page updated
  2026-03-31 [S14]. Entry count and download format are **unverified**.
- **Fit:** optional, as a third regulator alongside the FDA and EU. Not needed for a US showcase.

### California Safe Cosmetics Program: "Chemicals in Cosmetics" open data (new find)

- **Who:** California Department of Public Health [S27].
- **What:** companies with at least $1M in annual cosmetic sales must report products sold in California that contain
  ingredients "known or suspected to cause cancer, birth defects, or other developmental or reproductive harm" [S27].
- **Coverage:** CSV with 114,635 rows covering 36,972 product IDs (my count of the downloaded file). Columns include
  product name, company, brand, category, CAS number, chemical name and reporting dates [S27]. **No barcode column.**
- **License:** the CalHHS portal says "You are welcome to freely download and use this Content" under its terms of
  use [S28].
- **Fit:** **yes, a good extra.** This is official, US, product-level data. "This company reported titanium dioxide in
  this lipstick to California" is a citable fact. Matching has to go by brand and product name, since there is no UPC.

## (b) Laundry detergent and other cleaning products

### EPA Safer Choice certified products (strongest new find)

- **Who:** US EPA [S15][S16].
- **Coverage (my count of the CSV downloaded 2026-10-02):** 4,993 products (4,875 Safer Choice, 118 Design for the
  Environment). 3,228 of them have a UPC or GTIN. Top categories: all-purpose cleaners 778, **laundry detergents 500**,
  floor cleaners 383, carpet cleaners 321 [S16].
- **Data:** a certification list, not ingredient lists. Columns include `upcs`, `gtins`, `product_name`,
  `company_name`, `fragrance_free` and `product_url` [S16].
- **Access:** CSV, JSON, Excel and XML from the Envirofacts REST API, e.g.
  `https://data.epa.gov/efservice/t_safer_choice_and_design_for_the_environment/CSV` [S16].
- **License:** EPA data is US federal government data. Federal works aren't subject to copyright under 17 U.S.C.
  §105 [S34]. I didn't find a dataset-specific license page.
- **Fit:** **best cleaning-product option.** Scan a barcode → match a UPC → "EPA Safer Choice certified". That is an
  official, positive, barcode-matched fact with almost no build cost. A missing certification means nothing and must
  not be shown as bad.

### EPA Safer Chemical Ingredients List (SCIL)

- **Who:** US EPA Safer Choice [S15].
- **What:** chemicals "arranged by functional-use class" (surfactants, solvents and so on) that EPA has found safer
  than traditional ingredients. They are marked green circle (verified low concern), green half-circle (expected low
  concern), yellow triangle (best-in-class but has some hazard issues), or grey square [S15]. It leaves out confidential
  chemicals, so it is not a complete "safe" list [S15].
- **Coverage:** about 1,008 unique CAS numbers in the spreadsheet (my count) [S15].
- **Access:** an Excel file at `https://www.epa.gov/sites/default/files/2015-09/safer_chemical_ingredients_list.xls`
  (server Last-Modified 2025-09-30) [S15].
- **Fit:** **yes**, for positive notes on cleaning ingredients ("EPA lists this surfactant as low concern"). It has
  no "bad" list, so it pairs with Prop 65 or the ECHA SVHC list for flags.

### EWG Guide to Healthy Cleaning

- **Coverage:** 2,109 products, 197 brands, more than 1,000 ingredients, with A–F grades that combine ingredient
  hazard and a "disclosure" score. EWG notes that 48% of the labels it examined listed three or fewer
  ingredients [S17].
- **Fit:** **no**, for the same license reasons as Skin Deep [S2][S3]. Its point about labels matters, though:
  cleaning products often don't list full ingredients, so an ingredient-text check will often have nothing to work on.

### Open Products Facts

- **Who / license:** Open Food Facts; ODbL/DbCL [S10]. It covers general products "BUT NOT food, cosmetics or pet
  food" and focuses on circular use and repairability [S10].
- **Coverage (API, 2026-10-02):** 46,450 products; 3,349 with ingredients completed; 127 tagged laundry
  detergents [S9].
- **Fit:** **weak** fallback for cleaning-product barcodes; most entries won't have ingredients.

### CPID (Consumer Product Information Database) and the old NIH Household Products Database

- **NIH Household Products Database:** **no longer exists at NLM.** NLM's TOXNET page says "The content of HPD is
  available from the original content provider Consumer Product Information Database" (whatsinproducts.com), and
  that the data is also in PubChem as the CPID source [S31]. `hpd.nlm.nih.gov` did not resolve when checked.
- **CPID:** run by DeLima Associates. `whatsinproducts.com` and `delimaassociates.com` both returned HTTP 503 on
  2026-10-02, so its coverage, terms and API are **unverified**.
- **Via PubChem:** PubChem compound records carry a "Consumer Product Information Database Classification" section
  sourced from CPID. For example, sodium lauryl sulfate (CID 3423265) shows CPID, Cosmetic Ingredient Review and FDA
  Substances Added to Food sections [S29].
- **Fit:** **only through PubChem**, and the depositor's rights still apply (see PubChem).

## (c) Food ingredients and additives

### FDA Substances Added to Food (formerly EAFUS)

- **Who:** US FDA [S18].
- **What:** food and color additives in 21 CFR 172/173/73/74, GRAS substances in 21 CFR 182/184, prior-sanctioned
  substances, flavourings evaluated by FEMA or JECFA, and *formerly used* substances labelled "PROHIBITED" (21 CFR 189)
  or "DELISTED" (color additives) [S18]. FDA warns it is "only a partial list". Including a FEMA or JECFA entry "does
  not indicate an FDA approval" [S18].
- **Coverage:** "Records Found: 3971" in the inventory on 2026-10-02 [S19].
- **Access:** a searchable web inventory plus a "Download data ... in Excel format" link [S19].
- **License:** public domain [S13].
- **Fit:** **yes.** The PROHIBITED and DELISTED labels match the safety engine's "banned or revoked by FDA" rule, and
  the file can be checked by machine instead of by hand.

### FDA GRAS Notice Inventory

- **What:** GRAS notices filed since 1998, with FDA's response letters (e.g. "FDA has no questions"). 1,336 records on
  2026-10-02; the newest response is dated Sep 8, 2026. Since July 2025 some notices are posted on
  regulations.gov [S19].
- **Access / license:** searchable plus an Excel download; public domain [S13][S19].
- **Fit:** **partial.** It shows a company's GRAS conclusion and FDA's reply. That's useful context ("FDA had no
  questions"), but it's not a hazard source.

### FDA list of select chemicals under review (new find)

- **What:** a table of chemicals FDA is re-reviewing after they reached the market, by chemical type and review step.
  For example, a BHT request for information had its comment period reopened to 2026-08-31 [S20].
- **Fit:** **context only.** "Under FDA review" is not a finding; showing it as a flag would break the engine's rule.

### EU food additives database (DG SANTE) and its API

- **Who:** European Commission, DG SANTE. Based on the Union list in Annex II of Regulation (EC) No 1333/2008 [S21].
- **Coverage:** 412 list entries (376 substances, 36 groups), with 395 distinct E-codes, from paging the API on
  2026-10-02 [S22].
- **Data:** E-number, name, type, link to details. A details endpoint gives conditions of use [S22].
- **Access:** **an open JSON API with no key needed**, e.g.
  `https://api.datalake.sante.service.ec.europa.eu/food-additives/food-additives-list?format=json&api-version=v2.0`.
  The developer portal says "All data is freely available for use and consumption". Endpoints include `/download`,
  `/food-additives-list` and `/food-additives-details` [S21][S22].
- **Fit:** **yes.** It answers "is this E-number currently approved in the EU?" by machine. An E-number missing from
  the list (e.g. after a ban) is evidence for the engine's "banned in the EU" rule, but it should be confirmed against
  the regulation text before it's shown.

### EFSA OpenFoodTox 3.0

- **Who:** European Food Safety Authority [S23].
- **Coverage:** 7,880 distinct substances, 45,682 study results and 19,452 toxicological reference values (e.g. ADI,
  TDI). It spans food additives, flavourings, pesticides, contaminants, food contact materials, feed additives and
  nutrients. Released April 2026 with EFSA outputs up to December 2025 [S23].
- **Access:** an Excel file, IUCLID 6 archives and Power BI dashboards [S23]. The Zenodo record (2026-04-30) has
  `OFT3.0 export repository.xlsx` [S24].
- **License:** **CC BY-ND 4.0** on Zenodo [S24]. EFSA says it "owns this database and its content" and that the
  original scientific output takes precedence over the database [S23]. ND (no derivatives) means you can quote values
  with credit, but you can't publish a modified version of the dataset.
- **Fit:** **yes, with care.** Show "EFSA set an ADI of X mg/kg body weight/day (year)" with a link to the opinion.
  Don't turn ADIs into scores.

### Already in place: USDA FoodData Central, Open Food Facts, IARC

- These stay as they are. USDA supplies US branded labels, OFF is the fallback and supplies additive codes, and IARC
  classifications are part of the severity rules. PubChem also carries an IARC section [S29], which could help with
  matching, but IARC's own site is the source to cite.

## Cross-category chemical sources

### PubChem

- **Who:** NIH / National Library of Medicine [S30].
- **What:** an aggregator. A single compound record pulls in sections from FDA Substances Added to Food, EFSA
  OpenFoodTox, ECHA, IARC, EPA DSSTox/CPDat, Cosmetic Ingredient Review and CPID [S29].
- **Access:** PUG REST and PUG View APIs. Usage limits are no more than 5 requests/second and 400/minute, with dynamic
  throttling (**snippet only**: the docs page is rendered by script). Responses carry an `X-Throttling-Control`
  header, which I observed [S29][S32].
- **License:** NLM-created content is public domain. The site also holds material "contributed or licensed by
  individuals, companies, or organizations that may be protected by U.S. and foreign copyright laws", so each
  section's own source terms apply [S30].
- **Fit:** **yes, as glue.** Map ingredient name → CID/CAS → which official lists mention it. Then cite the original
  agency, not PubChem.

### EPA CompTox Chemicals Dashboard and CTX APIs

- **What:** "chemistry, toxicity and exposure information for over one million chemicals" and 300+ chemical lists.
  Searchable by consumer product category [S25].
- **Access:** CTX APIs; "Limited Access APIs" need a free key requested by email (ccte_api@epa.gov) [S26].
- **Fit:** **later, if ever.** It's research-grade data (bioactivity assays, models), too raw to show consumers
  without expert interpretation.

### ECHA / REACH and the SVHC Candidate List

- **What:** 253 entries on the Candidate List of substances of very high concern, viewed 2026-10-02. The latest
  additions are dated 04-Feb-2026 (e.g. n-hexane). Reasons include carcinogenic, toxic for reproduction, endocrine
  disrupting, PBT and vPvB [S33]. The data is moving to ECHA CHEM; the old table is maintained "until December
  2026" [S33].
- **Access:** a web table with "Export search results to: XLS CSV XML" [S33]. The site sits behind a web firewall and
  a legal-notice acceptance dialog (I read the notice but didn't accept it).
- **License (from ECHA's legal notice):** information "may be downloaded, reproduced, distributed and/or used ... for
  commercial and non-commercial purposes" if ECHA is credited ("Source: European Chemicals Agency,
  https://echa.europa.eu/"). This **excludes** "whole or substantial parts of databases". Scraping is "generally
  prohibited". **CAS numbers on ECHA are American Chemical Society property** and can't be redistributed without
  ACS permission [S33].
- **Fit:** **yes, for a small hand-picked subset** relevant to consumer products (e.g. 1,4-dioxane, butyl and isobutyl
  4-hydroxybenzoate (butyl- and isobutylparaben), all seen in the table on 2026-10-02), credited to ECHA. Don't mirror the whole
  list, and don't copy CAS numbers from ECHA; get identifiers from PubChem instead. Note that "SVHC" is an EU REACH
  status about chemicals in articles, not a cosmetics or food ban.

### California Proposition 65 list

- **Who:** California OEHHA.
- **What:** chemicals "known to cause cancer, birth defects or other reproductive harm"; "approximately 900
  chemicals"; updated at least once a year (**snippet only**: OEHHA's pages put automated visitors behind a CAPTCHA,
  which I did not try to bypass) [S35]. The current list PDF is titled "July 31, 2026 List of Proposition 65
  chemicals" (62 pages, from its metadata) [S36].
- **Access:** PDF. An Excel/CSV version is **unverified**.
- **License:** **unverified** (no terms page could be read).
- **Fit:** **yes, as a flag source, with careful wording.** A listing means a warning may be required in California
  above certain exposure levels. It does not mean the product is unsafe at normal use. Prop 65 lists hazard, not risk.

## Recommended for EcoGo

The engine's rules stay the same: only official findings, every flag cites its source, no made-up scores. The
cheapest, most trustworthy additions, in order:

1. **Cleaning products: EPA Safer Choice UPC match.** Download the Envirofacts CSV (5k rows, 3.2k with UPCs). If the
   scanned barcode matches, show "EPA Safer Choice certified" with a link. This is the only source found that is
   official, barcode-keyed and free. Show nothing when there's no match.
2. **Sunscreen: FDA monograph status.** A hand-entered list of 17 actives (the 16 in the deemed final order plus
   bemotrizinol), of which PABA and trolamine salicylate were removed on 2026-09-10. Each gets one of three FDA labels: proposed
   GRASE (zinc oxide, titanium dioxide); "FDA says more data needed" (oxybenzone and 11 others); or "removed by FDA".
   Get ingredient lists from Open Beauty Facts.
3. **Cosmetics: a small official library** built like the food one: FDA prohibited/restricted (about 10 entries), EU
   bans/restrictions checked against CosIng and the regulation, Prop 65 (carefully worded), and a handful of ECHA SVHC
   entries credited to ECHA. Optionally add the California CSCP "reported to the state" fact by brand and product
   name.
4. **Food: make the existing library machine-checked.** Cross-check entries against the FDA Substances Added to Food
   Excel (PROHIBITED/DELISTED) and the EU additives API (approved or not). Add EFSA ADIs as cited context.
5. **PubChem as the name-matching layer** (ingredient name → CAS/CID), respecting the 5 requests/second limit and
   citing the original agencies.

**Don't use:** EWG's three databases (no reuse without permission, noncommercial only, single advocacy score),
INCIDecoder/INKEEDecoder (no terms, commercial ties), the NIH HPD (retired), CompTox (too raw), or whole-database
copies of ECHA. "Under FDA review" and "not on the Safer Choice list" are not findings and should never become flags.

**Known limits to plan for:** cleaning products often don't list full ingredients (EWG found 48% of labels list three
or fewer) [S17]. Open Beauty Facts has ingredients for only 21k of 77k products and about 5k US products. So for
non-food products the honest answer will often be "certified" or "no data", not a full ingredient check.

## Sources (all accessed 2026-10-02)

- [S1] EWG, "Learn how Skin Deep works" (about / methodology): https://www.ewg.org/skindeep/learn_more/about/
- [S2] EWG, Reprint Permission Information: https://www.ewg.org/reprint-permission-information (redirect from
  https://www.ewg.org/reprintpermission)
- [S3] EWG, Legal Disclaimer / Terms, Conditions, and User Agreement: https://www.ewg.org/legal-disclaimer
- [S4] INKEEDecoder (formerly INCIDecoder), About: https://inkeedecoder.com/about (redirect from https://incidecoder.com/)
- [S5] European Commission, Cosmetic ingredient database (CosIng):
  https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en
- [S6] CosIng web app and user manual: https://ec.europa.eu/growth/tools-databases/cosing/ ,
  https://ec.europa.eu/growth/tools-databases/cosing/assets/images/CosIng_FO.pdf
- [S7] European Commission, Legal notice (reuse policy, CC BY 4.0): https://commission.europa.eu/legal-notice_en
- [S8] Open Beauty Facts, Data and conditions for reuse: https://world.openbeautyfacts.org/data
- [S9] Open Beauty Facts / Open Products Facts search API counts, e.g.
  https://world.openbeautyfacts.org/api/v2/search?page_size=1&fields=code (and `&countries_tags_en=united-states`,
  `&categories_tags_en=sunscreens`, `&states_tags=en:ingredients-completed`),
  https://world.openproductsfacts.org/api/v2/search?page_size=1&fields=code&categories_tags_en=laundry-detergents ;
  sample record https://world.openbeautyfacts.org/api/v2/product/3600523614493
- [S10] Open Products Facts, Data and home page: https://world.openproductsfacts.org/data ,
  https://world.openproductsfacts.org/
- [S11] FDA, Questions and Answers: FDA's regulatory actions on OTC sunscreen:
  https://www.fda.gov/drugs/understanding-over-counter-medicines/questions-and-answers-fdas-regulatory-actions-over-counter-sunscreen
- [S12] FDA, Prohibited & Restricted Ingredients in Cosmetics:
  https://www.fda.gov/cosmetics/cosmetics-laws-regulations/prohibited-restricted-ingredients-cosmetics
- [S13] FDA, Website Policies (content is public domain): https://www.fda.gov/about-fda/about-website/website-policies
- [S14] Health Canada, Cosmetic Ingredient Hotlist:
  https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics/cosmetic-ingredient-hotlist-prohibited-restricted-ingredients.html
- [S15] EPA, Safer Chemical Ingredients List: https://www.epa.gov/saferchoice/safer-ingredients ; spreadsheet
  https://www.epa.gov/sites/default/files/2015-09/safer_chemical_ingredients_list.xls
- [S16] EPA, Search Safer Choice products and Envirofacts downloads: https://www.epa.gov/saferchoice/products ,
  https://www.epa.gov/enviro/download-additional-envirofacts-datasets ,
  https://data.epa.gov/efservice/t_safer_choice_and_design_for_the_environment/CSV
- [S17] EWG, Guide to Healthy Cleaning methodology: https://www.ewg.org/cleaners/content/methodology/
- [S18] FDA, Substances Added to Food (formerly EAFUS):
  https://www.fda.gov/food/food-additives-petitions/substances-added-food-formerly-eafus
- [S19] FDA inventories: https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances ,
  https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=GRASNotices
- [S20] FDA, List of Select Chemicals in the Food Supply Under FDA Review:
  https://www.fda.gov/food/food-chemical-safety/list-select-chemicals-food-supply-under-fda-review
- [S21] European Commission, Food additives database: https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en ;
  DG SANTE developer portal: https://developer.datalake.sante.service.ec.europa.eu/
- [S22] DG SANTE food additives API (portal listing and live call):
  https://developer.datalake.sante.service.ec.europa.eu/developer/apis?api-version=2022-04-01-preview ,
  https://api.datalake.sante.service.ec.europa.eu/food-additives/food-additives-list?format=json&api-version=v2.0
- [S23] EFSA, Chemical Hazards Database (OpenFoodTox): https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox
- [S24] Zenodo, OpenFoodTox 3.0 record (license CC BY-ND 4.0): https://doi.org/10.5281/zenodo.19388272
- [S25] EPA, CompTox Chemicals Dashboard: https://www.epa.gov/comptox-tools/comptox-chemicals-dashboard
- [S26] EPA, Computational Toxicology and Exposure APIs: https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis
- [S27] CalHHS Open Data, Chemicals in Cosmetics (CDPH): https://data.chhs.ca.gov/dataset/chemicals-in-cosmetics
- [S28] CalHHS Open Data Portal Terms of Use: https://data.chhs.ca.gov/pages/terms
- [S29] PubChem PUG View record for sodium lauryl sulfate (CID 3423265) and aspirin (CID 1983), source sections:
  https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/3423265/JSON ,
  https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/1983/JSON
- [S30] NCBI Website and Data Usage Policies: https://www.ncbi.nlm.nih.gov/home/about/policies/
- [S31] NLM, TOXNET and HPD status: https://www.nlm.nih.gov/toxnet/index.html
- [S32] PubChem, Dynamic Request Throttling (script-rendered; limits from search snippet):
  https://pubchem.ncbi.nlm.nih.gov/docs/dynamic-request-throttling
- [S33] ECHA, Candidate List of SVHC (table and legal-notice dialog): https://echa.europa.eu/candidate-list-table ;
  legal notice https://echa.europa.eu/legal-notice
- [S34] EPA Disclaimers (17 U.S.C. §105 public-domain note): https://www.epa.gov/web-policies-and-procedures/epa-disclaimers
- [S35] OEHHA, About Proposition 65 (snippet only): https://oehha.ca.gov/proposition-65/about-proposition-65
- [S36] OEHHA, Proposition 65 list PDF (July 31, 2026):
  https://oehha.ca.gov/sites/default/files/media/downloads/proposition-65/p65chemicalslist.pdf

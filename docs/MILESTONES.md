# EcoGo milestones

The build as chapters → milestones → lettered steps. Daedalus updates this at every step change and close-out (it is
also the dashboard's data). Status: ✅ done (date) · 🔨 building · ⏳ waiting on Minh · 📋 queued.
Work type: [Foundation] data/database · [Server] Edge Functions · [Facts] sourced claims · [Feature] new screens ·
[UI] polish/accessibility · [Debug] bug fixes · [Test] checks · [Deploy] going live · [Process] docs/workflow.

## Chapter 0 · Week 0 (before 2026-09-23)
Hack the Hood prototype (Figma Make) turned personal agentic-programming research project.

## Chapter 1 · Foundation (09-23 → 10-04) ✅
M0 cleanup · M1 sourced safety engine [Facts] · M2 barcode lookup [Foundation] · M3 deploy [Deploy] · M4 concern levels
[Facts] · M5 nutrition [Feature] · M6 camera [Feature] · M7–M7.5 Home, explainers, trust cleanup [Feature] · M9 LA map [Feature]

## Chapter 2 · Owning the data (10-02 → 10-05) ✅
M10 own copy of 430,127 USDA foods [Foundation] · A M10.1 processed-meat rules · B M10.2 sausage/cure · C M10.3 roast-beef brine [Facts]

## Chapter 3 · App features (10-06 → 10-16) ✅
M11 quick wins · M12 Home Learn tiles · M13 Map near me · M14 Collections [Feature]
M8 add a product to Open Food Facts [Feature][Server] ✅ 10-08
- A label trim (047) · B photo quality (048) · C blur + speed (049) · D progress bar (050) · E fix existing OFF products
  (051) · F photo fixes + crop (052) [Debug][Feature] ✅ 10-09 → 10-14
- 053 trust wording [Facts] · 054 bug batch · 055 Send edge cases · 056 search rows [Debug] ✅ 10-14 → 10-15
M8.1 Suggest a place + Report a problem (057) [Feature][Server] ✅ 10-15 · 058 Check the label yourself · 059 map batch ✅ 10-16
M15 Your contributions (060) [Feature] ✅ 10-16 · 061 stricter source checks [Facts][Test] ✅ 10-16

## Chapter 4 · Beyond food (10-16 → now)
M16 personal care (062) ✅ 10-17 · A sourced library [Facts] · B Open Beauty Facts lookup [Foundation] · C product page +
"What is it?" [Feature] · D check-care [Test] · ⏳ Minh's soap/lotion test
063 accuracy fixes ✅ 10-20 (e202a84) · A fragrance/removal/conditions/fold text [Facts] · B seed-oil EU cite [Facts] ·
C care-page fixes + bigger buttons [UI] · D Home/search/contrast [UI] · ⏳ Minh's lotion retest
M17 cleaners (065) ✅ 10-20 (df2b7c8) · A EPA Safer Choice snapshot [Foundation] · B Safer Choice card [Feature] · C California
line [Facts] · D "Cleaning product" choice [Feature] · ⏳ Minh's listed + unlisted scan
064 hidden risks ✅ 10-21 (9905870) · A "Risks a label can't show" article [Facts] · B benzene note on drinks [Facts] ·
C celery context on flagged meats [Facts] · ⏳ Minh's live test (checklist 2F, 4E)

## Chapter 5 · Hardening (next)
066 Label reader v2 ✅ 10-22 (f23f876; Headsman IV + V) · A measured test of free readers on real labels [Test] · B clean-up before
reading [Feature] · C stronger reader on the phone [Foundation] · D unsure words: tap 1 of 3 suggestions, type it, or
retake [Feature] · E warning text kept as ingredients (OCR-02) · F false "not clear" (OCR-03) [Debug] · (G cloud help → 070) · H "never photograph anything private" on photo sends [UI] · I take another
photo, text joined at the overlap [Feature]
070 Cloud help, opt-in (OCR.space) ✅ 10-23 (9fd47c7) [Feature][Server] (decision 070; spec docs/archive/2026-10-23-cloud-help-070-design.md)
Tidy-up 📋 (C, the check-home split, before 068) · A shared check set-up (~-190 lines) · B trim Figma CSV + unread fields · C split check-home (315 s of 420) ·
D archive the M10 specs still in `specs/` [Process]
Minh's next-chapter review ✅ 10-22 (playtest) → Chapter 6 (decision 067).

## Priority build list (Daedalus keeps it current; top = next)
1. ~~066 Label reader v2 live~~ ✅ 10-22 (f23f876, live check passed) · ⏳ Minh's live test (checklist section 6)
2. ~~070 Cloud help, opt-in~~ ✅ 10-23 (9fd47c7) · ⏳ Minh's live test (checklist 7A)
3. ~~073 Check-home split + gates close Edge~~ ✅ 10-23 (d58462c): check-home 103 s / check-scan 185 s, no leftover Edge
4. **068 Scan screen** 📋 Barcode / Ingredients switch at the bottom, "Check ingredients", no dead end after "Cleaning product", a paste-from-Photos path
5. **075 Audit fixes** 📋 ChatGPT audit, all 16 confirmed: High first (cloud upload after close, old-Safari crash,
   unsourced Tide line incl. the live catalog row), then medium/low (KNOWN_ISSUES)
6. **071 Label reader v3** 📋 brand / product name / net weight lines never kept as ingredients; Add a product asks name + brand at the end; line-by-line join for cut-off photos; more stop phrases from real photos
7. **072 Ingredient knowledge** 📋 research first (official, licence-checked lists): a cleaner ingredient library (none today) and wider personal-care coverage
8. **069 Learn + Privacy redesign** 📋 prettier cards, bubbles, Source buttons, new sourced facts
9. Later: personal care to Open Beauty Facts, home inventory, profile, themes, map rethink, variety packs

## Chapter 6 · Label first (after 066; decision 071: "lets go mad brutal on ingredient scanner")
068 Scan screen 📋 · A Barcode / Ingredients switch at the bottom of the camera (Minh, 10-22) [Feature] · B "Check ingredients" wording [UI] · C no dead
end after "Cleaning product" [UI] · D paste-from-Photos path: tip + Paste button; tip (Minh, 10-22): "On iPhone: open the photo, press and hold the words, tap Copy, then tap Paste here." [Feature]
071 Label reader v3 📋 · A brand / product name / net weight lines aren't ingredients [Debug] · B Add a product: name + brand at the end [Feature] ·
C line-by-line join for cut-off photos [Feature] · D stop phrases from Minh's photos [Debug] · E split glued words on condensed print
("BENZYLSALICYLATE", "INGREDIENTSALCOHOL…": Burberry) [Debug] · F turn sideways text (Coppertone Drug Facts) [Feature] · G start-word traps:
"…Imported Ingredients" never starts a list (Pantene), "INGREDIENTS," with a comma (Burberry); Drug Facts stops ("Purpose", "Uses") [Debug]
072 Ingredient knowledge 📋 · A research: official, licence-checked cleaner + personal-care lists [Facts] · B cleaner ingredient library [Facts] ·
C wider personal-care coverage [Facts]
069 Learn + Privacy redesign 📋 · A one frame per card, bubbles + More, Source buttons, badge links [UI] · B How EcoGo checks:
logos + bold steps [UI] · C new sourced facts: seed-oil contaminants, pesticide foods, cleaning produce, organic [Facts]

## Future features (saved for later; Minh picks when) · 💡 = Minh's own idea
**Core: reading labels** [Foundation]
- 💡 Label reader as strong as the iPhone's Live Text (2026-10-21; "almost more important than the barcode"): moved
  into 066 (Label reader v2).
**Data coverage** [Foundation]
- 💡 More foods beyond USDA + Open Food Facts (free databases are limited; paid ones have licence limits).
- Open Products Facts lookup for other non-food items; an ingredient library for cleaners.
**Community** [Feature][Server]
- 💡 Points & levels: points for scans, first scans of new products, ingredient photos, adding or fixing product data,
  verifying facts; must reward accurate help, not fast help (Oct 5 review; 060 shipped only counts + badges).
**More facts** [Facts]
- 💡 Open Food Facts scores (Nutri-Score, NOVA, Green-Score, labelled as OFF's) · 💡 mercury-in-fish marker (FDA/EPA
  fish advice) · Prop 65 / CSCP wording.
**More products** [Feature]
- 💡 Produce by PLU sticker code (origins, tips, footprint from sourced data).
**Privacy & control** [Feature]
- 💡 Privacy settings page: every sensitive choice (cloud help, photo sharing, location, sign-in) in one easy-to-find
  place, each with an on/off switch (2026-10-21).
- 💡 "Help build the database" opt-in: people choose to share their label photos to improve EcoGo (needs storage,
  consent text and review; 2026-10-21).
**From the 2026-10-22 playtest** (later, decision 067)
- 💡 Home inventory ("Pokédex"): save what you own; scanning a store product compares it with yours.
- 💡 Profile and community: photo, banner, bio, scan count, points, friends, map visits.
- 💡 Colour themes beyond high contrast (also the intro page).
- 💡 Add personal care to Open Beauty Facts (today only food can be sent, to Open Food Facts).
- 💡 Variety packs: several ingredient lists / nutrition panels on one bag, one result per flavour (2026-10-22).
- 💡 Map rethink: finding clean places is "an easter egg hunt"; keep, shrink or change.
**Reach & polish** [UI]
- 💡 "Slow but sharper" reader option: the bigger PaddleOCR model (~33 MB, ~47 s a photo; best on tiny curved print),
  off by default (066 R1, 2026-10-22).
- 💡 Languages (full translation, needs care) · Map layout second look (059 choices) · 375 px phone layout pass.

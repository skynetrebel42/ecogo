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
066 Label reader v2 🔨 (Minh's design; Headsman IV) · A measured test of free readers on real labels [Test] · B clean-up before
reading [Feature] · C stronger reader on the phone [Foundation] · D unsure words: tap 1 of 3 suggestions, type it, or
retake [Feature] · E warning text kept as ingredients (OCR-02) · F false "not clear" (OCR-03) [Debug] · G cloud help,
opt-in, free tier [Feature][Server] · H "never photograph anything private" on photo sends [UI]
Tidy-up 📋 · A shared check set-up (~-190 lines) · B trim Figma CSV + unread fields · C split check-home (315 s of 420) ·
D archive the M10 specs still in `specs/` [Process]
⏳ Minh's next-chapter review (demo, 2026-10-22) → picks Chapter 6.

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
**Reach & polish** [UI]
- 💡 Languages (full translation, needs care) · Map layout second look (059 choices) · 375 px phone layout pass.

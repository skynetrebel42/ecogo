# M7.2: Profile cleanup (no fake user, stats or badges): design spec

- **Date:** 2026-10-01
- **Status:** done (`1c108af`…`ba8cc10`, plus the docs commit); plan: `docs/superpowers/plans/2026-10-01-m72-m73-profile-welcome.md`
- **Designed with:** the owner (Minh Bui), 2026-10-01, through multiple-choice questions and the mockup
  https://claude.ai/artifact/CMxtUdUwwMsP1LnD9Pr2Nk. They chose **"About & your data"**, **remove all** fake badges and
  dead buttons, and **layout A** ("All on one page"; they first picked B, then switched to A after viewing both).
- **Builds on:** M7 (`recent.ts`, the `recent` state in `App.tsx`). **M7 must be built first.**

## 1. Why

`ProfileTab` is still Figma filler:
- a made-up user ("Alex Johnson", alex@email.com, 4 stars, "Level 4 · Conscious Shopper");
- 4 made-up stats ("Money Saved $47.80", "CO₂ Reduced 12.4 kg", "Products Scanned 34", "Ethical Purchases 21");
- 6 made-up achievement badges;
- 5 settings buttons that do nothing (Notifications, Dark Mode, Privacy, Achievements, App Settings).

**Done for M7.2:** Profile shows only true things: how much is saved on this device (with Clear), where results come
from, what leaves the phone, and the source-code link, all on one page.

## 2. Decisions (owner, 2026-10-01, unless marked *recommended default*)

| # | Decision |
|---|---|
| P1 | Layout A, top to bottom: title "Profile" + "No account yet. What you do stays on this device." → **Your data** card → **Where results come from** card → **Privacy** card → footer "A student project. Not medical advice. Source code and updates" (link to https://github.com/skynetrebel42/ecogo, new tab) |
| P2 | **Your data:** "Recently scanned · N products, saved in this browser only" with a **Clear** button (empties the M7 recent list); at 0: "Nothing scanned yet", no Clear button *(recommended default)*. Below it: "Favorites are kept until you close EcoGo. Saving them for good comes with accounts." |
| P3 | No sub-screens: every section is visible on the page. "How EcoGo checks a product" stays on Home (M7) and isn't repeated here |
| P4 | **Remove:** the fake user, level and stars, `STATS`, `BADGES`, and the 5 dead settings buttons. Badges return only with accounts and real activity |
| P5 | No user name or avatar until accounts exist |

## 3. Facts the pages state (all already true in the code; no new outside sources)

- **Where results come from:**
  - USDA FoodData Central: label data supplied by the makers, checked first (`lookup.ts`).
  - Open Food Facts: crowd-sourced, used when USDA has no match, and always marked (M2/M5; the "Looks wrong? Fix it"
    link, `39ff6e3`).
  - IARC, EU, FDA, EFSA, WHO: the official findings behind the badge, each linked on the product page (`library.ts`,
    `foodConcerns.ts`).
  - Nutrition: FDA % Daily Value and its 5/20 rule (`nutrition.ts`).
- **Privacy:**
  - The camera reads barcodes on the phone; no images are uploaded (M6; the scan screen already says so).
  - To find a product, its barcode or search words are sent to USDA or Open Food Facts.
  - The catalog loads from EcoGo's database (Supabase). Recently scanned stays in this browser (M7). There's no account.
  - Don't claim "no tracking" or "no cookies" unless the plan checks it (Google Fonts and Supabase are outside hosts).

## 4. Design

- `ProfileTab({ recentCount, onClearRecent })` replaces the current one in `App.tsx`: plain markup, three cards and a
  footer, as in mockup A. No new files.
- Unused lucide icons are removed from the imports.

## 5. Testing

- Headless check (extend `check-home.mjs` or a new `check-profile.mjs`):
  - no "Alex", "Level 4", "Money Saved", "CO₂", "Ethical Purchases", "Achievements", "Notifications" or "Dark Mode" on
    Profile;
  - with 2 recent products the card says "2 products"; Clear makes it "Nothing scanned yet", and Home shows the
    first-visit card;
  - "Where results come from" and "Privacy" are on the page; the footer link is
    `https://github.com/skynetrebel42/ecogo` with `target="_blank"`;
  - no console errors.
- `npm test` and `npm run build` green. Docs: roadmap entry in `KNOWN_ISSUES.md`.

## 6. Out of scope

Accounts, synced data and real badges; dark mode; notifications; favorites persistence (K-16). **Next cleanup
candidate:** the welcome/onboarding slides still promise features EcoGo doesn't have ("Compare Amazon, Walmart, local
stores & Facebook Marketplace", "ethical local businesses near you").

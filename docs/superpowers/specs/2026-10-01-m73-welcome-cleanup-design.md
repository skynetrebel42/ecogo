# M7.3: Welcome cleanup (one honest welcome screen, shown once): design spec

- **Date:** 2026-10-01
- **Status:** approved by the owner 2026-10-01 (through multiple-choice answers); plan:
  `docs/superpowers/plans/2026-10-01-m72-m73-profile-welcome.md`
- **Decided with:** the owner (Minh Bui), 2026-10-01: **one welcome screen** (the slides are removed), headline **"Know
  what's in your food"**, and **remove** the "Sign In" button and the price and community promises until they're real.

## 1. Why

The first thing a new visitor sees promises things EcoGo doesn't do:
- the headline "Shop Smarter. Save Money. Live Better." and "better prices": every price in the catalog is invented
  (K-30);
- a **Sign In** button that does nothing (there are no accounts);
- onboarding slide 1, "Find the Best Price": "Compare Amazon, Walmart, local stores & Facebook Marketplace instantly";
- slide 3, "Support Your Community": "ethical local businesses near you" (the Map shows demo places).

Only slide 2 ("Scan any barcode to see which ingredients carry an official health concern…") is true.

**Done for M7.3:** one welcome screen that says what EcoGo does, shown once per device.

## 2. Decisions

| # | Decision |
|---|---|
| W1 | One welcome screen: the existing illustration, then **"Know what's in your food"** and **"Scan a barcode. See official health findings, with sources."** |
| W2 | Buttons: **Start scanning** (opens the Scan tab) and a text button **Look around first** (opens Home) *(recommended default)* |
| W3 | **Remove:** `ONBOARDING`, `OnboardingScreen`, the slide state, the "onboarding" app state, **Sign In**, **Get Started** and **Continue as Guest** |
| W4 | Shown **once per device**: `localStorage["ecogo.welcomed.v1"] = "1"` after either button; read in `try/catch` (blocked storage just shows it again next visit) *(recommended default)* |
| W5 | The illustration's 5 gold stars go (they read as a rating EcoGo doesn't give); a third label line takes their place *(recommended default)* |

## 3. Testing

`check-home.mjs` (M7's headless check, extended): the welcome shows "Know what's in your food" and "Start scanning",
with no "Sign In", "Get Started", "Save Money", "better prices", "Best Price", "Amazon" or "Walmart"; after a reload it
doesn't show again. All earlier checks still pass.

## 4. Out of scope

Accounts and sign-in; real prices; the real map (Los Angeles, OpenStreetMap), whose demo places stay on the Map tab.

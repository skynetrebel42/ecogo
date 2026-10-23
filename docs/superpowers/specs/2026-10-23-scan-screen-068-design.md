# 068: Scan screen: Barcode / Ingredients switch, paste from Photos, no dead end for cleaners

- **Date:** 2026-10-23 · **Status:** approved pieces (decisions 067, 071; Minh 10-22/23) · Priority list #4, label first.
- **Why:** the ingredient check is hidden behind "No barcode? / Type a barcode"; iPhone users copy label text best from
  Photos; "Cleaning product" on the not-found screen is a dead end (Minh's tests 2C/2D/2E).

## 1. Parts
| # | Part | Type |
|---|---|---|
| S1 | **Switch at the bottom of the camera:** "Barcode · Ingredients" (Minh, 10-22: "at the bottom of the camera"). Ingredients opens the existing ingredient check (photo / type) without leaving the Scan tab's camera flow; Barcode is the default. The words "No barcode?" become "Check ingredients" wherever they lead to the check (Minh, 10-22) | Feature |
| S2 | **Paste from Photos:** under "Type it", the tip exactly *"On iPhone: open the photo, press and hold the words, tap Copy, then tap Paste here."* (Minh, 10-22: "as drafted") and a **Paste** button that puts the clipboard text into the box (browser clipboard read on tap; if the browser refuses, the box gets focus so the person can long-press → Paste) | Feature |
| S3 | **No dead end for cleaners** (Minh, 10-23: "ok"): "Cleaning product" on the not-found screen opens the same "Check the label yourself" photo/type check with a cleaner kind. It checks against what applies to any product today (IARC findings), keeps the Safer Choice card when a barcode matched, and shows: *"EcoGo's cleaner checks are just starting: for now it looks for cancer findings (IARC). More official lists are coming."* (draft offered 10-23; Minh's "ok"). The California line stays. 072 later widens the cleaner list on the same screen | Feature |

## 2. Testing
- Node: the cleaner kind uses IARC findings only (no food or cosmetic rules applied to a cleaner); paste fills the box.
- check-scan: switch present and labelled, Barcode default, Ingredients opens the check; "Check ingredients" wording;
  not-found → Cleaning product → the check with the cleaner line (red on the old build); paste button fills the box
  (CDP clipboard permission) and falls back to focus. Every gate within budget (check-scan ~185 of 360).
- Live: Minh scans an unknown cleaner → Cleaning product → photographs its label; copies label text from Photos → Paste.

## 3. Out of scope
Auto-detecting barcode vs label in one camera (bigger; later if wanted); the cleaner ingredient library (072);
Open Products Facts lookups.

## 4. Builder questions (planner, 2026-10-23: all Option A)
G1 cleaner kind = personal-care entries with an IARC source, shown with that source only ("IARC classifies it as … (Group N)."); no food library, no EU cosmetic rules. G2 check screen gets a third "What is it?" button "Cleaning product", the cleaner line replaces the FDA/EU/IARC limits line, nothing found = "No matches in EcoGo's checked list." G3 not-found → Cleaning product keeps Safer Choice meaning + California line, the cleaner line replaces "Check the maker's website…", main button "Check the label yourself". G4 nothing added to EPA's Safer Choice page. G5 two pressed buttons "Barcode" / "Ingredients", back to Barcode after the check closes; Ingredients starts on Food. G6 Paste appends on a new line; empty clipboard = refused → focus; tip + Paste in "Type it" only. G7 check-ocr selectors renamed (no new checks). G8 camera stops while Ingredients is open.

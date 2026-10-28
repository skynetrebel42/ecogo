# 071 Label reader v3 (decisions 071, 076; Minh's tests 10-24 and 10-28)

**Goal:** what EcoGo shows after a photo, a paste or typing is as trustworthy as the product page: every flag carries
its official quote, garbled words never hide a finding silently, and the reader keeps only ingredient text.
Voice: facts first (memory `project_vision`). Nothing invented: no match = no claim.

Two rounds with a report between them (the builder may rotate at that seam). Each item: a test that fails on the old
build first. Gates within budget (check-ocr ≤ 180 s; split, never raise).

## Round 1 · the check screen (what users see)
| # | Item | Done when |
|---|---|---|
| O | **GA-09:** photo/typed results show each flag's source the way the product page does (`ProductDetailScreen.tsx` ~108–125: cite line + source links/quotes); food flags, care flags and cleaner (IARC) flags | A typed `sodium nitrite` shows the same cite + source link as its product-page row; a check-* gate asserts it |
| J | Benzene note in the ingredient check (`benzeneNote`, `foodConcerns.ts:329`) when benzoate + ascorbic acid are both present, same text and source as the product page | `water, sodium benzoate, ascorbic acid` (typed) shows the note; either one alone doesn't |
| H | Typing feedback: results already recompute on every keystroke; show **wording W1** while typing and **W2** about 0.4 s after typing stops (`role="status"`, no layout jump) | Unit/gate check: edit → W1 → W2; nothing announced on every keystroke |
| I | Unsure words for typed and pasted text, not only photo text: words not in the known vocabulary (`knownWord`, `ocr.ts`) get the existing underline + "did you mean" chips (`WordFix`); a near-miss of a known ingredient name is suggested (e.g. `ED&C YILLOW 0. 5` → `FD&C Yellow No. 5`, `benozate` → `benzoate`); an unreadable stretch says so with **wording W3** instead of silently not matching | Minh's 2F paste (research-2f-owner-test.md, notes folder) gives Yellow 5 after one tap, or names the unreadable words; a clean list shows no chips |
| B | Add a product: a last step before Send asks **W4** (product name, brand); name goes to `product_name_en` (exists, `off.ts:60`); brand needs `brands` added in `off.ts` + off-submit redeploy (server first, Minh's yes via the checked push/deploy ask) | Sent form has both; skipping either still sends; off-submit tests cover it |

## Round 2 · the reader (`src/lib/ocr.ts`; xhigh effort)
| # | Item | Done when |
|---|---|---|
| A | Brand / product name / net weight lines (`NET WT`, `fl oz`, `ml`, `g`) are never kept as ingredients | Fixture lines before/after the list are dropped |
| C | Line-by-line join for cut-off photos (two photos overlapping by lines, not only by words) | Two cut-off halves join once, no doubled or lost line |
| D, G | Start/stop traps: "…Imported Ingredients" never starts a list (Pantene); "INGREDIENTS," with a comma starts one (Burberry); Drug Facts stops at "Purpose", "Uses", "Warnings" | One fixture each |
| E | Split glued words on condensed print (`BENZYLSALICYLATE`, `INGREDIENTSALCOHOL…`, Burberry) using the known vocabulary | Both split; no real compound word split |
| F | Sideways text (Coppertone Drug Facts): detect orientation and rotate before reading | A rotated fixture image reads like the upright one (gate or unit, within budget) |
| K | **GA-03:** `cheese ( contains milk), sodium nitrite` keeps the whole list (space after "(") | Food → `high` |
| L | **GA-04:** `3-` + line break + `Cyclohexene` joins to `3-Cyclohexene…` (hyphen kept) | Care → Lyral flagged |
| M | **GA-05:** Drug Facts: the "Inactive ingredients" list is read, not only the active line | `… Inactive ingredients: Water, formaldehyde` → formaldehyde flagged |
| N | **GA-06:** `joinReads` never drops a word that only one side has (`talc`) | Joined text keeps talc → `high` |
Exact inputs for K–N: research-grand-audit-chatgpt.md (notes folder). Real photos: Minh's, never committed; use text fixtures.

## Wording (Minh, 2026-10-28: the defaults below, locked)
W1 "Checking…" · W2 "Checked ✓" · W3 "We couldn't read: ‹words›. Fix them above or retake the photo." ·
W4 title "What's it called?", fields "Product name" and "Brand" (both optional).

## Builder calls (Round 1)
| # | Call |
|---|---|
| O | (builder) The product page's rows move to `Findings.tsx`; the check shows them inside its result box (one row open at a time) |
| J | (builder) A typed list doesn't say it's a drink, so the check passes `Beverages` to `benzeneNote`: the row shows whenever both words are listed (it says "In some drinks") |
| H | (builder) The W1/W2 line is `aria-live="polite"`, not a second `role="status"` (gates read the first one as the verdict); the result boxes are `aria-live="off"`, so only W1/W2 is announced |
| I | (builder) Typed/pasted words get a chip only when they are no known word and ≤ 2 letters off one of EcoGo's own names (the catalog's 51 lists, typed: no chips); a stretch off a multi-word name or a US colour form ("FD&C YELLOW NO. 5") is one chip. W3 sits under the chips, photo text too |
| B | (builder) W4 is a card on the Send screen (the last screen before Send), not an extra screen; a name or brand OFF already has is kept (off-submit reads `brands`) |

## Out of scope
Scores or grades; claims without an official quote ("rinse after wipes", "fragrance = endocrine disruptor": no source);
072's ingredient pages; 076 (stuck Sending, lookup timeout).

## Done
npm test + build + all gates + verify:sources (if safety/learn files change); code-review + ponytail-review; Log line in
docs/HOW_ECOGO_WORKS.md; push list opens with "Changes the live app" (CLAUDE.md); live check by Daedalus; owner tests
added at close-out.

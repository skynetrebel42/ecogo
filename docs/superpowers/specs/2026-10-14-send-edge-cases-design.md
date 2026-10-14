# Send edge cases (decision 055): lock while sending, three clear outcomes

- **Date:** 2026-10-14
- **Status:** **Approved** by the owner 2026-10-14 (decision 055, both picked from options, recommended)
- **Why:** outside audit RW1-02/05 and RW1-03/04 (KNOWN_ISSUES "Outside audits"). Today Close during "Sending…" drops
  the screen while the send runs on (no receipt), the name can change after the send snapshot, a lost reply says "Not
  sent" though OFF may have it, and a photo OFF rejects is called "already has these photos".
- **Base:** M8 + follow-ups 1–6, 054, 051 (AddProductFlow, `src/lib/contribute.ts`, `supabase/functions/off-submit/`).
  Every earlier rule holds (limits, Turnstile, partial success, latestWins).

## 1. Changes

| # | Change |
|---|---|
| E1 | **Lock while sending:** during `sending`, Close is disabled (Back already is) and every field that feeds the send (name, text, photos, crop, consent) is disabled. Sending ends in Sent, Not sent or E2's screen; on any of them Close works again. On Not sent all photos and text are kept for a retry (as today). A closed browser tab can't be stopped; out of scope |
| E1a | (planner, 2026-10-14) **Every send ends**, so the lock can't trap anyone: no human-check token within 60 s → `captcha` (Not sent, as today); no answer from off-submit within 90 s after the upload's last byte → `unknown` (E2) |
| E2 | **No reply** (the request throws, times out, or the answer isn't EcoGo's JSON) is no longer `off-down`: a new outcome `unknown` with its own screen, title "Not sure it arrived", text "We didn't hear back from Open Food Facts. It may have arrived. Check the product in a few minutes before sending again." and a link "Open on Open Food Facts" (world.openfoodfacts.org/product/<code>, new tab) plus Close. No Try again button on this screen. A real `off-down` answer from off-submit (502 with EcoGo's JSON) stays "Not sent" as today |
| E3 | **Rejected photo:** off-submit answers a new reason `photo-rejected` when nothing was taken and at least one photo got an OFF error other than "This picture has already been sent." Wording: "Open Food Facts couldn't use this photo. Try another one." (in photos mode too); Try again goes back to the front photo (as J2b). A send where every photo was a duplicate stays `nothing-new` ("already has"). Partial success is unchanged. Needs an off-submit redeploy, with Minh's OK |

## 2. Testing

- Node: `contribute.ts` maps a thrown/timeout/non-JSON reply to `unknown` and a 502 `{reason:"off-down"}` to `off-down`;
  `sendReply` gives `photo-rejected` for a non-duplicate photo error, `nothing-new` for all-duplicates, `off-down` for
  HTTP errors (as today).
- check-home (CDP stub, nothing reaches Supabase or OFF): Close and the fields are disabled while the stub holds the
  reply; a dropped reply shows "Not sure it arrived" with the OFF link; a `photo-rejected` answer shows the new line and
  Try again lands on the front photo. All earlier gates.
- Live: none needed beyond the redeploy boot check (OPTIONS 200, unsigned POST 401 captcha).

## 3. Out of scope

Resuming a send after the screen or tab closes; background retries; telling which photo OFF rejected.

# M8 follow-up 4: a real progress bar while sending

- **Date:** 2026-10-09
- **Status:** **Approved** by the owner 2026-10-09 (decision 050, picked from options: real upload % + steps)
- **Why:** after follow-up 3 (Send ~10 s), Minh wants a progress bar for the photo send-off, following good UI practice:
  a wait of several seconds deserves visible progress, and the progress must be true (facts first: never a timer
  pretending to be progress).
- **Base:** M8 and follow-ups 1–3 as shipped (`docs/archive/2026-10-02-m8-add-product-design.md`, `…-followup-…`,
  `…-followup2-…`, `2026-10-09-m8-followup3-blur-speed-design.md`). No server change; `off-submit` stays v6.

## 1. Changes

| # | Change |
|---|---|
| P1 | **Upload with progress.** `contribute.ts` sends the same multipart body to `off-submit` with `XMLHttpRequest` (POST `<VITE_SUPABASE_URL>/functions/v1/off-submit`, headers `Authorization: Bearer <session access token>` and `apikey: <publishable key>`) instead of `supabase.functions.invoke`, so `upload.onprogress` gives real bytes sent. It reports stages through an `onProgress` callback: `"check"` (only while Turnstile + anonymous sign-in run), `"upload"` with a percent, `"saving"` once the upload finished and the server works. Reply handling and reason mapping (`limit-you`, `limit-all`, `captcha`, `off-down`, `invalid`, `nothing-new`, `failedPhotos`, `pendingPhotos`) are unchanged; network error or timeout → `off-down` |
| P2 | **The bar.** On the Send step while sending, above the disabled "Sending…" button: a bar (8 px, EcoGo green `#1A5C39` on a light track, rounded) with a label: "Checking you're human…" (moving bar), "Uploading photos… 62%" (fills with the real percent), "Open Food Facts is saving it…" (moving bar). `role="progressbar"` with `aria-valuenow` only during upload, `aria-valuetext` = the label, and a polite live region announcing stage changes (not every percent). Under `prefers-reduced-motion`, the moving bar is a static full-width tint; text carries the stage. Replaces 048 G1's "this can take up to 30 seconds" text |
| P3 | With no photos the upload stage is near-instant; the bar simply passes through it. Nothing else on the Sent / Not sent screens changes |

## 2. Testing

- Node: `contribute.ts` with a stubbed XHR: stage order `check` → `upload` (rising percents) → `saving`, `check` skipped
  when a session exists; every existing reason mapping still holds through the XHR path (401 → `captcha`, network
  error → `off-down`, …).
- check-home: with the function intercepted (CDP Fetch, nothing reaches Supabase or OFF) and a throttled upload, the
  bar shows "Uploading photos… N%" with a rising `aria-valuenow`, then "Open Food Facts is saving it…", then Sent;
  reduced-motion emulation shows no animation. All earlier gates (npm test 297, check-home 48, check-map 36,
  check-saved 18, check-ocr 25).
- Live (Minh's phone): one Send; the bar fills and ends on Sent.

## 3. Out of scope

Progress for the background photos after "Sent" (they keep their H1 line); a cancel button.

# M8.1: Suggest a place and Report a problem, in the app (decisions 039, 042, 045, 057)

- **Date:** 2026-10-15
- **Status:** **Approved** by the owner 2026-10-15. Owner picks 2026-10-15 (decision 057): approved places go to OSM by hand;
  evidence = the place's own website or its own official social page; one in-app report form for OSM and County cards;
  review in the Supabase dashboard.
- **Why:** 039 and 042 promised in-app suggestions and reports once M8's sign-in and bot check existed (045). Today the
  Map has "Missing a place? Add it on OpenStreetMap" and "Report a problem" opens an OSM note or an email.
- **Base:** M13 (Map near me), M8 (anonymous sign-in at the first Send, Turnstile, Edge Function with service-role
  writes). ChatGPT R3 research was advice only. Nothing a suggestion or report says is shown in the app.

## 1. Changes

| # | Change |
|---|---|
| P1 | **Suggest a place:** in the Map list footer, the "Missing a place?" line becomes a "Suggest a place" button, with "or add it on OpenStreetMap yourself" kept as a link after it. The form asks for: Name (required); Address or cross streets (required); What it offers (Food pantry / Free meals / Community fridge / Other); Who can use it (Anyone / Students only / Other, with a short note); Link to its own website or official social page (required, `https://`); Note (optional, ≤ 500 characters). Hint under the link: "Its own site or its own Instagram/Facebook page. Not Yelp, Google Maps or news." |
| P2 | **Report a problem:** on every Map card (OSM and County), "Report a problem" opens one in-app form instead of the OSM note or the email: What's wrong (Closed for good / Wrong address or hours / Not free / Other); Note (optional, ≤ 500 characters). The place's name, source and id are filled in and shown. The OSM note link and the County mailto go away (`osmNoteUrl`, `countyReportMailto`, `REPORT_EMAIL` deleted with their tests) |
| P3 | **Send:** both forms reuse M8's anonymous sign-in and Turnstile at the first Send, the 055 lock-while-sending and every-send-ends rules. Notice above Send: "EcoGo's owner reads this by hand. Don't include personal details. Approved places are added to OpenStreetMap, which is public." Consent box as in M8. Sent screen: "Thanks. EcoGo checks these by hand, so it can take a few days." Not sent lines reuse M8's for limits, captcha and no answer |
| P4 | **Server:** a new Edge Function `place-submit` (verify_jwt off, Turnstile check and session as off-submit) validates and inserts one row into a new table `place_reports` (service role only; RLS: anonymous users read only their own rows, as 046). Columns: id, user_id, kind (`suggest`/`report`), place_ref (OSM or County id, null for suggest), fields (jsonb), status (`new`/`approved`/`rejected`, default `new`), created_at, reviewed_at. Limits: 10 a day per person and 50 a day overall (the owner reviews by hand); attempts count toward M8's 30-a-day cap. On each call it deletes rows reviewed more than 90 days ago. Deploy and the migration with Minh's OK |
| P5 | **Review:** the owner opens `place_reports` in the Supabase dashboard and sets status + reviewed_at. Approved suggestions: the owner adds the place on OpenStreetMap; the next snapshot picks it up. Approved County reports: the site goes into `county-hidden.json` (M13 D13). Approved OSM reports: the owner fixes OSM. No owner screen in the app |
| P6 | **Rule change:** CLAUDE.md's browser rule adds `place-submit` (which alone writes `place_reports`) next to `off-submit` |

## 2. Testing

- Node: `place-submit` validation (required fields, `https://` link, note ≤ 500, kind/place_ref pairing, unknown fields
  dropped), limits (10/50, the 30-try cap), the 90-day cleanup, Turnstile failure → captcha.
- check-map: Suggest and Report open their forms, required fields gate Send, a report shows the card's name and source;
  OSM note and mailto links are gone. Sends go to a CDP stub; nothing reaches Supabase. All earlier gates.
- Live (Minh, in his own browser): one suggestion and one report; the planner reads both rows with the Supabase MCP,
  then Minh deletes them.

## 3. Out of scope

Showing suggestions or reports in the app; an owner screen; email alerts; photos; editing OSM from EcoGo; points.

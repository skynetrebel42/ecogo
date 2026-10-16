# M15: Your contributions (points and levels, decision 060)

- **Date:** 2026-10-16
- **Status:** **Approved** by the owner 2026-10-16. Owner picks 2026-10-16 (decision 060, all recommended): private counts +
  milestones, not points; only help someone else checked; kept with this device's anonymous sign-in; private only.
- **Why:** owner backlog item 6 (decision 033). Design risk from the backlog: reward accurate help, not fast help. R4
  research (ChatGPT/Gemini, advice only) found no proven reward model; counts must come from server rows.
- **Base:** M8 `contributions` (status `sent`/`failed`; each person reads only their own rows, decision 046), M8.1
  `place_reports` (status `new`/`approved`/`rejected`, own rows readable). No new table, column or function.

## 1. Changes

| # | Change |
|---|---|
| C1 | **Profile section "Your contributions"** (above the existing rows): two counts and a milestone row. "Products sent to Open Food Facts" = distinct barcodes in the person's `contributions` with status `sent` (new products, added ingredients and new photos all count; failed sends don't). "Map fixes EcoGo approved" = the person's `place_reports` with status `approved` (suggestions and reports). Total = the two added |
| C2 | **Milestones:** five small badges for a total of 1, 5, 10, 25 and 50, labelled "First help", "5 helps", "10 helps", "25 helps", "50 helps"; reached ones filled, the next one outlined with "N more to go". No points number, no levels, no ranks, nothing public |
| C3 | **Honest scope lines** under the section: "Counted from what Open Food Facts took and what EcoGo approved. Kept with this device's anonymous sign-in: clearing site data or a new phone starts from zero." With no session yet (never sent anything): the counts read 0 and the line "Send a product or a map fix to start counting." No sign-in is created just to show the section |
| C4 | **Reading:** with an existing session only, two `select` calls on the person's own rows (RLS already limits them): `contributions.barcode` where status `sent` (distinct counted in the app) and a head `count` of `place_reports` where status `approved`; no writes. A failed read shows "Couldn't load your contributions." and no badges. CLAUDE.md's browser rule adds: "and reads the person's own `contributions` / `place_reports` counts (M15)" |
| C5 | **Feedback after a send:** M8's and M8.1's Sent screens add one line when a new milestone was just reached: "You reached <badge>. See Profile." (counted after the send; skipped if the read fails) |

| C6 | (Minh, 2026-10-16; gap G1) **Keep the tally, drop the text:** place-submit's 90-day cleanup deletes only `rejected` rows; an `approved` row reviewed over 90 days ago keeps kind, status, place_ref and dates, and its `fields` become `{}` (name, address, note, link erased). Counts never expire. place-submit redeploy (v2) with Minh's yes; it can go before or after the push (no new answer) |
| C5a | (planner; gap G2) C5's milestone line is on the **product** Sent screen only: a place send writes a `new` row, which never counts at send time. The place Sent screen is unchanged |

## 2. Testing

- Node: the count → milestone function (0, 1, 4, 5, 49, 50, 51; "N more to go"); distinct barcodes (two sends of one
  barcode count once).
- check-home (or check-saved, whichever is lighter): Profile with no session shows zeros + the start line and makes no
  Supabase request; with a stubbed session and stubbed counts shows the counts, filled badges and "N more to go"; a
  failed read shows the error line. Requests intercepted, nothing reaches Supabase. All six gates within budget (split,
  don't raise).
- Live (Minh's own browser, his real session): Profile shows his real counts; the planner checks them against his rows
  with the Supabase MCP.

## 3. Out of scope

Points, levels, leaderboards, nicknames, accounts that follow you across devices, rewards for scans or self-checks.

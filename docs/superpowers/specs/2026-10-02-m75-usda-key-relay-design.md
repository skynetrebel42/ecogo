# M7.5: USDA key relay (the key leaves the public JavaScript): design spec

- **Date:** 2026-10-02
- **Status:** draft for the owner's approval; built right after M7.4 (order: M7.4 → M7.5 → M9 → M10 → M8). **M10 retires
  this relay** (`2026-10-02-m10-data-ownership-design.md`), so M7.5 stays minimal and builds nothing ahead for M10.
- **Decided with:** the owner (Minh Bui) via the PM chat, 2026-10-02: a small Supabase Edge Function relays only the USDA
  calls the app makes; the key becomes a Supabase secret; Minh creates the new key and pastes it himself.

## 1. Why

`VITE_FDC_API_KEY` is inlined into the public JavaScript at build time and sent from every visitor's browser as
`?api_key=` (`lookup.ts` lines 95 and 108; call sites `App.tsx:244`, `ScanTab.tsx:66`, `NutritionPanel.tsx:27`). USDA's API
guide says keys found public are deactivated (read 2026-10-02). A deactivated key breaks every USDA lookup: the scan shows
"Couldn't reach the product databases", and only 12+ digit codes fall back to Open Food Facts.

## 2. Decisions

| # | Decision |
|---|---|
| R1 | An Edge Function **`usda-relay`** relays only what `lookup.ts` asks USDA today: `GET foods/search` with `dataType=Branded`, `pageSize` 5 (barcode lookup) or 15 (text search), and `query`. |
| R2 | The key is the Supabase secret **`FDC_API_KEY`**. Minh creates a fresh key (api.data.gov signup) and pastes it into the dashboard himself (Edge Functions → Secrets). **No chat sees, prints or types it.** The function trims it (a pasted secret once carried a newline and USDA answered 403). The old key is deactivated by Minh after the new deploy is verified. |
| R3 | Not an open proxy: the function builds the one fixed upstream URL itself and accepts only `query` (1-100 characters after trimming) and `pageSize` in {5, 15}; GET (and OPTIONS) only; anything else is 400/405. A 200 passes USDA's JSON through unchanged; any non-2xx upstream answer becomes the same status with `{"error":"USDA returned HTTP <n>"}` (never USDA's body, never the key). |
| R4 | Origin allowlist, **both** as CORS headers and enforced: `https://skynetrebel42.github.io`, and `http://localhost:<port>` / `http://127.0.0.1:<port>`. Another or a missing `Origin` gets 403. This stops other *websites* from using the relay from a browser; it does not stop a script that sends its own `Origin` header. Accepted. |
| R5 | `verify_jwt` is **off**: the app's call carries no login, and Supabase's platform check only understands legacy JWT keys. Protection is R2-R4. |
| R6 | `lookup.ts` takes `relayUrl` (a string) instead of `fdcKey` and calls `<relayUrl>?query=<q>&pageSize=<5 or 15>`; it never sends `api_key` or `dataType`. The relay URL, `${VITE_SUPABASE_URL}/functions/v1/usda-relay`, is exported once as `USDA_RELAY_URL` from `src/lib/supabase.ts`; the three call sites pass it. |
| R7 | **`DEMO_KEY` is removed** (the console warning and the fallback): it allows 30 requests an hour per IP, so it cannot carry a public app. If the relay is down or unconfigured, the existing error state shows ("Couldn't reach the product databases", Try again). `npm run dev` then needs no key: localhost is allowed by R4 and calls the live relay. |
| R8 | No cache, rate limiter or database in the function. |

## 3. The trade-off to accept

Today every visitor has USDA's own limit (1,000 requests an hour **per IP address**). Through the relay all visitors share
what USDA counts for the relay's outbound address(es): plan for **1,000 an hour in total** (Supabase may spread calls over
several addresses; unverified). A first-time lookup costs 1-2 requests (the typed digits, then the 14-digit form), a catalog
product's nutrition 1-2, a text search 1: roughly 500-1,000 first-time lookups an hour for everyone. Beyond that USDA
answers 429, the app shows its error state, and Open Food Facts covers 12+ digit codes. Fine for a showcase. M10 removes
the limit. Also: anyone with `curl` can spend the shared quota (R4 stops browsers only). If that ever happens: a per-IP
limit in the function, or pull M10 forward. Edge Function invocations are not the constraint (free plan: 500,000 a month,
Supabase docs, 2026-10-02).

## 4. Changes

- **New** `supabase/functions/usda-relay/index.ts`: an exported pure `handle(req, { key }, fetchImpl)` (so Node tests load
  it) and, guarded by `typeof Deno !== "undefined"`, the `Deno.serve` wiring that reads `FDC_API_KEY`.
  **New** `supabase/functions/usda-relay/index.test.ts`; the `npm test` glob also covers `supabase/functions/**/*.test.ts`.
- `src/lib/lookup.ts`, `lookup.test.ts` (R6, R7); `src/lib/supabase.ts` (`USDA_RELAY_URL`); `App.tsx`, `ScanTab.tsx`,
  `NutritionPanel.tsx` (pass it).
- `.github/workflows/deploy.yml`: remove the key-check step and `VITE_FDC_API_KEY` from the build step.
- Docs: README (running the app needs no key), ARCHITECTURE, PROJECT_HANDOFF (a decision row, next free number),
  KNOWN_ISSUES (mark moot: the whitespace-only secret check, the README's "30 lookups an hour", "USDA 429/403 … under
  `DEMO_KEY` Open Food Facts silently takes over"; add the shared-quota trade-off). `.env.local` no longer needs
  `VITE_FDC_API_KEY` (Minh can delete it).

## 5. Rollout (the live site never breaks; every deploy and push needs Minh's OK, asked right before)

1. Minh creates the new key and adds the secret `FDC_API_KEY` himself.
2. Build and test the function; Minh approves; deploy `usda-relay` with `verify_jwt` off (the Supabase connector's deploy
   tool or the CLI).
3. Verify the relay without exposing the key, with `curl`: `Origin: https://skynetrebel42.github.io` and
   `?query=049000042566&pageSize=5` → 200 and JSON with `foods`; a different `Origin` → 403; `pageSize=99` → 400; no
   `api_key` anywhere in the response.
4. App change on `main`, tests and build green; Minh approves the push.
5. Live checks after the deploy: type a non-catalog barcode (Tostitos `028400064057`) → found; search "oreo" → "More from
   USDA" lists products; the network panel shows requests to `…/functions/v1/usda-relay` and none to `api.nal.usda.gov`
   or with `api_key=`; `dist/assets/*.js` contains neither `api.nal.usda.gov` nor `DEMO_KEY`.
6. Minh deletes the repository secret `VITE_FDC_API_KEY` and deactivates the old key.

Rollback: revert the app commit; the old key keeps working until step 6.

## 6. Testing

- **Function (`index.test.ts`, Node):** allowed origin → 200 with the CORS header; another or missing origin → 403;
  non-GET → 405 and OPTIONS → 204; missing or over-long `query`, a bad `pageSize` → 400; extra parameters are not forwarded
  (the upstream URL has exactly `api_key`, `dataType`, `pageSize`, `query`); upstream 429 → 429 with a body that holds no
  key; upstream throws → 502; missing secret → 500 "relay is not configured"; a secret of `" KEY\n"` is sent as `KEY`.
- **`lookup.test.ts`:** every USDA request goes to the relay URL with `query` and `pageSize` (5 for a barcode, 15 for text)
  and never contains `api_key` or `api.nal.usda.gov`; the typed-then-14-digit retry, the session cache, "errors aren't
  cached", the 8-digit rule and the OFF fallback behave as today; the old key-trimming and `api_key` assertions are
  removed.
- `npm test` and `npm run build` green; `check-home.mjs` passes against a local preview (it calls the live relay).

## 7. Out of scope

Caching, rate limiting, per-user quotas, the `foods` table (M10), Open Food Facts (unchanged), automatic key rotation.

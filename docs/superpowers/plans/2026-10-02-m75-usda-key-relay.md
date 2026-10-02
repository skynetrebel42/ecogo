# M7.5 USDA key relay: build plan

- **Spec:** `docs/superpowers/specs/2026-10-02-m75-usda-key-relay-design.md` (R1–R8, rollout §5, tests §6).
- **Builder:** the Royal Knight (debugger 1 build chat), on `main`, 2026-10-02. Short plan written by the build chat.
- **Rules:** test first; commit by path; `npm test` + `npm run build` green after each commit; never read, print or
  type the USDA key; ask the owner right before the function deploy and right before the push (with the push list).

## Commits

1. **The relay** `supabase/functions/usda-relay/index.ts` + `index.test.ts`; the `npm test` glob adds
   `supabase/functions/**/*.test.ts`. Pure `handle(req, { key }, fetchImpl)`; `Deno.serve` only when `Deno` exists.
2. **The app uses it** (R6, R7): `lookup.ts` takes `relayUrl` (`?query=…&pageSize=5|15`), no `api_key`, no
   `DEMO_KEY`; `USDA_RELAY_URL` in `src/lib/supabase.ts`; `App.tsx`, `ScanTab.tsx`, `NutritionPanel.tsx` pass it;
   `lookup.test.ts` asserts relay URL + pageSize and no key or USDA host.
3. **Deploy workflow:** `deploy.yml` loses the key-check step and `VITE_FDC_API_KEY`.
4. **Docs:** README, ARCHITECTURE, PROJECT_HANDOFF (decision 026), KNOWN_ISSUES (moot items, shared-quota trade-off,
   roadmap), SYNOPSIS, spec Status.

## Rollout (spec §5)

1. Done by the owner: the secret `FDC_API_KEY`.
2. One final reviewer (opus, effort medium) on commits 1–3 **before** the deploy (the relay is the security surface).
3. Ask the owner → deploy `usda-relay` (`verify_jwt` off) with the Supabase connector.
4. `curl` checks (no key needed): allowed `Origin` + `query=049000042566&pageSize=5` → 200 with `foods`; other `Origin`
   → 403; `pageSize=99` → 400; no `api_key` in any response.
5. `check-home.mjs` against `npm run build` + `vite preview` (it calls the live relay); `dist/assets/*.js` has neither
   `api.nal.usda.gov` nor `DEMO_KEY`.
6. Ask the owner with the push list → push → live checks (§5 step 5) → remind the owner of step 6.

## Rulings

- **Key echo guard (adds to R3):** if USDA's 200 body ever contains the key, the relay answers 502 instead of passing it
  through. USDA's fixtures were trimmed, so whether it echoes request parameters isn't known; the guard makes "never the
  key" hold either way. One test.

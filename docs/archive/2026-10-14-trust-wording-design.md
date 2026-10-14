# Trust wording fixes (ChatGPT audit TRUST-01, TRUST-02, R2-01/PRIVACY-01, R2-02)

- **Date:** 2026-10-14
- **Status:** **Done**, live 2026-10-14 (origin/main 7af98f4); approved by the owner 2026-10-14 as written (decision 053; "Live data" removed)
- **Why:** ChatGPT's trust/UI audit and R2 browser review (2026-10-11 → 14, triaged in KNOWN_ISSUES "Outside audits")
  found live wording that says more than EcoGo knows. EcoGo's promise is that nothing it shows is invented; these lines
  overstate. Copy only: no engine, data or layout changes. Every factual phrase below comes from EcoGo's own sourced
  library or code.

## 1. Changes (current → new)

| # | Where | Current | New |
|---|---|---|---|
| W1 | Badge levels page, "The key point" (`Explainer.tsx`) | "the levels describe how strong the evidence is that something can cause cancer, not how much harm one serving does. Processed meat and tobacco are both Group 1, but IARC says that doesn't make them equally dangerous." | "Each level shows the strongest official finding EcoGo matched, and the table says what kind it is. IARC's groups rate how strong the evidence is that something can cause cancer. EU warning labels and EU or US bans are regulators' decisions, and not all of them are about cancer: the EU label on Red 40, for example, warns about activity and attention in children. None of them measures how much harm one serving does. Processed meat and tobacco are both IARC Group 1, but IARC says that doesn't make them equally dangerous." |
| W2 | Badge levels table, "none" row (`LEVELS`) | "No official finding for its additives or the food itself" | "Nothing matched EcoGo's list of official findings (this doesn't mean none exist)" |
| W3 | Profile subtitle (`App.tsx` ProfileTab) | "No account yet. What you do stays on this device." | "No account. Your saved products, lists and history stay in this browser. Privacy, below, lists what's sent." |
| W4 | Header label shown when the catalog loaded (`App.tsx`) | green "Live data" | **removed**; the amber "Offline — showing the built-in catalog" banner stays. Source dates stay where they are (County *, USDA snapshot) |
| W5 | Profile → Privacy, map line | "…It stays on your phone. Map images load from OpenStreetMap." | "…Your location stays on your phone. Map images load from OpenStreetMap's servers, which see the map area you're viewing, as with any web map." |

## 2. Testing

check-home asserts the new W1, W2, W3, W5 strings and that "Live data" is gone while the offline banner still shows when
Supabase is unreachable. All other gates unchanged.

## 3. Out of scope

COPY-01 (seed oils fat profile: needs an official quote first), SOURCE-01 (verify:sources coverage), R2-03/R2-04,
ACCESS-01 (separate small fix), any badge-mapping change.

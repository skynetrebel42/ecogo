# M8: Add a product to Open Food Facts + check ingredients without a barcode: design spec

- **Date:** 2026-10-02, refreshed 2026-10-07 after M9–M14 (decisions 044, 045; upstream re-checked, §9)
- **Status:** **Approved** by the owner 2026-10-02; refresh approved 2026-10-07
- **Mockup:** https://claude.ai/artifact/Ki9oBNTrJzSqWBTXYoTd1F (owner chose **layout A**, one step per screen)
- **Decided with:** the owner (Minh Bui), 2026-10-02. M8 = adding data. Accounts with **points and levels** are item 6
  of decision 033 (counted from M8's `contributions` table); "M9" is now the Map, not accounts.

## 1. Why

A barcode that isn't in the catalog, USDA FoodData Central or Open Food Facts (OFF) is a dead end today. The
not-found screen links out to OFF's website form. The owner wants people to add the product **inside EcoGo**: photograph
the label, have the ingredients read automatically, fix them, see the safety check, and submit. People also want to
check foods that have **no barcode** (bakery, farmers' market).

Facts first still holds: **EcoGo never hosts user-entered food data.** Submissions go to OFF, the open database EcoGo
already reads and labels as crowd-sourced, where OFF's own community and tools review them. Results come back to
EcoGo through the existing lookup (`lib/lookup.ts`).

**Done for M8:** from the not-found screen, a person can add a product to OFF (3 photos, ingredients read on the phone
and checked by them, the safety check shown right away), and anyone can check an ingredient list without a barcode.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Submitted data goes to **Open Food Facts only**, under one shared **EcoGo app account** (OFF docs: "You can create a global account to allow your app users to contribute without registering individual accounts"). Each request carries `app_name=EcoGo`, `app_version` and a per-person `app_uuid` so OFF can block one person without blocking the app. Every OFF request also sends `User-Agent: EcoGo/<version> (<owner's contact email>)` (OFF: "Always use a custom User-Agent") |
| D2 | **No barcode = check only.** Ingredients photographed or typed go through the existing safety engine; **nothing is saved or sent**, no points |
| D3 | A submission is **3 photos (front, ingredients, nutrition) + the ingredients text the person checked + an optional product name**. EcoGo reads **only the ingredients photo** on the phone; OFF's own tools read the nutrition photo. No nutrition numbers are typed or read in EcoGo |
| D4 | Text reading: **Tesseract.js** (Apache-2.0), English, **self-hosted** (worker, WebAssembly core and language data bundled by Vite like M6's ZXing `.wasm`; no CDN), **loaded only when a photo is read**. Words below a confidence threshold are underlined for the person to check. Pin **tesseract.js 7.x** with `createWorker("eng", 1, { workerPath, corePath, langPath })`: `corePath` is a *directory* holding all four core builds (the library picks SIMD/LSTM per device), `langPath` serves `eng.traineddata.gz`. The site runs at `/ecogo/` with Vite `base: './'`, so the three paths are built from `import.meta.env.BASE_URL`, never `/…`. The builder reports the first-use download size |
| D5 | Photos are taken with the phone's **own camera app** (`<input type="file" accept="image/*" capture="environment">`) or chosen from the library. The mockup's in-app viewfinder is replaced by an instruction screen with a **Take photo** button: this is the native, reliable path on iPhone and Android, and photos come out full resolution. Photos are downscaled on the phone to at most 2000 px on the long side, JPEG, before upload; anything under OFF's minimum (640 × 160 px) is refused with a message |
| D6 | **Server function** `off-submit` (Supabase Edge Function, free tier) holds the OFF password as a secret, enforces limits, logs the submission and calls OFF. The browser never talks to OFF's write API. It authenticates with `user_id` + `password` form fields on each POST (OFF's session cookie must stay on one IP, and Edge Functions have none fixed). Endpoints: `POST /cgi/product_jqm2.pl` (the write path in OFF's own current tutorial) and `POST /cgi/product_image_upload.pl` (`imagefield` + `imgupload_<imagefield>`), unchanged for clients that don't ask for API v3.3. *ponytail:* OFF's new `POST /api/v3.3/<code>/images` is the upgrade path once its schema is documented |
| D7 | **Hidden anonymous ID:** Supabase anonymous sign-in, requested **only at the first Send** (never at app start). Points and levels (033 item 6) can upgrade the same ID to a real account by linking an identity, keeping its history. Supabase doesn't clean up anonymous users automatically; that's fine at this size |
| D8 | **Human check:** Cloudflare **Turnstile** (free, usually invisible) on that one anonymous sign-in, through Supabase Auth's built-in CAPTCHA support (Supabase docs "strongly recommend" it with anonymous sign-ins). The Turnstile script loads only on the Send screen |
| D9 | **Limits:** 10 submissions per ID per day and **200 per day across everyone**, counted in `contributions`. Supabase's own limit of 30 anonymous sign-ins per hour per IP stays on |
| D10 | **Never overwrite OFF data:** the function first reads the product from OFF. If it already exists with ingredients, it only uploads the photos and leaves the text alone |
| D11 | **Public notice + consent:** the Send screen says the photos and text become public on OFF under its open licenses (photos CC BY-SA, data ODbL) and asks people not to show faces, receipts or anything personal. A required checkbox: "I took these photos, and they show only the product." (OFF terms: "Photos added by contributors must have been taken by the contributors themselves.") |
| D12 | Build and test against **OFF's test server** (`world.openfoodfacts.net`, its own accounts, plus OFF's public HTTP basic auth `off`/`off`, a constant, not a secret). Production is one secret change (`OFF_BASE`), made only after the owner's go-ahead |
| D13 | **Ways in (decision 044):** the not-found screen (**Add this product**, primary; today's "add it on Open Food Facts" website link stays as a small fallback) and the Scan drawer (**No barcode? Check ingredients**). **No Home entry**: Home stays Scan card, search, recents, Learn. Crowd-sourced product pages keep M11's **Update info** button unchanged |
| D14 | After Send: "Sent to Open Food Facts. Volunteers there review new products, so it can take a while before everyone sees it in EcoGo." No points or levels in M8 |
| D15 | Profile privacy text becomes true for people who submit: what goes to OFF (photos, ingredients, barcode, name; public), what EcoGo keeps (an anonymous ID and a log of your submissions: barcode, time, result), and that Cloudflare runs a human check at the first Send |
| D16 | **M8.1 follows right after M8 (decision 045):** in-app "Suggest a place" (039) and "Report a problem" for Map places (042) reuse M8's anonymous sign-in, Turnstile and server-function pattern. Its own spec, written after M8 ships. Nothing for the Map changes in M8 |
| D17 | **CLAUDE.md rule change when M8 ships (not before):** "Browser writes nothing to Supabase" becomes "The browser writes no table rows: its only Supabase calls beyond reading `foods` are the anonymous sign-in at the first Send and invoking `off-submit`." The no-API-key rule stays: only the public Turnstile site key ships in client code |

## 3. User flows (layout A)

**Add a product** (from the not-found screen; barcode known):
1. **Front photo** → 2. **Ingredients photo** → the text is read on the phone (spinner "Reading the label…"; the first use downloads the reader once) → 3. **Check the ingredients**: an editable text box, unsure words underlined, the concern badge updating as they type (`assessProduct` over the text). "Retake" goes back. If reading fails or finds no text, the box is empty with "Couldn't read it. Type the ingredients or retake the photo." → 4. **Nutrition photo** (Skip allowed) → 5. **Send**: thumbnails, optional product name, public notice, consent checkbox, Send (disabled until checked and the ingredients aren't empty) → 6. **Sent** (D14) or an error with Try again.
- Front and nutrition photos may be skipped; the ingredients text is required (it is what the safety check and OFF need most). The ingredients photo itself may be skipped if the person types the text.
- Errors: limit reached → "You've sent 10 today. Thanks! Try again tomorrow." (or "EcoGo has reached today's limit"); human check failed → "Couldn't confirm you're not a robot. Try again."; OFF unreachable → logged `failed`, "Open Food Facts didn't answer. Try again later." Nothing is lost while the screen stays open.

**Check without a barcode** (Scan drawer): **Take a photo** | **Type it** → the same check box and badge →
"Without a barcode there's no nutrition label to look up, so this checks ingredients only. Nothing is saved or sent."
The "Nothing flagged" result links to the existing "Nothing flagged isn't healthy" explainer.

## 4. Architecture

```
Browser                                              Supabase                         Open Food Facts
 AddProductFlow / IngredientCheck (React)
   ├─ lib/ocr.ts ── tesseract.js (lazy, self-hosted) ─ on the phone only
   ├─ lib/safety (assessProduct) ─ on the phone only
   └─ lib/contribute.ts
        ├─ Turnstile token (Send screen only)
        ├─ supabase.auth.signInAnonymously({ options: { captchaToken } })  ─► Auth (anon user)
        └─ supabase.functions.invoke("off-submit", FormData)  ─► off-submit ──► GET product (exists?)
                                                               │  limits,      POST /cgi/product_jqm2.pl
                                                               │  log row      POST /cgi/product_image_upload.pl ×≤3
                                                               └─ contributions (user sees own rows)
```

**New units** (each with one job):

| Unit | Job | Interface |
|---|---|---|
| `src/lib/ocr.ts` | Read text from a photo on the phone | `readLabel(image: Blob): Promise<{ text: string; unsure: string[] }>`; pure `cleanIngredients(raw)` (drops a leading "Ingredients:", rejoins hyphenated line breaks, newlines → spaces, trims) |
| `src/lib/photo.ts` | Prepare a photo for upload | `preparePhoto(file: File): Promise<Blob>` (≤ 2000 px, JPEG); pure `fitWithin(w, h, max)`, `bigEnough(w, h)` (640 × 160) |
| `src/lib/contribute.ts` | Send a submission | `submitProduct({ code, name?, ingredients, photos }, getCaptchaToken)` → `{ ok: true } \| { ok: false; reason: "limit-you" \| "limit-all" \| "captcha" \| "off-down" \| "invalid" }`; signs in anonymously only when there is no session |
| `src/app/components/AddProductFlow.tsx` | Layout A steps 1–6 | `{ code, onDone, onClose }` |
| `src/app/components/IngredientCheck.tsx` | No-barcode check; also the shared check box + live badge used in step 3 | `{ onClose }`; exports `IngredientEditor` |
| `supabase/functions/off-submit/index.ts` | Verify the caller, limits, log, call OFF | multipart POST: `code`, `ingredients`, `name?`, `front?`, `ingredients_photo?`, `nutrition?` |
| `supabase/functions/off-submit/off.ts` | Pure OFF request builders and the limit rule, importable by `node --test` | `productForm(...)`, `imageForm(...)`, `limitReason(mine, all)` |
| migration `contributions` | The submission log | below |

`App.tsx` gains one sub-screen value per flow (`"add-product"`, `"check-ingredients"`) and passes `onAdd(code)` and
`onCheckIngredients` to `ScanTab`. `HomeTab` is untouched (D13). No other App state.

## 5. Database

```sql
create table public.contributions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  barcode     text not null check (barcode ~ '^[0-9]{8,14}$'),
  status      text not null default 'pending' check (status in ('pending','sent','failed')),
  error       text,
  created_at  timestamptz not null default now()
);
create index contributions_user_day on public.contributions (user_id, created_at);
alter table public.contributions enable row level security;
grant select on public.contributions to authenticated;          -- no insert/update/delete for browsers
create policy "Read your own contributions" on public.contributions
  for select to authenticated using (user_id = (select auth.uid()));
```

Only `off-submit` (service role) writes rows. Not in the realtime publication. It holds no photos, text or location.

## 6. Owner setup (only the owner can do these; step-by-step instructions come with the build prompt)

1. Create an OFF account on the **test server** and one on **production** (separate account databases), and fill in
   OFF's API usage form for the app (OFF asks for it before an app relies on its account). The User-Agent contact (D1)
   is the dedicated EcoGo address from 042 (owner, 2026-10-07), so create that address first.
2. Create a free Cloudflare Turnstile widget for `skynetrebel42.github.io` and `localhost`; copy the site key and secret.
3. Supabase dashboard: enable **anonymous sign-ins**; enable **CAPTCHA protection** with Turnstile and its secret.
4. Supabase function secrets: `OFF_USER`, `OFF_PASSWORD`, `OFF_CONTACT` (the User-Agent email),
   `OFF_BASE=https://world.openfoodfacts.net` (test). The Turnstile
   **site key** (public) goes in `.env` as `VITE_TURNSTILE_SITE_KEY`, and as a repository variable for the deploy.

## 7. Testing

- **Node tests:** `cleanIngredients` (prefixes, hyphenated breaks, newlines), `fitWithin`/`bigEnough`, `limitReason`
  (9/10/200 edges), `productForm`/`imageForm` (fields, `app_name`, `app_uuid`, `ingredients_text_en`, `imagefield`
  names), and `submitProduct` reason mapping with a stubbed client.
- **OCR check:** a recorded ingredients photo fixture read headlessly in the dry run (text contains its known words).
- **Headless check (`check-home.mjs`, extended):** the Scan drawer shows "No barcode? Check ingredients" and Home does
  not; typing a list containing "Red 40" shows "Some concern"; the not-found screen shows "Add this product"; the Send
  button stays disabled until the checkbox is ticked. Every earlier gate still passes (baseline 2026-10-07: `npm test`
  252, check-home 37, check-map 36, check-saved 18).
- **End to end against OFF's test server** (needs the owner's setup 1–4): one submission appears on
  `world.openfoodfacts.net` with its photos; an 11th submission from the same ID is refused; `get_advisors` shows no new
  warnings.

## 8. Out of scope

Accounts, points and levels (033 item 6); "Suggest a place" and in-app "Report a problem" (M8.1, D16); a Home entry
(044); typing or reading nutrition numbers; saving no-barcode checks; editing existing OFF products from EcoGo;
non-English labels; switching `OFF_BASE` to production (a separate, owner-approved step).

## 9. Upstream re-check (2026-10-07)

- **OFF** ([API intro](https://openfoodfacts.github.io/openfoodfacts-server/api/)): global app account and
  `app_name`/`app_version`/`app_uuid` unchanged; staging needs basic auth `off`/`off`; custom User-Agent and API usage
  form asked for; v2 deprecated in favour of v3 (`lookup.ts` already reads OFF through `/api/v3/product/`); OIDC
  login "in the future". Write path per OFF's current tutorial is still
  `product_jqm2.pl`.
- **Supabase** ([anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)): CAPTCHA/Turnstile still
  "strongly recommended"; 30 sign-ins per hour per IP (adjustable); no automatic cleanup of anonymous users.
- **Tesseract.js**: current 7.0.0; self-hosting via `workerPath`/`corePath`/`langPath` (D4).

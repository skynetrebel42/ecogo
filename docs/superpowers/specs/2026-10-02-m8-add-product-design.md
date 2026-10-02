# M8: Add a product to Open Food Facts + check ingredients without a barcode: design spec

- **Date:** 2026-10-02
- **Status:** approved by the owner 2026-10-02; plan to follow
- **Mockup:** https://claude.ai/artifact/Ki9oBNTrJzSqWBTXYoTd1F (owner chose **layout A**, one step per screen)
- **Decided with:** the owner (Minh Bui), 2026-10-02. M8 = adding data; **M9 = accounts with points and levels**
  (counted from M8's `contributions` table).

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
| D1 | Submitted data goes to **Open Food Facts only**, under one shared **EcoGo app account** (OFF docs: "You can create a global account to allow your app users to contribute without registering individual accounts"). Each request carries `app_name=EcoGo`, `app_version` and a per-person `app_uuid` so OFF can block one person without blocking the app |
| D2 | **No barcode = check only.** Ingredients photographed or typed go through the existing safety engine; **nothing is saved or sent**, no points |
| D3 | A submission is **3 photos (front, ingredients, nutrition) + the ingredients text the person checked + an optional product name**. EcoGo reads **only the ingredients photo** on the phone; OFF's own tools read the nutrition photo. No nutrition numbers are typed or read in EcoGo |
| D4 | Text reading: **Tesseract.js** (Apache-2.0), English, **self-hosted** (worker, WebAssembly core and language data bundled by Vite like M6's ZXing `.wasm`; no CDN), **loaded only when a photo is read**. Words below a confidence threshold are underlined for the person to check |
| D5 | Photos are taken with the phone's **own camera app** (`<input type="file" accept="image/*" capture="environment">`) or chosen from the library. The mockup's in-app viewfinder is replaced by an instruction screen with a **Take photo** button: this is the native, reliable path on iPhone and Android, and photos come out full resolution. Photos are downscaled on the phone to at most 2000 px on the long side, JPEG, before upload; anything under OFF's minimum (640 × 160 px) is refused with a message |
| D6 | **Server function** `off-submit` (Supabase Edge Function, free tier) holds the OFF password as a secret, enforces limits, logs the submission and calls OFF. The browser never talks to OFF's write API |
| D7 | **Hidden anonymous ID:** Supabase anonymous sign-in, requested **only at the first Send** (never at app start). M9 can upgrade the same ID to a real account and keep its history |
| D8 | **Human check:** Cloudflare **Turnstile** (free, usually invisible) on that one anonymous sign-in, through Supabase Auth's built-in CAPTCHA support (Supabase docs "strongly recommend" it with anonymous sign-ins). The Turnstile script loads only on the Send screen |
| D9 | **Limits:** 10 submissions per ID per day and **200 per day across everyone**, counted in `contributions`. Supabase's own limit of 30 anonymous sign-ins per hour per IP stays on |
| D10 | **Never overwrite OFF data:** the function first reads the product from OFF. If it already exists with ingredients, it only uploads the photos and leaves the text alone |
| D11 | **Public notice + consent:** the Send screen says the photos and text become public on OFF under its open licenses (photos CC BY-SA, data ODbL) and asks people not to show faces, receipts or anything personal. A required checkbox: "I took these photos, and they show only the product." (OFF terms: "Photos added by contributors must have been taken by the contributors themselves.") |
| D12 | Build and test against **OFF's test server** (`world.openfoodfacts.net`, its own accounts). Production is one secret change (`OFF_BASE`), made only after the owner's go-ahead |
| D13 | **Ways in:** the not-found screen (**Add this product**, primary; the OFF-website link stays as a small fallback), the Scan drawer (**No barcode? Check ingredients**), and a Home card under the Scan card. OFF product pages keep today's "Fix it on Open Food Facts" link |
| D14 | After Send: "Sent to Open Food Facts. Volunteers there review new products, so it can take a while before everyone sees it in EcoGo." No points or levels in M8 |
| D15 | Profile privacy text becomes true for people who submit: what goes to OFF (photos, ingredients, barcode, name; public), what EcoGo keeps (an anonymous ID and a log of your submissions: barcode, time, result), and that Cloudflare runs a human check at the first Send |

## 3. User flows (layout A)

**Add a product** (from the not-found screen; barcode known):
1. **Front photo** → 2. **Ingredients photo** → the text is read on the phone (spinner "Reading the label…"; the first use downloads the reader once) → 3. **Check the ingredients**: an editable text box, unsure words underlined, the concern badge updating as they type (`assessProduct` over the text). "Retake" goes back. If reading fails or finds no text, the box is empty with "Couldn't read it. Type the ingredients or retake the photo." → 4. **Nutrition photo** (Skip allowed) → 5. **Send**: thumbnails, optional product name, public notice, consent checkbox, Send (disabled until checked and the ingredients aren't empty) → 6. **Sent** (D14) or an error with Try again.
- Front and nutrition photos may be skipped; the ingredients text is required (it is what the safety check and OFF need most). The ingredients photo itself may be skipped if the person types the text.
- Errors: limit reached → "You've sent 10 today. Thanks! Try again tomorrow." (or "EcoGo has reached today's limit"); human check failed → "Couldn't confirm you're not a robot. Try again."; OFF unreachable → logged `failed`, "Open Food Facts didn't answer. Try again later." Nothing is lost while the screen stays open.

**Check without a barcode** (Scan drawer or Home card): **Take a photo** | **Type it** → the same check box and badge →
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
        ├─ supabase.auth.signInAnonymously({ captchaToken })  ─► Auth (anon user)
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

`App.tsx` gains one sub-screen value per flow (`"add-product"`, `"check-ingredients"`) and passes `onAdd(code)` to
`ScanTab` and `onCheckIngredients` to `HomeTab` and `ScanTab`. No other App state.

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

1. Create an OFF account on the **test server** and one on **production** (separate account databases).
2. Create a free Cloudflare Turnstile widget for `skynetrebel42.github.io` and `localhost`; copy the site key and secret.
3. Supabase dashboard: enable **anonymous sign-ins**; enable **CAPTCHA protection** with Turnstile and its secret.
4. Supabase function secrets: `OFF_USER`, `OFF_PASSWORD`, `OFF_BASE=https://world.openfoodfacts.net` (test). The Turnstile
   **site key** (public) goes in `.env` as `VITE_TURNSTILE_SITE_KEY`, and as a repository variable for the deploy.

## 7. Testing

- **Node tests:** `cleanIngredients` (prefixes, hyphenated breaks, newlines), `fitWithin`/`bigEnough`, `limitReason`
  (9/10/200 edges), `productForm`/`imageForm` (fields, `app_name`, `app_uuid`, `ingredients_text_en`, `imagefield`
  names), and `submitProduct` reason mapping with a stubbed client.
- **OCR check:** a recorded ingredients photo fixture read headlessly in the dry run (text contains its known words).
- **Headless check (`check-home.mjs`, extended):** Home shows "No barcode? Check ingredients"; typing a list containing
  "Red 40" shows "Some concern"; the not-found screen shows "Add this product"; the Send button stays disabled until the
  checkbox is ticked. Every earlier check still passes.
- **End to end against OFF's test server** (needs the owner's setup 1–4): one submission appears on
  `world.openfoodfacts.net` with its photos; an 11th submission from the same ID is refused; `get_advisors` shows no new
  warnings.

## 8. Out of scope

Accounts, points and levels (M9); typing or reading nutrition numbers; saving no-barcode checks; editing existing OFF
products from EcoGo; non-English labels; switching `OFF_BASE` to production (a separate, owner-approved step).

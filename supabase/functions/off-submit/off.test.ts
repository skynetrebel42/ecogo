import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTEMPTS_DAILY, limitReason, offHeaders, productForm, imageForm, photoResult, sendPlan, sendReply, validForm, withLater } from "./off.ts";

// M8 follow-up 2 (docs/superpowers/specs/2026-10-08-m8-followup2-photo-quality-design.md G1, G2).
test("a photo OFF took, or already had, counts as taken; an HTTP error or a refusal doesn't", () => {
  assert.deepEqual(photoResult("front", 200, { status: "status ok" }), { kind: "front", taken: true });
  assert.deepEqual(photoResult("front", 200, { status: "status not ok", error: "This picture has already been sent." }),
    { kind: "front", taken: true, note: "front: This picture has already been sent." });
  assert.deepEqual(photoResult("nutrition", 500, null), { kind: "nutrition", taken: false, httpError: true, note: "nutrition: HTTP 500" });
  assert.deepEqual(photoResult("nutrition", 0, null), { kind: "nutrition", taken: false, httpError: true, note: "nutrition: HTTP 0" });
  assert.deepEqual(photoResult("ingredients", 200, { status: "status not ok", error: "too small" }),
    { kind: "ingredients", taken: false, note: "ingredients: too small" });
});

test("text taken and the nutrition photo failing is still sent, naming the failed photo", () => {
  const photos = [photoResult("front", 200, { status: "status ok" }), photoResult("nutrition", 500, null)];
  assert.deepEqual(sendReply(true, photos), { ok: true, failedPhotos: ["nutrition"] });
  assert.deepEqual(sendReply(true, [photos[0]]), { ok: true });
});

// M8 follow-up 3 (docs/superpowers/specs/2026-10-09-m8-followup3-blur-speed-design.md H1).
test("photos still to upload in the background are named in the reply", () => {
  assert.deepEqual(sendReply(true, [photoResult("ingredients", 200, { status: "status ok" })], ["front", "nutrition"]),
    { ok: true, pendingPhotos: ["front", "nutrition"] });
  assert.deepEqual(sendReply(true, [photoResult("ingredients", 500, null)], ["nutrition"]),
    { ok: true, failedPhotos: ["ingredients"], pendingPhotos: ["nutrition"] });
});

test("a background photo that fails is added to the row's log; one that went in adds nothing", () => {
  assert.equal(withLater("had ingredients: photos only", [photoResult("nutrition", 500, null)]), "had ingredients: photos only; nutrition: HTTP 500");
  assert.equal(withLater(undefined, [photoResult("front", 200, { status: "status ok" })]), undefined);
  assert.equal(withLater(undefined, [photoResult("front", 502, null)]), "front: HTTP 502");
});

test("with OFF's own text kept, one photo taken is enough; nothing taken is not sent", () => {
  assert.deepEqual(sendReply(false, [photoResult("front", 200, { status: "status ok" }), photoResult("nutrition", 500, null)]),
    { ok: true, failedPhotos: ["nutrition"] });
  assert.deepEqual(sendReply(false, [photoResult("front", 500, null)]), { ok: false, reason: "off-down" });
  assert.deepEqual(sendReply(false, []), { ok: false, reason: "nothing-new" });
});

// 055 E3 (E3a: 048 G1 stands, a duplicate counts as taken): a photo OFF refuses is no longer "already has these photos".
test("nothing taken because OFF refused a photo is photo-rejected; all duplicates is still sent; HTTP errors stay off-down", () => {
  const refused = photoResult("front", 200, { status: "status not ok", error: "bad" });
  const duplicate = photoResult("nutrition", 200, { status: "status not ok", error: "This picture has already been sent." });
  assert.deepEqual(sendReply(false, [refused]), { ok: false, reason: "photo-rejected" });
  assert.deepEqual(sendReply(false, [duplicate]), { ok: true });
  assert.deepEqual(sendReply(false, [refused, photoResult("nutrition", 502, null)]), { ok: false, reason: "off-down" });
  assert.deepEqual(sendReply(true, [refused]), { ok: true, failedPhotos: ["front"] }, "text taken: partial success, as before");
  // OFF said nothing about the photo (a 200 that isn't JSON, e.g. a maintenance page): not "couldn't use this photo".
  assert.deepEqual(photoResult("front", 200, null), { kind: "front", taken: false, httpError: true, note: "front: no answer" });
  assert.deepEqual(sendReply(false, [photoResult("front", 200, null)]), { ok: false, reason: "off-down" });
});

// M8 follow-up 5 (docs/superpowers/specs/2026-10-09-m8-followup5-fix-off-products-design.md J3).
const form = { code: "0123456789012", ingredients: "", name: "", photosMode: false, photos: 1 };
test("empty ingredients are invalid in a normal send, as before; photos mode accepts them with at least one photo", () => {
  assert.equal(validForm({ ...form, ingredients: "Water" }), true);
  assert.equal(validForm(form), false);
  assert.equal(validForm({ ...form, photosMode: true }), true);
  assert.equal(validForm({ ...form, photosMode: true, photos: 0 }), false, "photos mode with no photo sends nothing");
  assert.equal(validForm({ ...form, photosMode: true, code: "12" }), false);
});

// 071 B: "What's it called?" before Send: the name as before, the brand in OFF's `brands`; either can be left out.
test("071 B: the product form carries the brand in OFF's brands field; neither name nor brand is needed", () => {
  const both = productForm({ code: "0123456789012", ingredients: "Water", name: "Guava Punch", brand: "Tropilicious" }, who);
  assert.equal(both.get("product_name_en"), "Guava Punch");
  assert.equal(both.get("brands"), "Tropilicious");
  assert.equal(productForm({ code: "0123456789012", ingredients: "Water", name: "Guava Punch" }, who).has("brands"), false);
  const brandOnly = productForm({ code: "0123456789012", ingredients: "Water", brand: "Tropilicious" }, who);
  assert.equal(brandOnly.has("product_name_en"), false);
  assert.equal(brandOnly.get("brands"), "Tropilicious");
  assert.equal(validForm({ ...form, ingredients: "Water", brand: "x".repeat(200) }), true);
  assert.equal(validForm({ ...form, ingredients: "Water", brand: "x".repeat(201) }), false, "a brand is checked like a name");
});

test("photos mode uploads photos only, never the text, and only for a product OFF already has", () => {
  assert.equal(sendPlan(true, true, false), "photos", "OFF has the product but no text: still no text write");
  assert.equal(sendPlan(true, true, true), "photos");
  assert.equal(sendPlan(true, false, false), null, "unknown product: invalid");
  assert.equal(sendPlan(false, false, false), "text", "a normal send of a new product writes the text");
  assert.equal(sendPlan(false, true, false), "text");
  assert.equal(sendPlan(false, true, true), "photos", "OFF's own text is kept (D10)");
});

const who = { user: "ecogo-app", password: "pw", uuid: "3f1c0e2a-0000-4000-8000-000000000001" };

test("the 10th submission of the day is the last one a person may send", () => {
  assert.equal(limitReason(9, 0), null);
  assert.equal(limitReason(10, 0), "limit-you");
});

test("after 200 submissions a day across everyone, nobody may send", () => {
  assert.equal(limitReason(0, 199), null);
  assert.equal(limitReason(0, 200), "limit-all");
  assert.equal(limitReason(10, 200), "limit-you", "a person over their own limit hears about that one");
});

// 054 B2 (R1 1): failed attempts didn't count, so one session could retry without limit (each retry reads OFF and logs a
// row). Every attempt today, failed or not, counts toward a cap of 30 per person.
test("after 30 attempts a day, failed ones included, a person must wait until tomorrow", () => {
  assert.equal(limitReason(0, 0, 29), null);
  assert.equal(limitReason(0, 0, 30), "limit-tries", "30 failed attempts, none sent: not 'you've sent 10'");
  assert.equal(limitReason(3, 50, 30), "limit-tries");
  assert.equal(limitReason(10, 0, 10), "limit-you", "the 10 sent still stop first");
  assert.equal(ATTEMPTS_DAILY, 30);
});

test("every request names EcoGo and its contact; the test server also gets OFF's public basic auth", () => {
  assert.deepEqual(offHeaders("https://world.openfoodfacts.net", "hello@ecogo.example"), {
    "User-Agent": "EcoGo/0.1 (hello@ecogo.example)",
    Authorization: "Basic b2ZmOm9mZg==",
  });
  assert.deepEqual(offHeaders("https://world.openfoodfacts.org", "hello@ecogo.example"), {
    "User-Agent": "EcoGo/0.1 (hello@ecogo.example)",
  });
});

test("the product form carries the app account, the person's app ID and the English ingredients", () => {
  const f = productForm({ code: "0123456789012", ingredients: "Sugar, Red 40", name: "Gummy bears" }, who);
  assert.deepEqual(Object.fromEntries(f), {
    code: "0123456789012",
    user_id: "ecogo-app",
    password: "pw",
    app_name: "EcoGo",
    app_version: "0.1",
    app_uuid: who.uuid,
    ingredients_text_en: "Sugar, Red 40",
    product_name_en: "Gummy bears",
  });
});

test("without a name the product form sends no name field", () => {
  const f = productForm({ code: "0123456789012", ingredients: "Water" }, who);
  assert.equal(f.has("product_name_en"), false);
});

test("an image form names the English image field and attaches the photo under imgupload_<field>", async () => {
  const photo = new Blob(["jpeg bytes"], { type: "image/jpeg" });
  const f = imageForm("0123456789012", "ingredients", photo, who);
  assert.equal(f.get("code"), "0123456789012");
  assert.equal(f.get("imagefield"), "ingredients_en");
  assert.equal(f.get("app_uuid"), who.uuid);
  assert.equal(f.get("user_id"), "ecogo-app");
  const file = f.get("imgupload_ingredients_en") as File;
  assert.equal(file.name, "ingredients.jpg");
  assert.equal(await file.text(), "jpeg bytes");
  assert.equal(imageForm("1", "front", photo, who).get("imagefield"), "front_en");
  assert.equal(imageForm("1", "nutrition", photo, who).get("imagefield"), "nutrition_en");
});

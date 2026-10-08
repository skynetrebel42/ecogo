import { test } from "node:test";
import assert from "node:assert/strict";
import { limitReason, offHeaders, productForm, imageForm, photoResult, sendReply } from "./off.ts";

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

test("with OFF's own text kept, one photo taken is enough; nothing taken is not sent", () => {
  assert.deepEqual(sendReply(false, [photoResult("front", 200, { status: "status ok" }), photoResult("nutrition", 500, null)]),
    { ok: true, failedPhotos: ["nutrition"] });
  assert.deepEqual(sendReply(false, [photoResult("front", 500, null)]), { ok: false, reason: "off-down" });
  assert.deepEqual(sendReply(false, [photoResult("front", 200, { status: "status not ok", error: "bad" })]), { ok: false, reason: "nothing-new" });
  assert.deepEqual(sendReply(false, []), { ok: false, reason: "nothing-new" });
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

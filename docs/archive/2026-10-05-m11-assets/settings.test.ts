// M11 part 4: text size and high contrast. Copy to src/lib/settings.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSettings, defaultSettings, applySettings, TEXT_SIZES } from "./settings.ts";

const normal = defaultSettings(false);

test("defaults: normal text; high contrast only when the phone asks for more contrast", () => {
  assert.deepEqual(normal, { textSize: "normal", contrast: "normal" });
  assert.deepEqual(defaultSettings(true), { textSize: "normal", contrast: "high" });
});

test("parseSettings: valid values are kept, corrupt or unknown ones fall back field by field", () => {
  assert.deepEqual(parseSettings('{"textSize":"larger","contrast":"high"}', normal), { textSize: "larger", contrast: "high" });
  assert.deepEqual(parseSettings('{"textSize":"huge","contrast":"high"}', normal), { textSize: "normal", contrast: "high" });
  assert.deepEqual(parseSettings('{"contrast":"normal"}', defaultSettings(true)), { textSize: "normal", contrast: "normal" }, "a saved 'normal' beats the phone's setting");
  assert.deepEqual(parseSettings("not json", normal), normal);
  assert.deepEqual(parseSettings(null, defaultSettings(true)), { textSize: "normal", contrast: "high" });
  assert.deepEqual(parseSettings("[]", normal), normal);
});

test("applySettings writes the two attributes the CSS reads", () => {
  const seen: Record<string, string> = {};
  applySettings({ setAttribute: (k, v) => { seen[k] = v; } }, { textSize: "large", contrast: "high" });
  assert.deepEqual(seen, { "data-text-size": "large", "data-contrast": "high" });
});

test("three text sizes, 100% / 115% / 130%", () => {
  assert.deepEqual(TEXT_SIZES.map(t => [t.id, t.scale]), [["normal", 1], ["large", 1.15], ["larger", 1.3]]);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { splitSpeechText } from "./speechText";
test("splits long spoken replies into complete provider-sized requests", () => {
  const text = "Explain how energy moves through a cell. ".repeat(20).trim();
  const chunks = splitSpeechText(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 200));
  assert.equal(chunks.join(" "), text);
});
test("handles Unicode and long unbroken words without dropping characters", () => {
  const text = "🧠".repeat(450);
  const chunks = splitSpeechText(text);
  assert.deepEqual(
    chunks.map((chunk) => Array.from(chunk).length),
    [200, 200, 50],
  );
  assert.equal(chunks.join(""), text);
  assert.deepEqual(splitSpeechText("   "), []);
});

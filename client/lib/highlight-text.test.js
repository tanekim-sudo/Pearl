import test from "node:test";
import assert from "node:assert/strict";
import { extractTextRangeFromHighlightStroke, sampleStrokePoints } from "./highlight-text.js";

test("sampleStrokePoints interpolates along segments", () => {
  const pts = sampleStrokePoints([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
  assert.ok(pts.length >= 3);
});

test("extractTextRangeFromHighlightStroke returns null for empty input", () => {
  assert.equal(extractTextRangeFromHighlightStroke(null, [{ x: 0, y: 0 }]), null);
});

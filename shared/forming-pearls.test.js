import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FORMING_PEARLS,
  discoverFormingPearls,
  pearlMetadataHarness,
} from "./forming-pearls.js";

const SAMPLE = `
User: Can you summarize this memo from a product strategy angle?
Assistant: Here is a summary...
User: Summarize it again, shorter, same product strategy lens.
Assistant: Shorter summary...
User: Rewrite the memo in the style of a board update.
Assistant: Board update...
User: Rewrite once more — still a board update, tighter.
Assistant: Tighter board update...
User: As a theologian, what tensions do you notice in this creativity brief?
Assistant: ...
User: From a creativity perspective, critique the same brief.
Assistant: ...
User: Compare the theology and creativity readings.
Assistant: ...
User: Plan next research steps with sources.
Assistant: ...
User: Research competing frames for this product.
Assistant: ...
`;

test("discoverFormingPearls caps at five organized pearls with studio order", () => {
  const result = discoverFormingPearls(SAMPLE, { source: "pasted-chat" });
  assert.equal(result.version, 1);
  assert.ok(result.pearls.length >= 1);
  assert.ok(result.pearls.length <= MAX_FORMING_PEARLS);
  assert.deepEqual(result.organizationOrder, ["moves", "weights", "lenses"]);
  for (const pearl of result.pearls) {
    assert.deepEqual(pearl.organization.order, ["moves", "weights", "lenses"]);
    assert.ok(pearl.organization.moves.length >= 1);
    assert.ok(pearl.organization.lenses.length >= 1);
    assert.ok(Array.isArray(pearl.organization.weights));
    assert.ok(pearl.discovery.signals.length >= 1);
  }
});

test("discoverFormingPearls surfaces recurring questions ops and frames", () => {
  const result = discoverFormingPearls(SAMPLE);
  const signals = new Set(result.pearls.flatMap((pearl) => pearl.discovery.signals));
  assert.ok(
    [...signals].some((signal) => /question|prompt|ops|frame|angle/i.test(signal)),
    `expected discovery signals, got ${[...signals].join(", ")}`,
  );
});

test("pearlMetadataHarness exposes editable organization and honest bounds", () => {
  const discovered = discoverFormingPearls(SAMPLE);
  const harness = pearlMetadataHarness(discovered.pearls[0]);
  assert.equal(harness.organization.order[0], "moves");
  assert.ok(harness.editablePaths.includes("organization.lenses"));
  assert.ok(harness.editablePaths.includes("organization.weights"));
  assert.equal(harness.bounds.modelRequiredForOpenRewrite, true);
  assert.ok(harness.bounds.deterministicOps.includes("synthesize"));
});

test("empty import returns a precise reason without inventing pearls", () => {
  const result = discoverFormingPearls("hi");
  assert.equal(result.pearls.length, 0);
  assert.match(result.reason, /No reusable|did not yield/i);
});

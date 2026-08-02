import test from "node:test";
import assert from "node:assert/strict";
import {
  editPearlWeights,
  normalizePearlWeights,
  seedWeightsFromIntent,
  summarizeWeightsForPrompt,
} from "./pearl-weights.js";

test("seedWeightsFromIntent captures care-more tradeoffs", () => {
  const weights = seedWeightsFromIntent("I care more about honesty than polish");
  assert.ok(weights.some((entry) => /honesty/i.test(entry.name)));
  assert.ok(weights.some((entry) => /polish/i.test(entry.name)));
  const honesty = weights.find((entry) => /honesty/i.test(entry.name));
  const polish = weights.find((entry) => /polish/i.test(entry.name));
  assert.ok(honesty.priority > polish.priority);
});

test("seedWeightsFromIntent captures weight-over language", () => {
  const weights = seedWeightsFromIntent("weight risk over upside");
  assert.ok(weights.some((entry) => /risk/i.test(entry.name)));
  assert.ok(weights.some((entry) => /upside/i.test(entry.name)));
});

test("editPearlWeights append and remove", () => {
  const appended = editPearlWeights([], {
    mode: "append",
    weights: [{ name: "Evidence", priority: 0.9 }],
  });
  assert.equal(appended.ok, true);
  assert.equal(appended.weights.length, 1);
  const removed = editPearlWeights(appended.weights, { mode: "remove", name: "Evidence" });
  assert.equal(removed.weights.length, 0);
});

test("summarizeWeightsForPrompt hides ids", () => {
  const text = summarizeWeightsForPrompt(normalizePearlWeights([
    { id: "weight:secret-99", name: "Honesty", priority: 0.8, note: "Over polish" },
  ]));
  assert.match(text, /Honesty/);
  assert.doesNotMatch(text, /weight:secret/);
});

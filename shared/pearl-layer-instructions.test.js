import test from "node:test";
import assert from "node:assert/strict";
import {
  PEARL_LAYER_ORDER,
  classifyUtteranceLayer,
  formatPearlLayerInstructionsForCompanion,
  seedPearlLayersFromIntent,
} from "./pearl-layer-instructions.js";

test("layer order is Moves → Weights → Lenses", () => {
  assert.deepEqual([...PEARL_LAYER_ORDER], ["moves", "weights", "lenses"]);
});

test("classifyUtteranceLayer routes process / preference / perspective", () => {
  assert.equal(classifyUtteranceLayer("add a move that drafts a haiku"), "moves");
  assert.equal(classifyUtteranceLayer("I care more about honesty than polish"), "weights");
  assert.equal(classifyUtteranceLayer("weight risk over upside"), "weights");
  assert.equal(classifyUtteranceLayer("apply a skeptical lens"), "lenses");
});

test("seedPearlLayersFromIntent seeds M/W/L for poetry style simile", () => {
  const seeded = seedPearlLayersFromIntent({
    name: "poetry · sylvia plaths",
    intent: "make me a poetry pearl like sylvia plaths thought process",
  });
  assert.ok(seeded.moves.length >= 2);
  assert.ok(seeded.weights.length >= 1);
  assert.ok(seeded.lenses.length >= 1);
  assert.match(seeded.systemPrompt, /Moves|Weights|Lenses/i);
  assert.deepEqual(seeded.organization.order, ["moves", "weights", "lenses"]);
});

test("companion layer instructions mention all three layers and verbs", () => {
  const text = formatPearlLayerInstructionsForCompanion({ includeExamples: true });
  assert.match(text, /Moves/);
  assert.match(text, /Weights/);
  assert.match(text, /Lenses/);
  assert.match(text, /editPearlWeights/);
  assert.match(text, /reorderPearlFunctionMoves/);
  assert.doesNotMatch(text, /Moves→Functions→Lenses/);
});

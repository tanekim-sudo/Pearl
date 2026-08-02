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

test("Buffett style+taste+lens create seeds high-fidelity offline layers", () => {
  const utterance = "make me a pearl that reflects Warren Buffett's style and taste and lens of investing";
  const seeded = seedPearlLayersFromIntent({ intent: utterance });
  assert.equal(seeded.title, "Buffett · investing");
  assert.equal(seeded.personaKey, "buffett");
  assert.ok(seeded.moves.length >= 5, "Buffett template moves");
  assert.ok(seeded.weights.length >= 5, "Buffett template weights");
  assert.ok(seeded.lenses.length >= 3, "Buffett template lenses");
  assert.match(seeded.systemPrompt, /## Moves/i);
  assert.match(seeded.systemPrompt, /## Weights/i);
  assert.match(seeded.systemPrompt, /## Lenses/i);
  assert.match(seeded.systemPrompt, /moat|margin of safety|circle of competence/i);
  assert.ok(seeded.moves.some((m) => /filings|moat|margin/i.test(m.name)));
  assert.equal(classifyUtteranceLayer(utterance), "mixed");
});

test("companion layer instructions mention all three layers and verbs", () => {
  const text = formatPearlLayerInstructionsForCompanion({ includeExamples: true });
  assert.match(text, /Moves/);
  assert.match(text, /Weights/);
  assert.match(text, /Lenses/);
  assert.match(text, /editPearlWeights/);
  assert.match(text, /reorderPearlFunctionMoves/);
  assert.match(text, /Cursor-for-pearls/i);
  assert.doesNotMatch(text, /Moves→Functions→Lenses/);
});

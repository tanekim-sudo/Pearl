import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPrimitiveMovePreferences,
  demotePrimitiveMove,
  primitiveMoveLevels,
  promotePrimitiveMove,
  reorderPrimitiveMove,
} from "./primitive-moves.js";

const moves = [
  { id: "a", name: "A", kind: "prompt", primitiveMove: true },
  { id: "b", name: "B", kind: "prompt", primitiveMove: true },
  { id: "c", name: "C", kind: "prompt" },
  { id: "f", name: "F", kind: "pipeline" },
];

test("primitive promotion, demotion, and rank survive canonical defaults", () => {
  let prefs = demotePrimitiveMove({}, "a", moves);
  prefs = promotePrimitiveMove(prefs, "c", moves);
  prefs = reorderPrimitiveMove(prefs, "c", 0, moves);
  const applied = applyPrimitiveMovePreferences(moves, prefs);
  assert.equal(applied.find((move) => move.id === "a").primitiveMove, false);
  assert.equal(applied.find((move) => move.id === "c").primitiveRank, 0);
  assert.deepEqual(applyPrimitiveMovePreferences(moves, prefs), applied);
});

test("branch levels contain primitives, other Moves, then Functions only", () => {
  const levels = primitiveMoveLevels(applyPrimitiveMovePreferences(moves, { demoted: ["a"] }));
  assert.deepEqual(levels.map((level) => level.label), ["Primitive Moves", "Moves", "Functions"]);
  assert.deepEqual(levels[0].choices.map((choice) => choice.id), ["b"]);
  assert.ok(levels[1].choices.every((choice) => choice.kind !== "pipeline"));
  assert.ok(levels[2].choices.every((choice) => choice.kind === "pipeline"));
});

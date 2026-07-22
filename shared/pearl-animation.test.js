import assert from "node:assert/strict";
import test from "node:test";
import { pearlAnimationForCommand, PEARL_ANIMATION_VOCABULARY, validatePearlAnimation } from "./pearl-animation.js";

test("remix primitives map birth, merge, nest, split, lens, and restore commands", () => {
  assert.equal(pearlAnimationForCommand("createSemanticOrb").semantic, "emerge");
  assert.equal(pearlAnimationForCommand("mergeSemanticOrbs").semantic, "merge");
  assert.equal(pearlAnimationForCommand("composeSemanticOrbs").semantic, "compose");
  assert.equal(pearlAnimationForCommand("synthesizeSemanticOrbs").semantic, "remix");
  assert.equal(pearlAnimationForCommand("organizePearl").semantic, "compose");
  assert.equal(pearlAnimationForCommand("createCounterPearl").semantic, "echo");
  assert.equal(pearlAnimationForCommand("evaluateWithGauntlet").semantic, "refract");
  assert.equal(pearlAnimationForCommand("nestSemanticOrb").semantic, "nest");
  assert.equal(pearlAnimationForCommand("splitSemanticOrb").semantic, "split");
  assert.equal(pearlAnimationForCommand("duplicateSemanticOrb").semantic, "duplicate");
  assert.equal(pearlAnimationForCommand("applySemanticOrbLens").semantic, "refract");
  assert.equal(pearlAnimationForCommand("restorePearlVersion").semantic, "recover");
  assert.equal(pearlAnimationForCommand("mutatePearlCognitiveLayer").semantic, "remix");
  assert.equal(pearlAnimationForCommand("createWorker").semantic, "fission");
  assert.equal(pearlAnimationForCommand("findOnScreenMatching").semantic, "filament");
  for (const semantic of ["emerge", "merge", "nest", "compose", "duplicate", "remix", "split", "recover", "fission", "echo", "charge", "filament", "seek"]) {
    assert.ok(PEARL_ANIMATION_VOCABULARY[semantic], semantic);
  }
  const animation = pearlAnimationForCommand("composeSemanticOrbs", { effectReceiptId: "effect:1" });
  assert.equal(validatePearlAnimation(animation, { id: "effect:1" }), true);
  assert.equal(animation.narration, false);
});

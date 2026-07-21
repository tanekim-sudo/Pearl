import assert from "node:assert/strict";
import test from "node:test";
import { compileAutomationPearl } from "./automation-pearl.js";
import { executeDomainCommand } from "./domain-commands.js";
import { createPearlEntity } from "./pearl-entity.js";
import {
  COGNITIVE_LAYER_KINDS,
  advanceCognitivePlayback,
  applyCognitiveLayerPatch,
  composeCognitiveLayers,
  createCognitiveLayer,
  createPearlCognition,
  proposeCognitiveLayerPatch,
  resolveCognitiveUncertainty,
  startCognitivePlayback,
} from "./pearl-cognitive-layers.js";
import { createPearlShareReview } from "./pearl-sharing.js";

const layer = (kind, id = kind, extra = {}) => createCognitiveLayer({
  id,
  kind,
  name: kind,
  confidence: 1,
  authorship: "user-authored",
  status: "resolved",
  executable: true,
  ...extra,
});

test("Primitive, Role, Lens, Move, Function and Pearl are differentiated versioned layers", () => {
  const layers = COGNITIVE_LAYER_KINDS.map((kind) => layer(kind));
  assert.deepEqual(layers.map((entry) => entry.kind), COGNITIVE_LAYER_KINDS);
  assert.ok("primitiveType" in layers[0].definition);
  assert.ok("instructions" in layers[1].definition);
  assert.ok("perceptualSchema" in layers[2].definition);
  assert.ok("transformation" in layers[3].definition);
  assert.ok("graph" in layers[4].definition);
  assert.ok("pearlId" in layers[5].definition);
  assert.equal(layers.every((entry) => entry.version === 1), true);
});

test("all typed combinations compose without a type-error UI and expose bridge Moves", () => {
  for (const leftKind of COGNITIVE_LAYER_KINDS) {
    for (const rightKind of COGNITIVE_LAYER_KINDS) {
      const composition = composeCognitiveLayers(layer(leftKind, `left:${leftKind}`), layer(rightKind, `right:${rightKind}`));
      assert.ok(["function", "lens"].includes(composition.object.kind));
      assert.ok(Array.isArray(composition.bridges));
      if (["primitive", "pearl"].includes(leftKind) || ["primitive", "pearl"].includes(rightKind)) {
        assert.ok(composition.bridges.length > 0);
        assert.equal(composition.preview.requiresConfirmation, true);
      }
    }
  }
});

test("low-confidence AI inference remains visible and cannot execute or masquerade as fact", () => {
  const uncertain = createCognitiveLayer({
    id: "f1",
    kind: "function",
    name: "Maybe process",
    graph: { nodes: [] },
    confidence: 0.42,
    rationale: "Ambiguous prompt",
    unresolvedQuestions: ["Does compare happen before compress?"],
    authorship: "ai-inferred",
  });
  assert.equal(uncertain.uncertainty.status, "unresolved");
  assert.equal(uncertain.uncertainty.executable, false);
  assert.equal(uncertain.uncertainty.shareableFact, false);
  assert.throws(() => startCognitivePlayback(createPearlCognition({ layers: [uncertain] }), "f1"), /resolve low-confidence/);
  const resolved = resolveCognitiveUncertainty(createPearlCognition({ layers: [uncertain] }), "f1", { confidence: 1 });
  assert.equal(resolved.layers[0].uncertainty.executable, true);
});

test("semantic AI patches require confirmation while preserving exact evidence mapping", () => {
  const cognition = createPearlCognition({
    rawEvidence: [{ id: "e1", content: "Compare, then compress." }],
    layers: [{ id: "m1", kind: "move", name: "Compare", transformation: "compare", evidenceRefs: ["e1"], confidence: 1, authorship: "user-authored", status: "resolved" }],
  });
  const proposal = proposeCognitiveLayerPatch(cognition, "m1", {
    definition: { ...cognition.layers[0].definition, transformation: "compress" },
  }, { rationale: "Requested semantic edit" });
  assert.equal(proposal.semantic, true);
  assert.throws(() => applyCognitiveLayerPatch(cognition, proposal, false), /confirmation/);
  const applied = applyCognitiveLayerPatch(cognition, proposal, true);
  assert.deepEqual(applied.layers[0].sourceMapping.evidenceRefs, ["e1"]);
  assert.equal(applied.organizationDiffs.at(-1).status, "applied");
});

test("layout movement does not alter semantic order and semantic reorder checkpoints", async () => {
  const entity = createPearlEntity({
    id: "p1",
    cognition: { layers: [layer("move", "m1"), layer("move", "m2")] },
  });
  const state = { pearlEntities: { p1: entity } };
  const moved = await executeDomainCommand("mutatePearlCognitiveLayer", state, {
    pearlId: "p1", layerId: "m1", operation: "layout", value: { x: 220, y: 90 },
  });
  assert.deepEqual(moved.state.pearlEntities.p1.cognition.semanticOrder, ["m1", "m2"]);
  assert.equal(moved.state.pearlEntities.p1.cognition.layers.find((entry) => entry.id === "m1").layout.x, 220);
  const reordered = await executeDomainCommand("mutatePearlCognitiveLayer", moved.state, {
    pearlId: "p1", layerId: "m2", operation: "reorder", to: 0, confirmed: true,
  });
  assert.deepEqual(reordered.state.pearlEntities.p1.cognition.semanticOrder, ["m2", "m1"]);
  assert.ok(reordered.state.pearlEntities.p1.history.checkpoints.length >= 2);
});

test("playback steps through exact Function nodes and records intermediate Result Pearls", () => {
  const cognition = createPearlCognition({
    layers: [layer("function", "f1", { graph: { nodes: [{ id: "s1", layerId: "m1" }, { id: "s2", layerId: "m2" }], edges: [{ from: "s1", to: "s2", relation: "then" }] } })],
  });
  let playing = startCognitivePlayback(cognition, "f1", { inputs: { material: "x" }, checkpointId: "cp1" });
  assert.equal(playing.activeExecution.status, "paused");
  playing = advanceCognitivePlayback(playing, { resultPearlId: "r1", receiptId: "effect1" });
  assert.equal(playing.activeExecution.cursor, 1);
  playing = advanceCognitivePlayback(playing, { resultPearlId: "r2", receiptId: "effect2" });
  assert.equal(playing.activeExecution.status, "completed");
  assert.deepEqual(playing.activeExecution.intermediateResultPearlIds, ["r1", "r2"]);
  assert.equal(playing.activeExecution.checkpointId, "cp1");
});

test("prompt organization preserves verbatim evidence, mapping, and unresolved inference in sharing", () => {
  const automation = compileAutomationPearl([{ id: "e1", kind: "system-prompt", content: "Compare evidence, then compress it into a memo." }], null, { id: "automation:1" });
  assert.equal(automation.cognition.rawEvidence[0].verbatim, "Compare evidence, then compress it into a memo.");
  assert.ok(automation.cognition.sourceMapping.e1.layerIds.length > 0);
  assert.ok(automation.cognition.layers.some((entry) => entry.kind === "move" && entry.uncertainty.status === "unresolved"));
  const review = createPearlShareReview(automation, { included: ["identity", "cognition", "privacyPolicy"] });
  assert.equal(review.blocked, false);
  const sharedLayer = review.snapshot.cognition.layers.find((entry) => entry.uncertainty.status === "unresolved");
  assert.equal(sharedLayer.uncertainty.executable, false);
  assert.equal(sharedLayer.uncertainty.shareableFact, false);
});

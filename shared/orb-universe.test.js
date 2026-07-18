import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrbState,
  executeOrbCommand,
  markUtteranceDispatched,
  recordOrbUtterance,
  transitionOrb,
} from "./orb-runtime.js";
import {
  composeLensRings,
  contextPriorityFromDistance,
  normalizeContextOrbit,
  resolveOrbGesture,
  rewindSemanticHistory,
} from "./orb-interactions.js";
import {
  createOrbInstance,
  fuseWorkerProposals,
  splitOrbWorkers,
  swarmSummary,
  workerProposal,
} from "./orb-swarm.js";
import { resolveDropIntent } from "./drop-intent-resolver.js";

test("orb state machine carries task and effect IDs through verified canonical execution", async () => {
  const orb = transitionOrb(createOrbState(), "interpreting", { taskId: "task-1" });
  const execution = await executeOrbCommand({
    orb,
    command: "createMoveFromContent",
    state: { objects: [] },
    args: { items: [{ id: "material-1", content: "Summarize this" }], id: "move-1" },
    taskId: "task-1",
    dispatchId: "dispatch-1",
    idFactory: () => "generated",
    now: 1,
    observe: async ({ result }) => ({ effectId: "effect-1", effects: result.effects }),
  });
  assert.equal(execution.orb.phase, "completed");
  assert.equal(execution.verification.commandId, "dispatch-1");
  assert.equal(execution.verification.effectId, "effect-1");
  assert.equal(execution.state.objects[0].id, "move-1");
  assert.equal(execution.animationTrace.disabledSafe, true);
});

test("utterance ledger normalizes repairs and dispatches exactly once", () => {
  const first = recordOrbUtterance(createOrbState(), "um please  summarize   this", { id: "u1" });
  assert.equal(first.entry.normalized, "summarize this");
  const dispatched = markUtteranceDispatched(first.state, "u1", "d1");
  assert.throws(() => markUtteranceDispatched(dispatched, "u1", "d2"), /already dispatched/);
  assert.equal(recordOrbUtterance(dispatched, "ignored duplicate", { id: "u1" }).duplicate, true);
});

test("context orbit, Lens atmosphere, and gesture fallback preserve material", () => {
  const orbit = normalizeContextOrbit([
    { id: "far", priority: contextPriorityFromDistance(140) },
    { id: "near", priority: contextPriorityFromDistance(12), pinned: true },
  ]);
  assert.equal(orbit[0].id, "near");
  const composed = composeLensRings({ id: "clarity", strength: .8 }, { id: "skeptic", strength: .6 });
  assert.deepEqual(composed.composedFrom, ["clarity", "skeptic"]);
  assert.equal(resolveOrbGesture({ source: { id: "x" }, target: { kind: "orb" } }).command, "addOrbContext");
  assert.equal(resolveOrbGesture({ source: { id: "x" }, target: null }).preserving, true);
});

test("semantic rewind returns real command inverses", () => {
  const result = rewindSemanticHistory({
    cursor: 2,
    entries: [{ id: "a", inverse: { command: "remove", id: "a" } }, { id: "b", inverse: { command: "remove", id: "b" } }],
  }, 0);
  assert.deepEqual(result.inverses.map((entry) => entry.id), ["b", "a"]);
});

test("orb drop matrix covers context, Stage, Frame, candidate, and workers", () => {
  const source = { id: "m", type: "text", text: "kept" };
  const expected = {
    orb: "addOrbContext",
    "context-orbit": "addOrbContext",
    stage: "materializeOnStage",
    "output-frame": "materializeInOutputFrame",
    "candidate-constellation": "queueBranchMaterial",
    "worker-orb": "assignWorkerContext",
  };
  for (const [kind, command] of Object.entries(expected)) {
    const resolved = resolveDropIntent(source, { kind, id: "target" });
    assert.equal(resolved.defaultIntent.command, command, kind);
    assert.equal(resolved.preserved, true, kind);
  }
});

test("worker swarm rejects concurrent writes and fuses verified typed proposals", () => {
  const parent = createOrbInstance({ id: "primary", role: "primary", checkpoint: { id: "cp-1" } });
  assert.throws(() => splitOrbWorkers(parent, [
    { goal: "A", mutationScope: "scene:1" },
    { goal: "B", mutationScope: "scene:1" },
  ]), /concurrent mutation/);
  const workers = splitOrbWorkers(parent, [{ goal: "read" }, { goal: "evaluate" }]).map((worker, index) =>
    workerProposal(worker, { type: "evaluation", score: index })
  );
  const fusion = fuseWorkerProposals(workers, () => true);
  assert.equal(fusion.applicable, true);
  assert.equal(fusion.accepted.length, 2);
  assert.equal(swarmSummary(workers, .4).collapsed, true);
});

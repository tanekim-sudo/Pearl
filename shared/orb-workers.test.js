import assert from "node:assert/strict";
import test from "node:test";
import { executeDomainCommand } from "./domain-commands.js";
import { createSemanticOrb } from "./semantic-orbs.js";
import { MAX_ORB_WORKERS } from "./orb-swarm.js";

test("createWorker fissions role-bound sub-agent pearls under the hard cap", async () => {
  const parent = createSemanticOrb({
    id: "parent-1",
    sceneId: "scene-1",
    name: "Parent",
    placement: { x: 0, y: 0 },
    workingSet: { context: [{ id: "c1", kind: "material", label: "Source" }], lenses: [] },
  });
  const created = await executeDomainCommand("createWorker", {
    semanticOrbs: [parent],
    activeSemanticOrbId: parent.id,
  }, {
    parentId: parent.id,
    sceneId: "scene-1",
    specs: [
      { role: "explore", goal: "Explore" },
      { role: "evaluate", goal: "Evaluate" },
      { role: "draft", goal: "Draft" },
    ],
  }, { idFactory: (() => { let n = 0; return () => `worker-pearl-${++n}`; })() });
  assert.equal(created.result.workers.length, 3);
  assert.equal(created.result.objects.length, 3);
  assert.equal(created.result.powerFx.kind, "fission");
  assert.equal(created.state.orbWorkers[parent.id].length, 3);
  assert.ok(created.state.semanticOrbs.every((orb) => orb.id === parent.id || orb.representation.kind === "worker"));

  await assert.rejects(() => executeDomainCommand("createWorker", {
    semanticOrbs: [parent],
  }, {
    parentId: parent.id,
    specs: Array.from({ length: MAX_ORB_WORKERS + 1 }, (_, index) => ({ role: `w${index}` })),
  }, { idFactory: () => `x-${Math.random()}` }), /worker limit/i);

  const fused = await executeDomainCommand("mergeWorkers", created.state, { parentId: parent.id });
  assert.equal(fused.result.powerFx.kind, "fuse");
  assert.equal(fused.state.orbWorkers[parent.id], undefined);
  assert.equal(fused.state.semanticOrbs.filter((orb) => orb.representation?.kind === "worker").length, 0);
});

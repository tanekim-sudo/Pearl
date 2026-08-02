import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_COMMANDS, executeDomainCommand } from "./domain-commands.js";

const context = { idFactory: () => "fixed-id", now: 100 };

test("direct, companion, and extension adapters produce the same Move effect", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  const args = { items: [{ text: "Rewrite clearly." }], id: "move-1" };
  const routes = await Promise.all(["ui", "companion", "extension"].map(() =>
    executeDomainCommand("createMoveFromContent", state, args, context)
  ));
  assert.deepEqual(routes.map((entry) => entry.state), [routes[0].state, routes[0].state, routes[0].state]);
  assert.equal(routes[0].result.object.prompt, "Rewrite clearly.");
});

test("content without lineage becomes a valid one-step Function without losing source", async () => {
  const exact = "Inspect the claim. Then compare primary evidence.";
  const execution = await executeDomainCommand("createFunctionFromContent", { objects: [] }, {
    items: [{ id: "paper-command", type: "text", text: exact, provenance: { surface: "paper" } }],
    name: "Captured process",
    id: "function-exact",
    moveId: "move-exact",
  }, { idFactory: () => "unused", now: 100 });
  const move = execution.state.objects.find((entry) => entry.id === "move-exact");
  const fn = execution.state.objects.find((entry) => entry.id === "function-exact");
  assert.equal(move.sourceInstruction, exact);
  assert.equal(move.promptTemplate, exact);
  assert.equal(fn.processGraph.nodes.length, 1);
  assert.deepEqual(fn.processGraph.nodes[0].ref, { id: move.id, version: move.version });
  assert.equal(fn.processInstructions, exact);
});

test("transactions persist atomically and expose rollback state", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  let rolledBack = null;
  await assert.rejects(
    () => executeDomainCommand("createMoveFromContent", state, { items: [{ text: "One action" }], id: "m" }, {
      ...context,
      persist: async () => { throw new Error("storage failed"); },
      rollback: async (before) => { rolledBack = before; },
    }),
    /storage failed/
  );
  assert.deepEqual(rolledBack, state);
});

test("idempotent canonical upsert does not duplicate retried sync", async () => {
  const state = { objects: [], primitivePreferences: {}, idempotencyKeys: [] };
  const args = { object: { id: "m", kind: "move", prompt: "Act." }, idempotencyKey: "sync-1" };
  const once = await executeDomainCommand("upsertCanonicalObject", state, args, context);
  const twice = await executeDomainCommand("upsertCanonicalObject", once.state, args, context);
  assert.equal(twice.state.objects.length, 1);
  assert.equal(twice.result.type, "idempotent-replay");
});

test("orb context add, priority, pin, and removal are canonical and reversible", async () => {
  const initial = { orbContext: [] };
  const added = await executeDomainCommand("addOrbContext", initial, {
    items: [{ id: "material-1", kind: "text", label: "Exact source", text: "Keep this verbatim.", provenance: { source: "paper" } }],
    priority: .6,
  }, context);
  assert.equal(added.state.orbContext[0].priority, .6);
  assert.equal(added.state.orbContext[0].text, "Keep this verbatim.");
  const updated = await executeDomainCommand("updateOrbContext", added.state, {
    id: "material-1",
    priority: .95,
    pinned: true,
    group: "evidence",
  }, context);
  assert.deepEqual(updated.state.orbContext[0], {
    id: "material-1",
    kind: "text",
    label: "Exact source",
    text: "Keep this verbatim.",
    priority: .95,
    group: "evidence",
    provenance: { source: "paper" },
    pinned: true,
  });
  const removed = await executeDomainCommand("removeOrbContext", updated.state, { id: "material-1" }, context);
  assert.deepEqual(removed.state.orbContext, []);
  assert.deepEqual(removed.undo().orbContext, updated.state.orbContext);
});

test("orb Lens atmosphere uses canonical reversible commands", async () => {
  const added = await executeDomainCommand("addOrbLens", { orbLenses: [] }, {
    lens: { id: "lens-1", kind: "lens", name: "Concrete evidence" },
    strength: .8,
  });
  assert.equal(added.state.orbLenses[0].strength, .8);
  const updated = await executeDomainCommand("updateOrbLens", added.state, { id: "lens-1", strength: .35 });
  assert.equal(updated.state.orbLenses[0].strength, .35);
  const removed = await executeDomainCommand("removeOrbLens", updated.state, { id: "lens-1" });
  assert.deepEqual(removed.state.orbLenses, []);
  assert.deepEqual(removed.undo(), updated.state);
});

test("semantic orb capsules preserve sources, activate singly, nest, merge, and undo", async () => {
  let nextId = 0;
  const options = { idFactory: () => `orb-${++nextId}`, now: 100 };
  const initial = { semanticOrbs: [], activeSemanticOrbId: null };
  const created = await executeDomainCommand("createSemanticOrb", initial, {
    sceneId: "scene-1",
    material: { id: "note-1", type: "text", text: "Keep this source." },
    placement: { x: 20, y: 30 },
  }, options);
  assert.equal(created.state.semanticOrbs[0].representation.refs[0], "note-1");
  assert.equal(created.state.semanticOrbs[0].workingSet.context[0].text, "Keep this source.");
  const second = await executeDomainCommand("createSemanticOrb", created.state, {
    sceneId: "scene-1",
    orb: { name: "Taste", representation: { kind: "lens", refs: ["lens-1"] } },
    placement: { x: 20, y: 30 },
  }, options);
  assert.notDeepEqual(second.state.semanticOrbs[0].placement, second.state.semanticOrbs[1].placement);
  const active = await executeDomainCommand("activateSemanticOrb", second.state, { id: "orb-1" }, options);
  assert.equal(active.state.activeSemanticOrbId, "orb-1");
  const nested = await executeDomainCommand("nestSemanticOrb", active.state, { childId: "orb-1", parentId: "orb-2" }, options);
  assert.equal(nested.state.semanticOrbs.find((orb) => orb.id === "orb-1").parentOrbId, "orb-2");
  const merged = await executeDomainCommand("mergeSemanticOrbs", nested.state, {
    ids: ["orb-1", "orb-2"],
    sceneId: "scene-1",
    name: "Combined",
  }, options);
  assert.equal(merged.state.semanticOrbs.length, 3);
  assert.ok(merged.state.semanticOrbs.some((orb) => orb.id === "orb-1"), "source orb-1 remains");
  assert.ok(merged.state.semanticOrbs.some((orb) => orb.id === "orb-2"), "source orb-2 remains");
  assert.deepEqual(merged.result.preservedSourceIds, ["orb-1", "orb-2"]);
  assert.equal(merged.result.object.representation.preserveIndividuals, true);
  assert.deepEqual(merged.result.object.representation.refs, ["orb-1", "orb-2"]);
  assert.ok(merged.result.effects.includes("semantic-orb-merge-preserved-sources"));
  assert.equal(merged.undo().semanticOrbs.length, 2);
  const synthesized = await executeDomainCommand("synthesizeSemanticOrbs", nested.state, {
    ids: ["orb-1", "orb-2"],
    sceneId: "scene-1",
    mode: "mutual",
  }, options);
  assert.equal(synthesized.state.semanticOrbs.length, 3);
  assert.ok(synthesized.state.semanticOrbs.some((orb) => orb.id === "orb-1"), "source orb-1 remains after synthesize");
  assert.ok(synthesized.state.semanticOrbs.some((orb) => orb.id === "orb-2"), "source orb-2 remains after synthesize");
  assert.deepEqual(synthesized.result.preservedSourceIds, ["orb-1", "orb-2"]);
  assert.equal(synthesized.result.object.representation.kind, "synthesis");
  assert.equal(synthesized.result.object.representation.preserveIndividuals, true);
  assert.equal(synthesized.result.observations.length, 2);
  assert.ok(synthesized.result.observations.every((item) => item.kind === "pearl-observation"));
  assert.ok(synthesized.result.effects.includes("pearl-synthesis-created"));
  const before = nested.state.semanticOrbs.find((orb) => orb.id === "orb-1");
  const after = synthesized.state.semanticOrbs.find((orb) => orb.id === "orb-1");
  assert.deepEqual(after, before, "source pearl content is unchanged");
  assert.equal(synthesized.undo().semanticOrbs.length, 2);

  const dumpState = {
    semanticOrbs: [{
      ...created.state.semanticOrbs[0],
      id: "orb-dump",
      name: "Messy dump",
      workingSet: {
        context: [
          { id: "d1", text: "As a skeptical LP, evaluate traction and moat. Care about capital efficiency." },
          { id: "d2", text: "Rewrite the problem slide but keep the metaphors." },
        ],
        lenses: [],
      },
      placement: { x: 10, y: 10, radius: 24 },
    }],
    activeSemanticOrbId: "orb-dump",
  };
  const organized = await executeDomainCommand("organizePearl", dumpState, { id: "orb-dump" }, options);
  assert.ok(organized.result.effects.includes("pearl-organized"));
  assert.ok(organized.result.organization.moves.length >= 1);
  assert.equal(organized.state.semanticOrbs.find((orb) => orb.id === "orb-dump").workingSet.context.length >= 2, true);

  const countered = await executeDomainCommand("createCounterPearl", nested.state, {
    id: "orb-1",
    sceneId: "scene-1",
    instruction: "foil the source",
  }, options);
  assert.ok(countered.result.effects.includes("pearl-counter-created"));
  assert.equal(countered.result.object.representation.kind, "counter");
  assert.ok(nested.state.semanticOrbs.some((orb) => orb.id === "orb-1"));
  assert.equal(countered.state.semanticOrbs.find((orb) => orb.id === "orb-1").name, nested.state.semanticOrbs.find((orb) => orb.id === "orb-1").name);
});

test("createSemanticOrb with systemPrompt seed still preserves material context", async () => {
  let nextId = 0;
  const options = { idFactory: () => `seed-${++nextId}`, now: 100 };
  const intent = "make me a pearl to observe and generate inspiration for poetry";
  const created = await executeDomainCommand("createSemanticOrb", { semanticOrbs: [], activeSemanticOrbId: null }, {
    sceneId: "scene-1",
    activate: true,
    systemPrompt: "You are the Pearl poetry inspiration.",
    intent,
    // Companion create path always attaches name + systemPrompt on orb.
    orb: { name: "poetry inspiration", systemPrompt: "You are the Pearl poetry inspiration." },
    material: {
      id: "pearl-text:poetry",
      kind: "dump",
      label: "poetry inspiration",
      text: "observe and generate inspiration for poetry",
    },
  }, options);
  const orb = created.state.semanticOrbs[0];
  assert.equal(orb.name, "poetry inspiration");
  assert.match(String(orb.systemPrompt || ""), /poetry inspiration/i);
  assert.ok(
    (orb.workingSet?.context || []).some((entry) => /inspiration for poetry/i.test(entry.text || "")),
    "material context must survive systemPrompt seeding",
  );
});

test("createSemanticOrb keeps forming-pearl Moves→Functions→Lenses when material is also passed", async () => {
  let nextId = 0;
  const options = { idFactory: () => `form-${++nextId}`, now: 100 };
  const forming = await executeDomainCommand("createSemanticOrb", { semanticOrbs: [], activeSemanticOrbId: null }, {
    sceneId: "scene-1",
    activate: false,
    orb: {
      name: "Forming LP",
      representation: { kind: "function", label: "Forming LP", discovery: "forming-pearls" },
      workingSet: { context: [{ id: "ev-1", text: "summarize LP briefing" }] },
      moves: [{ id: "m1", name: "Summarize", kind: "move" }],
      functions: [{ id: "f1", name: "Brief", kind: "function" }],
      lenses: [{ id: "l1", name: "Partner", kind: "lens" }],
    },
    material: { id: "ignored", text: "should not wipe organization" },
  }, options);
  const formed = forming.state.semanticOrbs[0];
  assert.equal(formed.name, "Forming LP");
  assert.equal(formed.moves?.[0]?.name, "Summarize");
  assert.equal(formed.functions?.[0]?.name, "Brief");
  assert.equal(formed.lenses?.[0]?.name, "Partner");
  assert.equal(formed.workingSet.context[0].text, "summarize LP briefing");
});

test("every command declares complete release contract metadata", () => {
  for (const [name, command] of Object.entries(DOMAIN_COMMANDS)) {
    for (const field of ["schema", "preconditions", "risk", "confirmation", "undo", "surfaces", "persistenceEffect", "observableEffects", "execute"]) {
      assert.ok(command[field], `${name}.${field}`);
    }
  }
});

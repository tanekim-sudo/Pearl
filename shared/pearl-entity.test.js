import assert from "node:assert/strict";
import test from "node:test";
import { compileAutomationPearl } from "./automation-pearl.js";
import { createPearlActionEvent, executePearlActionEvent } from "./pearl-action-protocol.js";
import { createPearlEntity, migratePearlEntity, pearlEntityObservation } from "./pearl-entity.js";
import { compareAndSwapPearl, migrateLegacyPearlState, removePearlFromStore } from "./pearl-store.js";
import { spawnResultPearl } from "./result-pearls.js";
import { createSemanticOrb } from "./semantic-orbs.js";

test("one canonical entity contains every Pearl capability section", () => {
  const entity = createPearlEntity({ id: "p1", name: "Unified Pearl" });
  const required = [
    "systemPrompt", "identity", "representation", "workingSet", "lenses", "moves", "functions", "automation", "generation",
    "results", "canvas", "soundscape", "privacy", "sharing", "provenance", "lineage", "relationships", "history",
    "permissions", "tasks", "outputRouting", "runtime",
  ];
  for (const section of required) assert.ok(section in entity, section);
  assert.ok(String(entity.systemPrompt || "").length > 0, "migrates a default systemPrompt");
  assert.equal(entity.privacy.policy.pearlId, "p1");
  assert.equal(entity.privacy.effectivePolicy.effective, true);
});

test("semantic, Result, automation and canvas Pearls migrate without stable ID loss", () => {
  const semantic = createSemanticOrb({ id: "semantic:1", name: "Context Pearl", workingSet: { context: [{ id: "c1" }] } });
  const result = spawnResultPearl({ id: "result:1", pearlId: "semantic:1", pageIdentity: "https://example.com", status: "ready", text: "Output" });
  const automation = compileAutomationPearl("Write a design review.", null, { id: "automation:1" });
  const canvas = { id: "canvas:1", pearlId: "semantic:1", pageIdentity: "https://example.com", artifacts: [{ id: "a1", type: "text", text: "Canvas" }] };
  const store = migrateLegacyPearlState({
    semanticOrbs: [semantic],
    resultPearls: { [result.id]: result },
    automationPearls: { [automation.id]: automation },
    pearlPageCanvases: { "semantic:1::https://example.com": canvas },
    activeSemanticOrbId: semantic.id,
  });
  assert.equal(Object.keys(store.entities).length, 4);
  assert.deepEqual(new Set(Object.keys(store.entities)), new Set(["semantic:1", "result:1", "automation:1", "canvas:1"]));
  assert.equal(store.activePearlId, "semantic:1");
  assert.equal(store.receipts.every((entry) => entry.preservedStableId || entry.type.includes("failure")), true);
});

test("direct, companion, voice and extension actions share one command/effect protocol", async () => {
  const entity = createPearlEntity({ id: "p1" });
  const states = [];
  for (const surface of ["gesture", "companion", "voice", "extension"]) {
    const event = createPearlActionEvent({
      id: `event:${surface}`,
      pearlId: "p1",
      command: "addOrbContext",
      args: { items: [{ id: "material:1", text: "Same material" }] },
      surface,
      idempotencyKey: `effect:${surface}`,
      expectedRevision: 0,
    });
    const executed = await executePearlActionEvent({ entity, state: { orbContext: [] }, event });
    states.push(executed.state.orbContext);
    assert.equal(executed.effectReceipt.command, "addOrbContext");
    assert.equal(executed.animation.effectReceiptId, executed.effectReceipt.id);
    assert.equal(executed.observation.pearlId, "p1");
  }
  assert.deepEqual(states[0], states[1]);
  assert.deepEqual(states[1], states[2]);
  assert.deepEqual(states[2], states[3]);
});

test("action replay is idempotent and stale revisions return reviewable conflict", async () => {
  const entity = createPearlEntity({ id: "p1" });
  const event = createPearlActionEvent({
    id: "event:1",
    pearlId: "p1",
    command: "addOrbContext",
    args: { items: [{ id: "m1" }] },
    surface: "gesture",
    idempotencyKey: "same-effect",
    expectedRevision: 0,
  });
  const first = await executePearlActionEvent({ entity, state: { orbContext: [] }, event });
  const replay = await executePearlActionEvent({ entity: first.entity, state: first.state, event: { ...event, expectedRevision: first.entity.revision } });
  assert.equal(replay.replay, true);
  const stale = await executePearlActionEvent({ entity: first.entity, state: first.state, event: { ...event, id: "event:2", idempotencyKey: "new", expectedRevision: 0 } });
  assert.equal(stale.conflict.type, "pearl-action-revision-conflict");
});

test("canonical store CAS and deletion preserve conflict and tombstone semantics", () => {
  const entity = createPearlEntity({ id: "p1", revision: 2 });
  const store = { version: 1, entities: { p1: entity }, activePearlId: "p1" };
  const stale = compareAndSwapPearl(store, "p1", 1, entity);
  assert.equal(stale.conflict.actualRevision, 2);
  const updated = compareAndSwapPearl(store, "p1", 2, { ...entity, revision: 3, identity: { ...entity.identity, name: "Edited" } });
  assert.equal(updated.entity.identity.name, "Edited");
  const removed = removePearlFromStore(updated.store, "p1");
  assert.equal(removed.store.entities.p1, undefined);
  assert.equal(removed.store.tombstones[0].pearlId, "p1");
});

test("observation states precise inaccessible boundaries", () => {
  const entity = createPearlEntity({ id: "p1" });
  const observation = pearlEntityObservation(entity, {
    authorizedSections: ["identity", "privacy"],
    requestedSections: ["identity", "privacy", "workingSet", "canvas"],
  });
  assert.deepEqual(Object.keys(observation.sections), ["identity", "privacy"]);
  assert.deepEqual(observation.unavailable.map((entry) => entry.section), ["workingSet", "canvas"]);
});

test("future Pearl versions fail closed instead of destructive migration", () => {
  assert.throws(() => migratePearlEntity({ schemaVersion: 99, id: "future" }), /newer incompatible/);
});

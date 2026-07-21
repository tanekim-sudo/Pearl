import assert from "node:assert/strict";
import test from "node:test";
import { executeDomainCommand } from "./domain-commands.js";
import { createPearlEntity } from "./pearl-entity.js";
import { createPearlGestureArbiter } from "./pearl-gesture-arbiter.js";
import { createPearlStudioViewModel, pearlStudioRepresentations } from "./pearl-studio.js";

test("Studio dynamically exposes only relevant sections and representations", () => {
  const text = createPearlEntity({ id: "text", kind: "result", text: "Memo", provenance: { source: "lens" } });
  assert.deepEqual(pearlStudioRepresentations(text), ["document", "lineage"]);
  const mixed = createPearlEntity({
    id: "mixed",
    kind: "automation",
    functions: [{ id: "f1" }],
    candidates: [{ id: "c1", text: "Memo" }, { id: "c2", type: "image" }],
    canvas: { artifacts: [{ id: "i1", type: "image" }, { id: "t1", type: "text", text: "Caption" }] },
  });
  const view = createPearlStudioViewModel(mixed);
  assert.deepEqual(new Set(view.representations), new Set(["document", "gallery", "spatial", "branch-comparison", "process"]));
  assert.ok(view.sections.some((section) => section.id === "privacy"));
  assert.ok(!view.sections.some((section) => section.id === "soundscape"));
});

test("single activation is immediate while triple and keyboard still open Studio", async () => {
  const events = [];
  const arbiter = createPearlGestureArbiter({
    onSingle: () => events.push("single"),
    onDouble: () => events.push("double"),
    onTriple: ({ accessible }) => events.push(accessible ? "accessible" : "triple"),
  }, { sequenceMs: 15 });
  arbiter.release({ at: 1, x: 10, y: 10 });
  arbiter.release({ at: 2, x: 10, y: 10 });
  const third = arbiter.release({ at: 3, x: 10, y: 10 });
  assert.equal(third.type, "triple");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(events, ["single", "triple"]);
  assert.equal(arbiter.keyboard({ key: "Enter", shiftKey: true }).type, "accessible-open");
  assert.deepEqual(events, ["single", "triple", "accessible"]);
});

test("drag and hold never become Studio activation", () => {
  let opens = 0;
  const arbiter = createPearlGestureArbiter({ onTriple: () => opens++ });
  arbiter.release({ at: 1, x: 0, y: 0 });
  assert.equal(arbiter.release({ at: 2, x: 30, y: 0, dragged: true }).type, "drag");
  arbiter.hold({});
  arbiter.release({ at: 3, x: 0, y: 0 });
  assert.equal(opens, 0);
});

test("Studio edits use canonical CAS checkpoints with undo and redo", async () => {
  const entity = createPearlEntity({ id: "p1", name: "Before" });
  const state = { pearlEntities: { p1: entity } };
  const opened = await executeDomainCommand("openPearlStudio", state, { pearlId: "p1", sourceSurface: "extension" });
  assert.equal(opened.result.object.viewModel.pearlId, "p1");
  const edited = await executeDomainCommand("editPearlEntity", opened.state, {
    pearlId: "p1",
    patch: { identity: { ...entity.identity, name: "After" } },
    expectedRevision: 0,
    idempotencyKey: "edit:1",
  });
  assert.equal(edited.state.pearlEntities.p1.identity.name, "After");
  const stale = await executeDomainCommand("editPearlEntity", edited.state, {
    pearlId: "p1",
    patch: { identity: { ...entity.identity, name: "Stale" } },
    expectedRevision: 0,
    idempotencyKey: "edit:2",
  });
  assert.equal(stale.result.type, "pearl-conflict");
  const undone = await executeDomainCommand("undoPearlEntityEdit", edited.state, { pearlId: "p1" });
  assert.equal(undone.state.pearlEntities.p1.identity.name, "Before");
  const redone = await executeDomainCommand("redoPearlEntityEdit", undone.state, { pearlId: "p1" });
  assert.equal(redone.state.pearlEntities.p1.identity.name, "After");
});

import assert from "node:assert/strict";
import test from "node:test";
import { executeDomainCommand } from "./domain-commands.js";
import { createPearlEntity } from "./pearl-entity.js";
import { createPearlGestureArbiter } from "./pearl-gesture-arbiter.js";
import {
  PEARL_STUDIO_COGNITIVE_SECTION_ORDER,
  createPearlStudioViewModel,
  pearlStudioCognitiveSectionIds,
  pearlStudioRepresentations,
} from "./pearl-studio.js";

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

test("Studio cognitive sections keep load-bearing Moves → Weights → Lenses order", () => {
  assert.deepEqual(PEARL_STUDIO_COGNITIVE_SECTION_ORDER, ["moves", "weights", "lenses"]);
  const entity = createPearlEntity({
    id: "studio-order",
    kind: "automation",
    lenses: [{ id: "l1", name: "Audience" }],
    moves: [{ id: "m1", name: "Distill" }],
    functions: [{ id: "f1", name: "Brief" }],
    weights: [{ id: "w1", name: "Honesty", priority: 0.8 }],
    cognition: {
      layers: [
        { id: "cl-lens", kind: "lens", identity: { name: "Audience" } },
        { id: "cl-move", kind: "move", identity: { name: "Distill" } },
        { id: "cl-fn", kind: "function", identity: { name: "Brief" } },
      ],
      semanticOrder: ["cl-lens", "cl-move", "cl-fn"],
    },
  });
  const view = createPearlStudioViewModel(entity);
  const ids = view.sections.map((section) => section.id);
  const movesAt = ids.indexOf("moves");
  const weightsAt = ids.indexOf("weights");
  const lensesAt = ids.indexOf("lenses");
  assert.ok(movesAt >= 0 && weightsAt >= 0 && lensesAt >= 0);
  assert.ok(movesAt < weightsAt && weightsAt < lensesAt);
  assert.deepEqual(pearlStudioCognitiveSectionIds(view), ["moves", "weights", "lenses"]);
  assert.match(view.sections.find((section) => section.id === "moves").value.help, /how work is done|ordered steps/i);
  assert.match(view.sections.find((section) => section.id === "weights").value.help, /valued|preferences|judgements/i);
  assert.match(view.sections.find((section) => section.id === "lenses").value.help, /perspectives|frames|seeing/i);
  assert.ok(
    view.sections.find((section) => section.id === "moves").value.orderedGroups?.length >= 1,
    "function-of-moves storage is nested under Moves",
  );
  assert.ok(!view.sections.some((section) => section.id === "functions"), "Functions must not be a middle brain section");
  assert.ok(!view.sections.some((section) => section.id === "process"), "legacy combined Process section must not replace Moves/Weights/Lenses");
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

test("Studio version history can name and restore without deleting intermediates", async () => {
  let state = { pearlEntities: { p1: createPearlEntity({ id: "p1", name: "A", results: [{ id: "r", text: "one" }] }) } };
  state = (await executeDomainCommand("editPearlEntity", state, {
    pearlId: "p1",
    patch: { identity: { ...state.pearlEntities.p1.identity, name: "B" }, results: [{ id: "r", text: "two" }] },
    expectedRevision: 0,
    idempotencyKey: "v1",
  })).state;
  state = (await executeDomainCommand("snapshotPearlVersion", state, {
    pearlId: "p1",
    label: "Review ready",
    idempotencyKey: "snap:1",
  })).state;
  state = (await executeDomainCommand("editPearlEntity", state, {
    pearlId: "p1",
    patch: { identity: { ...state.pearlEntities.p1.identity, name: "C" }, results: [{ id: "r", text: "three" }] },
    expectedRevision: state.pearlEntities.p1.revision,
    idempotencyKey: "v2",
  })).state;
  const history = await executeDomainCommand("browsePearlHistory", state, { pearlId: "p1" });
  const named = history.result.object.versions.find((entry) => entry.label === "Review ready");
  assert.ok(named);
  const restored = await executeDomainCommand("restorePearlVersion", state, {
    pearlId: "p1",
    checkpointId: named.id,
    confirmed: true,
  });
  assert.equal(restored.state.pearlEntities.p1.results[0].text, "two");
  assert.ok(restored.state.pearlEntities.p1.history.checkpoints.some((entry) => entry.metadata?.label === "Review ready" || entry.reason === "Review ready"));
  const view = createPearlStudioViewModel(restored.state.pearlEntities.p1);
  assert.ok(view.sections.some((section) => section.id === "history" && section.value.count >= 1));
});

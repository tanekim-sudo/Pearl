import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspaceObservation,
  revalidateObservationTarget,
  sceneRelationships,
  viewportWorldBounds,
} from "./workspace-observation.js";

const objects = [
  { id: "visible", version: 1, type: "text", text: "Visible note", x: 10, y: 10, w: 100, h: 50 },
  { id: "offscreen", version: 1, type: "text", text: "Offscreen note", x: 1200, y: 900, w: 100, h: 50 },
  { id: "secret", version: 1, type: "text", text: "api_key=do-not-leak", x: 20, y: 80, w: 100, h: 50 },
];

test("distinguishes viewport from full paper semantic scope", () => {
  const base = { objects, camera: { x: 0, y: 0, scale: 1 }, viewport: { width: 500, height: 400 }, stateRevision: "r1" };
  const viewport = createWorkspaceObservation({ ...base, scope: "viewport" });
  const paper = createWorkspaceObservation({ ...base, scope: "paper" });
  assert.deepEqual(viewport.objects.map((object) => object.id), ["visible", "secret"]);
  assert.deepEqual(paper.objects.map((object) => object.id), ["visible", "offscreen", "secret"]);
  assert.equal(viewport.objects.find((object) => object.id === "offscreen"), undefined);
});

test("uses camera transforms for zoomed and panned viewport bounds", () => {
  assert.deepEqual(viewportWorldBounds({ x: -200, y: -100, scale: 2 }, { width: 400, height: 200 }), {
    minx: 100, miny: 50, maxx: 300, maxy: 150,
  });
});

test("selection scope retains exact allowed text and redacts secrets", () => {
  const observation = createWorkspaceObservation({
    scope: "selection",
    objects,
    selectedIds: ["visible", "secret"],
    camera: { scale: 1 },
    viewport: { width: 500, height: 400 },
  });
  assert.equal(observation.objects.length, 2);
  assert.equal(observation.objects[0].exactText, "Visible note");
  assert.doesNotMatch(observation.objects[1].exactText, /api_key/);
});

test("visible-tab scope requires an explicit user gesture", () => {
  assert.throws(() => createWorkspaceObservation({ scope: "visibleTab", objects: [] }), /explicit user gesture/);
  assert.equal(createWorkspaceObservation({ scope: "visibleTab", objects: [], userGesture: true }).scope, "visibleTab");
});

test("Scene scopes distinguish unbounded Stage, Output Frame, orb context, and AI aliases", () => {
  const scoped = [
    { id: "stage", domain: "paper", x: 0, y: 0 },
    { id: "frame", domain: "paper", frameId: "frame-1", x: 10, y: 10 },
    { id: "ai", domain: "ai", x: 20, y: 20 },
  ];
  assert.deepEqual(
    createWorkspaceObservation({ scope: "stage", objects: scoped }).objects.map((object) => object.id),
    ["stage", "ai"]
  );
  assert.deepEqual(
    createWorkspaceObservation({ scope: "frame", frameId: "frame-1", objects: scoped }).objects.map((object) => object.id),
    ["frame"]
  );
  assert.deepEqual(
    createWorkspaceObservation({ scope: "orb-context", contextIds: ["stage"], objects: scoped }).objects.map((object) => object.id),
    ["stage"]
  );
  assert.deepEqual(
    createWorkspaceObservation({ scope: "ai-space", objects: scoped }).objects.map((object) => object.id),
    ["ai"]
  );
});

test("semantic orb scope resolves the active capsule, children, and referenced sources", () => {
  const scoped = [
    { id: "orb-a", kind: "semantic-orb", sceneId: "scene-1", placement: { x: 0, y: 0 }, representation: { refs: ["note-a"] } },
    { id: "orb-child", kind: "semantic-orb", sceneId: "scene-1", parentOrbId: "orb-a", placement: { x: 20, y: 20 } },
    { id: "note-a", type: "text", sceneId: "scene-1", text: "Grounded source" },
    { id: "other", kind: "semantic-orb", sceneId: "scene-1", placement: { x: 300, y: 300 } },
  ];
  const observation = createWorkspaceObservation({
    scope: "semantic-orb",
    semanticOrbId: "orb-a",
    objects: scoped,
  });
  assert.deepEqual(observation.objects.map((object) => object.id), ["orb-a", "orb-child", "note-a"]);
  assert.equal(observation.objects[0].sourceIds[0], "note-a");
});

test("scene relationships remain grounded to stable object IDs", () => {
  const observation = createWorkspaceObservation({
    scope: "paper",
    objects: [
      { id: "a", x: 0, y: 0, w: 100, h: 100 },
      { id: "b", x: 10, y: 20, w: 30, h: 30 },
      { id: "c", x: 200, y: 0, w: 50, h: 50 },
    ],
    viewport: { width: 500, height: 500 },
  });
  const relations = sceneRelationships(observation);
  assert.ok(relations.some((relation) => relation.kind === "overlaps" && relation.fromId === "a" && relation.toId === "b"));
  assert.ok(relations.every((relation) => observation.objects.some((object) => object.id === relation.fromId)));
});

test("stale revisions re-resolve stable targets or require replanning", () => {
  const observation = createWorkspaceObservation({
    scope: "paper", objects: [{ id: "a", version: 1, x: 0, y: 0, w: 20, h: 20 }], stateRevision: "old",
  });
  assert.equal(revalidateObservationTarget(observation, "a", "old").status, "current");
  assert.equal(revalidateObservationTarget(observation, "a", "new", [{ id: "a", version: 1, x: 5, y: 5, w: 20, h: 20 }]).status, "re-resolved");
  assert.equal(revalidateObservationTarget(observation, "a", "new", [{ id: "a", version: 2, x: 100, y: 100, w: 20, h: 20 }]).requiresReplan, true);
});

test("rejects unsafe and cyclic observations", () => {
  assert.throws(() => createWorkspaceObservation(JSON.parse('{"__proto__":{"polluted":true}}')), /unsafe key/);
  const cyclic = { objects: [] };
  cyclic.focus = cyclic;
  assert.throws(() => createWorkspaceObservation(cyclic), /cycle/);
});

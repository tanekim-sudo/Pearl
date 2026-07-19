import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIFIED_WORKSPACE_VERSION,
  clampAiNodeToPage,
  clampAiNodeToOutputFrame,
  clampWorkspaceItem,
  clampItemToOutputFrame,
  createOutputFrame,
  createScene,
  workspaceItemBBox,
  hitUnifiedMaterial,
  migrateUnifiedWorkspace,
  routeUnifiedGesture,
  serializeUnifiedWorkspace,
  selectSceneWorkspace,
  updateSceneWorkspace,
} from "./unified-workspace.js";

test("legacy paper and AI records migrate inside page without losing metadata", () => {
  const item = { id: "paper-1", type: "text", x: 12, y: 24, text: "kept", history: ["a"] };
  const node = { id: "node-1", x: -40, y: 10, parentId: "root", expandedText: "kept", history: ["b"] };
  const migrated = migrateUnifiedWorkspace({
    items: [item],
    nodes: [node],
    camera: { x: 4, y: 8, scale: 0.5 },
  });

  assert.equal(migrated.version, UNIFIED_WORKSPACE_VERSION);
  assert.equal(migrated.items[0].text, item.text);
  assert.ok(migrated.items[0].x >= 24);
  assert.ok(migrated.nodes[0].x <= 768 - 24 - migrated.nodes[0].radius);
  assert.ok(migrated.nodes[0].y >= 24 + migrated.nodes[0].radius);
  assert.deepEqual(migrated.nodes[0].history, ["b"]);
  assert.equal(migrated.nodes[0].parentId, "root");
  assert.equal(migrated.scenes[0].kind, "scene");
  assert.equal(migrated.frames[0].kind, "output-frame");
  assert.equal(migrated.items[0].frameId, migrated.frames[0].id);
  assert.equal(migrated.scenes[0].metadata.createdFrom, "legacy-page-migration");
});

test("every legacy page becomes a distinct Scene and Output Frame", () => {
  const migrated = migrateUnifiedWorkspace({
    pages: [
      { id: "page-a", name: "Alpha", camera: { x: 1, y: 2, scale: .8 } },
      { id: "page-b", name: "Beta", camera: { x: 3, y: 4, scale: .7 } },
    ],
    activePageId: "page-b",
    items: [
      { id: "a", pageId: "page-a", type: "text", x: 10, y: 20 },
      { id: "b", pageId: "page-b", type: "text", x: 30, y: 40 },
    ],
    nodes: [{ id: "node-b", pageId: "page-b", x: 20, y: 20 }],
  });
  assert.equal(migrated.scenes.length, 2);
  assert.equal(migrated.activeSceneId, "scene-legacy:page-b");
  assert.deepEqual(migrated.items.map((item) => item.id), ["b"]);
  assert.deepEqual(migrated.nodes.map((node) => node.id), ["node-b"]);
  assert.equal(migrated.scenes[0].frames[0].metadata.legacyPageId, "page-a");
  assert.equal(migrated.scenes[1].frames[0].metadata.legacyPageId, "page-b");
});

test("Scene v4 preserves unknown fields and leaves world objects unbounded", () => {
  const worldItem = { id: "world", type: "text", x: -9000, y: 5000, futureField: { safe: true } };
  const scene = createScene({
    id: "scene-1",
    items: [worldItem],
    camera: { x: 8, y: 9, scale: .5 },
    futureSceneField: "kept",
  });
  const migrated = migrateUnifiedWorkspace({ unified: {
    version: UNIFIED_WORKSPACE_VERSION,
    activeSceneId: scene.id,
    scenes: [scene],
  } });
  assert.equal(migrated.items[0].x, -9000);
  assert.deepEqual(migrated.items[0].futureField, { safe: true });
  assert.equal(migrated.scenes[0].futureSceneField, "kept");
});

test("semantic orbs migrate and serialize without leaking worker instances", () => {
  const scene = createScene({
    id: "scene-orbs",
    orbInstances: [{ id: "worker-1", role: "specialist", status: "completed" }],
    semanticOrbs: [{
      id: "orb-1",
      name: "Picasso",
      placement: { x: 120, y: -40 },
      representation: { kind: "lens", refs: ["lens-picasso"] },
      workingSet: { context: [{ id: "study-1" }] },
    }],
    activeSemanticOrbId: "orb-1",
  });
  const workspace = updateSceneWorkspace({
    version: UNIFIED_WORKSPACE_VERSION,
    activeSceneId: scene.id,
    scenes: [scene],
  }, scene.id, (current) => ({ ...current, items: [{ id: "new-material" }] }));
  const serialized = JSON.parse(serializeUnifiedWorkspace(workspace));
  const restored = migrateUnifiedWorkspace({ unified: serialized });
  assert.equal(restored.scenes[0].semanticOrbs[0].name, "Picasso");
  assert.deepEqual(restored.scenes[0].semanticOrbs[0].representation.refs, ["lens-picasso"]);
  assert.equal(restored.scenes[0].activeSemanticOrbId, "orb-1");
  assert.deepEqual(restored.scenes[0].orbInstances.map((entry) => entry.id), ["worker-1"]);
  assert.deepEqual(restored.items.map((entry) => entry.id), ["new-material"]);
});

test("only frame-local material is clamped", () => {
  const frame = createOutputFrame({ id: "frame-1", x: 100, y: 200 });
  const world = { id: "world", type: "text", x: -1000, y: -1000 };
  assert.equal(clampItemToOutputFrame(world, frame), world);
  const local = clampItemToOutputFrame({ ...world, id: "local", frameId: frame.id }, frame);
  assert.ok(local.x >= frame.x + 24);
  assert.ok(local.y >= frame.y + 24);
  const worldNode = { id: "world-node", x: -800, y: 4000, radius: 16 };
  assert.equal(clampAiNodeToOutputFrame(worldNode, frame), worldNode);
  const localNode = clampAiNodeToOutputFrame({ ...worldNode, frameId: frame.id }, frame);
  assert.ok(localNode.x >= frame.x + 24 + localNode.radius);
  assert.ok(localNode.y <= frame.y + frame.height - 24 - localNode.radius);
});

test("explicit Scene routes select or create only the requested working set", () => {
  const first = createScene({ id: "scene-a", items: [{ id: "a" }] });
  const second = createScene({ id: "scene-b", items: [{ id: "b" }], workingSet: { context: [{ id: "ctx" }] } });
  const selected = selectSceneWorkspace({
    version: UNIFIED_WORKSPACE_VERSION,
    activeSceneId: first.id,
    scenes: [first, second],
  }, "scene-b");
  assert.equal(selected.activeSceneId, "scene-b");
  assert.deepEqual(selected.items.map((item) => item.id), ["b"]);
  assert.deepEqual(selected.workingSet.context.map((item) => item.id), ["ctx"]);
  const created = selectSceneWorkspace(selected, "scene-new", { createIfMissing: true });
  assert.equal(created.activeSceneId, "scene-new");
  assert.equal(created.scenes.length, 3);
  assert.equal(created.scenes[2].metadata.createdFrom, "explicit-scene-route");
});

test("node clamp uses compact defaults and preserves explicit custom radii", () => {
  const compact = clampAiNodeToPage({ id: "n", nodeKind: "expanded", x: -99, y: 9999, radius: 30 });
  assert.equal(compact.radius, 16);
  assert.equal(compact.x, 40);
  assert.equal(compact.y, 1104 - 24 - 16);
  const custom = clampAiNodeToPage({
    id: "custom",
    nodeKind: "expanded",
    x: 200,
    y: 200,
    radius: 25,
    customRadius: true,
  });
  assert.equal(custom.radius, 25);
});

test("full item footprint clamps and oversized cards shrink", () => {
  const item = clampWorkspaceItem({ id: "wide", type: "image", x: -100, y: -50, w: 2000, h: 1800 });
  const box = workspaceItemBBox(item);
  assert.ok(item.scale < 1);
  assert.ok(box.minx >= 24 - 1e-8);
  assert.ok(box.miny >= 24 - 1e-8);
  assert.ok(box.maxx <= 768 - 24 + 1e-8);
  assert.ok(box.maxy <= 1104 - 24 + 1e-8);
});

test("unified migration is idempotent", () => {
  const once = migrateUnifiedWorkspace({ nodes: [{ id: "n", x: 1, y: 2 }] });
  const twice = migrateUnifiedWorkspace({
    items: [],
    nodes: [{ id: "legacy", x: 999, y: 999 }],
    unified: once,
  });
  assert.deepEqual(twice.nodes, once.nodes);
  assert.deepEqual(twice.camera, once.camera);
});

test("mixed hit testing gives node cores explicit precedence", () => {
  const point = { x: 20, y: 20 };
  const hit = hitUnifiedMaterial({
    point,
    nodes: [{ id: "n", x: 20, y: 20, radius: 10 }],
    items: [{ id: "p" }],
    itemBBox: () => ({ minx: 0, miny: 0, maxx: 40, maxy: 40 }),
  });
  assert.equal(hit.domain, "node");
  assert.equal(hit.id, "n");
});

test("gesture routing never treats a background drag as AI expansion", () => {
  assert.equal(routeUnifiedGesture({ tool: "select", hit: null, dragged: true }), "pan");
  assert.equal(
    routeUnifiedGesture({ tool: "select", hit: { domain: "node" }, zone: "edge" }),
    "node-operation-chooser"
  );
  assert.equal(routeUnifiedGesture({ tool: "pen", hit: { domain: "node" } }), "draw");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIFIED_WORKSPACE_VERSION,
  clampAiNodeToPage,
  clampWorkspaceItem,
  clampItemToOutputFrame,
  createOutputFrame,
  createScene,
  workspaceItemBBox,
  hitUnifiedMaterial,
  migrateUnifiedWorkspace,
  routeUnifiedGesture,
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

test("only frame-local material is clamped", () => {
  const frame = createOutputFrame({ id: "frame-1", x: 100, y: 200 });
  const world = { id: "world", type: "text", x: -1000, y: -1000 };
  assert.equal(clampItemToOutputFrame(world, frame), world);
  const local = clampItemToOutputFrame({ ...world, id: "local", frameId: frame.id }, frame);
  assert.ok(local.x >= frame.x + 24);
  assert.ok(local.y >= frame.y + 24);
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

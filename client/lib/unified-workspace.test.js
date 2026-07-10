import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_AI_OFFSET,
  UNIFIED_WORKSPACE_VERSION,
  hitUnifiedMaterial,
  migrateUnifiedWorkspace,
  routeUnifiedGesture,
} from "./unified-workspace.js";

test("legacy paper and AI records migrate without changing their contents", () => {
  const item = { id: "paper-1", type: "text", x: 12, y: 24, text: "kept", history: ["a"] };
  const node = { id: "node-1", x: -40, y: 10, parentId: "root", expandedText: "kept", history: ["b"] };
  const migrated = migrateUnifiedWorkspace({
    items: [item],
    nodes: [node],
    camera: { x: 4, y: 8, scale: 0.5 },
  });

  assert.equal(migrated.version, UNIFIED_WORKSPACE_VERSION);
  assert.deepEqual(migrated.items[0], item);
  assert.equal(migrated.nodes[0].x, node.x + LEGACY_AI_OFFSET.x);
  assert.equal(migrated.nodes[0].y, node.y + LEGACY_AI_OFFSET.y);
  assert.deepEqual(migrated.nodes[0].history, ["b"]);
  assert.equal(migrated.nodes[0].parentId, "root");
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

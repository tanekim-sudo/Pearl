import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkspaceSnapshot,
  queryWorkspace,
  workspacePromptContext,
} from "./companion-observation.js";

const snapshot = buildWorkspaceSnapshot({
  items: [
    { id: "claim", type: "text", text: "Market demand is accelerating", x: 20, y: 20, w: 180, h: 60 },
    { id: "evidence", type: "text", text: "Survey evidence", x: 430, y: 40, w: 160, h: 60 },
  ],
  nodes: [
    { id: "root", label: "memo", x: 100, y: 400 },
    { id: "branch", parentId: "root", expandedText: "contrarian branch", x: 260, y: 430 },
  ],
  selectedItemIds: ["claim"],
  selectedNodeIds: ["branch"],
  highlightedIds: ["evidence"],
  recentHistory: Array.from({ length: 30 }, (_, index) => ({ id: index, summary: `change ${index}` })),
});

test("snapshot is bounded, stable, and selection spans domains", () => {
  assert.deepEqual(snapshot.selection.map((entry) => entry.id), ["claim", "branch"]);
  assert.deepEqual(snapshot.highlighted.map((entry) => entry.id), ["evidence"]);
  assert.equal(snapshot.recentHistory.length, 20);
  assert.doesNotMatch(workspacePromptContext(snapshot), /change 0/);
});

test("queries by text, region, graph lineage, and spatial clusters", () => {
  assert.deepEqual(queryWorkspace(snapshot, "objects", { text: "survey" }).map((entry) => entry.id), ["evidence"]);
  assert.deepEqual(
    queryWorkspace(snapshot, "objects", { region: { minx: 400, miny: 0, maxx: 700, maxy: 200 } }).map((entry) => entry.id),
    ["evidence"]
  );
  assert.deepEqual(queryWorkspace(snapshot, "graph", { id: "root", direction: "descendants" }).map((entry) => entry.id), ["root", "branch"]);
  assert.ok(queryWorkspace(snapshot, "clusters", { distance: 250 }).length >= 2);
});

test("live indexes retrieve complete dense dependency, version, spatial, and temporal context", () => {
  const lenses = Array.from({ length: 500 }, (_, index) => ({
    id: `function-${index}`,
    stableId: `function-${index}`,
    version: index + 1,
    name: `Function ${index}`,
    kind: "pipeline",
    steps: index ? [`function-${index - 1}`] : [],
  }));
  const dense = buildWorkspaceSnapshot({
    items: Array.from({ length: 500 }, (_, index) => ({
      id: `item-${index}`,
      text: `Material ${index}`,
      x: index,
      y: index * 2,
      createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
    })),
    lenses,
  });
  assert.equal(queryWorkspace(dense, "dependencies", { ids: lenses.map((entry) => entry.id), limit: 500 }).length, 500);
  assert.equal(queryWorkspace(dense, "versions", { limit: 500 }).length, 500);
  assert.equal(queryWorkspace(dense, "spatial", { limit: 500 }).length, 500);
  assert.equal(queryWorkspace(dense, "temporal", { limit: 500 }).length, 500);
  assert.equal(queryWorkspace(dense, "material", { text: "Material 499", limit: 500 })[0].id, "item-499");
});

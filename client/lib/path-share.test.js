import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAiPath,
  materializeAiPath,
  pathStepCaption,
  loadPathWalkState,
  savePathWalkState,
} from "./path-share.js";

const chain = [
  { id: "a", nodeKind: "source", label: "seed", expandedText: "forgiveness is pressure release", x: 0, y: 0, radius: 26, createdAt: 100 },
  { id: "b", nodeKind: "expanded", label: "expand", opLabel: "expand", parentId: "a", expandedText: "the valve opens slowly", x: 180, y: 60, radius: 20, createdAt: 200 },
  { id: "c", nodeKind: "expanded", label: "invert", via: { name: "invert" }, parentId: "b", expandedText: "what if holding on is the release", x: 360, y: 20, radius: 20, createdAt: 300 },
  { id: "z", nodeKind: "source", label: "unrelated", x: -500, y: -500, radius: 26, createdAt: 50 },
];

describe("path-share", () => {
  it("builds an ordered path from lineage, excluding unrelated nodes", () => {
    const path = buildAiPath("c", chain);
    assert.equal(path.targetId, "c");
    assert.deepEqual(path.steps.map((s) => s.nodeId), ["a", "b", "c"]);
    assert.equal(path.nodes.length, 3);
    assert.equal(path.nodes.some((n) => n.id === "z"), false);
    assert.equal(path.steps[2].arrived, true);
    assert.equal(path.edges.length, 2);
    assert.equal(path.title, "what if holding on is the release");
  });

  it("captions steps with the operation that produced them", () => {
    assert.equal(pathStepCaption(chain[0], 0), "where it began");
    assert.equal(pathStepCaption(chain[1], 1), "through “expand”");
    assert.equal(pathStepCaption(chain[2], 2), "through “invert”");
  });

  it("includes convergence sources (sourceNodeIds) in the path", () => {
    const nodes = [
      ...chain,
      { id: "m", nodeKind: "move", label: "merge", parentId: "c", sourceNodeIds: ["z"], createdAt: 400, x: 500, y: 0 },
    ];
    const path = buildAiPath("m", nodes);
    assert.deepEqual(path.steps.map((s) => s.nodeId), ["z", "a", "b", "c", "m"]);
  });

  it("materializes with fresh ids, rewired lineage, and notes attached", () => {
    const path = buildAiPath("c", chain);
    const { nodes, idMap } = materializeAiPath(path, [], { notes: { b: "  a note here " } });
    assert.equal(nodes.length, 3);
    const na = nodes.find((n) => n.id === idMap.a);
    const nb = nodes.find((n) => n.id === idMap.b);
    const nc = nodes.find((n) => n.id === idMap.c);
    assert.notEqual(na.id, "a");
    assert.equal(nb.parentId, na.id);
    assert.equal(nc.parentId, nb.id);
    assert.equal(nb.pathNote, "a note here");
    assert.equal(nc.loading, false);
    assert.equal(nc.type, "ai-node");
    assert.equal(nc.sharedFrom.pathId, path.id);
  });

  it("offsets materialized nodes clear of the existing constellation", () => {
    const path = buildAiPath("c", chain);
    const existing = [{ id: "mine", x: 1000, y: 0, radius: 30 }];
    const { nodes } = materializeAiPath(path, existing);
    const minX = Math.min(...nodes.map((n) => n.x - (n.radius || 20)));
    assert.ok(minX >= 1030, `expected clear of existing bbox, got minX=${minX}`);
  });

  it("materializes a prefix for branching, then completes without duplicates", () => {
    const path = buildAiPath("c", chain);
    const first = materializeAiPath(path, [], { uptoStep: 1 });
    assert.equal(first.nodes.length, 2);
    const rest = materializeAiPath(path, first.nodes, {
      claimedIdMap: first.idMap,
      notes: { c: "my fork note" },
    });
    assert.equal(rest.nodes.length, 1);
    assert.equal(rest.nodes[0].parentId, first.idMap.b);
    // claimed prefix keeps its geometry, continuation stays aligned
    const a = first.nodes.find((n) => n.id === first.idMap.a);
    assert.equal(rest.nodes[0].x - a.x, 360);
  });

  it("persists walk state (notes survive) in storage", () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
    };
    savePathWalkState("p1", { stepIndex: 2, notes: { b: "hold this tension" } }, storage);
    const loaded = loadPathWalkState("p1", storage);
    assert.equal(loaded.stepIndex, 2);
    assert.equal(loaded.notes.b, "hold this tension");
  });
});

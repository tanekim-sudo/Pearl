import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AI_NODE_RADIUS,
  AI_SPAWN_MIN_DIST,
  AI_NODE_MIN_GAP,
  spawnChildPositions,
  layoutChildren,
  resolveOverlaps,
  collectAiEdges,
  childNodePosition,
  layoutAfterAppend,
} from "./ai-nodes.js";

describe("ai-nodes layout", () => {
  it("uses planet-scale radius constants", () => {
    assert.ok(AI_NODE_RADIUS.source <= 24);
    assert.ok(AI_SPAWN_MIN_DIST >= 200);
    assert.ok(AI_NODE_MIN_GAP >= 100);
  });

  it("fans multiple children without overlap at spawn distance", () => {
    const parent = { id: "p", x: 0, y: 0, radius: 22 };
    const positions = spawnChildPositions(parent, [], "expanded", 3);
    assert.equal(positions.length, 3);
    for (const pos of positions) {
      const d = Math.sqrt(pos.x ** 2 + pos.y ** 2);
      assert.ok(Math.abs(d - AI_SPAWN_MIN_DIST) < 1);
    }
    const d01 = Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y);
    assert.ok(d01 > AI_NODE_MIN_GAP);
  });

  it("layoutChildren spreads existing siblings", () => {
    const parent = { id: "p", x: 100, y: 100, parentId: null, radius: 22 };
    const c1 = { id: "c1", parentId: "p", x: 200, y: 100, radius: 20 };
    const c2 = { id: "c2", parentId: "p", x: 210, y: 105, radius: 20 };
    const laid = layoutChildren([parent, c1, c2], "p");
    const kids = laid.filter((n) => n.parentId === "p");
    const d = Math.hypot(kids[0].x - kids[1].x, kids[0].y - kids[1].y);
    assert.ok(d > 100);
  });

  it("resolveOverlaps pushes nodes apart", () => {
    const a = { id: "a", x: 0, y: 0, radius: 20 };
    const b = { id: "b", x: 10, y: 0, radius: 20 };
    const out = resolveOverlaps([a, b], 80);
    const d = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
    assert.ok(d >= 20 + 20 + 80 - 1);
  });

  it("childNodePosition accounts for existing siblings", () => {
    const parent = { id: "p", x: 0, y: 0, radius: 22 };
    const sib = { id: "s1", parentId: "p", x: 0, y: -240, radius: 20 };
    const pos = childNodePosition(parent, "expanded", [parent, sib]);
    assert.ok(Math.hypot(pos.x, pos.y - parent.y) >= AI_SPAWN_MIN_DIST - 1);
  });

  it("collectAiEdges gathers parentId and sourceNodeIds links", () => {
    const nodes = [
      { id: "src", nodeKind: "source", x: 0, y: 0 },
      { id: "exp", nodeKind: "expanded", parentId: "src", sourceNodeIds: ["src"], x: 200, y: 0 },
      { id: "mov", nodeKind: "move", sourceNodeIds: ["src"], x: 100, y: 100 },
    ];
    const edges = collectAiEdges(nodes);
    assert.ok(edges.some((e) => e.fromId === "src" && e.toId === "exp" && e.kind === "expand"));
    assert.ok(edges.some((e) => e.fromId === "src" && e.toId === "mov" && e.kind === "move"));
  });

  it("layoutAfterAppend fans and resolves", () => {
    const parent = { id: "p", x: 0, y: 0, radius: 22 };
    const n1 = { id: "c1", parentId: "p", x: 0, y: 0, radius: 20, nodeKind: "expanded" };
    const n2 = { id: "c2", parentId: "p", x: 5, y: 5, radius: 20, nodeKind: "expanded" };
    const out = layoutAfterAppend([parent], [n1, n2]);
    const kids = out.filter((n) => n.parentId === "p");
    const d = Math.hypot(kids[0].x - kids[1].x, kids[0].y - kids[1].y);
    assert.ok(d > 80);
  });
});

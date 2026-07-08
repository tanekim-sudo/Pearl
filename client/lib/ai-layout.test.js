import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  goldenSpiralPosition,
  layoutAfterAppend,
  layoutAiGraph,
  layoutSprings,
  nodeDepth,
  outwardAngle,
  suggestChildPosition,
  suggestRootPosition,
} from "./ai-layout.js";
import { AI_SPAWN_MIN_DIST, edgeGeometry, collectAiEdges } from "./ai-nodes.js";

describe("ai-layout spatial reasoning", () => {
  it("goldenSpiralPosition spreads roots apart", () => {
    const a = goldenSpiralPosition(0);
    const b = goldenSpiralPosition(1);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(d > 200);
  });

  it("suggestChildPosition places children at spawn distance from parent", () => {
    const parent = { id: "p", x: 400, y: 300, radius: 34, parentId: null };
    const pos = suggestChildPosition(parent, [parent], "expanded");
    const d = Math.hypot(pos.x - parent.x, pos.y - parent.y);
    assert.ok(Math.abs(d - AI_SPAWN_MIN_DIST) < 80);
  });

  it("suggestChildPosition fans siblings apart", () => {
    const parent = { id: "p", x: 0, y: 0, radius: 34, parentId: null };
    const a = suggestChildPosition(parent, [parent], "expanded", { slotIndex: 0, totalSlots: 3 });
    const b = suggestChildPosition(parent, [parent], "expanded", { slotIndex: 1, totalSlots: 3 });
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(d > 180);
  });

  it("outwardAngle continues lineage away from grandparent", () => {
    const gp = { id: "g", x: 0, y: 0 };
    const p = { id: "p", x: 100, y: 0, parentId: "g" };
    const angle = outwardAngle(p, [gp, p]);
    assert.ok(Math.abs(angle) < 0.2);
  });

  it("layoutSprings includes parent-child links", () => {
    const nodes = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a", sourceNodeIds: ["a"] },
    ];
    const springs = layoutSprings(nodes);
    assert.ok(springs.some((s) => s.fromId === "a" && s.toId === "b" && s.strong));
  });

  it("layoutAiGraph separates overlapping nodes", () => {
    const nodes = [
      { id: "a", x: 0, y: 0, radius: 30, parentId: null },
      { id: "b", x: 8, y: 0, radius: 30, parentId: "a" },
    ];
    const out = layoutAiGraph(nodes, { iterations: 80 });
    const d = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
    assert.ok(d > 120);
  });

  it("layoutAfterAppend connects new child near parent thread", () => {
    const parent = { id: "p", x: 500, y: 400, radius: 34, parentId: null, nodeKind: "source" };
    const child = {
      id: "c",
      x: 0,
      y: 0,
      radius: 30,
      parentId: "p",
      nodeKind: "expanded",
      sourceNodeIds: ["p"],
    };
    const out = layoutAfterAppend([parent], [child]);
    const c = out.find((n) => n.id === "c");
    const d = Math.hypot(c.x - parent.x, c.y - parent.y);
    assert.ok(d > AI_SPAWN_MIN_DIST * 0.7);
    assert.ok(d < AI_SPAWN_MIN_DIST * 1.8);
  });

  it("nodeDepth counts ancestry", () => {
    const nodes = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    assert.equal(nodeDepth(nodes, "c"), 2);
  });

  it("edgeGeometry path connects membrane to membrane", () => {
    const from = { x: 0, y: 0, radius: 30 };
    const to = { x: 500, y: 0, radius: 30 };
    const geom = edgeGeometry(from, to);
    assert.ok(geom.path.startsWith("M "));
    assert.ok(geom.path.includes("C"));
    const startDist = Math.hypot(geom.x1, geom.y1);
    assert.ok(startDist > 28 && startDist < 35);
    const endDist = Math.hypot(geom.x2 - 500, geom.y2);
    assert.ok(endDist > 28 && endDist < 35);
  });

  it("layoutAfterAppend keeps drop-pinned nodes at the release point", () => {
    const parent = { id: "p", x: 0, y: 0, radius: 34, parentId: null, nodeKind: "source" };
    const child = {
      id: "c",
      parentId: "p",
      sourceNodeIds: ["p"],
      nodeKind: "expanded",
      x: 900,
      y: 120,
      radius: 30,
      _dropPinned: true,
    };
    const laid = layoutAfterAppend([parent], [child]);
    const placed = laid.find((n) => n.id === "c");
    assert.ok(Math.abs(placed.x - 900) < 80);
    assert.ok(Math.abs(placed.y - 120) < 80);
  });

  it("collectAiEdges and layout produce connected graph body", () => {
    const parent = { id: "p", x: 200, y: 200, radius: 34, parentId: null, nodeKind: "source" };
    const child = {
      id: "c",
      parentId: "p",
      sourceNodeIds: ["p"],
      nodeKind: "expanded",
      x: 210,
      y: 205,
      radius: 30,
    };
    const laid = layoutAfterAppend([parent], [child]);
    const edges = collectAiEdges(laid);
    assert.equal(edges.length, 1);
    const geom = edgeGeometry(
      laid.find((n) => n.id === "p"),
      laid.find((n) => n.id === "c")
    );
    assert.ok(geom.len > 200);
  });
});

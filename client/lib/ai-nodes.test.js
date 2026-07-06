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
  edgeLabelForEdge,
  childNodePosition,
  layoutAfterAppend,
  fanStrandAngles,
  pickStrandIndex,
  collectStrandChoices,
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
      {
        id: "exp",
        nodeKind: "expanded",
        parentId: "src",
        sourceNodeIds: ["src"],
        opLabel: "summarize",
        x: 200,
        y: 0,
      },
      { id: "mov", nodeKind: "move", label: "reframe", sourceNodeIds: ["src"], x: 100, y: 100 },
    ];
    const edges = collectAiEdges(nodes);
    assert.ok(edges.some((e) => e.fromId === "src" && e.toId === "exp" && e.kind === "expand"));
    assert.ok(edges.some((e) => e.fromId === "src" && e.toId === "mov" && e.kind === "move"));
    const expandEdge = edges.find((e) => e.toId === "exp");
    assert.equal(expandEdge.label, "summarize");
    const moveEdge = edges.find((e) => e.toId === "mov");
    assert.equal(moveEdge.label, "reframe");
  });

  it("edgeLabelForEdge falls back to kind names", () => {
    assert.equal(edgeLabelForEdge(null, { nodeKind: "expanded" }, "expand"), "expand");
    assert.equal(edgeLabelForEdge(null, null, "link"), "link");
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

  it("fanStrandAngles spreads strands evenly", () => {
    const angles = fanStrandAngles(4, 0, Math.PI / 2);
    assert.equal(angles.length, 4);
    assert.ok(angles[0] < angles[3]);
  });

  it("pickStrandIndex finds nearest angle", () => {
    const angles = fanStrandAngles(3, Math.PI / 2);
    const idx = pickStrandIndex(Math.PI / 2, angles);
    assert.equal(idx, 1);
  });

  it("collectStrandChoices includes expand ops and toolbox moves", () => {
    const node = { id: "s", nodeKind: "source", sourceIds: ["a"] };
    const choices = collectStrandChoices(node, [], {
      expansionPrimitives: [{ id: "op-expand", name: "expand" }],
      topFunctions: [{ id: "f1", name: "summarize" }],
      moves: [{ id: "m1", name: "reframe" }],
      opMap: { m1: { id: "m1", name: "reframe" } },
    });
    assert.ok(choices.some((c) => c.kind === "expand"));
    assert.ok(choices.some((c) => c.label === "reframe"));
    assert.ok(choices.some((c) => c.label === "summarize"));
    assert.equal(choices.length, 3);
  });

  it("collectStrandChoices includes child move nodes on parent", () => {
    const node = { id: "src", nodeKind: "source", sourceIds: ["a"] };
    const allNodes = [
      node,
      { id: "mv", nodeKind: "move", opId: "m1", parentId: "src", label: "reframe" },
    ];
    const choices = collectStrandChoices(node, allNodes, {
      opMap: { m1: { id: "m1", name: "reframe" } },
      moves: [],
      topFunctions: [],
      expansionPrimitives: [],
    });
    assert.equal(choices.length, 1);
    assert.equal(choices[0].label, "reframe");
  });
});

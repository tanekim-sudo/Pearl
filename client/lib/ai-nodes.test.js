import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AI_NODE_RADIUS,
  AI_SPAWN_MIN_DIST,
  AI_NODE_MIN_GAP,
  attachPointOnNode,
  edgeGeometry,
  spawnChildPositions,
  layoutChildren,
  resolveOverlaps,
  collectAiEdges,
  edgeLabelForEdge,
  childNodePosition,
  layoutAfterAppend,
  fanStrandAngles,
  pickStrandIndex,
  resolveIntentChildPosition,
  collectStrandChoices,
} from "./ai-nodes.js";

describe("ai-nodes layout", () => {
  it("uses page-scale compact radius constants", () => {
    assert.ok(AI_NODE_RADIUS.source >= 14 && AI_NODE_RADIUS.source <= 18);
    assert.ok(AI_NODE_RADIUS.expanded >= 14 && AI_NODE_RADIUS.expanded <= 18);
    assert.ok(AI_SPAWN_MIN_DIST >= 90 && AI_SPAWN_MIN_DIST <= 140);
    assert.ok(AI_NODE_MIN_GAP >= 12 && AI_NODE_MIN_GAP <= 24);
  });

  it("fans multiple children without overlap at spawn distance", () => {
    const parent = { id: "p", x: 384, y: 552, radius: 18 };
    const positions = spawnChildPositions(parent, [], "expanded", 3);
    assert.equal(positions.length, 3);
    for (const pos of positions) {
      const d = Math.hypot(pos.x - parent.x, pos.y - parent.y);
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
    const parent = { id: "p", x: 384, y: 552, radius: 18 };
    const sib = { id: "s1", parentId: "p", x: 384, y: 440, radius: 16 };
    const pos = childNodePosition(parent, "expanded", [parent, sib]);
    assert.ok(Math.hypot(pos.x - parent.x, pos.y - parent.y) >= AI_SPAWN_MIN_DIST - 1);
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

  it("preserves all eight cursor rays across zoom-independent world intents", () => {
    const parent = { id: "p", x: 384, y: 552, radius: 18 };
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const intent = {
        x: parent.x + Math.cos(angle) * 180,
        y: parent.y + Math.sin(angle) * 180,
      };
      const pos = resolveIntentChildPosition(parent, intent, [parent], "expanded");
      assert.ok(pos.angleError <= 1e-8, `direction ${i} drifted`);
      assert.ok(Math.cos(angle) * (pos.x - parent.x) + Math.sin(angle) * (pos.y - parent.y) > 0);
    }
  });

  it("slides at most 20 degrees around a collision and stays cursor-facing", () => {
    const parent = { id: "p", x: 300, y: 400, radius: 18 };
    const blocker = { id: "b", x: 412, y: 400, radius: 16 };
    const pos = resolveIntentChildPosition(parent, { x: 480, y: 400 }, [parent, blocker], "expanded");
    assert.ok(pos.adjusted);
    assert.ok(pos.angleError <= (20 * Math.PI) / 180 + 1e-8);
    assert.ok(pos.x > parent.x, "collision adjustment must preserve the intended hemisphere");
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

  it("attachPointOnNode uses visual radius beyond node.radius", () => {
    const node = { x: 0, y: 0, radius: 30 };
    const pt = attachPointOnNode(node, 0, 100);
    const dist = Math.hypot(pt.x, pt.y);
    assert.ok(dist > 30, `edge should be outside core radius, got ${dist}`);
    assert.ok(dist < 42, `edge should stay near ring, got ${dist}`);
  });

  it("edgeGeometry end control curves into the child node", () => {
    const from = { x: 0, y: 0, radius: 30 };
    const to = { x: 500, y: 0, radius: 30 };
    const geom = edgeGeometry(from, to);
    const end = attachPointOnNode(to, from.x, from.y);
    const match = geom.path.match(/C [\d.-]+ [\d.-]+, ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+)/);
    assert.ok(match, "expected cubic path");
    const cx2 = parseFloat(match[1]);
    const x2 = parseFloat(match[3]);
    assert.ok(
      (end.ux < 0 && cx2 < x2) || (end.ux > 0 && cx2 > x2),
      `control point should trail outside child, cx2=${cx2} x2=${x2} ux=${end.ux}`
    );
  });

  it("attachPointOnNode stays on circle edge when text layout is present", () => {
    const node = { x: 100, y: 100, radius: 30 };
    const layout = { w: 28, h: 80, fontSize: 4, lineHeight: 1.28, pad: 6 };
    const pt = attachPointOnNode(node, 0, 100, {
      contentBlend: 1,
      textLayout: layout,
    });
    const dist = Math.hypot(pt.x - 100, pt.y - 100);
    assert.ok(dist > 28, `expected circle edge attach, got dist=${dist}`);
  });

  it("edgeGeometry end tangent points radially into the child (arrowhead never sideways)", () => {
    const from = { x: 0, y: 0, radius: 26 };
    const targets = [
      { x: 500, y: 300, radius: 26 },
      { x: 130, y: 40, radius: 26 },
    ];
    for (const to of targets) {
      for (const curveSign of [1, -1]) {
        for (const bundleOffset of [0, 14, 28, -28]) {
          const g = edgeGeometry(from, to, { curveSign, bundleOffset });
          // marker-end with orient="auto" follows the tangent p3 - p2
          const tangent = Math.atan2(g.y2 - g.cy2, g.x2 - g.cx2);
          const radialIn = Math.atan2(to.y - g.y2, to.x - g.x2);
          let diff = Math.abs(tangent - radialIn);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          assert.ok(
            diff < 0.02,
            `tangent off by ${((diff * 180) / Math.PI).toFixed(1)}° (sign=${curveSign}, bundle=${bundleOffset})`
          );
        }
      }
    }
  });

  it("edgeGeometry skips degenerate coincident nodes", () => {
    const node = { x: 50, y: 50, radius: 30 };
    const geom = edgeGeometry(node, { ...node, id: "b" });
    assert.ok(geom.tooShort || geom.path.includes("L"));
  });
});

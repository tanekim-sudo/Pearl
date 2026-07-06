import { AI_NODE_MIN_GAP, AI_NODE_RADIUS, AI_SPAWN_MIN_DIST } from "./ai-constants.js";
import {
  layoutAfterAppend,
  relayoutAiConstellation,
  suggestChildPosition,
  suggestRootPosition,
} from "./ai-layout.js";

export { AI_NODE_RADIUS, AI_SPAWN_MIN_DIST, AI_NODE_MIN_GAP };
export { layoutAfterAppend, relayoutAiConstellation, suggestChildPosition, suggestRootPosition };

export function nodePositionAt(existing, kind = "source", worldPos) {
  const radius = AI_NODE_RADIUS[kind] || 20;
  if (worldPos) {
    return { x: worldPos.x, y: worldPos.y, radius };
  }
  return nextAiNodePosition(existing, kind);
}

export function nextAiNodePosition(existing, kind = "source") {
  return suggestRootPosition(existing, kind);
}

/** Fan child positions around parent along the outward thread. */
export function spawnChildPositions(parent, existing, kind = "expanded", count = 1) {
  const siblings = existing.filter((n) => n.parentId === parent.id);
  const total = siblings.length + count;
  const positions = [];
  for (let j = 0; j < count; j++) {
    positions.push(
      suggestChildPosition(parent, existing, kind, {
        slotIndex: siblings.length + j,
        totalSlots: total,
      })
    );
  }
  return positions;
}

export function childNodePosition(parent, kind = "expanded", existing = []) {
  const [pos] = spawnChildPositions(parent, existing, kind, 1);
  return pos;
}

/** Re-fan all siblings of a parent into evenly spaced outward slots. */
export function layoutChildren(nodes, parentId) {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return nodes;
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length <= 1) return nodes;

  const n = children.length;
  return nodes.map((node) => {
    if (node.parentId !== parentId) return node;
    const idx = children.findIndex((c) => c.id === node.id);
    const pos = suggestChildPosition(
      parent,
      nodes.filter((x) => x.id !== node.id),
      node.nodeKind || "expanded",
      { slotIndex: idx, totalSlots: n }
    );
    return { ...node, x: pos.x, y: pos.y };
  });
}

/** Push overlapping nodes apart (single-pass iterative repulsion). */
export function resolveOverlaps(nodes, minGap = AI_NODE_MIN_GAP) {
  const result = nodes.map((n) => ({ ...n }));
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = (a.radius || 20) + (b.radius || 20) + minGap;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return result;
}

function edgeKindForNode(node) {
  if (node.nodeKind === "move") return "move";
  if (node.nodeKind === "expanded") {
    const label = String(node.opLabel || node.label || "").toLowerCase();
    if (label.includes("interpret")) return "interpret";
    return "expand";
  }
  return "branch";
}

/** Human-readable strand label from edge endpoints and kind. */
export function edgeLabelForEdge(fromNode, toNode, kind) {
  if (toNode) {
    for (const field of ["opLabel", "opName", "functionName", "methodName", "method", "label"]) {
      const value = toNode[field];
      if (value && String(value).trim() && String(value).trim() !== "···") {
        return String(value).trim();
      }
    }
  }
  if (fromNode?.nodeKind === "move" && fromNode.label) return fromNode.label;
  if (kind === "expand") return "expand";
  if (kind === "interpret") return "interpret";
  if (kind === "move") return "move";
  if (kind === "link") return "link";
  if (kind === "branch") return "derive";
  return kind || "link";
}

/** Collect all lineage / related-concept edges from node graph. */
export function collectAiEdges(nodes) {
  const edges = [];
  const seen = new Set();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  function add(fromId, toId, kind) {
    if (!fromId || !toId || fromId === toId) return;
    const key = `${fromId}-${toId}`;
    if (seen.has(key)) return;
    if (!byId.has(fromId) || !byId.has(toId)) return;
    seen.add(key);
    const from = byId.get(fromId);
    const to = byId.get(toId);
    edges.push({
      id: key,
      fromId,
      toId,
      kind,
      label: edgeLabelForEdge(from, to, kind),
    });
  }

  for (const node of nodes) {
    if (node.parentId) {
      add(node.parentId, node.id, edgeKindForNode(node));
    }
    for (const sid of node.sourceNodeIds || []) {
      add(sid, node.id, node.nodeKind === "move" ? "move" : "link");
    }
  }
  return edges;
}

/** Perpendicular bundle offset so sibling strands don't stack on top of each other. */
export function edgeBundleOffsets(edges) {
  const byFrom = new Map();
  for (const e of edges) {
    if (!byFrom.has(e.fromId)) byFrom.set(e.fromId, []);
    byFrom.get(e.fromId).push(e.id);
  }
  const offsets = new Map();
  for (const ids of byFrom.values()) {
    const n = ids.length;
    ids.forEach((id, i) => {
      offsets.set(id, (i - (n - 1) / 2) * 14);
    });
  }
  return offsets;
}

/** Synaptic strand geometry — membrane to membrane with smooth cubic curve. */
export function edgeGeometry(from, to, opts = {}) {
  if (!from || !to) {
    return { x1: 0, y1: 0, x2: 0, y2: 0, cx: 0, cy: 0, len: 0, path: "M 0 0 L 0 0" };
  }
  const fr = from.radius || 20;
  const tr = to.radius || 20;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bundle = opts.bundleOffset || 0;
  const px = -uy * bundle;
  const py = ux * bundle;

  const x1 = from.x + ux * (fr + 2) + px;
  const y1 = from.y + uy * (fr + 2) + py;
  const x2 = to.x - ux * (tr + 2) + px;
  const y2 = to.y - uy * (tr + 2) + py;

  const curve = Math.min(len * 0.14, 96) * (opts.curveSign ?? 1);
  const cx1 = x1 + ux * curve * 0.45;
  const cy1 = y1 + uy * curve * 0.45;
  const cx2 = x2 - ux * curve * 0.45;
  const cy2 = y2 - uy * curve * 0.45;
  const midX = (x1 + x2) / 2 + px * 0.5;
  const midY = (y1 + y2) / 2 + py * 0.5;

  return {
    x1,
    y1,
    x2,
    y2,
    cx: midX,
    cy: midY,
    cx1,
    cy1,
    cx2,
    cy2,
    len,
    path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
  };
}

export function makeAiNode({ nodeKind, label, id, ...rest }) {
  return {
    id: id || Math.random().toString(36).slice(2, 10),
    type: "ai-node",
    nodeKind,
    label: label || nodeKind,
    sourceIds: [],
    sourceNodeIds: [],
    expandedText: null,
    opId: null,
    preview: null,
    parentId: null,
    loading: false,
    error: null,
    x: 0,
    y: 0,
    radius: AI_NODE_RADIUS[nodeKind] || 20,
    ...rest,
  };
}

export function truncateLabel(text, max = 22) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

/** Evenly fan strand angles around a base direction (radians). */
export function fanStrandAngles(count, baseAngle = 0, spread = Math.PI * 0.82) {
  if (count <= 0) return [];
  if (count === 1) return [baseAngle];
  const start = baseAngle - spread / 2;
  return Array.from({ length: count }, (_, i) => start + (spread * i) / (count - 1));
}

/** Pick the strand index whose angle is closest to pointerAngle. */
export function pickStrandIndex(pointerAngle, angles) {
  if (!angles?.length) return -1;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < angles.length; i++) {
    let diff = Math.abs(pointerAngle - angles[i]);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/**
 * Build operation choices for strand drag-out — one strand per loaded function on the node.
 * @returns {{ id: string, label: string, kind: string, op?: object }[]}
 */
export function collectStrandChoices(
  node,
  allNodes = [],
  { expansionPrimitives = [], topFunctions = [], moves = [], opMap = {} } = {}
) {
  if (!node) return [];
  const choices = [];
  const seen = new Set();
  const push = (choice) => {
    if (seen.has(choice.id)) return;
    seen.add(choice.id);
    choices.push(choice);
  };

  for (const child of allNodes) {
    if (child.nodeKind !== "move" || !child.opId) continue;
    if (child.parentId !== node.id && !child.sourceNodeIds?.includes(node.id)) continue;
    const op = opMap[child.opId];
    if (op) push({ id: `move-${op.id}`, label: child.label || op.name, kind: "move", op });
  }

  if (node.nodeKind === "session") {
    push({ id: "interpret", label: "interpret", kind: "interpret" });
  }

  const canExpand =
    node.sourceIds?.length ||
    node.nodeKind === "source" ||
    node.nodeKind === "expanded" ||
    node.nodeKind === "move";

  if (canExpand) {
    for (const op of expansionPrimitives) {
      push({ id: op.id, label: op.name, kind: "expand", op });
    }
  }

  for (const op of topFunctions) {
    push({ id: op.id, label: op.name, kind: "function", op });
  }

  for (const op of moves) {
    push({ id: `move-${op.id}`, label: op.name, kind: "move", op });
  }

  return choices;
}


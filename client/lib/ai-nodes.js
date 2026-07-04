export const AI_NODE_RADIUS = {
  source: 22,
  expanded: 20,
  move: 18,
  lens: 20,
  session: 22,
};

/** Minimum center-to-center distance from parent when spawning children. */
export const AI_SPAWN_MIN_DIST = 240;

/** Minimum gap between node edges during overlap resolution. */
export const AI_NODE_MIN_GAP = 120;

export function nodePositionAt(existing, kind = "source", worldPos) {
  const radius = AI_NODE_RADIUS[kind] || 20;
  if (worldPos) {
    return { x: worldPos.x, y: worldPos.y, radius };
  }
  return nextAiNodePosition(existing, kind);
}

export function nextAiNodePosition(existing, kind = "source") {
  const idx = existing.length;
  const cols = 3;
  const spacingX = 280;
  const spacingY = 240;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const radius = AI_NODE_RADIUS[kind] || 20;
  return {
    x: 80 + col * spacingX + radius,
    y: 80 + row * spacingY + radius,
    radius,
  };
}

/** Fan child positions around parent at AI_SPAWN_MIN_DIST. */
export function spawnChildPositions(parent, existing, kind = "expanded", count = 1) {
  const radius = AI_NODE_RADIUS[kind] || 20;
  const minDist = AI_SPAWN_MIN_DIST;
  const siblings = existing.filter((n) => n.parentId === parent.id);
  const totalCount = siblings.length + count;
  const positions = [];

  for (let j = 0; j < count; j++) {
    const idx = siblings.length + j;
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / Math.max(totalCount, 1);
    positions.push({
      x: parent.x + Math.cos(angle) * minDist,
      y: parent.y + Math.sin(angle) * minDist,
      radius,
    });
  }
  return positions;
}

export function childNodePosition(parent, kind = "expanded", existing = []) {
  const [pos] = spawnChildPositions(parent, existing, kind, 1);
  return pos;
}

/** Re-fan all siblings of a parent into an evenly spaced arc. */
export function layoutChildren(nodes, parentId) {
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return nodes;
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length <= 1) return nodes;

  const minDist = AI_SPAWN_MIN_DIST;
  const n = children.length;
  return nodes.map((node) => {
    if (node.parentId !== parentId) return node;
    const idx = children.findIndex((c) => c.id === node.id);
    const angle = -Math.PI / 2 + (2 * Math.PI * idx) / n;
    return {
      ...node,
      x: parent.x + Math.cos(angle) * minDist,
      y: parent.y + Math.sin(angle) * minDist,
    };
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
    edges.push({ id: key, fromId, toId, kind });
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

/** World-space line endpoints trimmed to node radii, with optional curve control point. */
export function edgeGeometry(from, to, curve = 0.06) {
  const fr = from.radius || 20;
  const tr = to.radius || 20;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = from.x + ux * fr;
  const y1 = from.y + uy * fr;
  const x2 = to.x - ux * tr;
  const y2 = to.y - uy * tr;
  const cx = (x1 + x2) / 2 + uy * len * curve;
  const cy = (y1 + y2) / 2 - ux * len * curve;
  return { x1, y1, x2, y2, cx, cy, len };
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

/** Apply layout after adding nodes: fan siblings + resolve overlaps. */
export function layoutAfterAppend(nodes, newNodes) {
  let updated = [...nodes, ...newNodes];
  const parentIds = new Set(newNodes.map((n) => n.parentId).filter(Boolean));
  for (const pid of parentIds) {
    updated = layoutChildren(updated, pid);
  }
  return resolveOverlaps(updated);
}

export const AI_NODE_RADIUS = {
  source: 42,
  expanded: 38,
  move: 34,
  lens: 36,
  session: 40,
};

export function nodePositionAt(existing, kind = "source", worldPos) {
  const radius = AI_NODE_RADIUS[kind] || 40;
  if (worldPos) {
    return { x: worldPos.x, y: worldPos.y, radius };
  }
  return nextAiNodePosition(existing, kind);
}

export function nextAiNodePosition(existing, kind = "source") {
  const idx = existing.length;
  const cols = 3;
  const spacingX = 100;
  const spacingY = 95;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const radius = AI_NODE_RADIUS[kind] || 40;
  return {
    x: 55 + col * spacingX + radius,
    y: 55 + row * spacingY + radius,
    radius,
  };
}

export function childNodePosition(parent, kind = "expanded", offset = { dx: 88, dy: 0 }) {
  return {
    x: parent.x + offset.dx,
    y: parent.y + offset.dy,
    radius: AI_NODE_RADIUS[kind] || 38,
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
    radius: AI_NODE_RADIUS[nodeKind] || 40,
    ...rest,
  };
}

export function truncateLabel(text, max = 22) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

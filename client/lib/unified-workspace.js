export const UNIFIED_WORKSPACE_VERSION = 2;
export const UNIFIED_WORKSPACE_KEY = "lens.unified-workspace.v2";
export const LEGACY_AI_OFFSET = Object.freeze({ x: 820, y: 180 });

function finiteCamera(camera) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.scale)) {
    return { x: 80, y: 56, scale: 0.72 };
  }
  return { x: camera.x, y: camera.y, scale: camera.scale };
}

/**
 * Copies the two legacy stores into one coordinate system. Legacy values are
 * inputs only: callers keep those keys intact as recovery sources.
 */
export function migrateUnifiedWorkspace({ items = [], nodes = [], camera = null, unified = null } = {}) {
  if (unified?.version === UNIFIED_WORKSPACE_VERSION) {
    return {
      ...unified,
      items: Array.isArray(unified.items) ? unified.items : items,
      nodes: Array.isArray(unified.nodes) ? unified.nodes : nodes,
      camera: finiteCamera(unified.camera || camera),
    };
  }

  const migratedNodes = (Array.isArray(nodes) ? nodes : []).map((node) => ({
    ...node,
    x: (Number.isFinite(node.x) ? node.x : 0) + LEGACY_AI_OFFSET.x,
    y: (Number.isFinite(node.y) ? node.y : 0) + LEGACY_AI_OFFSET.y,
    unifiedWorldVersion: UNIFIED_WORKSPACE_VERSION,
  }));

  return {
    version: UNIFIED_WORKSPACE_VERSION,
    migratedAt: new Date().toISOString(),
    camera: finiteCamera(camera),
    items: Array.isArray(items) ? items : [],
    nodes: migratedNodes,
  };
}

export function serializeUnifiedWorkspace({ items, nodes, camera }) {
  return JSON.stringify({
    version: UNIFIED_WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
    camera: finiteCamera(camera),
    items: Array.isArray(items) ? items : [],
    nodes: Array.isArray(nodes) ? nodes : [],
  });
}

export function worldPoint(camera, screenX, screenY) {
  return {
    x: (screenX - camera.x) / camera.scale,
    y: (screenY - camera.y) / camera.scale,
  };
}

export function hitUnifiedMaterial({ point, items = [], nodes = [], itemBBox, nodePad = 0 }) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const radius = (node.radius || 20) + nodePad;
    if (Math.hypot(point.x - node.x, point.y - node.y) <= radius) {
      return { domain: "node", id: node.id, value: node };
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const box = itemBBox?.(item);
    if (
      box &&
      point.x >= box.minx &&
      point.x <= box.maxx &&
      point.y >= box.miny &&
      point.y <= box.maxy
    ) {
      return { domain: "paper", id: item.id, value: item };
    }
  }
  return null;
}

/** Explicit precedence shared by UI tests and the input adapters. */
export function routeUnifiedGesture({ tool, hit, zone = "core", shiftKey = false, altKey = false, dragged = false }) {
  if (tool === "pen" || tool === "marker") return "draw";
  if (tool === "eraser") return "erase";
  if (tool === "highlight") return hit ? `highlight-${hit.domain}` : "highlight-stroke";
  if (altKey || (!hit && dragged)) return "pan";
  if (shiftKey && !hit) return "lasso";
  if (hit?.domain === "node") return zone === "edge" ? "node-operation-chooser" : "move-node";
  if (hit?.domain === "paper") return "move-paper";
  return dragged ? "lasso" : "create-text";
}

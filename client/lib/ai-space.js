import { clampScale, zoomAtPoint, MIN_SCALE, MAX_SCALE, ZOOM_STEP } from "./paper.js";

export { MIN_SCALE, MAX_SCALE, ZOOM_STEP, clampScale, zoomAtPoint };

/** Screen (viewport-local) → unbounded AI world coordinates. */
export function screenToWorld(camera, sx, sy) {
  return {
    x: (sx - camera.x) / camera.scale,
    y: (sy - camera.y) / camera.scale,
  };
}

/** AI world → screen (viewport-local) coordinates. */
export function worldToScreen(camera, wx, wy) {
  return {
    x: wx * camera.scale + camera.x,
    y: wy * camera.scale + camera.y,
  };
}

export function viewportCenterWorld(camera, vpWidth, vpHeight) {
  return screenToWorld(camera, vpWidth / 2, vpHeight / 2);
}

/** Default zoom for constellation view — tiny planet nodes, long strands. */
export const DEFAULT_CONSTELLATION_SCALE = 0.25;
/** Double-click / deep explore — readable text inside the node. */
export const EXPLORE_ZOOM_SCALE = 1.9;
/** Below this scale, nodes are pure brain-cell circles. */
export const AI_CELL_ZOOM_MAX = 0.72;
/** Crossfade from circle → text begins here. */
export const AI_BLEND_ZOOM_START = 0.82;
/** Text fully readable above this scale. */
export const AI_TEXT_ZOOM_FULL = 1.72;
export const CONSTELLATION_ZOOM_THRESHOLD = AI_BLEND_ZOOM_START;
/** Drag-out strand gestures only when zoomed out (brain-cell / constellation view). */
export const AI_STRAND_DRAG_MAX_SCALE = AI_CELL_ZOOM_MAX;
/** Below this scale, nodes render as dots/planets with no label text. */
export const AI_DOT_ONLY_THRESHOLD = 0.55;

/** Smooth 0→1 blend for circle-to-text transition (smoothstep). */
export function zoomContentBlend(scale) {
  if (scale <= AI_BLEND_ZOOM_START) return 0;
  if (scale >= AI_TEXT_ZOOM_FULL) return 1;
  const t = (scale - AI_BLEND_ZOOM_START) / (AI_TEXT_ZOOM_FULL - AI_BLEND_ZOOM_START);
  return t * t * (3 - 2 * t);
}

/** Nearest node to viewport center in world space. */
export function findNearestNodeToCenter(nodes, camera, vpWidth, vpHeight) {
  if (!nodes?.length) return null;
  const center = viewportCenterWorld(camera, vpWidth, vpHeight);
  let best = null;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = (n.x - center.x) ** 2 + (n.y - center.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function centerAiCamera(vpWidth, vpHeight, scale = DEFAULT_CONSTELLATION_SCALE) {
  return {
    scale: clampScale(scale),
    x: vpWidth / 2,
    y: vpHeight / 2,
  };
}

export function computeNodesBBox(nodes) {
  if (!nodes?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const r = n.radius || 20;
    minX = Math.min(minX, n.x - r);
    minY = Math.min(minY, n.y - r);
    maxX = Math.max(maxX, n.x + r);
    maxY = Math.max(maxY, n.y + r);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/** Fit all nodes in view at constellation zoom (planet view). */
export function fitAiConstellation(nodes, vpWidth, vpHeight, opts = {}) {
  const pad = opts.padding ?? 80;
  const minScale = opts.minScale ?? 0.12;
  const maxScale = opts.maxScale ?? DEFAULT_CONSTELLATION_SCALE;

  if (!nodes?.length) {
    return centerAiCamera(vpWidth, vpHeight, DEFAULT_CONSTELLATION_SCALE);
  }

  const bb = computeNodesBBox(nodes);
  if (!bb) {
    return centerAiCamera(vpWidth, vpHeight, DEFAULT_CONSTELLATION_SCALE);
  }

  if (bb.w < 1 && bb.h < 1) {
    return focusAiNode(nodes[0], vpWidth, vpHeight, maxScale);
  }

  const fitX = (vpWidth - pad * 2) / Math.max(bb.w, 160);
  const fitY = (vpHeight - pad * 2) / Math.max(bb.h, 160);
  const scale = clampScale(Math.min(fitX, fitY, maxScale));
  const finalScale = Math.max(scale, minScale);

  return {
    scale: finalScale,
    x: vpWidth / 2 - bb.cx * finalScale,
    y: vpHeight / 2 - bb.cy * finalScale,
  };
}

/** Center camera on a single node at exploration zoom. */
export function focusAiNode(node, vpWidth, vpHeight, targetScale = EXPLORE_ZOOM_SCALE) {
  const scale = clampScale(targetScale);
  return {
    scale,
    x: vpWidth / 2 - node.x * scale,
    y: vpHeight / 2 - node.y * scale,
  };
}

export function findNearestSourceNode(nodes, wx, wy) {
  const sources = nodes.filter((n) => n.nodeKind === "source" || n.nodeKind === "session");
  if (!sources.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const n of sources) {
    const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

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
export const EXPLORE_ZOOM_SCALE = 1.2;
export const CONSTELLATION_ZOOM_THRESHOLD = 0.8;

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

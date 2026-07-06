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
export const AI_BLEND_ZOOM_START = 0.76;
/** Text fully readable above this scale. */
export const AI_TEXT_ZOOM_FULL = 1.72;
/** Click-to-read zoom — card fills viewport with ~15px screen font. */
export const AI_READING_ZOOM = 2.35;
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

/**
 * Borderless text block for a node — world units, top-anchored at the cell rim.
 * The full response is laid out (no clipping); the camera scales to fit on click.
 */
export function nodeTextLayout(radius = 20, textLen = 0) {
  const w = Math.max(radius * 4.4, 148);
  const lineHeight = 1.48;
  const fontSize = fitTextFontSize(w, textLen, radius);
  const charsPerLine = Math.max(14, Math.floor(w / (fontSize * 0.52)));
  const lines = Math.max(1, Math.ceil(Math.max(textLen, 1) / charsPerLine));
  const h = lines * fontSize * lineHeight;
  return { w, h, fontSize, lineHeight, anchorY: -radius };
}

/** @deprecated Use nodeTextLayout */
export function nodeCardLayout(radius, textLen) {
  return nodeTextLayout(radius, textLen);
}

/** Readable world font for a given column width and response length. */
export function fitTextFontSize(w, textLen, radius = 20) {
  if (!textLen) return Math.max(5.5, radius * 0.32);
  const lineHeight = 1.48;
  const ideal = Math.min(9.5, Math.max(6, radius * 0.38));
  const charsPerLine = Math.max(14, Math.floor(w / (ideal * 0.52)));
  const lines = Math.ceil(textLen / charsPerLine);
  const maxH = Math.max(radius * 10, 520);
  const neededH = lines * ideal * lineHeight;
  if (neededH <= maxH) return ideal;
  return Math.max(4.6, maxH / (lines * lineHeight));
}

/** @deprecated Use fitTextFontSize */
export function fitCardFontSize(w, _h, textLen) {
  return fitTextFontSize(w, textLen);
}

/** Interpolate text footprint from inside the circle → full response layout. */
export function nodeTextLayoutAtBlend(radius, textLen, blend) {
  const full = nodeTextLayout(radius, textLen);
  const t = Math.min(1, Math.max(0, blend));
  const inner = radius * 1.88;
  return {
    w: inner + (full.w - inner) * t,
    h: inner + (full.h - inner) * t,
    fontSize: radius * 0.26 + (full.fontSize - radius * 0.26) * t,
    lineHeight: full.lineHeight,
    anchorY: full.anchorY,
  };
}

/**
 * Camera for click-to-read: top of the text at the viewport top, full response in frame.
 */
export function focusAiNodeRead(node, layout, vpWidth, vpHeight, opts = {}) {
  const topMargin = opts.topMargin ?? 44;
  const padX = opts.padX ?? 0.9;
  const padY = opts.padY ?? 0.9;
  const maxScale = opts.maxScale ?? AI_READING_ZOOM;
  const minScreenFontPx = opts.minScreenFontPx ?? 14;

  const fitScale = Math.min((vpWidth * padX) / layout.w, (vpHeight * padY) / layout.h);
  const minReadScale = minScreenFontPx / layout.fontSize;
  const scale = clampScale(Math.min(Math.max(fitScale, minReadScale), maxScale));

  const textTopWorld = node.y + layout.anchorY;
  return {
    scale,
    x: vpWidth / 2 - node.x * scale,
    y: topMargin - textTopWorld * scale,
  };
}

/** @deprecated Use nodeTextLayout + focusAiNodeRead */
export function readingCardForNode(vpWidth, vpHeight, text = "", opts = {}) {
  const layout = nodeTextLayout(20, String(text || "").length);
  const cam = focusAiNodeRead({ x: 0, y: 0, radius: 20 }, layout, vpWidth, vpHeight, opts);
  return {
    ...layout,
    targetScale: cam.scale,
    screenFontPx: layout.fontSize * cam.scale,
  };
}

/** @deprecated Use focusAiNodeRead */
export function focusAiNodeCard(node, card, vpWidth, vpHeight, topMargin = 48) {
  const layout = {
    w: card.w,
    h: card.h,
    fontSize: card.fontSize,
    anchorY: -(node.radius || 20),
  };
  return focusAiNodeRead(node, layout, vpWidth, vpHeight, { topMargin });
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

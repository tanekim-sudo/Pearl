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
 * The content card that replaces a node when zoomed in — sized to the node's
 * footprint, with a font size computed so the response fits the card.
 * All units are AI-world px (the camera scale makes them readable).
 */
export function nodeCardLayout(radius = 20, textLen = 0) {
  const w = Math.max(110, radius * 4.6);
  const h = Math.max(84, radius * 3.4);
  const fontSize = fitCardFontSize(w, h, textLen);
  return { w, h, fontSize };
}

/** Largest font (world px) at which ~textLen chars fit inside a w×h card. */
export function fitCardFontSize(w, h, textLen) {
  if (!textLen) return 7;
  // usable area after padding/header; avg glyph ≈ 0.52em wide × 1.5em line box
  const usable = w * h * 0.7;
  const perChar = 0.52 * 1.5;
  const fs = Math.sqrt(usable / (textLen * perChar));
  return Math.min(9, Math.max(4.2, fs));
}

/**
 * Viewport-sized reading card for click-to-zoom — fixed screen font, not shrunk for long text.
 */
export function readingCardForNode(vpWidth, vpHeight, text = "", opts = {}) {
  const targetScale = clampScale(
    opts.targetScale ?? Math.max(AI_TEXT_ZOOM_FULL + 0.15, AI_READING_ZOOM)
  );
  const screenFontPx = opts.screenFontPx ?? 15;
  const fontSize = screenFontPx / targetScale;
  const lineHeight = 1.5;
  const charsPerLine = Math.max(
    28,
    Math.floor((vpWidth * 0.78) / targetScale / (fontSize * 0.52))
  );
  const lines = Math.max(5, Math.ceil(String(text || "").length / charsPerLine));
  const padY = fontSize * 2.6;
  const w = (vpWidth * 0.82) / targetScale;
  const h = Math.min((vpHeight * 0.86) / targetScale, lines * fontSize * lineHeight + padY);
  return { w, h, fontSize, targetScale, screenFontPx };
}

/**
 * Camera that frames a node's content card like an open chat message:
 * card fills most of the viewport, read from the top.
 */
export function focusAiNodeCard(node, card, vpWidth, vpHeight, topMargin = 48) {
  const scale = clampScale(
    card.targetScale ??
      Math.min((vpWidth * 0.82) / card.w, (vpHeight * 0.86) / card.h, AI_READING_ZOOM)
  );
  return {
    scale,
    x: vpWidth / 2 - node.x * scale,
    y: topMargin - (node.y - card.h / 2) * scale,
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

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
export const EXPLORE_ZOOM_SCALE = 1.25;
/** Below this scale, nodes are pure circles. */
export const AI_CELL_ZOOM_MAX = 0.85;
/** Crossfade from circle → text begins here (wider band = longer morph). */
export const AI_BLEND_ZOOM_START = 0.72;
/** Text fully readable above this scale. */
export const AI_TEXT_ZOOM_FULL = 1.28;
/** Click-to-read zoom — card fills viewport with ~15px screen font. */
export const AI_READING_ZOOM = 2.35;
export const CONSTELLATION_ZOOM_THRESHOLD = AI_BLEND_ZOOM_START;
/** Drag-out strand gestures only when zoomed out (brain-cell / constellation view). */
export const AI_STRAND_DRAG_MAX_SCALE = AI_CELL_ZOOM_MAX;
/** Below this scale, nodes are pure circles (no readable text). */
export const AI_DOT_ONLY_THRESHOLD = 0.35;

/** AI-space zoom bounds: constellation dots up to comfortably past reading zoom. */
export const AI_MIN_SCALE = 0.05;
export const AI_MAX_SCALE = 3.2;

/** Clamp an AI camera's scale to the usable zoom band (pan stays free). */
export function clampAiCamera(camera) {
  if (!camera) return camera;
  const scale = Math.max(AI_MIN_SCALE, Math.min(AI_MAX_SCALE, camera.scale));
  return scale === camera.scale ? camera : { ...camera, scale };
}

/** @deprecated Text opacity now tracks zoomContentBlend directly — no separate gate. */
export const AI_TEXT_VISIBLE_MIN_BLEND = 0;

/** Smooth 0→1 blend tied continuously to zoom (no mode switches). */
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

/** Word-wrap text to an approximate character width per line. */
function wrapTextLines(text, maxCharsPerLine) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (trial.length > maxCharsPerLine && line) {
      lines.push(line);
      line = word;
      while (line.length > maxCharsPerLine) {
        lines.push(line.slice(0, maxCharsPerLine));
        line = line.slice(maxCharsPerLine);
      }
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Text laid out to fit inside the node circle — scales font down for long responses.
 */
export function nodeTextLayout(radius = 20, textLen = 0, text = "") {
  const d = radius * 2;
  const pad = radius * 0.22;
  const maxW = d - pad * 2;
  const maxH = d - pad * 2;
  const lineHeight = 1.28;
  const charW = 0.54;
  const sample = text || (textLen ? "x".repeat(textLen) : "");

  if (!textLen && !sample) {
    return { w: maxW, h: maxH, fontSize: radius * 0.22, lineHeight, pad };
  }

  let fontSize = Math.min(radius * 0.28, maxH / 2.6);
  let lines = [""];
  for (let i = 0; i < 64; i++) {
    const charsPerLine = Math.max(3, Math.floor(maxW / (fontSize * charW)));
    lines = wrapTextLines(sample, charsPerLine);
    const h = lines.length * fontSize * lineHeight;
    if (h <= maxH) break;
    fontSize *= 0.88;
    if (fontSize < 2.4) break;
  }

  const h = Math.min(maxH, lines.length * fontSize * lineHeight);

  return { w: maxW, h, fontSize, lineHeight, pad, lineCount: lines.length };
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

/**
 * Blend-aware layout: at blend 0 the text sits clipped inside the circle; as
 * blend rises with zoom, the circle relaxes into a wider rounded card so the
 * silhouette genuinely stops being a circle at full text zoom.
 *
 * One silhouette rule: the node RING must be drawn with this exact geometry
 * (boxW/boxH/cornerRadius) so text can never spill past a visible circle —
 * the circle and the text share one shape that morphs and fades together.
 * Growth is delayed (starts ~35% into the fade) so the circle reads as a
 * circle while it is still strongly visible.
 */
export function nodeTextLayoutAtBlend(radius, textLen, blend = 0, text = "") {
  const t = Math.max(0, Math.min(1, blend || 0));
  const d = radius * 2;
  if (t <= 0.001) {
    const base = nodeTextLayout(radius, textLen, text);
    return { ...base, boxW: d, boxH: d, cornerRadius: radius };
  }

  // Shape growth lags the fade: no distortion until the ring is already going.
  const g = t <= 0.35 ? 0 : (t - 0.35) / 0.65;
  const gs = g * g * (3 - 2 * g);

  const boxW = d * (1 + 0.6 * gs);
  const boxH = d * (1 + 0.22 * gs);
  const pad = radius * (0.22 - 0.1 * t);
  const maxW = boxW - pad * 2;
  const maxH = boxH - pad * 2;
  const lineHeight = 1.28 + 0.14 * t;
  const charW = 0.54;
  const sample = text || (textLen ? "x".repeat(textLen) : "");

  let fontSize = Math.min(radius * (0.28 + 0.04 * t), maxH / 2.6);
  let lines = [""];
  for (let i = 0; i < 64; i++) {
    const charsPerLine = Math.max(3, Math.floor(maxW / (fontSize * charW)));
    lines = wrapTextLines(sample, charsPerLine);
    const h = lines.length * fontSize * lineHeight;
    if (h <= maxH) break;
    fontSize *= 0.88;
    if (fontSize < 2.4) break;
  }
  const h = Math.min(maxH, lines.length * fontSize * lineHeight);

  return {
    w: maxW,
    h,
    fontSize,
    lineHeight,
    pad,
    lineCount: lines.length,
    boxW,
    boxH,
    cornerRadius: radius * (1 - gs) + 12 * gs,
  };
}

/**
 * Camera for click-to-read: top of the text at the viewport top, full response in frame.
 */
export function focusAiNodeRead(node, layout, vpWidth, vpHeight, opts = {}) {
  const topMargin = opts.topMargin ?? 44;
  const maxScale = opts.maxScale ?? AI_READING_ZOOM;
  const minScreenFontPx = opts.minScreenFontPx ?? 13;
  const d = (node.radius || 20) * 2;

  const fitScale = Math.min((vpWidth * 0.55) / d, (vpHeight * 0.55) / d);
  const minReadScale = minScreenFontPx / layout.fontSize;
  const scale = clampScale(Math.min(Math.max(fitScale, minReadScale), maxScale));

  // Content taller than the viewport: read from the top, not the middle.
  const boxH = (layout.boxH || d) * scale;
  if (boxH > vpHeight - topMargin * 2) {
    const boxTopWorld = node.y - (layout.boxH || d) / 2;
    return {
      scale,
      x: vpWidth / 2 - node.x * scale,
      y: topMargin - boxTopWorld * scale,
    };
  }
  return focusAiNode(node, vpWidth, vpHeight, scale);
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

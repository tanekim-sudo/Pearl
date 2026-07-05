/** 8×11.5 paper at 96dpi — content lives in 0..width × 0..height. */
export const PAPER_WIDTH = 768;
export const PAPER_HEIGHT = 1104;
export const PAPER_MARGIN = 24;
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 1e6;
export const ZOOM_STEP = 1.2;
export const PAPER_INK = "#000000";

export function clampScale(scale) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function zoomAtPoint(camera, localX, localY, factor) {
  const scale = clampScale(camera.scale * factor);
  const wx = (localX - camera.x) / camera.scale;
  const wy = (localY - camera.y) / camera.scale;
  return { scale, x: localX - wx * scale, y: localY - wy * scale };
}

export function centerPaperCamera(vpWidth, vpHeight, scale = null) {
  const pad = 40;
  const fit = Math.min(
    (vpWidth - pad) / PAPER_WIDTH,
    (vpHeight - pad) / PAPER_HEIGHT,
    1
  );
  const s = clampScale(scale ?? fit);
  return {
    scale: s,
    x: (vpWidth - PAPER_WIDTH * s) / 2,
    y: (vpHeight - PAPER_HEIGHT * s) / 2,
  };
}

export function clampToPaper(x, y, margin = 0) {
  return {
    x: Math.max(margin, Math.min(PAPER_WIDTH - margin, x)),
    y: Math.max(margin, Math.min(PAPER_HEIGHT - margin, y)),
  };
}

export function maxTextWidth(margin = PAPER_MARGIN) {
  return PAPER_WIDTH - margin * 2;
}

/** Offset needed so a bbox fits inside paper margins. */
export function bboxClampOffset(bb, margin = PAPER_MARGIN) {
  if (!bb) return { dx: 0, dy: 0 };
  let dx = 0;
  let dy = 0;
  if (bb.minx < margin) dx = margin - bb.minx;
  if (bb.miny < margin) dy = margin - bb.miny;
  if (bb.maxx + dx > PAPER_WIDTH - margin) dx = PAPER_WIDTH - margin - bb.maxx;
  if (bb.maxy + dy > PAPER_HEIGHT - margin) dy = PAPER_HEIGHT - margin - bb.maxy;
  return { dx, dy };
}

/** Move an item so its bbox stays within paper margins. */
export function clampItemToPaper(item, getBBox, margin = PAPER_MARGIN) {
  if (!item) return item;
  let next = item;
  if (next.type === "text") {
    const w = clampTextWidth(next.w, margin);
    const x = Math.max(margin, Math.min(next.x ?? 0, PAPER_WIDTH - margin - w));
    const y = Math.max(margin, next.y ?? 0);
    next = { ...next, w, x, y };
  }
  const bb = getBBox?.(next);
  if (!bb) return next;
  const { dx, dy } = bboxClampOffset(bb, margin);
  if (!dx && !dy) return next;
  if (next.type === "stroke" && next.points?.length) {
    return {
      ...next,
      points: next.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    };
  }
  if (next.x != null || next.y != null) {
    return { ...next, x: (next.x || 0) + dx, y: (next.y || 0) + dy };
  }
  return next;
}

export function clampTextWidth(w, margin = PAPER_MARGIN) {
  return Math.max(120, Math.min(w || maxTextWidth(margin), maxTextWidth(margin)));
}

/** Fit the full paper sheet in a viewport (alias for centerPaperCamera). */
export function fitPaperInView(vpWidth, vpHeight) {
  return centerPaperCamera(vpWidth, vpHeight);
}

/** Pan is meaningful only when the zoomed paper exceeds the viewport. */
export function paperAllowsPan(scale, vpWidth, vpHeight) {
  return scale * PAPER_WIDTH > vpWidth + 2 || scale * PAPER_HEIGHT > vpHeight + 2;
}

export function describeStroke(stroke) {
  if (!stroke?.points?.length) return "";
  const pts = stroke.points;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = ((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(0);
  const cy = ((Math.min(...ys) + Math.max(...ys)) / 2).toFixed(0);
  const tool = stroke.highlight ? "highlighter" : stroke.marker ? "marker" : "pen";
  const voice = stroke.instructionText ? ` (voice: "${stroke.instructionText}")` : "";
  const t0 = pts[0]?.t != null ? ` @${pts[0].t}ms` : "";
  return `${tool} stroke near (${cx},${cy})${t0}${voice}`;
}

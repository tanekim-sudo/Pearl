/** 8×11.5 paper at 96dpi — content lives in 0..width × 0..height. */
export const PAPER_WIDTH = 768;
export const PAPER_HEIGHT = 1104;
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 1e6;
export const ZOOM_STEP = 1.2;

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

export function clampToPaper(x, y) {
  return {
    x: Math.max(0, Math.min(PAPER_WIDTH, x)),
    y: Math.max(0, Math.min(PAPER_HEIGHT, y)),
  };
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

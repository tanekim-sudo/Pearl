export const COLUMN_LAYOUT_KEY = "lens.column-layout.v1";

export const DEFAULT_COLUMN_LAYOUT = { left: 280, right: 340 };

export const MIN_COLUMN_W = 0;
export const MIN_PAPER_W = 0;
export const SNAP_COLLAPSE_W = 44;
export const BOUNDARY_W = 12;

export function snapColumnWidth(w) {
  if (w <= 0) return 0;
  if (w < SNAP_COLLAPSE_W) return 0;
  return w;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** @param {number} gridWidth viewport width of the three-column grid */
export function clampColumnLayout(layout, gridWidth) {
  const seams = BOUNDARY_W * 2;
  const maxSpan = Math.max(0, gridWidth - seams);
  let left = snapColumnWidth(clamp(layout.left, 0, maxSpan));
  let right = snapColumnWidth(clamp(layout.right, 0, maxSpan));
  let paper = gridWidth - left - right - seams;
  if (paper < 0) {
    const overflow = -paper;
    const total = left + right || 1;
    left = Math.max(0, left - Math.round(overflow * (left / total)));
    right = Math.max(0, right - Math.round(overflow * (right / total)));
    left = snapColumnWidth(left);
    right = snapColumnWidth(right);
  }
  return { left, right };
}

export function loadColumnLayout() {
  try {
    const raw = localStorage.getItem(COLUMN_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_COLUMN_LAYOUT };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "number" && typeof parsed?.right === "number") {
      return {
        left: snapColumnWidth(clamp(parsed.left, 0, 720)),
        right: snapColumnWidth(clamp(parsed.right, 0, 720)),
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_COLUMN_LAYOUT };
}

export function saveColumnLayout(layout) {
  try {
    localStorage.setItem(COLUMN_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

/**
 * @param {'left' | 'right'} edge which column edge is being dragged
 * @param {number} startX pointer clientX at drag start
 * @param {number} currentX pointer clientX now
 * @param {{ left: number, right: number }} startLayout layout at drag start
 */
export function layoutAfterResizeDrag(edge, startX, currentX, startLayout) {
  const dx = currentX - startX;
  if (edge === "left") {
    return { ...startLayout, left: startLayout.left + dx };
  }
  return { ...startLayout, right: startLayout.right - dx };
}

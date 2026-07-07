export const COLUMN_LAYOUT_KEY = "lens.column-layout.v1";

export const DEFAULT_COLUMN_LAYOUT = { left: 280, right: 340 };

export const MIN_COLUMN_W = 180;
export const MIN_PAPER_W = 220;
export const BOUNDARY_W = 12;

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** @param {number} gridWidth viewport width of the three-column grid */
export function clampColumnLayout(layout, gridWidth) {
  const seams = BOUNDARY_W * 2;
  const maxSide = Math.max(MIN_COLUMN_W, gridWidth - MIN_PAPER_W - seams);
  const left = clamp(layout.left, MIN_COLUMN_W, maxSide);
  const right = clamp(layout.right, MIN_COLUMN_W, maxSide);
  const paper = gridWidth - left - right - seams;
  if (paper >= MIN_PAPER_W) {
    return { left, right };
  }
  const deficit = MIN_PAPER_W - paper;
  const leftShare = left / (left + right || 1);
  return {
    left: clamp(left - Math.round(deficit * leftShare), MIN_COLUMN_W, maxSide),
    right: clamp(right - Math.round(deficit * (1 - leftShare)), MIN_COLUMN_W, maxSide),
  };
}

export function loadColumnLayout() {
  try {
    const raw = localStorage.getItem(COLUMN_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_COLUMN_LAYOUT };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "number" && typeof parsed?.right === "number") {
      return {
        left: clamp(parsed.left, MIN_COLUMN_W, 720),
        right: clamp(parsed.right, MIN_COLUMN_W, 720),
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

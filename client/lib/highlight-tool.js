/**
 * Highlight tool — unified cross-surface selection and transfer primitive.
 *
 * Paper: brush strokes mark items; drag the golden selection across columns.
 * AI: brush strokes on node text mark a golden fragment; drag marked content to paper.
 */

export const HIGHLIGHT_TRANSFER_KIND = "highlight";
/** Minimum pointer travel before a highlight transfer drag activates. */
export const HIGHLIGHT_DRAG_THRESHOLD = 6;
/** Minimum stroke length to count as a text-marking gesture. */
export const HIGHLIGHT_MARK_MIN_PX = 3;

export function isHighlightTool(tool) {
  return tool === "highlight";
}

/** Text payload transferred from an AI node (prefers marked fragment). */
export function aiNodeTransferText(node, fragmentOverride = null) {
  const override = String(fragmentOverride || "").trim();
  if (override) return override;
  const golden = String(node?.goldenFragment || "").trim();
  if (golden) return golden;
  return String(node?.expandedText || node?.preview || node?.label || "").trim();
}

/** Preview string for the transfer ghost. */
export function highlightTransferPreview({ text, count = 1 } = {}) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (!flat) return count > 1 ? `${count} highlights` : "highlight";
  const clipped = flat.length > 180 ? `${flat.slice(0, 179)}…` : flat;
  return count > 1 ? `${clipped}  (+${count - 1})` : clipped;
}

/** Whether a node can be dragged to another surface with the highlight tool. */
export function aiNodeHighlightDraggable(node) {
  if (!node) return false;
  return !!aiNodeTransferText(node);
}

/** Whether the highlight layer should accept marking strokes on this node. */
export function aiNodeHighlightMarkable(node, contentBlend = 0) {
  if (!node?.expandedText?.trim()) return false;
  return contentBlend > 0.12;
}

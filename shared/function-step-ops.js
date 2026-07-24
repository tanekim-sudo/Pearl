/**
 * Canonical step-order ops for Function = ordered Moves.
 * Extracted from the original LensTreeEditor / function-tree-editor path
 * so Pearl Studio and classic editor share one reorder algorithm.
 */

/** @typedef {{ id: string, kind?: string, steps?: string[], [key: string]: unknown }} DraftOp */

/** @param {DraftOp[]} draftOps */
export function buildDraftMap(draftOps) {
  return Object.fromEntries((draftOps || []).map((op) => [op.id, op]));
}

/**
 * Reorder children of a pipeline parent (original LensTreeEditor semantics).
 * When moving down, toIndex is interpreted as the drop slot before adjustment.
 * @param {DraftOp[]} draftOps
 * @param {string} parentId
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function reorderStep(draftOps, parentId, fromIndex, toIndex) {
  const draftMap = buildDraftMap(draftOps);
  const parent = draftMap[parentId];
  if (!parent?.steps) return draftOps;
  const steps = [...parent.steps];
  if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex > steps.length) {
    return draftOps;
  }
  const [moved] = steps.splice(fromIndex, 1);
  const target = toIndex > fromIndex ? toIndex - 1 : toIndex;
  steps.splice(target, 0, moved);
  return draftOps.map((op) => (op.id === parentId ? { ...op, steps } : op));
}

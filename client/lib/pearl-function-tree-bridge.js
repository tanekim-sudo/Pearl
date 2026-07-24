/**
 * Bridge Pearl Function records ↔ original LensTreeEditor draft ops.
 * Pearl Studio boots without App.jsx, so the classic editor must mount here
 * as the default Function interior and save steps back onto the pearl entity.
 */

import {
  draftOpsToPearlFunctionFields,
  pearlFunctionToDraftOps,
} from "../../shared/pearl-function-moves.js";

export { reorderStep, buildDraftMap } from "../../shared/function-step-ops.js";
export {
  destinationIndicesToReorderStep,
  reorderFunctionMoves,
  draftOpsToPearlFunctionFields,
  pearlFunctionToDraftOps,
} from "../../shared/pearl-function-moves.js";

/** Build LensTreeEditor seed from a pearl Function (ordered Moves). */
export function pearlFunctionToEditorSeed(fn = {}) {
  const { seedOps, rootId, root } = pearlFunctionToDraftOps(fn);
  return {
    seedOps,
    seedRoot: root,
    rootId,
    editor: {
      mode: "edit",
      creationMode: "editor",
      objectKind: "function",
      seedOps,
      seedRoot: root,
      op: root,
      pearlFunctionId: rootId,
    },
  };
}

/** Convert saved LensTreeEditor draft ops back into pearl Function fields. */
export function editorOpsToPearlFunction(fn = {}, draftOps = [], rootId) {
  return draftOpsToPearlFunctionFields(fn, draftOps, rootId);
}

/** opMap for LensTreeEditor when Pearl Studio has no App operator store. */
export function draftOpsToOpMap(draftOps = []) {
  return Object.fromEntries((draftOps || []).map((op) => [op.id, op]));
}

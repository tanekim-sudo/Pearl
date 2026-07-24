/**
 * Bridge Pearl Function records ↔ original LensTreeEditor draft ops.
 * Pearl Studio boots without App.jsx, so the classic editor was orphaned
 * unless we remount it here and save steps back onto the pearl entity.
 */

import { buildDraftMap } from "../../shared/function-step-ops.js";
import { orderedMovesFromFunction } from "../../shared/pearl-function-moves.js";

const newId = () => `pf:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

/** Build LensTreeEditor seed from a pearl Function (ordered Moves). */
export function pearlFunctionToEditorSeed(fn = {}) {
  const moves = orderedMovesFromFunction(fn);
  const rootId = String(fn.id || newId());
  const stepOps = moves.map((move, index) => ({
    id: String(move.id || `move:${index + 1}`),
    kind: "prompt",
    name: move.name || `Move ${index + 1}`,
    description: move.description || "",
    prompt: move.description || `Perform: ${move.name || `Move ${index + 1}`}`,
    libraryKind: "move",
  }));
  const root = {
    id: rootId,
    kind: "pipeline",
    name: fn.name || fn.identity?.name || "Function",
    description: fn.description || "",
    steps: stepOps.map((step) => step.id),
    top: true,
    libraryKind: "function",
  };
  return {
    seedOps: [root, ...stepOps],
    seedRoot: root,
    rootId,
    editor: {
      mode: "edit",
      creationMode: "editor",
      objectKind: "function",
      seedOps: [root, ...stepOps],
      seedRoot: root,
      op: root,
      pearlFunctionId: rootId,
    },
  };
}

/** Convert saved LensTreeEditor draft ops back into pearl Function fields. */
export function editorOpsToPearlFunction(fn = {}, draftOps = [], rootId) {
  const map = buildDraftMap(draftOps);
  const root = map[rootId] || draftOps.find((op) => op.kind === "pipeline") || null;
  const stepIds = root?.steps || [];
  const steps = stepIds.map((id, index) => {
    const op = map[id] || {};
    return {
      id: String(op.id || `step:${index + 1}`),
      name: op.name || `Move ${index + 1}`,
      description: op.description || "",
      prompt: op.prompt || "",
      kind: "move",
      layerId: op.layerId || null,
    };
  });
  const graph = {
    nodes: steps.map((step) => ({
      id: step.id,
      layerId: step.layerId,
      name: step.name,
      description: step.description,
      kind: "move",
    })),
    edges: steps.slice(1).map((_, index) => ({
      from: steps[index].id,
      to: steps[index + 1].id,
      relation: "then",
    })),
  };
  return {
    ...fn,
    name: root?.name || fn.name || fn.identity?.name || "Function",
    description: root?.description || fn.description || "",
    steps,
    graph,
    definition: {
      ...(fn.definition || {}),
      steps,
      graph,
    },
  };
}

/** opMap for LensTreeEditor when Pearl Studio has no App operator store. */
export function draftOpsToOpMap(draftOps = []) {
  return Object.fromEntries((draftOps || []).map((op) => [op.id, op]));
}

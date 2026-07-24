/**
 * Function = ordered series of Moves.
 * Helpers for Studio/explorer: list, reorder, decompose — never lose step names.
 */

const bounded = (value, limit = 180) => String(value ?? "").slice(0, limit);

/** Extract ordered move/step list from a function layer or legacy function record. */
export function orderedMovesFromFunction(fn = {}) {
  const graphNodes = fn?.graph?.nodes || fn?.definition?.graph?.nodes || [];
  const steps = fn?.steps || fn?.definition?.steps || [];
  if (graphNodes.length) {
    return graphNodes.map((node, index) => {
      const step = steps[index];
      const stepName = typeof step === "string" ? step : step?.name || step?.label;
      const stepDesc = typeof step === "object" ? (step?.description || step?.prompt || "") : "";
      return {
        id: String(node.id || `step:${index + 1}`),
        name: bounded(node.name || stepName || `Move ${index + 1}`, 180),
        description: bounded(node.description || stepDesc, 4_000),
        layerId: node.layerId || null,
        kind: node.kind || "move",
        index,
      };
    });
  }
  return steps.map((step, index) => {
    if (typeof step === "string") {
      return { id: `step:${index + 1}`, name: bounded(step, 180), description: "", layerId: step, kind: "move", index };
    }
    return {
      id: String(step?.id || `step:${index + 1}`),
      name: bounded(step?.name || step?.label || `Move ${index + 1}`, 180),
      description: bounded(step?.description || step?.prompt || "", 4_000),
      layerId: step?.layerId || step?.id || null,
      kind: step?.kind || "move",
      index,
    };
  });
}

/** Reorder moves inside a function; returns patchable function fields. */
export function reorderFunctionMoves(fn = {}, fromIndex, toIndex) {
  const moves = orderedMovesFromFunction(fn);
  if (fromIndex < 0 || fromIndex >= moves.length || toIndex < 0 || toIndex >= moves.length || fromIndex === toIndex) {
    return { ok: false, reason: "invalid move indices", function: fn, moves };
  }
  const next = [...moves];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  const steps = next.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    kind: "move",
    layerId: entry.layerId,
  }));
  const graph = {
    nodes: steps.map((step, index) => ({
      id: step.id || `step:${index + 1}`,
      layerId: step.layerId,
      name: step.name,
      description: step.description,
      kind: "move",
    })),
    edges: steps.slice(1).map((_, index) => ({
      from: steps[index].id || `step:${index + 1}`,
      to: steps[index + 1].id || `step:${index + 2}`,
      relation: "then",
    })),
  };
  return {
    ok: true,
    moves: next.map((entry, index) => ({ ...entry, index })),
    function: { ...fn, steps, graph, definition: { ...(fn.definition || {}), steps, graph } },
  };
}

/**
 * Decompose one compound move into named sub-moves (local, no model).
 * Uses description sentence splits / "and" clauses when present.
 */
export function decomposeFunctionMove(fn = {}, moveIndex) {
  const moves = orderedMovesFromFunction(fn);
  const target = moves[moveIndex];
  if (!target) return { ok: false, reason: "move not found", function: fn, moves };
  const source = `${target.description || ""} ${target.name || ""}`.trim();
  const parts = source
    .split(/\s*(?:;|\n|,\s*(?=then\b)|(?:\band\b))\s*/i)
    .map((part) => part.replace(/^(?:then|and)\s+/i, "").trim())
    .filter((part) => part.length >= 3);
  const unique = [...new Set(parts)].slice(0, 6);
  if (unique.length < 2) {
    return {
      ok: false,
      reason: "Need a richer move description to decompose — ask Companion to expand this step, or edit its description.",
      function: fn,
      moves,
    };
  }
  const subMoves = unique.map((text, index) => ({
    id: `${target.id}:sub:${index + 1}`,
    name: bounded(text.replace(/^./, (c) => c.toUpperCase()), 180),
    description: bounded(text, 4_000),
    kind: "move",
    layerId: null,
  }));
  const nextMoves = [
    ...moves.slice(0, moveIndex),
    ...subMoves,
    ...moves.slice(moveIndex + 1),
  ];
  const steps = nextMoves.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    kind: "move",
    layerId: entry.layerId,
  }));
  const graph = {
    nodes: steps.map((step, index) => ({
      id: step.id || `step:${index + 1}`,
      layerId: step.layerId,
      name: step.name,
      description: step.description,
      kind: "move",
    })),
    edges: steps.slice(1).map((_, index) => ({
      from: steps[index].id || `step:${index + 1}`,
      to: steps[index + 1].id || `step:${index + 2}`,
      relation: "then",
    })),
  };
  return {
    ok: true,
    moves: nextMoves.map((entry, index) => ({ ...entry, index })),
    decomposedFrom: target,
    function: { ...fn, steps, graph, definition: { ...(fn.definition || {}), steps, graph } },
  };
}

/** Summarize pearl functions for clueless Studio header. */
export function summarizePearlFunctions(entity = {}) {
  const functions = entity.functions || entity.cognition?.layers?.filter((l) => l.kind === "function") || [];
  return functions.map((fn) => {
    const name = fn.name || fn.identity?.name || "Function";
    const moves = orderedMovesFromFunction({
      ...fn,
      steps: fn.steps || fn.definition?.steps,
      graph: fn.graph || fn.definition?.graph,
    });
    return { id: fn.id, name, moveCount: moves.length, moves };
  });
}

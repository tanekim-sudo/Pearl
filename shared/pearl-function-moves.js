/**
 * Function = ordered series of Moves.
 * Pearl-surface adapters for Studio list + Companion domain verbs.
 * Original full editor remains LensTreeEditor (see pearl-function-tree-bridge.js
 * and docs/pearl-function-moves-forensics.md) — do not treat this module as a
 * replacement for that path.
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

/** Resolve first/second/last/1/end or a move name to an index. */
export function resolveMoveIndex(moves = [], ref, { asTarget = false } = {}) {
  if (ref == null || ref === "") return -1;
  if (typeof ref === "number" && Number.isFinite(ref)) {
    const index = Math.trunc(ref);
    return index >= 0 && index < moves.length ? index : -1;
  }
  const raw = String(ref).trim().toLowerCase().replace(/[“”"']/g, "");
  if (!raw || !moves.length) return -1;
  if (/^(?:last|end|bottom)$/.test(raw)) return moves.length - 1;
  if (/^(?:first|start|top|1st|1)$/.test(raw)) return 0;
  if (/^(?:second|2nd|2)$/.test(raw)) return moves.length > 1 ? 1 : -1;
  if (/^(?:third|3rd|3)$/.test(raw)) return moves.length > 2 ? 2 : -1;
  if (/^(?:fourth|4th|4)$/.test(raw)) return moves.length > 3 ? 3 : -1;
  if (/^(?:fifth|5th|5)$/.test(raw)) return moves.length > 4 ? 4 : -1;
  const position = raw.match(/^(?:position\s+)?(\d+)(?:st|nd|rd|th)?$/i);
  if (position) {
    const n = Number(position[1]);
    // Positions are 1-based for humans; allow 0-based indices too when asTarget.
    if (n === 0 && asTarget) return 0;
    const index = n >= 1 ? n - 1 : -1;
    return index >= 0 && index < moves.length ? index : -1;
  }
  const exact = moves.findIndex((move) => String(move.name || "").trim().toLowerCase() === raw);
  if (exact >= 0) return exact;
  return moves.findIndex((move) => String(move.name || "").toLowerCase().includes(raw));
}

export function listPearlFunctionRecords(entity = {}) {
  const fromLegacy = Array.isArray(entity.functions) ? entity.functions : [];
  const fromLayers = (entity.cognition?.layers || []).filter((layer) => layer.kind === "function");
  const byId = new Map();
  for (const fn of [...fromLegacy, ...fromLayers]) {
    if (!fn?.id || byId.has(fn.id)) continue;
    byId.set(fn.id, {
      ...fn,
      name: fn.name || fn.identity?.name || "Function",
      steps: fn.steps || fn.definition?.steps,
      graph: fn.graph || fn.definition?.graph,
    });
  }
  return [...byId.values()];
}

export function resolvePearlFunction(entity = {}, { functionId, functionName } = {}) {
  const functions = listPearlFunctionRecords(entity);
  if (!functions.length) return null;
  if (functionId) {
    const hit = functions.find((fn) => fn.id === functionId);
    if (hit) return hit;
  }
  if (functionName) {
    const needle = String(functionName).trim().toLowerCase();
    const exact = functions.find((fn) => String(fn.name || "").toLowerCase() === needle);
    if (exact) return exact;
    const partial = functions.find((fn) => String(fn.name || "").toLowerCase().includes(needle));
    if (partial) return partial;
  }
  return functions.find((fn) => orderedMovesFromFunction(fn).length >= 2) || functions[0];
}

/** Build an entity patch that updates one Function's ordered Moves (Studio + Companion). */
export function buildPearlFunctionMovesPatch(entity = {}, fnId, nextFn) {
  const functions = (entity.functions || []).map((entry) => (
    entry.id === fnId
      ? {
        ...entry,
        steps: nextFn.steps,
        graph: nextFn.graph,
        name: nextFn.name || entry.name,
        description: nextFn.description || entry.description,
        definition: {
          ...(entry.definition || {}),
          steps: nextFn.steps,
          graph: nextFn.graph,
        },
      }
      : entry
  ));
  const layers = (entity.cognition?.layers || []).map((layer) => {
    if (layer.id !== fnId || layer.kind !== "function") return layer;
    return {
      ...layer,
      definition: {
        ...layer.definition,
        steps: nextFn.steps,
        graph: nextFn.graph,
      },
      steps: nextFn.steps,
      graph: nextFn.graph,
    };
  });
  return {
    functions,
    cognition: entity.cognition ? { ...entity.cognition, layers } : { layers },
  };
}

/**
 * Shared mutation used by Studio drag and Companion NL verbs.
 * operation: "reorder" | "decompose"
 */
export function mutatePearlFunctionMoves(entity = {}, args = {}) {
  const fn = resolvePearlFunction(entity, args);
  if (!fn) {
    return { ok: false, reason: "No Function with Moves on this pearl yet.", entity, moves: [] };
  }
  const moves = orderedMovesFromFunction(fn);
  if (args.operation === "decompose") {
    const moveIndex = args.moveIndex != null
      ? resolveMoveIndex(moves, args.moveIndex)
      : resolveMoveIndex(moves, args.move ?? args.moveName ?? args.from);
    const result = decomposeFunctionMove(fn, moveIndex);
    if (!result.ok) return { ...result, functionId: fn.id, functionName: fn.name };
    return {
      ...result,
      functionId: fn.id,
      functionName: fn.name,
      patch: buildPearlFunctionMovesPatch(entity, fn.id, result.function),
    };
  }
  const fromIndex = args.fromIndex != null
    ? resolveMoveIndex(moves, args.fromIndex)
    : resolveMoveIndex(moves, args.from ?? args.move ?? args.moveName);
  let toIndex = args.toIndex != null
    ? resolveMoveIndex(moves, args.toIndex, { asTarget: true })
    : resolveMoveIndex(moves, args.to, { asTarget: true });
  if (toIndex < 0 && /^(?:end|last)$/i.test(String(args.to || ""))) toIndex = moves.length - 1;
  const result = reorderFunctionMoves(fn, fromIndex, toIndex);
  if (!result.ok) return { ...result, functionId: fn.id, functionName: fn.name };
  return {
    ...result,
    functionId: fn.id,
    functionName: fn.name,
    patch: buildPearlFunctionMovesPatch(entity, fn.id, result.function),
  };
}

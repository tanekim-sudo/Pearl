/**
 * Lens composition grammar.
 *
 * A compound is a pinned, inspectable operator pipeline by default. Component
 * trees are copied into the compound while their source ids, versions and
 * content hashes remain on the root for provenance and reproducibility.
 */

export const LENS_GRAMMAR_VERSION = 2;
export const DEFAULT_OUTPUT_CONFIRM_CAP = 16;
export const HARD_OUTPUT_CAP = 64;

const asCount = (value) => Math.max(1, Math.floor(Number(value) || 1));

export function stableOperatorContent(op, opMap, seen = new Set()) {
  if (!op || seen.has(op.id)) return null;
  seen.add(op.id);
  const base = {
    kind: op.kind || "prompt",
    name: op.name || "",
    description: op.description || "",
    prompt: op.prompt || "",
    inputType: op.inputType || "text",
    outputType: op.outputType || op.outputBlockType || "text",
    inputArity: asCount(op.inputArity),
    outputCount: asCount(op.outputCount),
    fork: !!op.fork,
  };
  if (op.kind === "pipeline") {
    base.steps = (op.steps || []).map((id) => stableOperatorContent(opMap[id], opMap, seen));
  }
  return base;
}

export function contentFingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function operatorOutputCount(op, opMap, seen = new Set()) {
  if (!op || seen.has(op.id)) return 0;
  seen.add(op.id);
  if (op.kind !== "pipeline") return asCount(op.outputCount);
  const steps = (op.steps || []).map((id) => opMap[id]).filter(Boolean);
  if (!steps.length) return asCount(op.outputCount);
  let count = 1;
  for (const step of steps) {
    if (step.fork && step.kind === "pipeline") {
      const branchCounts = (step.steps || [])
        .map((id) => operatorOutputCount(opMap[id], opMap, new Set(seen)))
        .filter(Boolean);
      count *= branchCounts.reduce((sum, n) => sum + n, 0) || 1;
    } else {
      count *= operatorOutputCount(step, opMap, new Set(seen)) || 1;
    }
    if (count > HARD_OUTPUT_CAP) return count;
  }
  return count;
}

export function operatorContract(op, opMap) {
  return {
    inputType: op?.inputType || "text",
    outputType: op?.outputType || op?.outputBlockType || "text",
    inputArity: asCount(op?.inputArity),
    outputCount: operatorOutputCount(op, opMap) || 1,
  };
}

function acceptsType(inputType, outputType) {
  if (!inputType || inputType === "any" || !outputType || outputType === "any") return true;
  return String(inputType).split("|").includes(outputType);
}

export function componentIdsOf(op) {
  if (!op) return [];
  return (op.composition?.components || [])
    .flatMap((component) => [component.lensId, component.opId])
    .filter(Boolean);
}

export function hasCompositionCycle(rootId, componentOps, opMap) {
  const visiting = new Set();
  const visited = new Set();
  function walk(id) {
    if (!id) return false;
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const op = opMap[id] || componentOps.find((entry) => entry?.id === id);
    for (const childId of componentIdsOf(op)) {
      if (childId === rootId || walk(childId)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return componentOps.some((op) => walk(op?.id));
}

export function previewComposition(first, second, opMap, options = {}) {
  const errors = [];
  const warnings = [];
  if (!first || !second) errors.push("two lenses are required");
  if (first?.id && first.id === second?.id) errors.push("identical lens requires an explicit duplicate");
  const a = operatorContract(first, opMap);
  const b = operatorContract(second, opMap);
  if (b.inputArity !== 1) {
    errors.push(`${second?.name || "second lens"} requires ${b.inputArity} inputs; sequential stacking supplies one`);
  }
  if (!acceptsType(b.inputType, a.outputType)) {
    errors.push(`type mismatch: ${a.outputType} cannot feed ${b.inputType}`);
  }
  const predictedOutputCount = a.outputCount * b.outputCount;
  const confirmCap = options.confirmCap || DEFAULT_OUTPUT_CONFIRM_CAP;
  const hardCap = options.hardCap || HARD_OUTPUT_CAP;
  if (predictedOutputCount > hardCap) errors.push(`predicted ${predictedOutputCount} outputs exceeds hard cap ${hardCap}`);
  else if (predictedOutputCount > confirmCap) warnings.push(`confirm ${predictedOutputCount} predicted outputs`);
  const missing = [first, second].filter((op) => !op?.id);
  if (missing.length) errors.push("component is missing");
  if (options.rootId && hasCompositionCycle(options.rootId, [first, second], opMap)) {
    errors.push("composition would create a cycle");
  }
  return {
    ok: errors.length === 0,
    order: [first?.id, second?.id].filter(Boolean),
    label: `${first?.name || "A"} → ${second?.name || "B"}`,
    nameSuggestion: `${first?.name || "A"} → ${second?.name || "B"}`.slice(0, 72),
    inputContract: { type: a.inputType, arity: a.inputArity },
    outputContract: { type: b.outputType, count: predictedOutputCount },
    algebra: {
      mode: "sequential-map-cartesian",
      firstOutputs: a.outputCount,
      secondOutputsPerInput: b.outputCount,
      predictedOutputCount,
    },
    requiresConfirmation: predictedOutputCount > confirmCap && predictedOutputCount <= hardCap,
    errors,
    warnings,
  };
}

function cloneTree(root, opMap, idFactory, componentIndex) {
  const clones = [];
  const ids = new Map();
  function clone(op) {
    if (!op) throw new Error("missing component dependency");
    if (ids.has(op.id)) return ids.get(op.id);
    const id = idFactory();
    ids.set(op.id, id);
    const next = {
      ...op,
      id,
      top: false,
      sourceComponent: { index: componentIndex, opId: op.id, version: asCount(op.version) },
    };
    clones.push(next);
    if (op.kind === "pipeline") next.steps = (op.steps || []).map((stepId) => clone(opMap[stepId]));
    return id;
  }
  return { rootId: clone(root), ops: clones };
}

export function createCompoundOperator(first, second, opMap, options = {}) {
  const preview = previewComposition(first, second, opMap, options);
  if (!preview.ok) throw new Error(preview.errors.join("; "));
  if (preview.requiresConfirmation && !options.confirmed) {
    throw new Error(`confirmation required for ${preview.algebra.predictedOutputCount} outputs`);
  }
  const idFactory =
    options.idFactory ||
    (() => globalThis.crypto?.randomUUID?.() || `lens-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const rootId = options.rootId || idFactory();
  const a = cloneTree(first, opMap, idFactory, 0);
  const b = cloneTree(second, opMap, idFactory, 1);
  const component = (op) => ({
    lensId: op.lensId || op.id,
    opId: op.id,
    name: op.name || "lens",
    version: asCount(op.version),
    hash: contentFingerprint(stableOperatorContent(op, opMap)),
  });
  const now = options.now || Date.now();
  const root = {
    id: rootId,
    kind: "pipeline",
    top: true,
    name: (options.name || preview.nameSuggestion).trim(),
    description: options.description || `Sequential composition: ${preview.label}.`,
    steps: [a.rootId, b.rootId],
    lensKind: "compound",
    schemaVersion: LENS_GRAMMAR_VERSION,
    version: 1,
    inputType: preview.inputContract.type,
    outputType: preview.outputContract.type,
    outputCount: preview.outputContract.count,
    createdAt: now,
    updatedAt: now,
    composition: {
      mode: "sequential",
      linkMode: options.linkMode === "latest" ? "latest" : "pinned",
      components: [component(first), component(second)],
      algebra: preview.algebra,
    },
  };
  return { rootId, ops: [root, ...a.ops, ...b.ops], preview };
}

export function migrateOperatorGrammar(op) {
  if (!op || typeof op !== "object") return op;
  const next = {
    ...op,
    version: asCount(op.version),
    schemaVersion: op.schemaVersion || 1,
    inputType: op.inputType || "text",
    outputType: op.outputType || op.outputBlockType || "text",
    inputArity: asCount(op.inputArity),
    outputCount: asCount(op.outputCount),
  };
  if (next.composition) {
    next.schemaVersion = LENS_GRAMMAR_VERSION;
    next.lensKind = "compound";
    next.composition = {
      mode: "sequential",
      linkMode: next.composition.linkMode === "latest" ? "latest" : "pinned",
      components: (next.composition.components || []).map((component) => ({
        ...component,
        version: asCount(component.version),
      })),
      algebra: next.composition.algebra || null,
    };
  } else if (!next.lensKind) {
    next.lensKind = next.forgedFrom ? "forged" : next.primitive ? "primitive" : "custom";
  }
  return next;
}

export function validateCompoundDependencies(op, opMap) {
  const errors = [];
  if (!op?.composition) return { ok: true, errors };
  for (const component of op.composition.components || []) {
    if (op.composition.linkMode === "latest" && !opMap[component.opId]) {
      errors.push(`missing component ${component.name || component.opId}`);
    }
  }
  if (hasCompositionCycle(op.id, [op], opMap)) errors.push("composition cycle");
  return { ok: errors.length === 0, errors };
}

/**
 * Pure N→M algebra used by tests and non-UI runners. Every output from A is
 * independently fed to B; B may return one or many outputs.
 */
export async function executeSequentialAlgebra(inputs, runFirst, runSecond, options = {}) {
  const signal = options.signal;
  const cap = options.hardCap || HARD_OUTPUT_CAP;
  const firstOutputs = [];
  for (const input of Array.isArray(inputs) ? inputs : [inputs]) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const out = await runFirst(input);
    firstOutputs.push(...(Array.isArray(out) ? out : [out]));
  }
  const results = [];
  for (let ai = 0; ai < firstOutputs.length; ai += 1) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const out = await runSecond(firstOutputs[ai]);
    const branch = Array.isArray(out) ? out : [out];
    for (let bi = 0; bi < branch.length; bi += 1) {
      if (results.length >= cap) throw new Error(`output cap ${cap} exceeded`);
      results.push({
        value: branch[bi],
        lineage: [
          { step: 0, outputIndex: ai },
          { step: 1, inputIndex: ai, outputIndex: bi },
        ],
      });
    }
  }
  return results;
}

export function previewCompositionSequence(operators, opMap, options = {}) {
  const queue = (operators || []).filter(Boolean);
  if (!queue.length) return { ok: false, errors: ["queue at least one lens"], warnings: [], predictedOutputCount: 0 };
  let predictedOutputCount = operatorContract(queue[0], opMap).outputCount;
  const errors = [];
  const warnings = [];
  for (let index = 1; index < queue.length; index += 1) {
    const previous = { ...queue[index - 1], outputCount: predictedOutputCount };
    const preview = previewComposition(previous, queue[index], opMap, options);
    predictedOutputCount = preview.outputContract.count;
    errors.push(...preview.errors);
    warnings.push(...preview.warnings);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    order: queue.map((op) => op.id),
    label: queue.map((op) => op.name).join(" → "),
    predictedOutputCount,
    requiresConfirmation: warnings.length > 0,
  };
}

/**
 * State-independent GO gate. Queueing and selecting only update pending data;
 * commit is explicit, idempotent per key, and failed commits retain state.
 */
export function createPendingStackGate(initial = []) {
  let queue = [...initial];
  const committed = new Set();
  return {
    get queue() {
      return [...queue];
    },
    add(op) {
      if (op && !queue.some((entry) => entry.id === op.id)) queue = [...queue, op];
      return [...queue];
    },
    remove(index) {
      queue = queue.filter((_, itemIndex) => itemIndex !== index);
      return [...queue];
    },
    reorder(from, to) {
      if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return [...queue];
      const next = [...queue];
      const [entry] = next.splice(from, 1);
      next.splice(to, 0, entry);
      queue = next;
      return [...queue];
    },
    preview(opMap, options) {
      return previewCompositionSequence(queue, opMap, options);
    },
    async go(key, execute) {
      if (committed.has(key)) return { committed: false, duplicate: true, queue: [...queue] };
      try {
        const result = await execute([...queue]);
        committed.add(key);
        return { committed: true, result, queue: [...queue] };
      } catch (error) {
        return { committed: false, error, queue: [...queue] };
      }
    },
  };
}

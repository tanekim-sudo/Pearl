/** @typedef {{ id: string, kind: 'pipeline'|'prompt', name?: string, description?: string, prompt?: string, steps?: string[], [key: string]: unknown }} DraftOp */

export const FN_STEP_MIME = "application/lens-fn-step";
export const FN_PALETTE_MIME = "application/lens-fn-palette";

/** @param {DraftOp[]} draftOps */
export function buildDraftMap(draftOps) {
  return Object.fromEntries(draftOps.map((o) => [o.id, o]));
}

/** @param {string} rootId @param {Record<string, DraftOp>} draftMap */
export function collectSubtreeIds(rootId, draftMap) {
  const ids = new Set();
  function walk(id) {
    if (!id || ids.has(id)) return;
    ids.add(id);
    const op = draftMap[id];
    if (op?.kind === "pipeline" && op.steps) op.steps.forEach(walk);
  }
  walk(rootId);
  return ids;
}

/** @param {string} stepId @param {Record<string, DraftOp>} draftMap */
export function findParentId(stepId, draftMap) {
  for (const op of Object.values(draftMap)) {
    if (op.kind === "pipeline" && op.steps?.includes(stepId)) return op.id;
  }
  return null;
}

/** @param {string} ancestorId @param {string} descendantId @param {Record<string, DraftOp>} draftMap */
export function isAncestor(ancestorId, descendantId, draftMap) {
  if (ancestorId === descendantId) return true;
  return collectSubtreeIds(ancestorId, draftMap).has(descendantId);
}

/** @param {DraftOp[]} ops @param {string} parentId @param {string} stepId */
function removeFromParentSteps(ops, parentId, stepId) {
  return ops.map((o) => {
    if (o.id !== parentId || o.kind !== "pipeline" || !o.steps) return o;
    return { ...o, steps: o.steps.filter((id) => id !== stepId) };
  });
}

/** @param {DraftOp[]} ops @param {string} parentId @param {string} stepId @param {number} index */
function insertIntoParentSteps(ops, parentId, stepId, index) {
  return ops.map((o) => {
    if (o.id !== parentId || o.kind !== "pipeline" || !o.steps) return o;
    const steps = [...o.steps];
    const at = index == null || index < 0 ? steps.length : Math.min(index, steps.length);
    steps.splice(at, 0, stepId);
    return { ...o, steps };
  });
}

/** @param {DraftOp[]} draftOps @param {string} parentId @param {number} fromIndex @param {number} toIndex */
export function reorderStep(draftOps, parentId, fromIndex, toIndex) {
  const draftMap = buildDraftMap(draftOps);
  const parent = draftMap[parentId];
  if (!parent?.steps) return draftOps;
  const steps = [...parent.steps];
  if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex > steps.length) return draftOps;
  const [moved] = steps.splice(fromIndex, 1);
  const target = toIndex > fromIndex ? toIndex - 1 : toIndex;
  steps.splice(target, 0, moved);
  return draftOps.map((o) => (o.id === parentId ? { ...o, steps } : o));
}

/** @param {DraftOp[]} draftOps @param {string} stepId @param {string} newParentId @param {number} index */
export function moveStep(draftOps, stepId, newParentId, index) {
  const draftMap = buildDraftMap(draftOps);
  if (stepId === newParentId || isAncestor(stepId, newParentId, draftMap)) return draftOps;
  const oldParentId = findParentId(stepId, draftMap);
  if (!oldParentId) return draftOps;
  let next = removeFromParentSteps(draftOps, oldParentId, stepId);
  next = insertIntoParentSteps(next, newParentId, stepId, index);
  return next;
}

/** @param {DraftOp[]} draftOps @param {string} stepId @param {string} rootId */
export function removeStep(draftOps, stepId, rootId) {
  if (stepId === rootId) return draftOps;
  const draftMap = buildDraftMap(draftOps);
  const parentId = findParentId(stepId, draftMap);
  if (!parentId) return draftOps;
  const removeIds = collectSubtreeIds(stepId, draftMap);
  let next = removeFromParentSteps(draftOps, parentId, stepId);
  next = next.filter((o) => !removeIds.has(o.id));
  return next;
}

/** @param {string} subtreeRootId @param {Record<string, DraftOp>} draftMap @param {() => string} newId */
export function cloneSubtree(subtreeRootId, draftMap, newId) {
  const subtreeIds = [...collectSubtreeIds(subtreeRootId, draftMap)];
  const idMap = Object.fromEntries(subtreeIds.map((id) => [id, newId()]));
  const newOps = subtreeIds.map((id) => {
    const op = { ...draftMap[id], id: idMap[id] };
    if (op.kind === "pipeline" && op.steps) {
      op.steps = op.steps.map((sid) => idMap[sid] || sid);
    }
    return op;
  });
  return { ops: newOps, rootId: idMap[subtreeRootId] };
}

/** @param {DraftOp[]} draftOps @param {string} stepId @param {() => string} newId */
export function duplicateStep(draftOps, stepId, newId) {
  const draftMap = buildDraftMap(draftOps);
  const parentId = findParentId(stepId, draftMap);
  if (!parentId) return draftOps;
  const parent = draftMap[parentId];
  const index = parent.steps.indexOf(stepId);
  const { ops: cloned, rootId: clonedRoot } = cloneSubtree(stepId, draftMap, newId);
  let next = [...draftOps, ...cloned];
  next = insertIntoParentSteps(next, parentId, clonedRoot, index + 1);
  return next;
}

/** @param {DraftOp[]} draftOps @param {string} parentId @param {number} index @param {Partial<DraftOp>} partial @param {() => string} newId */
export function addLeafStep(draftOps, parentId, index, partial, newId) {
  const id = newId();
  const leaf = {
    id,
    kind: "prompt",
    name: partial?.name || "new step",
    description: partial?.description || "",
    prompt: partial?.prompt || "Return ONLY the step output.",
    ...partial,
    kind: "prompt",
    id,
  };
  let next = [...draftOps, leaf];
  next = insertIntoParentSteps(next, parentId, id, index);
  return { draftOps: next, stepId: id };
}

/** @param {DraftOp[]} draftOps @param {string} parentId @param {number} index @param {Partial<DraftOp>} partial @param {() => string} newId */
export function addPipelineStep(draftOps, parentId, index, partial, newId) {
  const id = newId();
  const pipeline = {
    id,
    kind: "pipeline",
    name: partial?.name || "group",
    description: partial?.description || "",
    steps: [],
    ...partial,
    kind: "pipeline",
    id,
    steps: partial?.steps || [],
  };
  let next = [...draftOps, pipeline];
  next = insertIntoParentSteps(next, parentId, id, index);
  return { draftOps: next, stepId: id };
}

/**
 * Drag a strand out of a step: continue its lane if it's the tail, otherwise
 * fork. Forks are pipelines with fork:true whose children are sibling
 * branches — each leaf branch produces its own output at run time.
 * @param {DraftOp[]} draftOps @param {string} stepId @param {Partial<DraftOp>} partial @param {() => string} newId
 * @returns {{ draftOps: DraftOp[], stepId: string|null, forked: boolean }}
 */
export function addBranchAtStep(draftOps, stepId, partial, newId) {
  const draftMap = buildDraftMap(draftOps);
  const parentId = findParentId(stepId, draftMap);
  if (!parentId) return { draftOps, stepId: null, forked: false };
  const parent = draftMap[parentId];
  const idx = parent.steps.indexOf(stepId);
  if (idx < 0) return { draftOps, stepId: null, forked: false };
  const branchBefore = partial?.branchSide === "before";

  const leafId = newId();
  const leaf = {
    id: leafId,
    kind: "prompt",
    name: partial?.name || "new branch",
    description: partial?.description || "",
    prompt: partial?.prompt || "Return ONLY the step output.",
    ...(partial?.moveRef ? { moveRef: partial.moveRef } : {}),
    ...(partial?.research ? { research: true } : {}),
  };

  if (parent.fork) {
    // stepId IS a whole branch: extend it linearly by wrapping into a lane.
    const pipeId = newId();
    const pipe = {
      id: pipeId,
      kind: "pipeline",
      name: draftMap[stepId]?.name || "branch",
      description: "",
      steps: [stepId, leafId],
    };
    const next = draftOps
      .map((o) =>
        o.id === parentId
          ? { ...o, steps: o.steps.map((sid) => (sid === stepId ? pipeId : sid)) }
          : o
      )
      .concat(pipe, leaf);
    return { draftOps: next, stepId: leafId, forked: false };
  }

  const rest = parent.steps.slice(idx + 1);
  if (!rest.length) {
    // Tail of its lane: plain linear continuation.
    const next = [...draftOps, leaf].map((o) =>
      o.id === parentId ? { ...o, steps: [...o.steps, leafId] } : o
    );
    return { draftOps: next, stepId: leafId, forked: false };
  }
  if (rest.length === 1 && draftMap[rest[0]]?.fork) {
    // A fork already follows this step: open one more branch on it.
    const next = [...draftOps, leaf].map((o) =>
      o.id === rest[0]
        ? { ...o, steps: branchBefore ? [leafId, ...o.steps] : [...o.steps, leafId] }
        : o
    );
    return { draftOps: next, stepId: leafId, forked: true };
  }
  // Wrap the remainder into branch A, the new leaf becomes branch B.
  const forkId = newId();
  const extra = [leaf];
  let branchAId;
  if (rest.length === 1) {
    branchAId = rest[0];
  } else {
    branchAId = newId();
    extra.push({ id: branchAId, kind: "pipeline", name: "branch", description: "", steps: rest });
  }
  extra.push({
    id: forkId,
    kind: "pipeline",
    fork: true,
    name: "fork",
    description: "",
    steps: branchBefore ? [leafId, branchAId] : [branchAId, leafId],
  });
  const next = [...draftOps, ...extra].map((o) =>
    o.id === parentId ? { ...o, steps: [...o.steps.slice(0, idx + 1), forkId] } : o
  );
  return { draftOps: next, stepId: leafId, forked: true };
}

/** @param {DraftOp[]} draftOps @param {string} stepIdA @param {string} stepIdB @param {() => string} newId */
export function mergeStepsSequential(draftOps, stepIdA, stepIdB, newId) {
  const draftMap = buildDraftMap(draftOps);
  const parentId = findParentId(stepIdA, draftMap);
  if (!parentId || findParentId(stepIdB, draftMap) !== parentId) return draftOps;
  const parent = draftMap[parentId];
  const idxA = parent.steps.indexOf(stepIdA);
  const idxB = parent.steps.indexOf(stepIdB);
  if (idxA < 0 || idxB < 0) return draftOps;
  const pipelineId = newId();
  const order = idxA < idxB ? [stepIdA, stepIdB] : [stepIdB, stepIdA];
  const pipeline = {
    id: pipelineId,
    kind: "pipeline",
    name: `${draftMap[order[0]].name || "step"} → ${draftMap[order[1]].name || "step"}`.slice(0, 72),
    description: "Merged sequence",
    steps: order,
    mergedFrom: order,
  };
  const minIdx = Math.min(idxA, idxB);
  let next = draftOps.map((o) => {
    if (o.id !== parentId) return o;
    const steps = o.steps.filter((id) => id !== stepIdA && id !== stepIdB);
    steps.splice(minIdx, 0, pipelineId);
    return { ...o, steps };
  });
  return [...next, pipeline];
}

/** @param {DraftOp} op @param {Record<string, DraftOp>} draftMap */
export function opToClipboardTree(op, draftMap) {
  if (!op) return null;
  const base = {
    name: op.name || "step",
    description: op.description || "",
    ...(op.outputSpec ? { outputSpec: op.outputSpec } : {}),
  };
  if (op.kind === "pipeline" && op.steps?.length) {
    return {
      ...base,
      ...(op.fork ? { fork: true } : {}),
      steps: op.steps.map((id) => opToClipboardTree(draftMap[id], draftMap)).filter(Boolean),
    };
  }
  const leaf = { ...base, prompt: op.prompt || "" };
  if (op.moveRef) leaf.moveRef = op.moveRef;
  if (op.research) leaf.research = true;
  return leaf;
}

/** Materialize abstract JSON tree into flat draft ops (subset of App.jsx materializeTree). */
export function materializeDraftTree(node, newId, out = []) {
  const id = newId();
  const name = (node.name || "step").trim();
  const description = (node.description || "").trim();
  if (Array.isArray(node.steps) && node.steps.length) {
    const steps = node.steps.map((s) => materializeDraftTree(s, newId, out));
    out.push({ id, name, description, kind: "pipeline", steps, ...(node.fork ? { fork: true } : {}), ...(node.outputSpec ? { outputSpec: node.outputSpec } : {}) });
    return id;
  }
  if (node.moveRef && !(node.prompt || "").trim()) {
    out.push({
      id,
      name,
      description,
      kind: "prompt",
      moveRef: node.moveRef,
      research: !!node.research,
      ...(node.outputSpec ? { outputSpec: node.outputSpec } : {}),
    });
    return id;
  }
  const prompt = (node.prompt || "").trim() || `${description || name}. Return ONLY the step output.`;
  const leaf = { id, name, description, kind: "prompt", prompt, research: !!node.research, ...(node.outputSpec ? { outputSpec: node.outputSpec } : {}) };
  if (node.moveRef) leaf.moveRef = node.moveRef;
  out.push(leaf);
  return id;
}

/** @param {DraftOp[]} draftOps @param {object} tree @param {string} parentId @param {number} index @param {() => string} newId */
export function pasteTreeAt(draftOps, tree, parentId, index, newId) {
  const out = [];
  const rootId = materializeDraftTree(tree, newId, out);
  let next = [...draftOps, ...out];
  next = insertIntoParentSteps(next, parentId, rootId, index);
  return { draftOps: next, stepId: rootId };
}

/** @param {DraftOp[]} draftOps @param {string} rootId @param {() => string} newId */
export function ensurePipelineRoot(draftOps, rootId, newId) {
  const draftMap = buildDraftMap(draftOps);
  const root = draftMap[rootId];
  if (!root || root.kind === "pipeline") return { draftOps, rootId };
  const wrapperId = newId();
  const wrapper = {
    id: wrapperId,
    kind: "pipeline",
    name: root.name || "lens",
    description: root.description || "",
    steps: [rootId],
    top: root.top,
    role: root.role,
  };
  const next = draftOps
    .map((o) => (o.id === rootId ? { ...o, top: false } : o))
    .concat(wrapper);
  return { draftOps: next, rootId: wrapperId };
}

/** @param {DraftOp} op @param {Record<string, DraftOp>} opMap @param {() => string} newId */
export function importOpIntoDraft(op, opMap, newId) {
  const draftMap = buildDraftMap([op, ...Object.values(opMap).filter((x) => x.id !== op.id)]);
  const mergedMap = { ...opMap, [op.id]: op };
  const tree = opToClipboardTree(op, mergedMap);
  const out = [];
  const rootId = materializeDraftTree(tree, newId, out);
  return { ops: out, rootId };
}

/** @param {DraftOp[]} draftOps @param {string} parentId @param {string[]} stepIds @param {() => string} newId @param {string} [name] */
export function wrapStepsInPipeline(draftOps, parentId, stepIds, newId, name) {
  if (stepIds.length < 2) return draftOps;
  const draftMap = buildDraftMap(draftOps);
  const parent = draftMap[parentId];
  if (!parent?.steps) return draftOps;
  const pipelineId = newId();
  const indices = stepIds.map((id) => parent.steps.indexOf(id)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (indices.length < 2) return draftOps;
  const pipeline = {
    id: pipelineId,
    kind: "pipeline",
    name: name || "group",
    description: "",
    steps: stepIds.filter((id) => parent.steps.includes(id)),
  };
  const minIdx = indices[0];
  let next = draftOps.map((o) => {
    if (o.id !== parentId) return o;
    const steps = o.steps.filter((id) => !stepIds.includes(id));
    steps.splice(minIdx, 0, pipelineId);
    return { ...o, steps };
  });
  return [...next, pipeline];
}

/** @param {DraftOp[]} draftOps @param {string} rootId */
export function collectAllNodeIds(draftOps, rootId) {
  const draftMap = buildDraftMap(draftOps);
  return [...collectSubtreeIds(rootId, draftMap)];
}

/** @param {DraftOp[]} draftOps @param {string} parentId @param {string} stepId */
export function stepIndexInParent(draftOps, parentId, stepId) {
  const draftMap = buildDraftMap(draftOps);
  const parent = draftMap[parentId];
  if (!parent?.steps) return -1;
  return parent.steps.indexOf(stepId);
}

/** @param {DraftOp[]} draftOps @param {string} stepId @param {Record<string, DraftOp>} draftMap */
export function nextSiblingId(stepId, draftMap) {
  const parentId = findParentId(stepId, draftMap);
  if (!parentId) return null;
  const parent = draftMap[parentId];
  const idx = parent.steps.indexOf(stepId);
  if (idx < 0 || idx >= parent.steps.length - 1) return null;
  return parent.steps[idx + 1];
}

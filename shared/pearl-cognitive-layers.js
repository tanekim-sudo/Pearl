import { effectivePearlPrivacyPolicy } from "./pearl-privacy-policy.js";

export const PEARL_COGNITION_VERSION = 1;
export const COGNITIVE_LAYER_KINDS = Object.freeze(["primitive", "role", "lens", "move", "function", "pearl"]);
export const COGNITIVE_AUTHORSHIP = Object.freeze(["user-authored", "imported", "researched", "ai-inferred"]);
export const COGNITIVE_CONFIDENCE_EXECUTION_THRESHOLD = 0.7;
export const COGNITIVE_MAX_LAYERS = 1_000;

const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 120_000) => String(value ?? "").slice(0, limit);
const makeId = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function uncertainty(value = {}, kind = "primitive") {
  const confidence = Math.max(0, Math.min(1, Number(value.confidence ?? (value.authorship === "user-authored" ? 1 : 0.5))));
  const conflicts = (value.conflicts || []).slice(0, 100).map(clone);
  const questions = (value.unresolvedQuestions || []).slice(0, 100).map((entry) => bounded(entry, 2_000));
  const resolved = value.status === "resolved" || (!conflicts.length && !questions.length && confidence >= COGNITIVE_CONFIDENCE_EXECUTION_THRESHOLD);
  return {
    evidenceRefs: (value.evidenceRefs || []).slice(0, 500).map(String),
    confidence,
    rationale: bounded(value.rationale || "", 8_000),
    unresolvedQuestions: questions,
    conflicts,
    authorship: COGNITIVE_AUTHORSHIP.includes(value.authorship) ? value.authorship : "ai-inferred",
    status: resolved ? "resolved" : value.status === "deferred" ? "deferred" : "unresolved",
    executable: ["move", "function"].includes(kind) && resolved && value.executable !== false,
    shareableFact: resolved && confidence >= COGNITIVE_CONFIDENCE_EXECUTION_THRESHOLD && value.shareableFact !== false,
  };
}

function definitionFor(kind, value = {}) {
  if (kind === "primitive") return {
    primitiveType: ["operation", "material", "observation"].includes(value.primitiveType) ? value.primitiveType : "observation",
    value: clone(value.value ?? value.material ?? value.observation ?? null),
    inputSpec: clone(value.inputSpec || null),
    outputSpec: clone(value.outputSpec || null),
  };
  if (kind === "role") return {
    instructions: bounded(value.instructions || value.prompt || "", 20_000),
    responsibilities: (value.responsibilities || []).slice(0, 100).map((entry) => bounded(entry, 1_000)),
    authority: (value.authority || []).slice(0, 100).map(String),
    constraints: (value.constraints || []).slice(0, 100).map((entry) => bounded(entry, 1_000)),
  };
  if (kind === "lens") return {
    perceptualSchema: clone(value.perceptualSchema || value.perceptualModel || value.schema || {}),
    strength: Math.max(0, Math.min(1, Number(value.strength ?? 0.7))),
    context: clone(value.context || value.contextGraph || []),
    judgment: clone(value.judgment || null),
  };
  if (kind === "move") return {
    transformation: bounded(value.transformation || value.prompt || value.purpose || "", 20_000),
    inputSpec: clone(value.inputSpec || { type: "material" }),
    outputSpec: clone(value.outputSpec || { type: "material" }),
    atomic: true,
    adapter: value.adapter === true,
  };
  if (kind === "function") return {
    graph: clone(value.graph || value.processGraph || {
      nodes: (value.steps || []).map((ref, index) => ({ id: `step:${index + 1}`, layerId: typeof ref === "string" ? ref : ref.id })),
      edges: (value.steps || []).slice(1).map((_, index) => ({ from: `step:${index + 1}`, to: `step:${index + 2}`, relation: "then" })),
    }),
    branches: clone(value.branches || []),
    inputSpec: clone(value.inputSpec || { type: "material" }),
    outputSpecs: clone(value.outputSpecs || (value.outputSpec ? [value.outputSpec] : [])),
    generationPlan: clone(value.generationPlan || null),
  };
  return {
    pearlId: String(value.pearlId || value.ref?.id || value.id || ""),
    revision: Math.max(0, Number(value.revision) || 0),
    entryLayerId: value.entryLayerId || null,
    outputLayerIds: (value.outputLayerIds || []).map(String),
  };
}

export function createCognitiveLayer(value = {}, options = {}) {
  const kind = COGNITIVE_LAYER_KINDS.includes(value.kind) ? value.kind : "primitive";
  const id = bounded(value.id || makeId(kind), 220);
  const confidence = uncertainty(value.uncertainty || value.inference || {
    evidenceRefs: value.evidenceRefs,
    confidence: value.confidence,
    rationale: value.rationale,
    unresolvedQuestions: value.unresolvedQuestions,
    conflicts: value.conflicts,
    authorship: value.authorship,
    status: value.status,
    executable: value.executable,
    shareableFact: value.shareableFact,
  }, kind);
  return {
    version: PEARL_COGNITION_VERSION,
    id,
    stableId: bounded(value.stableId || id, 220),
    revision: Math.max(0, Number(value.revision) || 0),
    kind,
    identity: {
      name: bounded(value.identity?.name || value.name || `Untitled ${kind}`, 180),
      description: bounded(value.identity?.description || value.description || "", 4_000),
    },
    definition: definitionFor(kind, value.definition || value),
    semantic: {
      order: Math.max(0, Number(value.semantic?.order ?? value.order) || 0),
      parentId: value.semantic?.parentId || value.parentId || null,
      links: (value.semantic?.links || value.links || []).slice(0, 500).map(clone),
      tags: (value.semantic?.tags || value.tags || []).slice(0, 100).map(String),
    },
    layout: {
      x: Number(value.layout?.x) || 0,
      y: Number(value.layout?.y) || 0,
      width: Math.max(1, Number(value.layout?.width) || 180),
      height: Math.max(1, Number(value.layout?.height) || 80),
      collapsed: value.layout?.collapsed === true,
      groupId: value.layout?.groupId || null,
    },
    uncertainty: confidence,
    sourceMapping: {
      evidenceRefs: confidence.evidenceRefs,
      sourceSpans: (value.sourceMapping?.sourceSpans || value.sourceSpans || []).slice(0, 500).map(clone),
      verbatimRefs: (value.sourceMapping?.verbatimRefs || value.verbatimRefs || []).slice(0, 500).map(String),
    },
    provenance: clone(value.provenance || { source: confidence.authorship }),
    privacyPolicy: clone(value.privacyPolicy || options.privacyPolicy || null),
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

export function createPearlCognition(value = {}, options = {}) {
  const rawEvidence = (value.rawEvidence || value.evidence || []).slice(0, 500).map((entry, index) => ({
    id: bounded(entry.id || `evidence:${index + 1}`, 220),
    kind: bounded(entry.kind || "material", 80),
    verbatim: bounded(entry.verbatim ?? entry.content ?? entry.text ?? "", 500_000),
    contentHash: entry.contentHash || null,
    provenance: clone(entry.provenance || { source: "user-provided" }),
  }));
  const layers = (value.layers || []).slice(0, COGNITIVE_MAX_LAYERS).map((entry, index) =>
    createCognitiveLayer({ ...entry, semantic: { ...entry.semantic, order: entry.semantic?.order ?? index } }, options)
  );
  return {
    version: PEARL_COGNITION_VERSION,
    layers,
    semanticOrder: (value.semanticOrder || layers.map((entry) => entry.id)).filter((id) => layers.some((entry) => entry.id === id)),
    rawEvidence,
    sourceMapping: clone(value.sourceMapping || {}),
    organizationDiffs: (value.organizationDiffs || []).slice(-100).map(clone),
    activeExecution: clone(value.activeExecution || null),
  };
}

function bridgeMove(source, purpose, index, privacyPolicy) {
  return createCognitiveLayer({
    id: `bridge:${source.id}:${index}`,
    kind: "move",
    name: purpose,
    transformation: purpose,
    adapter: true,
    evidenceRefs: [source.id],
    confidence: 1,
    authorship: "user-authored",
    status: "resolved",
    provenance: { source: "canonical-composition-bridge", sourceLayerId: source.id },
    privacyPolicy,
  });
}

export function composeCognitiveLayers(leftInput, rightInput, options = {}) {
  const left = createCognitiveLayer(leftInput);
  const right = createCognitiveLayer(rightInput);
  const bridges = [];
  const executable = [];
  const context = [];
  for (const [layer, index] of [[left, 0], [right, 1]]) {
    if (["move", "function"].includes(layer.kind)) executable.push(layer);
    else if (["lens", "role"].includes(layer.kind)) context.push(layer);
    else {
      const bridge = bridgeMove(layer, layer.kind === "primitive" ? `Use ${layer.identity.name} as typed input` : `Enter ${layer.identity.name} and expose its selected output`, index, layer.privacyPolicy);
      bridges.push(bridge);
      executable.push(bridge);
    }
  }
  if (!executable.length) {
    const bridge = bridgeMove(left, `Interpret ${left.identity.name} through ${right.identity.name}`, 2, left.privacyPolicy || right.privacyPolicy);
    bridges.push(bridge);
    executable.push(bridge);
  }
  const id = options.id || makeId("function");
  const policies = [options.privacyPolicy, left.privacyPolicy, right.privacyPolicy].filter(Boolean);
  const privacyPolicy = policies.length ? effectivePearlPrivacyPolicy(policies, { pearlId: id }) : null;
  const ordered = options.order === "right-left" ? [...executable].reverse() : executable;
  const object = createCognitiveLayer({
    id,
    kind: context.length === 2 && context.every((entry) => entry.kind === "lens") ? "lens" : "function",
    name: options.name || `${left.identity.name} → ${right.identity.name}`,
    graph: {
      nodes: ordered.map((entry, index) => ({ id: `step:${index + 1}`, layerId: entry.id, kind: entry.kind })),
      edges: ordered.slice(1).map((_, index) => ({ from: `step:${index + 1}`, to: `step:${index + 2}`, relation: options.relation || "then" })),
      contextBindings: context.map((entry) => ({ layerId: entry.id, kind: entry.kind, relation: entry.kind === "lens" ? "through" : "as-role" })),
    },
    perceptualSchema: context.reduce((schema, entry) => ({ ...schema, [entry.id]: entry.definition }), {}),
    strength: Math.max(...context.filter((entry) => entry.kind === "lens").map((entry) => entry.definition.strength), 0.7),
    evidenceRefs: [...left.uncertainty.evidenceRefs, ...right.uncertainty.evidenceRefs],
    confidence: Math.min(left.uncertainty.confidence, right.uncertainty.confidence),
    rationale: options.intent || "Explicit canonical layer composition",
    authorship: options.authorship || "user-authored",
    status: left.uncertainty.status === "resolved" && right.uncertainty.status === "resolved" ? "resolved" : "unresolved",
    unresolvedQuestions: [...left.uncertainty.unresolvedQuestions, ...right.uncertainty.unresolvedQuestions],
    conflicts: [...left.uncertainty.conflicts, ...right.uncertainty.conflicts],
    privacyPolicy,
    provenance: { source: "canonical-layer-composition", operands: [left.id, right.id], bridges: bridges.map((entry) => entry.id) },
  });
  return {
    version: PEARL_COGNITION_VERSION,
    object,
    bridges,
    operands: [left, right],
    preview: {
      title: `Create ${object.kind}: ${object.identity.name}`,
      bridgeMoves: bridges.map((entry) => entry.identity.name),
      uncertainty: object.uncertainty,
      requiresConfirmation: bridges.length > 0 || object.uncertainty.status !== "resolved",
    },
  };
}

export function proposeCognitiveLayerPatch(cognitionInput, layerId, patch, options = {}) {
  const cognition = createPearlCognition(cognitionInput);
  const current = cognition.layers.find((entry) => entry.id === layerId);
  if (!current) throw new Error("cognitive layer not found");
  const next = createCognitiveLayer({ ...current, ...clone(patch), id: current.id, stableId: current.stableId, revision: current.revision + 1 });
  const changed = Object.keys(patch);
  const semantic = changed.some((key) => ["kind", "definition", "uncertainty", "privacyPolicy"].includes(key));
  return {
    version: PEARL_COGNITION_VERSION,
    id: options.id || makeId("cognitive-patch"),
    layerId,
    expectedRevision: current.revision,
    before: current,
    after: next,
    changed,
    semantic,
    requiresConfirmation: semantic || current.privacyPolicy != null || cognition.activeExecution != null,
    rationale: bounded(options.rationale || "", 4_000),
    status: "proposed",
    createdAt: Date.now(),
  };
}

export function applyCognitiveLayerPatch(cognitionInput, proposal, confirmed = false) {
  const cognition = createPearlCognition(cognitionInput);
  const current = cognition.layers.find((entry) => entry.id === proposal.layerId);
  if (!current || current.revision !== proposal.expectedRevision) throw new Error("cognitive layer changed; review the proposal again");
  if (proposal.requiresConfirmation && confirmed !== true) throw new Error("semantic cognitive patch confirmation is required");
  return {
    ...cognition,
    layers: cognition.layers.map((entry) => entry.id === proposal.layerId ? createCognitiveLayer(proposal.after) : entry),
    organizationDiffs: [...cognition.organizationDiffs, { ...clone(proposal), status: "applied", appliedAt: Date.now() }].slice(-100),
  };
}

export function resolveCognitiveUncertainty(cognitionInput, layerId, resolution = {}) {
  const cognition = createPearlCognition(cognitionInput);
  const layer = cognition.layers.find((entry) => entry.id === layerId);
  if (!layer) throw new Error("cognitive layer not found");
  const next = createCognitiveLayer({
    ...layer,
    revision: layer.revision + 1,
    uncertainty: {
      ...layer.uncertainty,
      ...clone(resolution),
      authorship: resolution.authorship || "user-authored",
      status: resolution.defer ? "deferred" : "resolved",
      confidence: resolution.confidence ?? layer.uncertainty.confidence,
      executable: resolution.defer ? false : resolution.executable ?? ["move", "function"].includes(layer.kind),
      shareableFact: resolution.defer ? false : resolution.shareableFact ?? true,
      unresolvedQuestions: resolution.defer ? layer.uncertainty.unresolvedQuestions : resolution.unresolvedQuestions || [],
      conflicts: resolution.defer ? layer.uncertainty.conflicts : resolution.conflicts || [],
    },
  });
  return { ...cognition, layers: cognition.layers.map((entry) => entry.id === layerId ? next : entry) };
}

export function startCognitivePlayback(cognitionInput, functionLayerId, options = {}) {
  const cognition = createPearlCognition(cognitionInput);
  const layer = cognition.layers.find((entry) => entry.id === functionLayerId);
  if (!layer || layer.kind !== "function") throw new Error("playback requires a Function layer");
  if (!layer.uncertainty.executable) throw new Error("resolve low-confidence Function uncertainty before execution");
  const nodes = layer.definition.graph?.nodes || [];
  return {
    ...cognition,
    activeExecution: {
      version: 1,
      id: options.id || makeId("cognitive-execution"),
      functionLayerId,
      functionRevision: layer.revision,
      checkpointId: options.checkpointId || makeId("execution-checkpoint"),
      inputs: clone(options.inputs || {}),
      lensIds: clone(options.lensIds || []),
      roleId: options.roleId || null,
      branchId: options.branchId || null,
      nodes: clone(nodes),
      cursor: 0,
      status: "paused",
      intermediateResultPearlIds: [],
      provenance: { pearlRevision: options.pearlRevision ?? null, startedAt: Date.now() },
    },
  };
}

export function advanceCognitivePlayback(cognitionInput, effect = {}) {
  const cognition = createPearlCognition(cognitionInput);
  const execution = cognition.activeExecution;
  if (!execution || ["cancelled", "completed"].includes(execution.status)) throw new Error("no playable Function execution is active");
  const cursor = Math.min(execution.nodes.length, execution.cursor + 1);
  return {
    ...cognition,
    activeExecution: {
      ...execution,
      cursor,
      status: cursor >= execution.nodes.length ? "completed" : "paused",
      intermediateResultPearlIds: effect.resultPearlId
        ? [...execution.intermediateResultPearlIds, effect.resultPearlId]
        : execution.intermediateResultPearlIds,
      lastEffectReceiptId: effect.receiptId || null,
    },
  };
}

export function cancelCognitivePlayback(cognitionInput) {
  const cognition = createPearlCognition(cognitionInput);
  if (!cognition.activeExecution) return cognition;
  return { ...cognition, activeExecution: { ...cognition.activeExecution, status: "cancelled", cancelledAt: Date.now() } };
}

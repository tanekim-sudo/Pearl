import { contentFingerprint } from "./lens-grammar.js";
import { normalizeOutputSpec, suggestedOutputSpec } from "./output-specifications.js";
import { emptyPerceptualModel, normalizePerceptualModel } from "./lens-perceptual-model.js";
import { normalizeGenerationPlan } from "./generation-plan.js";

export const LIBRARY_OBJECT_VERSION = 2;
export const LIBRARY_OBJECT_KINDS = Object.freeze(["move", "function", "lens"]);
export const LIBRARY_OBJECT_LIMITS = Object.freeze({
  depth: 32,
  objects: 2000,
  graphNodes: 500,
  graphEdges: 2000,
  promptCharacters: 120_000,
  contextItems: 5000,
  contextCharacters: 120_000,
});

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const KINDS = new Set(LIBRARY_OBJECT_KINDS);
const KNOWN_FIELDS = new Set([
  "kind", "schemaVersion", "id", "stableId", "version", "name", "title", "metadata", "tags", "description", "summary",
  "createdAt", "updatedAt", "savedAt", "migration", "extensions", "prompt", "instructions", "primitiveMove", "primitive",
  "primitiveRank", "inputRequirements", "inputType", "inputArity", "outputSpec", "privateExamples", "provenance",
  "processGraph", "processInstructions", "invariants", "historyFingerprint", "steps", "stepVersions", "outputSelections",
  "outputSelection", "composition", "contextPolicy", "contextGraph", "material", "items", "objects", "relationships",
  "placements", "spatial", "inclusionPolicy", "contextBudget", "priority", "symbols", "pattern", "branches", "pipeline",
  "captured", "sessionHistory", "move", "role", "top", "contextBindings", "modelPreference", "composition",
  "perceptualModel", "encoding", "promptTemplate", "sourceInstruction", "generationPlan"
]);
const clone = (value) => globalThis.structuredClone
  ? globalThis.structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const text = (value, max = 4096) => String(value ?? "").slice(0, max);
const asVersion = (value) => Math.max(1, Math.floor(Number(value) || 1));
const asTime = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

function assertPlain(value, path = "object", depth = 0, seen = new WeakSet()) {
  if (depth > LIBRARY_OBJECT_LIMITS.depth) throw new Error(`${path} exceeds maximum depth`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error(`${path} must contain plain data`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error(`${path} contains unsafe key "${key}"`);
    assertPlain(value[key], `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

export function classifyLegacyLibraryObject(value = {}) {
  if (KINDS.has(value.kind) && value.schemaVersion >= LIBRARY_OBJECT_VERSION) {
    return { kind: value.kind, confidence: "explicit", reason: "canonical-v2" };
  }
  // Superseded v1 taxonomy: function=atomic, lens=process, generator=context.
  if (value.kind === "generator") return { kind: "lens", confidence: "high", reason: "v1-generator-context" };
  if (value.kind === "lens" && (value.processGraph || value.steps || value.composition)) {
    return { kind: "function", confidence: "high", reason: "v1-lens-process" };
  }
  if (value.kind === "function" && (value.prompt != null || value.instructions != null) && !value.processGraph) {
    return { kind: "move", confidence: "high", reason: "v1-function-atomic" };
  }
  if (value.items || value.objects || value.material || value.symbols || value.pattern || value.spatial || value.contextPolicy) {
    return { kind: "lens", confidence: "high", reason: "context-material" };
  }
  const children = value.steps || value.processGraph?.nodes || value.composition?.components || value.branches;
  if ((Array.isArray(children) && children.length) || value.pipeline || value.captured || value.sessionHistory) {
    return { kind: "function", confidence: "high", reason: "process-structure" };
  }
  if (typeof value.prompt === "string" || value.primitive || value.primitiveMove || value.move || value.role) {
    return { kind: "move", confidence: "high", reason: value.primitive ? "built-in-primitive" : "atomic-prompt" };
  }
  return { kind: "lens", confidence: "ambiguous", reason: "reversible-context-default" };
}

function commonFields(value, kind, classification, options) {
  const now = asTime(options.now, Date.now());
  const id = text(value.id || options.idFactory?.() || globalThis.crypto?.randomUUID?.() || `library-${now}`, 256);
  const unknown = Object.fromEntries(Object.entries(value).filter(([key]) => !KNOWN_FIELDS.has(key)));
  return {
    kind,
    schemaVersion: LIBRARY_OBJECT_VERSION,
    id,
    stableId: text(value.stableId || id, 256),
    version: asVersion(value.version),
    name: value.name === "" ? "" : value.name == null && kind === "lens" ? "" : text(value.name || value.title || `Untitled ${kind}`, 160),
    metadata: {
      tags: [...new Set((value.metadata?.tags || value.tags || []).map((tag) => text(tag, 80)).filter(Boolean))].slice(0, 50),
      description: text(value.metadata?.description || value.description || value.summary, 2000),
      archivedAt: value.metadata?.archivedAt || value.archivedAt || null,
    },
    createdAt: asTime(value.createdAt || value.savedAt, now),
    updatedAt: asTime(value.updatedAt || value.savedAt, now),
    migration: value.migration?.targetVersion === LIBRARY_OBJECT_VERSION
      ? clone(value.migration)
      : {
          sourceKind: value.kind || "unknown",
          targetVersion: LIBRARY_OBJECT_VERSION,
          classification: classification.confidence,
          reason: classification.reason,
          reversible: classification.confidence === "ambiguous",
          aliases: [...new Set([...(value.migration?.aliases || []), value.id].filter(Boolean))],
        },
    extensions: clone({ ...(value.extensions || {}), ...unknown }),
  };
}

function legacyRefs(value) {
  return [
    ...(value.steps || []).map((entry) => typeof entry === "string" ? entry : entry?.id),
    ...(value.composition?.components || []).map((entry) => entry.opId || entry.functionId),
  ].filter(Boolean);
}

function normalizeProcessGraph(value) {
  if (value.processGraph?.nodes) return clone(value.processGraph);
  const refs = legacyRefs(value);
  return {
    nodes: refs.map((ref, index) => ({
      id: `step-${index + 1}`,
      ref: { id: ref, version: asVersion(value.stepVersions?.[ref]) },
      select: value.outputSelections?.[ref] ?? null,
    })),
    edges: refs.slice(1).map((_, index) => ({ from: `step-${index + 1}`, to: `step-${index + 2}` })),
    outputs: refs.length ? [{ from: `step-${refs.length}`, select: value.outputSelection ?? null }] : [],
  };
}

function normalizeLensMaterial(value) {
  return clone(value.contextGraph?.material || value.material || value.items || value.objects || []);
}

export function normalizeLibraryObject(value, options = {}) {
  assertPlain(value);
  if (KINDS.has(value.kind) && Number(value.schemaVersion) > LIBRARY_OBJECT_VERSION) {
    throw new Error(`unsupported future library object version ${value.schemaVersion}; this app supports ${LIBRARY_OBJECT_VERSION}`);
  }
  const classification = classifyLegacyLibraryObject(value);
  const common = commonFields(value, classification.kind, classification, options);
  if (classification.kind === "move") {
    return {
      ...common,
      prompt: text(value.prompt ?? value.instructions, LIBRARY_OBJECT_LIMITS.promptCharacters),
      promptTemplate: text(value.promptTemplate ?? value.prompt ?? value.instructions, LIBRARY_OBJECT_LIMITS.promptCharacters),
      sourceInstruction: text(value.sourceInstruction ?? value.prompt ?? value.instructions, LIBRARY_OBJECT_LIMITS.promptCharacters),
      primitiveMove: value.primitiveMove ?? !!value.primitive,
      primitiveRank: value.primitiveRank == null ? null : Number.isFinite(Number(value.primitiveRank)) ? Number(value.primitiveRank) : null,
      inputRequirements: clone(value.inputRequirements || { type: value.inputType || "text", arity: Math.max(1, Number(value.inputArity) || 1) }),
      outputSpec: normalizeOutputSpec(value.outputSpec || suggestedOutputSpec(value), value),
      generationPlan: normalizeGenerationPlan(value.generationPlan || {}),
      privateExamples: clone(value.privateExamples || []),
      provenance: clone(value.provenance || null),
    };
  }
  if (classification.kind === "function") {
    const processInstructions = text(value.processInstructions || value.instructions || "", 20_000);
    return {
      ...common,
      processGraph: normalizeProcessGraph(value),
      contextBindings: clone(value.contextBindings || []),
      composition: clone(value.composition || null),
      modelPreference: clone(value.modelPreference || null),
      instructions: processInstructions,
      processInstructions,
      sourceInstruction: text(value.sourceInstruction || processInstructions, LIBRARY_OBJECT_LIMITS.promptCharacters),
      invariants: clone(value.invariants || []),
      outputSpec: normalizeOutputSpec(value.outputSpec || suggestedOutputSpec(value), value),
      generationPlan: normalizeGenerationPlan(value.generationPlan || {}),
      provenance: clone(value.provenance || { historyFingerprint: value.historyFingerprint || "" }),
    };
  }
  const policy = ["empty", "bounded", "rich"].includes(value.contextPolicy) ? value.contextPolicy : "bounded";
  return {
    ...common,
    contextPolicy: policy,
    contextGraph: {
      material: normalizeLensMaterial(value),
      relationships: clone(value.contextGraph?.relationships || value.relationships || []),
      placements: clone(value.contextGraph?.placements || value.placements || value.spatial || {}),
      layers: clone(value.contextGraph?.layers || []),
      conflicts: clone(value.contextGraph?.conflicts || {}),
    },
    inclusionPolicy: clone(value.inclusionPolicy || { private: true, includeSources: true, excludeSensitive: true }),
    contextBudget: Math.max(0, Math.min(Number(value.contextBudget) || 24_000, LIBRARY_OBJECT_LIMITS.contextCharacters)),
    priority: Number.isFinite(Number(value.priority)) ? Number(value.priority) : 0,
    perceptualModel: normalizePerceptualModel(value.perceptualModel || value.contextGraph?.perceptualModel || emptyPerceptualModel()),
    encoding: clone(value.encoding || {
      status: policy === "empty" ? "empty" : "provisional",
      includedSourceCount: normalizeLensMaterial(value).length,
      excludedSourceCount: 0,
    }),
    composition: clone(value.composition || null),
    modelPreference: clone(value.modelPreference || null),
    provenance: clone(value.provenance || null),
  };
}

export function createNewChatLens(options = {}) {
  return normalizeLibraryObject({
    kind: "lens",
    schemaVersion: LIBRARY_OBJECT_VERSION,
    id: options.id || "lens-new-chat",
    stableId: options.stableId || "lens-new-chat",
    version: 1,
    name: "New chat",
    contextPolicy: "empty",
    contextBudget: 0,
    material: [],
    perceptualModel: emptyPerceptualModel(),
    encoding: { status: "empty", includedSourceCount: 0, excludedSourceCount: 0 },
    inclusionPolicy: { private: true, includeSources: false, excludeSensitive: true },
    metadata: { tags: ["built-in", "isolation"], description: "Fresh isolated model context." },
  }, options);
}

export function migrateLibraryObjects(values = [], options = {}) {
  if (!Array.isArray(values) || values.length > LIBRARY_OBJECT_LIMITS.objects) throw new Error("library exceeds object limit");
  const byVersion = new Map();
  for (const value of values) {
    const object = normalizeLibraryObject(value, options);
    const key = `${object.id}@${object.version}`;
    const previous = byVersion.get(key);
    if (!previous) byVersion.set(key, object);
    else if (canonicalObjectFingerprint(previous) !== canonicalObjectFingerprint(object)) throw new Error(`conflicting duplicate object ${key}`);
  }
  const objects = [...byVersion.values()];
  validateLibraryObjects(objects);
  return objects;
}

function assertAcyclic(graph) {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error("function edge references a missing node");
    outgoing.get(edge.from).push(edge.to);
  }
  const visiting = new Set();
  const visited = new Set();
  const walk = (id, depth = 0) => {
    if (depth > LIBRARY_OBJECT_LIMITS.depth) throw new Error("function graph exceeds maximum depth");
    if (visiting.has(id)) throw new Error("function graph contains a cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    outgoing.get(id).forEach((child) => walk(child, depth + 1));
    visiting.delete(id);
    visited.add(id);
  };
  graph.nodes.forEach((node) => walk(node.id));
}

export function validateLibraryObject(object, objectMap = new Map()) {
  assertPlain(object);
  if (!KINDS.has(object.kind)) throw new Error(`unknown library object kind "${object.kind}"`);
  if (!object.id || !object.stableId || !Number.isInteger(object.version)) throw new Error("object requires stable ID and version");
  if (object.kind === "move") {
    if (!object.prompt?.trim()) throw new Error("move prompt is required");
    if (object.processGraph || object.steps || object.branches) throw new Error("move cannot contain process children");
  } else if (object.kind === "function") {
    const graph = object.processGraph;
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error("function process graph is required");
    if (graph.nodes.length > LIBRARY_OBJECT_LIMITS.graphNodes || graph.edges.length > LIBRARY_OBJECT_LIMITS.graphEdges) throw new Error("function graph exceeds size limit");
    const nodeIds = new Set();
    for (const node of graph.nodes) {
      if (!node.id || nodeIds.has(node.id)) throw new Error("function graph has duplicate or missing node ID");
      nodeIds.add(node.id);
      if (!node.ref?.id || !Number.isInteger(Number(node.ref.version))) throw new Error("function node requires a versioned reference");
      const target = objectMap.get(`${node.ref.id}@${node.ref.version}`);
      if (target && !["move", "function"].includes(target.kind)) throw new Error("function may only reference Moves or Functions");
    }
    for (const binding of object.contextBindings || []) {
      if (!binding?.lens?.id || !Number.isInteger(Number(binding.lens.version))) throw new Error("function context binding requires a versioned Lens reference");
      const target = objectMap.get(`${binding.lens.id}@${binding.lens.version}`);
      if (target && target.kind !== "lens") throw new Error("function context binding must reference a Lens");
    }
    assertAcyclic(graph);
  } else {
    if (!["empty", "bounded", "rich"].includes(object.contextPolicy)) throw new Error("lens context policy is invalid");
    if (!Array.isArray(object.contextGraph?.material)) throw new Error("lens context material must be an array");
    if (object.contextGraph.material.length > LIBRARY_OBJECT_LIMITS.contextItems) throw new Error("lens has too much context material");
    if (object.contextPolicy === "empty" && object.contextGraph.material.length) throw new Error("empty lens cannot contain context material");
  }
  return object;
}

export function validateLibraryObjects(objects = []) {
  const map = new Map(objects.map((object) => [`${object.id}@${object.version}`, object]));
  objects.forEach((object) => validateLibraryObject(object, map));
  return objects;
}

export function createMoveFromDrop(items, options = {}) {
  const list = Array.isArray(items) ? items : [items];
  const parts = list.map((item) => text(item?.text ?? item?.quote ?? item?.content, LIBRARY_OBJECT_LIMITS.promptCharacters));
  if (parts.some((part) => !part)) throw new Error("non-text material requires an explicit Extract instruction action");
  return normalizeLibraryObject({
    kind: "move",
    schemaVersion: LIBRARY_OBJECT_VERSION,
    id: options.id,
    name: options.name || parts[0].split(/\n/)[0].slice(0, 72) || "Dropped Move",
    prompt: parts.join(options.separator ?? "\n\n"),
    outputSpec: options.outputSpec,
    provenance: { private: true, sources: list.map((item) => item?.provenance || null) },
  }, options);
}

export function createLensFromDrop(items, options = {}) {
  const list = Array.isArray(items) ? items : [items];
  return normalizeLibraryObject({
    kind: "lens",
    schemaVersion: LIBRARY_OBJECT_VERSION,
    id: options.id,
    name: options.name ?? "",
    contextPolicy: options.contextPolicy || "bounded",
    contextBudget: options.contextBudget,
    material: list.map((item, index) => ({
      id: text(item?.id || `material-${index + 1}`, 256),
      type: text(item?.type || item?.machineKind || "text", 80),
      content: clone(item?.content ?? item?.text ?? item?.quote ?? item?.src ?? ""),
      priority: Number(item?.priority) || index,
      group: text(item?.group || item?.pageId || "", 256),
      private: item?.private !== false,
      provenance: clone(item?.provenance || null),
    })),
    perceptualModel: options.perceptualModel || emptyPerceptualModel(),
    encoding: {
      status: "provisional",
      includedSourceCount: list.length,
      excludedSourceCount: 0,
      sourceOrder: list.map((item, index) => text(item?.id || `material-${index + 1}`, 256)),
    },
    provenance: {
      kind: "lens-encoding",
      privateSources: true,
      sourceStructureFingerprint: contentFingerprint(list.map((item, index) => ({
        id: text(item?.id || `material-${index + 1}`, 256),
        type: text(item?.type || item?.machineKind || "text", 80),
        group: text(item?.group || item?.pageId || "", 256),
      }))),
    },
  }, options);
}

export function captureFunctionFromLineage(items, options = {}) {
  const list = Array.isArray(items) ? items : [items];
  const lineages = list.map((item) => item?.lineage || item?.history || []).filter((lineage) => lineage.length);
  if (!lineages.length) return {
    eligible: false,
    reason: "No reusable process history was found. Preserve the source as a one-step Function, Move, or Lens material.",
    alternatives: ["function", "move", "lens"],
  };
  const nodes = new Map();
  const edges = new Map();
  const outputs = [];
  lineages.forEach((lineage, branch) => {
    let previous = null;
    lineage.forEach((step, index) => {
      const refId = step.moveId || step.functionId || step.opId || step.id;
      if (!refId) throw new Error("lineage step is missing a Move or Function reference");
      const refVersion = asVersion(step.version);
      const key = `${refId}@${refVersion}:${step.outputSelection ?? ""}`;
      if (!nodes.has(key)) nodes.set(key, {
        id: `step-${nodes.size + 1}`,
        ref: { id: refId, version: refVersion },
        select: step.outputSelection ?? null,
        userEdit: step.userEdit ? text(step.userEdit, 20_000) : null,
      });
      const current = nodes.get(key);
      if (previous) edges.set(`${previous.id}->${current.id}`, { from: previous.id, to: current.id });
      previous = current;
      if (index === lineage.length - 1) outputs.push({ from: current.id, select: step.outputSelection ?? null, branch });
    });
  });
  const fn = normalizeLibraryObject({
    kind: "function",
    schemaVersion: LIBRARY_OBJECT_VERSION,
    id: options.id,
    name: options.name || "Captured Function",
    processGraph: { nodes: [...nodes.values()], edges: [...edges.values()], outputs },
    provenance: {
      historyFingerprint: contentFingerprint(lineages),
      privateExamples: list.map((item) => ({ id: item?.id, content: item?.text ?? item?.content ?? "", private: true })),
    },
  }, options);
  return { eligible: true, function: fn, summary: `${fn.processGraph.nodes.length} steps → ${outputs.length} output${outputs.length === 1 ? "" : "s"}` };
}

export function canonicalObjectFingerprint(object) {
  if (object.kind === "move") return contentFingerprint({
    kind: "move",
    prompt: object.prompt.trim().replace(/\r\n/g, "\n"),
    inputRequirements: object.inputRequirements,
    outputSpec: object.outputSpec,
    generationPlan: object.generationPlan,
  });
  if (object.kind === "function") return contentFingerprint({
    kind: "function",
    nodes: [...object.processGraph.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...object.processGraph.edges].sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    outputs: object.processGraph.outputs || [],
    instructions: object.instructions,
    outputSpec: object.outputSpec,
    generationPlan: object.generationPlan,
    contextBindings: object.contextBindings || [],
    composition: object.composition || null,
  });
  return contentFingerprint({
    kind: "lens",
    policy: object.contextPolicy,
    contextGraph: object.contextGraph,
    inclusionPolicy: object.inclusionPolicy,
    budget: object.contextBudget,
    priority: object.priority,
    perceptualModel: object.perceptualModel,
    composition: object.composition,
  });
}

export function dependencyClosure(rootRefs, objects) {
  const map = new Map(objects.map((object) => [`${object.id}@${object.version}`, object]));
  const result = new Map();
  const walk = (ref, depth = 0) => {
    if (depth > LIBRARY_OBJECT_LIMITS.depth) throw new Error("dependency closure exceeds maximum depth");
    const key = `${ref.id}@${asVersion(ref.version)}`;
    if (result.has(key)) return;
    const object = map.get(key);
    if (!object) throw new Error(`missing dependency ${key}`);
    result.set(key, object);
    if (object.kind === "function") object.processGraph.nodes.forEach((node) => walk(node.ref, depth + 1));
  };
  rootRefs.forEach((ref) => walk(ref));
  return [...result.values()];
}

export async function executeLibraryObject(object, input, context = {}) {
  const objects = context.objects || [];
  const map = new Map(objects.map((entry) => [`${entry.id}@${entry.version}`, entry]));
  if (object.kind === "move") {
    const output = await context.callModel({ prompt: object.prompt, input, outputSpec: object.outputSpec, contextEnvelope: context.contextEnvelope, signal: context.signal });
    return {
      outputs: Array.isArray(output) ? output : [output],
      history: [{ kind: "move", id: object.id, version: object.version, outputSpec: object.outputSpec, lensContext: context.contextEnvelope?.provenance || null }],
      modelCalls: 1,
    };
  }
  if (object.kind !== "function") throw new Error("a Lens supplies context and is not an action");
  validateLibraryObject(object, map);
  const graph = object.processGraph;
  const incoming = new Map(graph.nodes.map((node) => [node.id, []]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  graph.edges.forEach((edge) => { incoming.get(edge.to).push(edge.from); outgoing.get(edge.from).push(edge.to); });
  const results = new Map();
  const histories = new Map();
  const ready = graph.nodes.filter((node) => !incoming.get(node.id).length);
  let calls = 0;
  while (ready.length) {
    const node = ready.shift();
    if (context.signal?.aborted) throw new DOMException("Execution cancelled", "AbortError");
    const parents = incoming.get(node.id);
    const nodeInput = parents.length ? parents.flatMap((id) => results.get(id) || []) : [input];
    const dependency = map.get(`${node.ref.id}@${asVersion(node.ref.version)}`);
    if (!dependency) throw new Error(`missing dependency ${node.ref.id}@${node.ref.version}`);
    const executed = await executeLibraryObject(dependency, nodeInput.length === 1 ? nodeInput[0] : nodeInput, context);
    calls += executed.modelCalls;
    results.set(node.id, node.select == null ? executed.outputs : [executed.outputs[node.select]].filter((value) => value != null));
    histories.set(node.id, [...parents.flatMap((id) => histories.get(id) || []), ...executed.history]);
    context.checkpoint?.({ functionId: object.id, nodeId: node.id, results: clone([...results]) });
    outgoing.get(node.id).forEach((childId) => {
      if (incoming.get(childId).every((parentId) => results.has(parentId)) && !ready.some((candidate) => candidate.id === childId)) {
        ready.push(graph.nodes.find((candidate) => candidate.id === childId));
      }
    });
  }
  if (results.size !== graph.nodes.length) throw new Error("function graph could not be fully executed");
  const refs = graph.outputs?.length ? graph.outputs : graph.nodes.filter((node) => !outgoing.get(node.id).length).map((node) => ({ from: node.id }));
  return {
    outputs: refs.flatMap((output) => output.select == null ? results.get(output.from) || [] : [(results.get(output.from) || [])[output.select]].filter((value) => value != null)),
    history: refs.flatMap((output) => histories.get(output.from) || []),
    modelCalls: calls,
    function: { id: object.id, version: object.version },
    lensContext: context.contextEnvelope?.provenance || null,
  };
}

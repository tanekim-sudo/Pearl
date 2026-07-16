import { contentFingerprint } from "./lens-grammar.js";
import { normalizeLibraryObject, canonicalObjectFingerprint, LIBRARY_OBJECT_LIMITS } from "./library-objects.js";
import { normalizeOutputSpec } from "./output-specifications.js";
import { mergePerceptualModels } from "./lens-perceptual-model.js";
import { deriveComposedGenerationPlan } from "./generation-plan.js";

export const COMPOSITION_ALGEBRA_VERSION = 1;
export const COMPOSITION_KINDS = Object.freeze(["move", "function", "lens"]);
export const COMPOSITION_RESULT_MATRIX = Object.freeze({
  move: Object.freeze({ move: "function", function: "function", lens: "function" }),
  function: Object.freeze({ move: "function", function: "function", lens: "function" }),
  lens: Object.freeze({ move: "function", function: "function", lens: "lens" }),
});
const RELATIONS = new Set(["then", "before", "through", "scope", "merge"]);

const ref = (object) => ({ id: object.id, version: Number(object.version) || 1, kind: object.kind });
const label = (object) => object.name || `Untitled ${object.kind}`;
const clone = (value) => structuredClone(value);

export function compositionResultKind(leftKind, rightKind) {
  const result = COMPOSITION_RESULT_MATRIX[leftKind]?.[rightKind];
  if (!result) throw new Error(`Unknown canonical object kind: ${leftKind || "missing"} × ${rightKind || "missing"}`);
  return result;
}

function orderedOperands(left, right, options) {
  return options.order === "right-left" ? [right, left] : [left, right];
}

function relationFor(left, right, requested) {
  if (requested && RELATIONS.has(requested)) return requested;
  if (left.kind === "lens" && right.kind === "lens") return "merge";
  if (left.kind === "lens" || right.kind === "lens") return "through";
  return "then";
}

function compositionProvenance(left, right, relation, options) {
  return {
    kind: "canonical-composition",
    version: COMPOSITION_ALGEBRA_VERSION,
    left: ref(left),
    right: ref(right),
    relation,
    order: options.order || "left-right",
    drag: options.drag ? clone(options.drag) : null,
    intent: String(options.intent || "").slice(0, 1000),
    grouping: options.grouping || "explicit-binary",
    ephemeral: options.ephemeral === true,
  };
}

function actionGraph(actions, relation, options) {
  const nodes = actions.map((object, index) => ({
    id: `operand-${index + 1}`,
    ref: { id: object.id, version: Number(object.version) || 1 },
    sourceKind: object.kind,
  }));
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id, relation: "then" }));
  return {
    version: 1,
    nodes,
    edges,
    outputs: nodes.length ? [{ from: nodes[nodes.length - 1].id }] : [],
    grouping: options.grouping || "explicit-binary",
    relation,
  };
}

function outputOf(actions) {
  const terminal = actions[actions.length - 1];
  return normalizeOutputSpec(terminal?.outputSpec, terminal || {});
}

function composeFunction(left, right, options) {
  const relation = relationFor(left, right, options.relation);
  const ordered = orderedOperands(left, right, options);
  const actions = ordered.filter((object) => object.kind !== "lens");
  const lenses = ordered.filter((object) => object.kind === "lens");
  const provenance = compositionProvenance(left, right, relation, options);
  const fingerprint = contentFingerprint({ provenance, actions: actions.map(ref), lenses: lenses.map(ref), scope: options.scope || null });
  const name = options.name || (lenses.length
    ? `${actions.map(label).join(" → ")} through ${lenses.map(label).join(" + ")}`
    : ordered.map(label).join(" → "));
  return normalizeLibraryObject({
    kind: "function",
    schemaVersion: 2,
    id: options.id || `composition-${fingerprint.slice(0, 24)}`,
    stableId: options.stableId || `composition-${fingerprint.slice(0, 24)}`,
    version: Number(options.version) || 1,
    name,
    processGraph: actionGraph(actions, relation, options),
    contextBindings: lenses.map((lens, index) => ({
      id: `context-${index + 1}`,
      lens: ref(lens),
      priority: Number(options.lensPriority?.[lens.id]) || index,
      scope: clone(options.scope || { type: "function" }),
      relation,
    })),
    composition: { ...provenance, fingerprint },
    outputSpec: outputOf(actions),
    generationPlan: actions.length
      ? actions.slice(1).reduce(
          (plan, action) => deriveComposedGenerationPlan(plan, action.generationPlan),
          actions[0].generationPlan,
        )
      : undefined,
    provenance: { composition: provenance, compositionFingerprint: fingerprint },
  }, options);
}

function composeLens(left, right, options) {
  const relation = relationFor(left, right, options.relation);
  const ordered = orderedOperands(left, right, options);
  const provenance = compositionProvenance(left, right, relation, options);
  const lastEmptyIndex = ordered.reduce((found, lens, index) => lens.contextPolicy === "empty" ? index : found, -1);
  const effective = lastEmptyIndex >= 0 ? ordered.slice(lastEmptyIndex) : ordered;
  const layers = effective.map((lens, index) => ({
    id: `layer-${index + 1}`,
    lens: ref(lens),
    priority: Number(options.priority?.[lens.id]) || index,
    conflict: options.conflicts?.[lens.id] || (index ? "later-overrides" : "base"),
    budget: Math.max(0, Math.min(Number(lens.contextBudget) || 0, LIBRARY_OBJECT_LIMITS.contextCharacters)),
    privacy: clone(lens.inclusionPolicy || { private: true, includeSources: true, excludeSensitive: true }),
    fingerprint: canonicalObjectFingerprint(lens),
  }));
  const fingerprint = contentFingerprint({ provenance, layers });
  const empty = effective.every((lens) => lens.contextPolicy === "empty");
  const perceptual = mergePerceptualModels(effective.map((lens) => lens.perceptualModel));
  return normalizeLibraryObject({
    kind: "lens",
    schemaVersion: 2,
    id: options.id || `composition-${fingerprint.slice(0, 24)}`,
    stableId: options.stableId || `composition-${fingerprint.slice(0, 24)}`,
    version: Number(options.version) || 1,
    name: options.name || ordered.map(label).join(" + "),
    contextPolicy: empty ? "empty" : effective.some((lens) => lens.contextPolicy === "rich") ? "rich" : "bounded",
    contextBudget: Math.min(LIBRARY_OBJECT_LIMITS.contextCharacters, layers.reduce((sum, layer) => sum + layer.budget, 0)),
    contextGraph: {
      material: empty ? [] : effective.flatMap((lens) => lens.contextGraph.material || []),
      relationships: empty ? [] : effective.flatMap((lens) => lens.contextGraph.relationships || []),
      placements: {},
      layers,
      conflicts: { ...(clone(options.conflicts || {})), perceptual: perceptual.conflicts },
    },
    inclusionPolicy: {
      private: effective.some((lens) => lens.inclusionPolicy?.private !== false),
      includeSources: effective.every((lens) => lens.inclusionPolicy?.includeSources !== false),
      excludeSensitive: effective.some((lens) => lens.inclusionPolicy?.excludeSensitive !== false),
    },
    perceptualModel: perceptual.model,
    encoding: {
      status: empty ? "empty" : effective.every((lens) => lens.encoding?.status === "inferred") ? "inferred" : "provisional",
      includedSourceCount: empty ? 0 : effective.reduce((sum, lens) => sum + (lens.contextGraph.material?.length || 0), 0),
      excludedSourceCount: effective.reduce((sum, lens) => sum + (Number(lens.encoding?.excludedSourceCount) || 0), 0),
    },
    composition: { ...provenance, fingerprint },
    provenance: { composition: provenance, compositionFingerprint: fingerprint },
  }, options);
}

export function composeLibraryObjects(leftValue, rightValue, options = {}) {
  const left = normalizeLibraryObject(leftValue);
  const right = normalizeLibraryObject(rightValue);
  const resultKind = compositionResultKind(left.kind, right.kind);
  const result = resultKind === "lens" ? composeLens(left, right, options) : composeFunction(left, right, options);
  return {
    version: COMPOSITION_ALGEBRA_VERSION,
    resultKind,
    left: ref(left),
    right: ref(right),
    relation: result.composition.relation,
    fingerprint: result.composition.fingerprint,
    object: result,
    bridges: [],
    preview: {
      title: `Create ${resultKind === "lens" ? "Lens" : "Function"}: ${result.name}`,
      operands: [ref(left), ref(right)],
      relation: result.composition.relation,
      outputSpec: resultKind === "function" ? result.outputSpec : null,
      contextContract: resultKind === "lens" ? {
        policy: result.contextPolicy,
        budget: result.contextBudget,
        layers: result.contextGraph.layers.length,
        fingerprint: result.composition.fingerprint,
      } : null,
    },
  };
}

export function composeSelection(values, options = {}) {
  if (!Array.isArray(values) || values.length < 2) throw new Error("Composition requires at least two canonical objects.");
  if (values.length > 100) throw new Error("Composition selection exceeds the 100-object limit.");
  return values.slice(1).reduce((current, value, index) => composeLibraryObjects(current.object || current, value, {
    ...options,
    grouping: options.grouping || "left-fold",
    intent: index === values.length - 2 ? options.intent : "",
  }), normalizeLibraryObject(values[0]));
}

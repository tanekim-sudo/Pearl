import {
  captureFunctionFromLineage,
  createLensFromDrop,
  createMoveFromDrop,
  normalizeLibraryObject,
  validateLibraryObjects,
} from "./library-objects.js";
import {
  demotePrimitiveMove,
  promotePrimitiveMove,
  reorderPrimitiveMove,
} from "./primitive-moves.js";
import { composeLibraryObjects } from "./composition-algebra.js";
import { applyPerceptualInference, normalizePerceptualModel } from "./lens-perceptual-model.js";
import {
  createGenerationBatch,
  moreLikeThisPlan,
  normalizeGenerationPlan,
  recordTasteFeedback,
  updateCandidate,
} from "./generation-plan.js";
import { createWorkspaceObservation } from "./workspace-observation.js";

export const DOMAIN_COMMAND_VERSION = 1;

const clone = (value) => structuredClone(value);
const result = (type, object, effects = []) => ({ type, id: object?.id || null, object, effects });

function appendObject(state, object) {
  const objects = [...(state.objects || [])];
  const duplicate = objects.find((entry) => entry.id === object.id && entry.version === object.version);
  if (!duplicate) objects.push(object);
  validateLibraryObjects(objects);
  return { ...state, objects };
}

export const DOMAIN_COMMANDS = Object.freeze({
  observeWorkspace: {
    schema: { observation: "object" },
    preconditions: ["scope is explicit", "visibleTab requires user gesture"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "none",
    observableEffects: ["workspace-observed"],
    execute(state, args) {
      const observation = createWorkspaceObservation(args.observation);
      return { state, result: { type: "workspace-observation", id: observation.id, observation, effects: ["workspace-observed"] } };
    },
  },
  interpretObservationThroughLens: {
    schema: { observation: "object", lens: "object", name: "string?" },
    preconditions: ["observation is current or revalidated", "Lens is canonical context"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["lens-scoped-function-created", "workspace-observation-bound"],
    execute(state, args, context) {
      const observation = createWorkspaceObservation(args.observation);
      const lens = normalizeLibraryObject(args.lens);
      if (lens.kind !== "lens") throw new Error("interpretation context must be a Lens");
      const viewMove = normalizeLibraryObject({
        kind: "move",
        schemaVersion: 2,
        id: "move-view-through-lens",
        stableId: "move-view-through-lens",
        version: 1,
        name: "View through Lens",
        prompt: "Interpret the supplied material by performing the enabled perceptual operations in the bound Lens context. Ground every finding to supplied source IDs.",
        primitiveMove: true,
        inputRequirements: { type: "workspace-observation", arity: 1 },
        provenance: { builtIn: true },
      });
      const composition = composeLibraryObjects(viewMove, lens, {
        id: context.idFactory(),
        name: args.name || `View ${observation.scope} through ${lens.name || "Lens"}`,
        intent: "lens-scoped-workspace-interpretation",
      });
      const object = normalizeLibraryObject({
        ...composition.object,
        provenance: {
          ...composition.object.provenance,
          observation: {
            id: observation.id,
            scope: observation.scope,
            fingerprint: observation.fingerprint,
            stateRevision: observation.stateRevision,
            sourceIds: observation.objects.map((entry) => entry.id),
          },
        },
      });
      return {
        state: appendObject(state, object),
        result: result("function", object, ["lens-scoped-function-created", "workspace-observation-bound"]),
      };
    },
  },
  setGenerationPlan: {
    schema: { objectId: "string", expectedVersion: "number", generationPlan: "object" },
    preconditions: ["Move or Function exists", "expected version matches"],
    risk: "low", confirmation: "none", undo: "restore-library-snapshot",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.version",
    observableEffects: ["generation-plan-changed", "library-changed"],
    execute(state, args, context) {
      const current = [...(state.objects || [])].reverse().find((entry) => entry.id === args.objectId && ["move", "function"].includes(entry.kind));
      if (!current) throw new Error("Move or Function not found");
      if (Number(args.expectedVersion) !== current.version) throw new Error("artifact changed; refresh generation settings");
      const object = normalizeLibraryObject({
        ...current,
        version: current.version + 1,
        updatedAt: context.now,
        generationPlan: normalizeGenerationPlan(args.generationPlan),
      }, { now: context.now });
      return { state: appendObject(state, object), result: result(object.kind, object, ["generation-plan-changed", "library-changed"]) };
    },
  },
  startGenerationBatch: {
    schema: { batch: "object", idempotencyKey: "string" },
    preconditions: ["explicit GO or generation command", "budget accepted when required"],
    risk: "medium", confirmation: "cost-policy", undo: "cancel-pending-batch",
    surfaces: ["web", "companion", "extension", "server"],
    persistenceEffect: "generationBatches.append",
    observableEffects: ["generation-batch-started", "candidate-placeholders-created"],
    execute(state, args) {
      const prior = (state.generationBatches || []).find((batch) => batch.idempotencyKey === args.idempotencyKey);
      if (prior) return { state, result: { type: "idempotent-replay", id: prior.id, batch: prior, effects: [] } };
      const batch = createGenerationBatch({ ...args.batch, idempotencyKey: args.idempotencyKey });
      return {
        state: { ...state, generationBatches: [...(state.generationBatches || []), batch] },
        result: { type: "generation-batch", id: batch.id, batch, effects: ["generation-batch-started", "candidate-placeholders-created"] },
      };
    },
  },
  updateGenerationCandidate: {
    schema: { batchId: "string", candidateId: "string", patch: "object", idempotencyKey: "string" },
    preconditions: ["candidate exists", "event is idempotent"],
    risk: "low", confirmation: "none", undo: "restore-batch-snapshot",
    surfaces: ["web", "server", "extension"],
    persistenceEffect: "generationBatches.update",
    observableEffects: ["generation-candidate-changed"],
    execute(state, args) {
      if ((state.idempotencyKeys || []).includes(args.idempotencyKey)) {
        return { state, result: { type: "idempotent-replay", id: args.idempotencyKey, effects: [] } };
      }
      let changed = null;
      const generationBatches = (state.generationBatches || []).map((batch) => {
        if (batch.id !== args.batchId) return batch;
        changed = updateCandidate(batch, args.candidateId, args.patch);
        return changed;
      });
      if (!changed) throw new Error("generation batch not found");
      return {
        state: { ...state, generationBatches, idempotencyKeys: [...(state.idempotencyKeys || []), args.idempotencyKey].slice(-2000) },
        result: { type: "generation-candidate", id: args.candidateId, batch: changed, effects: ["generation-candidate-changed"] },
      };
    },
  },
  recordTasteFeedback: {
    schema: { batchId: "string", candidateId: "string", decision: "accepted|rejected|undecided", reason: "string?", remember: "boolean?" },
    preconditions: ["candidate exists and is focused or explicitly referenced"],
    risk: "low", confirmation: "none", undo: "restore-previous-feedback",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "generationBatches.update",
    observableEffects: ["taste-feedback-changed", "candidate-focus-changed"],
    execute(state, args, context) {
      let changed = null;
      const generationBatches = (state.generationBatches || []).map((batch) => {
        if (batch.id !== args.batchId) return batch;
        changed = recordTasteFeedback(batch, args.candidateId, args.decision, { reason: args.reason, remember: args.remember, at: context.now });
        return changed;
      });
      if (!changed) throw new Error("generation batch not found");
      return {
        state: { ...state, generationBatches },
        result: { type: "taste-feedback", id: args.candidateId, batch: changed, effects: ["taste-feedback-changed", "candidate-focus-changed"] },
      };
    },
  },
  prepareMoreLikeThis: {
    schema: { batchId: "string", candidateId: "string", count: "number?", model: "string?", diversity: "number?", preserve: "array?", change: "array?" },
    preconditions: ["completed candidate exists", "new cost stays within budget"],
    risk: "medium", confirmation: "cost-policy", undo: "cancel-pending-child-batch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "none",
    observableEffects: ["more-like-this-prepared"],
    execute(state, args) {
      const batch = (state.generationBatches || []).find((entry) => entry.id === args.batchId);
      if (!batch) throw new Error("generation batch not found");
      const request = moreLikeThisPlan(batch, args.candidateId, args);
      return { state, result: { type: "more-like-this", id: args.candidateId, request, effects: ["more-like-this-prepared"] } };
    },
  },
  encodeMaterialAsLens: {
    schema: { items: "array", name: "string?", id: "string?", contextPolicy: "empty|bounded|rich?" },
    preconditions: ["material is explicit and user-selected"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["lens-created", "lens-encoding-provisional", "library-changed"],
    execute(state, args, context) {
      const object = createLensFromDrop(args.items, {
        id: args.id || context.idFactory(),
        name: args.name,
        contextPolicy: args.contextPolicy,
        now: context.now,
      });
      return {
        state: appendObject(state, object),
        result: result("lens", object, ["lens-created", "lens-encoding-provisional", "library-changed"]),
      };
    },
  },
  updateLensPerceptualModel: {
    schema: { lensId: "string", perceptualModel: "object", expectedVersion: "number" },
    preconditions: ["Lens exists", "expected version matches"],
    risk: "low", confirmation: "none", undo: "restore-library-snapshot",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.version",
    observableEffects: ["lens-perceptual-model-changed", "library-changed"],
    execute(state, args, context) {
      const current = [...(state.objects || [])].reverse().find((entry) => entry.id === args.lensId && entry.kind === "lens");
      if (!current) throw new Error("Lens not found");
      if (Number(args.expectedVersion) !== current.version) throw new Error("Lens changed; refresh before applying edits");
      const object = normalizeLibraryObject({
        ...current,
        version: current.version + 1,
        updatedAt: context.now,
        perceptualModel: normalizePerceptualModel(args.perceptualModel),
      }, { now: context.now });
      return {
        state: appendObject(state, object),
        result: result("lens", object, ["lens-perceptual-model-changed", "library-changed"]),
      };
    },
  },
  applyLensInference: {
    schema: { lensId: "string", inferredPerceptualModel: "object", expectedVersion: "number", metadata: "object?" },
    preconditions: ["Lens exists", "inference was previewed", "expected version matches"],
    risk: "low", confirmation: "none", undo: "restore-library-snapshot",
    surfaces: ["web", "companion"],
    persistenceEffect: "library.objects.version",
    observableEffects: ["lens-inference-applied", "library-changed"],
    execute(state, args, context) {
      const current = [...(state.objects || [])].reverse().find((entry) => entry.id === args.lensId && entry.kind === "lens");
      if (!current) throw new Error("Lens not found");
      if (Number(args.expectedVersion) !== current.version) throw new Error("Lens changed; re-run the inference diff");
      const preview = applyPerceptualInference(current.perceptualModel, args.inferredPerceptualModel);
      const object = normalizeLibraryObject({
        ...current,
        version: current.version + 1,
        updatedAt: context.now,
        name: args.metadata?.name || current.name,
        metadata: { ...current.metadata, description: args.metadata?.description || current.metadata?.description },
        contextPolicy: args.metadata?.contextPolicy || current.contextPolicy,
        contextBudget: args.metadata?.contextBudget || current.contextBudget,
        perceptualModel: preview.proposed,
        encoding: { ...current.encoding, status: "inferred", lastDiff: preview.changes },
      }, { now: context.now });
      return {
        state: appendObject(state, object),
        result: result("lens", object, ["lens-inference-applied", "library-changed"]),
      };
    },
  },
  composeCanonicalObjects: {
    schema: { left: "object", right: "object", options: "object?", idempotencyKey: "string" },
    preconditions: ["both canonical objects validate", "ordered composition is explicit"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["canonical-composition-created", "library-changed"],
    execute(state, args) {
      const composition = composeLibraryObjects(args.left, args.right, args.options || {});
      return {
        state: appendObject(state, composition.object),
        result: result(composition.resultKind, composition.object, ["canonical-composition-created", "library-changed"]),
      };
    },
  },
  createMoveFromContent: {
    schema: { items: "array", name: "string?", separator: "string?", id: "string?" },
    preconditions: ["text content is explicit", "non-text extraction requires user action"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["move-created", "library-changed"],
    execute(state, args, context) {
      const object = createMoveFromDrop(args.items, { id: args.id || context.idFactory(), name: args.name, separator: args.separator, now: context.now });
      return { state: appendObject(state, object), result: result("move", object, ["move-created", "library-changed"]) };
    },
  },
  createFunctionFromContent: {
    schema: { items: "array", name: "string?", moveName: "string?", separator: "string?", id: "string?", moveId: "string?" },
    preconditions: ["source material is explicit", "non-text material stays attached until an instruction is explicit"],
    risk: "low", confirmation: "none", undo: "remove-created-versions",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["move-created", "function-created", "library-changed"],
    execute(state, args, context) {
      const list = Array.isArray(args.items) ? args.items : [];
      const textItems = list.map((item) => ({
        ...item,
        content: item?.content ?? item?.text ?? item?.quote ??
          "Ask for an explicit instruction before using this attached source material.",
      }));
      const move = createMoveFromDrop(textItems, {
        id: args.moveId || context.idFactory(),
        name: args.moveName,
        separator: args.separator,
        now: context.now,
      });
      const object = normalizeLibraryObject({
        kind: "function",
        schemaVersion: 2,
        id: args.id || context.idFactory(),
        name: args.name || `${move.name} Function`,
        processGraph: {
          version: 1,
          nodes: [{ id: "step-1", ref: { id: move.id, version: move.version } }],
          edges: [],
          outputs: [{ from: "step-1" }],
        },
        processInstructions: textItems.map((item) => String(item.content || "")).join(args.separator ?? "\n\n"),
        provenance: {
          kind: "semantic-drop",
          sourceMaterials: list.map((item) => item?.provenance || { id: item?.id || null }),
          wrappedMove: { id: move.id, version: move.version },
        },
      }, { now: context.now });
      const withMove = appendObject(state, move);
      return {
        state: appendObject(withMove, object),
        result: result("function", object, ["move-created", "function-created", "library-changed"]),
      };
    },
  },
  captureFunctionFromLineage: {
    schema: { items: "array", name: "string?", id: "string?" },
    preconditions: ["at least one contributing lineage exists"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["function-created", "library-changed"],
    execute(state, args, context) {
      const captured = captureFunctionFromLineage(args.items, { id: args.id || context.idFactory(), name: args.name, now: context.now });
      if (!captured.eligible) throw new Error(captured.reason);
      return { state: appendObject(state, captured.function), result: result("function", captured.function, ["function-created", "library-changed"]) };
    },
  },
  collectLensMaterial: {
    schema: { items: "array", name: "string?", id: "string?", contextPolicy: "empty|bounded|rich?" },
    preconditions: ["material is explicit and bounded"],
    risk: "low", confirmation: "none", undo: "remove-created-version",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.append",
    observableEffects: ["lens-created", "library-changed"],
    execute(state, args, context) {
      const object = createLensFromDrop(args.items, { id: args.id || context.idFactory(), name: args.name, contextPolicy: args.contextPolicy, now: context.now });
      return { state: appendObject(state, object), result: result("lens", object, ["lens-created", "library-changed"]) };
    },
  },
  setPrimitiveMove: {
    schema: { moveId: "string", primitive: "boolean" },
    preconditions: ["Move exists"],
    risk: "low", confirmation: "none", undo: "restore-primitive-preferences",
    surfaces: ["web", "companion"],
    persistenceEffect: "primitivePreferences.replace",
    observableEffects: ["primitive-order-changed"],
    execute(state, args) {
      const moves = state.objects || [];
      if (!moves.some((entry) => entry.id === args.moveId && entry.kind === "move")) throw new Error("Move not found");
      const primitivePreferences = args.primitive
        ? promotePrimitiveMove(state.primitivePreferences, args.moveId, moves)
        : demotePrimitiveMove(state.primitivePreferences, args.moveId, moves);
      return { state: { ...state, primitivePreferences }, result: { type: "primitive-preferences", id: args.moveId, effects: ["primitive-order-changed"] } };
    },
  },
  reorderPrimitiveMove: {
    schema: { moveId: "string", to: "number" },
    preconditions: ["Move is primitive"],
    risk: "low", confirmation: "none", undo: "restore-primitive-preferences",
    surfaces: ["web", "companion"],
    persistenceEffect: "primitivePreferences.replace",
    observableEffects: ["primitive-order-changed"],
    execute(state, args) {
      const primitivePreferences = reorderPrimitiveMove(state.primitivePreferences, args.moveId, args.to, state.objects || []);
      return { state: { ...state, primitivePreferences }, result: { type: "primitive-preferences", id: args.moveId, effects: ["primitive-order-changed"] } };
    },
  },
  upsertCanonicalObject: {
    schema: { object: "object", idempotencyKey: "string" },
    preconditions: ["object validates", "idempotency key is stable"],
    risk: "low", confirmation: "none", undo: "restore-library-snapshot",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "library.objects.upsert",
    observableEffects: ["library-changed"],
    execute(state, args, context) {
      if ((state.idempotencyKeys || []).includes(args.idempotencyKey)) {
        return { state, result: { type: "idempotent-replay", id: args.idempotencyKey, effects: [] } };
      }
      const object = normalizeLibraryObject(args.object, { now: context.now, idFactory: context.idFactory });
      const objects = [...(state.objects || []).filter((entry) => !(entry.id === object.id && entry.version === object.version)), object];
      validateLibraryObjects(objects);
      return {
        state: { ...state, objects, idempotencyKeys: [...(state.idempotencyKeys || []), args.idempotencyKey].slice(-2000) },
        result: result(object.kind, object, ["library-changed"]),
      };
    },
  },
});

export async function executeDomainCommand(name, state, args, options = {}) {
  const command = DOMAIN_COMMANDS[name];
  if (!command) throw new Error(`unknown domain command "${name}"`);
  const before = clone(state);
  const context = {
    idFactory: options.idFactory || (() => crypto.randomUUID()),
    now: options.now || Date.now(),
  };
  const execution = command.execute(before, clone(args || {}), context);
  try {
    await options.persist?.(execution.state, { command: name, result: execution.result });
    return { ...execution, undo: () => before, command: name };
  } catch (error) {
    await options.rollback?.(before, { command: name, error });
    throw error;
  }
}

export function commandContract(name) {
  const command = DOMAIN_COMMANDS[name];
  if (!command) return null;
  const { execute: _execute, ...contract } = command;
  return { name, version: DOMAIN_COMMAND_VERSION, ...contract };
}

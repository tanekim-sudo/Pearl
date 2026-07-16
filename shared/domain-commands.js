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

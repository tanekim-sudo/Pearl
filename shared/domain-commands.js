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
import { applyTasteLensDiff } from "./taste-lens.js";
import {
  createSemanticOrb,
  placeSemanticOrb,
  semanticOrbFromMaterial,
} from "./semantic-orbs.js";

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

function updateSemanticOrb(state, id, update) {
  let found = false;
  const semanticOrbs = (state.semanticOrbs || []).map((orb) => {
    if (orb.id !== id) return orb;
    found = true;
    return createSemanticOrb(typeof update === "function" ? update(orb) : { ...orb, ...update });
  });
  if (!found) throw new Error("semantic orb not found");
  return { ...state, semanticOrbs };
}

export const DOMAIN_COMMANDS = Object.freeze({
  openOrbCreationPreview: {
    schema: { sceneId: "string", source: "object?", placement: "object?" },
    preconditions: ["Scene is explicit"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion"],
    persistenceEffect: "none",
    observableEffects: ["semantic-orb-preview-opened"],
    execute(state, args) {
      const placement = placeSemanticOrb(state.semanticOrbs, args.placement || {});
      return {
        state,
        result: {
          type: "semantic-orb-preview",
          id: null,
          preview: {
            sceneId: args.sceneId,
            source: clone(args.source || null),
            placement,
            choices: ["create-empty", "create-from-source", "cancel"],
          },
          effects: ["semantic-orb-preview-opened"],
        },
      };
    },
  },
  createSemanticOrb: {
    schema: { sceneId: "string", orb: "object?", material: "object?", placement: "object?", activate: "boolean?" },
    preconditions: ["Scene is explicit", "source material is preserved"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const id = String(args.orb?.id || context.idFactory());
      if ((state.semanticOrbs || []).some((orb) => orb.id === id)) {
        return { state, result: { type: "idempotent-replay", id, effects: [] } };
      }
      const placement = placeSemanticOrb(state.semanticOrbs, args.placement || args.orb?.placement || {});
      const orb = args.material
        ? semanticOrbFromMaterial(args.material, { id, sceneId: args.sceneId, placement, now: context.now })
        : createSemanticOrb({ ...(args.orb || {}), id, sceneId: args.sceneId, placement }, { now: context.now });
      return {
        state: {
          ...state,
          semanticOrbs: [...(state.semanticOrbs || []), orb],
          activeSemanticOrbId: args.activate === true ? id : state.activeSemanticOrbId || null,
        },
        result: { type: "semantic-orb", id, object: orb, effects: ["semantic-orb-created"] },
      };
    },
  },
  activateSemanticOrb: {
    schema: { id: "string?" },
    preconditions: ["orb exists when id is supplied"],
    risk: "low", confirmation: "none", undo: "restore-active-semantic-orb",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.activeSemanticOrbId",
    observableEffects: ["semantic-orb-activation-changed"],
    execute(state, args) {
      if (args.id && !(state.semanticOrbs || []).some((orb) => orb.id === args.id && !orb.archived)) {
        throw new Error("semantic orb not found");
      }
      return {
        state: { ...state, activeSemanticOrbId: args.id || null },
        result: { type: "semantic-orb-activation", id: args.id || null, effects: ["semantic-orb-activation-changed"] },
      };
    },
  },
  moveSemanticOrb: {
    schema: { id: "string", placement: "object" },
    preconditions: ["orb exists"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-moved"],
    execute(state, args, context) {
      const next = updateSemanticOrb(state, args.id, (orb) => ({
        ...orb,
        placement: { ...orb.placement, ...args.placement },
        updatedAt: new Date(context.now).toISOString(),
      }));
      return { state: next, result: { type: "semantic-orb-moved", id: args.id, effects: ["semantic-orb-moved"] } };
    },
  },
  renameSemanticOrb: {
    schema: { id: "string", name: "string" },
    preconditions: ["orb exists", "name is explicit"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-updated"],
    execute(state, args, context) {
      const name = String(args.name || "").trim();
      if (!name) throw new Error("semantic orb name is required");
      const next = updateSemanticOrb(state, args.id, (orb) => ({
        ...orb,
        name: name.slice(0, 80),
        representation: { ...orb.representation, label: name.slice(0, 120) },
        updatedAt: new Date(context.now).toISOString(),
      }));
      return { state: next, result: { type: "semantic-orb-updated", id: args.id, effects: ["semantic-orb-updated"] } };
    },
  },
  bindSemanticOrb: {
    schema: { id: "string", representation: "object" },
    preconditions: ["orb exists", "representation is explicit"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-updated"],
    execute(state, args, context) {
      const next = updateSemanticOrb(state, args.id, (orb) => ({
        ...orb,
        representation: { ...orb.representation, ...clone(args.representation) },
        updatedAt: new Date(context.now).toISOString(),
      }));
      return { state: next, result: { type: "semantic-orb-updated", id: args.id, effects: ["semantic-orb-updated"] } };
    },
  },
  addSemanticOrbContext: {
    schema: { id: "string", items: "array" },
    preconditions: ["orb exists", "material is explicit and preserved"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-context-changed"],
    execute(state, args, context) {
      const next = updateSemanticOrb(state, args.id, (orb) => {
        const byId = new Map((orb.workingSet.context || []).map((item) => [item.id, item]));
        for (const item of args.items || []) if (item?.id) byId.set(String(item.id), clone(item));
        return {
          ...orb,
          workingSet: { ...orb.workingSet, context: [...byId.values()] },
          updatedAt: new Date(context.now).toISOString(),
        };
      });
      return { state: next, result: { type: "semantic-orb-context", id: args.id, effects: ["semantic-orb-context-changed"] } };
    },
  },
  removeSemanticOrbContext: {
    schema: { id: "string", itemId: "string" },
    preconditions: ["orb and context item exist"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-context-changed"],
    execute(state, args, context) {
      const next = updateSemanticOrb(state, args.id, (orb) => {
        const contextItems = (orb.workingSet.context || []).filter((item) => item.id !== args.itemId);
        if (contextItems.length === (orb.workingSet.context || []).length) throw new Error("semantic orb context item not found");
        return { ...orb, workingSet: { ...orb.workingSet, context: contextItems }, updatedAt: new Date(context.now).toISOString() };
      });
      return { state: next, result: { type: "semantic-orb-context", id: args.id, effects: ["semantic-orb-context-changed"] } };
    },
  },
  applySemanticOrbLens: {
    schema: { id: "string", lens: "object", strength: "number?" },
    preconditions: ["orb exists", "Lens is explicit and preserved"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-lenses-changed"],
    execute(state, args, context) {
      if (!args.lens?.id) throw new Error("Lens id is required");
      const next = updateSemanticOrb(state, args.id, (orb) => {
        const byId = new Map((orb.workingSet.lenses || []).map((lens) => [lens.id, lens]));
        byId.set(args.lens.id, { ...clone(args.lens), strength: Math.max(0, Math.min(1, Number(args.strength ?? args.lens.strength) || .7)) });
        return { ...orb, workingSet: { ...orb.workingSet, lenses: [...byId.values()] }, updatedAt: new Date(context.now).toISOString() };
      });
      return { state: next, result: { type: "semantic-orb-lens", id: args.id, effects: ["semantic-orb-lenses-changed"] } };
    },
  },
  removeSemanticOrbLens: {
    schema: { id: "string", lensId: "string" },
    preconditions: ["orb and Lens exist"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-lenses-changed"],
    execute(state, args, context) {
      const next = updateSemanticOrb(state, args.id, (orb) => {
        const lenses = (orb.workingSet.lenses || []).filter((lens) => lens.id !== args.lensId);
        if (lenses.length === (orb.workingSet.lenses || []).length) throw new Error("semantic orb Lens not found");
        return { ...orb, workingSet: { ...orb.workingSet, lenses }, updatedAt: new Date(context.now).toISOString() };
      });
      return { state: next, result: { type: "semantic-orb-lens", id: args.id, effects: ["semantic-orb-lenses-changed"] } };
    },
  },
  nestSemanticOrb: {
    schema: { childId: "string", parentId: "string" },
    preconditions: ["both orbs exist", "nesting remains acyclic"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-hierarchy-changed"],
    execute(state, args, context) {
      if (args.childId === args.parentId) throw new Error("an orb cannot contain itself");
      const byId = new Map((state.semanticOrbs || []).map((orb) => [orb.id, orb]));
      const child = byId.get(args.childId);
      const parent = byId.get(args.parentId);
      if (!child || !parent) throw new Error("semantic orb not found");
      let cursor = parent;
      while (cursor?.parentOrbId) {
        if (cursor.parentOrbId === child.id) throw new Error("semantic orb nesting must remain acyclic");
        cursor = byId.get(cursor.parentOrbId);
      }
      const priorParent = child.parentOrbId ? byId.get(child.parentOrbId) : null;
      const at = new Date(context.now).toISOString();
      const semanticOrbs = (state.semanticOrbs || []).map((orb) => {
        if (orb.id === child.id) return createSemanticOrb({ ...orb, parentOrbId: parent.id, updatedAt: at });
        if (orb.id === parent.id) return createSemanticOrb({ ...orb, childOrbIds: [...new Set([...(orb.childOrbIds || []), child.id])], updatedAt: at });
        if (priorParent && orb.id === priorParent.id) return createSemanticOrb({ ...orb, childOrbIds: (orb.childOrbIds || []).filter((id) => id !== child.id), updatedAt: at });
        return orb;
      });
      return { state: { ...state, semanticOrbs }, result: { type: "semantic-orb-hierarchy", id: child.id, effects: ["semantic-orb-hierarchy-changed"] } };
    },
  },
  unnestSemanticOrb: {
    schema: { id: "string" },
    preconditions: ["orb exists"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-hierarchy-changed"],
    execute(state, args, context) {
      const child = (state.semanticOrbs || []).find((orb) => orb.id === args.id);
      if (!child) throw new Error("semantic orb not found");
      const parentId = child.parentOrbId;
      const at = new Date(context.now).toISOString();
      const semanticOrbs = (state.semanticOrbs || []).map((orb) => {
        if (orb.id === child.id) return createSemanticOrb({ ...orb, parentOrbId: null, updatedAt: at });
        if (orb.id === parentId) return createSemanticOrb({ ...orb, childOrbIds: (orb.childOrbIds || []).filter((id) => id !== child.id), updatedAt: at });
        return orb;
      });
      return { state: { ...state, semanticOrbs }, result: { type: "semantic-orb-hierarchy", id: child.id, effects: ["semantic-orb-hierarchy-changed"] } };
    },
  },
  mergeSemanticOrbs: {
    schema: { ids: "array", name: "string?", sceneId: "string" },
    preconditions: ["at least two orbs exist"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const ids = [...new Set(args.ids || [])];
      const sources = (state.semanticOrbs || []).filter((orb) => ids.includes(orb.id));
      if (sources.length < 2) throw new Error("at least two semantic orbs are required");
      const id = context.idFactory();
      const placement = placeSemanticOrb(state.semanticOrbs, {
        x: sources.reduce((sum, orb) => sum + orb.placement.x, 0) / sources.length,
        y: sources.reduce((sum, orb) => sum + orb.placement.y, 0) / sources.length,
      });
      const byContext = new Map(sources.flatMap((orb) => orb.workingSet.context || []).map((item) => [item.id, item]));
      const byLens = new Map(sources.flatMap((orb) => orb.workingSet.lenses || []).map((lens) => [lens.id, lens]));
      const merged = createSemanticOrb({
        id,
        sceneId: args.sceneId,
        name: args.name || sources.map((orb) => orb.name).join(" + "),
        placement,
        representation: { kind: "grouped-context", refs: sources.map((orb) => orb.id), label: args.name || "Merged orb" },
        workingSet: { context: [...byContext.values()], lenses: [...byLens.values()] },
        lineage: sources.map((orb) => ({ orbId: orb.id, operation: "merge" })),
      }, { now: context.now });
      return { state: { ...state, semanticOrbs: [...(state.semanticOrbs || []), merged] }, result: { type: "semantic-orb", id, object: merged, effects: ["semantic-orb-created"] } };
    },
  },
  composeSemanticOrbs: {
    schema: { ids: "array", name: "string?", sceneId: "string" },
    preconditions: ["at least two orbs exist", "composition order is explicit"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const execution = DOMAIN_COMMANDS.mergeSemanticOrbs.execute(state, args, context);
      const composed = createSemanticOrb({
        ...execution.result.object,
        name: args.name || (args.ids || []).map((id) => (state.semanticOrbs || []).find((orb) => orb.id === id)?.name || id).join(" → "),
        lineage: (args.ids || []).map((orbId, index) => ({ orbId, operation: "compose", order: index })),
        representation: {
          ...execution.result.object.representation,
          label: args.name || "Composed orb",
          composition: { order: [...(args.ids || [])] },
        },
      });
      return {
        state: {
          ...execution.state,
          semanticOrbs: execution.state.semanticOrbs.map((orb) => orb.id === composed.id ? composed : orb),
        },
        result: { ...execution.result, object: composed },
      };
    },
  },
  duplicateSemanticOrb: {
    schema: { id: "string", name: "string?" },
    preconditions: ["orb exists"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const source = (state.semanticOrbs || []).find((orb) => orb.id === args.id);
      if (!source) throw new Error("semantic orb not found");
      const id = context.idFactory();
      const placement = placeSemanticOrb(state.semanticOrbs, { x: source.placement.x + 36, y: source.placement.y + 36 });
      const duplicate = createSemanticOrb({
        ...clone(source),
        id,
        name: args.name || `${source.name} copy`,
        placement,
        parentOrbId: null,
        childOrbIds: [],
        lineage: [...(source.lineage || []), { orbId: source.id, operation: "duplicate" }],
        createdAt: null,
        updatedAt: null,
      }, { now: context.now });
      return { state: { ...state, semanticOrbs: [...(state.semanticOrbs || []), duplicate] }, result: { type: "semantic-orb", id, object: duplicate, effects: ["semantic-orb-created"] } };
    },
  },
  splitSemanticOrb: {
    schema: { id: "string", sceneId: "string" },
    preconditions: ["orb exists", "orb has referenced context or child orbs"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const source = (state.semanticOrbs || []).find((orb) => orb.id === args.id);
      if (!source) throw new Error("semantic orb not found");
      const parts = source.workingSet.context?.length
        ? source.workingSet.context
        : (source.childOrbIds || []).map((id) => ({ id, kind: "grouped-context", label: id }));
      if (!parts.length) throw new Error("semantic orb has nothing to split");
      let occupied = [...(state.semanticOrbs || [])];
      const additions = parts.map((part, index) => {
        const id = context.idFactory();
        const placement = placeSemanticOrb(occupied, {
          x: source.placement.x + Math.cos(index * 2.3999632297) * 80,
          y: source.placement.y + Math.sin(index * 2.3999632297) * 80,
        });
        const orb = semanticOrbFromMaterial(part, { id, sceneId: args.sceneId, placement, now: context.now });
        occupied = [...occupied, orb];
        return createSemanticOrb({ ...orb, lineage: [...(orb.lineage || []), { orbId: source.id, operation: "split" }] });
      });
      return {
        state: { ...state, semanticOrbs: [...(state.semanticOrbs || []), ...additions] },
        result: { type: "semantic-orb-split", id: source.id, objects: additions, effects: ["semantic-orb-created"] },
      };
    },
  },
  archiveSemanticOrb: {
    schema: { id: "string", archived: "boolean?" },
    preconditions: ["orb exists"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["semantic-orb-archived"],
    execute(state, args, context) {
      const archived = args.archived !== false;
      const next = updateSemanticOrb(state, args.id, (orb) => ({ ...orb, archived, updatedAt: new Date(context.now).toISOString() }));
      return {
        state: { ...next, activeSemanticOrbId: archived && state.activeSemanticOrbId === args.id ? null : state.activeSemanticOrbId },
        result: { type: "semantic-orb-archived", id: args.id, effects: ["semantic-orb-archived"] },
      };
    },
  },
  deleteSemanticOrb: {
    schema: { id: "string" },
    preconditions: ["scoped destructive confirmation was granted"],
    risk: "high", confirmation: "framework", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.delete",
    observableEffects: ["semantic-orb-deleted"],
    execute(state, args) {
      if (!(state.semanticOrbs || []).some((orb) => orb.id === args.id)) throw new Error("semantic orb not found");
      const semanticOrbs = (state.semanticOrbs || [])
        .filter((orb) => orb.id !== args.id)
        .map((orb) => createSemanticOrb({
          ...orb,
          parentOrbId: orb.parentOrbId === args.id ? null : orb.parentOrbId,
          childOrbIds: (orb.childOrbIds || []).filter((id) => id !== args.id),
        }));
      return {
        state: { ...state, semanticOrbs, activeSemanticOrbId: state.activeSemanticOrbId === args.id ? null : state.activeSemanticOrbId },
        result: { type: "semantic-orb-deleted", id: args.id, effects: ["semantic-orb-deleted"] },
      };
    },
  },
  addOrbLens: {
    schema: { lens: "object", strength: "number?" },
    preconditions: ["Lens is explicit and preserved"],
    risk: "low", confirmation: "none", undo: "restore-orb-lenses",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.lenses",
    observableEffects: ["orb-lenses-changed"],
    execute(state, args) {
      if (!args.lens?.id) throw new Error("Lens id is required");
      const byId = new Map((state.orbLenses || []).map((entry) => [entry.id, entry]));
      byId.set(args.lens.id, {
        ...clone(args.lens),
        strength: Math.max(0, Math.min(1, Number(args.strength ?? args.lens.strength) || .7)),
      });
      return { state: { ...state, orbLenses: [...byId.values()] }, result: { type: "orb-lens", id: args.lens.id, effects: ["orb-lenses-changed"] } };
    },
  },
  updateOrbLens: {
    schema: { id: "string", strength: "number?" },
    preconditions: ["Lens is active on the orb"],
    risk: "low", confirmation: "none", undo: "restore-orb-lenses",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.lenses",
    observableEffects: ["orb-lenses-changed"],
    execute(state, args) {
      let found = false;
      const orbLenses = (state.orbLenses || []).map((lens) => {
        if (lens.id !== args.id) return lens;
        found = true;
        return {
          ...lens,
          ...(Number.isFinite(args.strength) ? { strength: Math.max(0, Math.min(1, args.strength)) } : {}),
        };
      });
      if (!found) throw new Error("orb Lens not found");
      return { state: { ...state, orbLenses }, result: { type: "orb-lens-updated", id: args.id, effects: ["orb-lenses-changed"] } };
    },
  },
  removeOrbLens: {
    schema: { id: "string" },
    preconditions: ["Lens is active on the orb"],
    risk: "low", confirmation: "none", undo: "restore-orb-lenses",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.lenses",
    observableEffects: ["orb-lenses-changed"],
    execute(state, args) {
      const orbLenses = (state.orbLenses || []).filter((lens) => lens.id !== args.id);
      if (orbLenses.length === (state.orbLenses || []).length) throw new Error("orb Lens not found");
      return { state: { ...state, orbLenses }, result: { type: "orb-lens-removed", id: args.id, effects: ["orb-lenses-changed"] } };
    },
  },
  addOrbContext: {
    schema: { items: "array", priority: "number?", group: "string?" },
    preconditions: ["material is explicit and preserved"],
    risk: "low", confirmation: "none", undo: "restore-orb-context",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.context",
    observableEffects: ["orb-context-changed"],
    execute(state, args) {
      const byId = new Map((state.orbContext || []).map((entry) => [entry.id, entry]));
      for (const item of args.items || []) {
        const id = String(item.id || item.material?.id || "");
        if (!id) continue;
        byId.set(id, {
          ...(byId.get(id) || {}),
          ...clone(item),
          id,
          kind: item.kind || item.material?.machineKind || "material",
          priority: Math.max(0, Math.min(1, Number.isFinite(args.priority) ? args.priority : 1)),
          group: args.group || null,
          provenance: item.provenance || item.material?.provenance || null,
        });
      }
      return { state: { ...state, orbContext: [...byId.values()] }, result: { type: "orb-context", id: null, effects: ["orb-context-changed"] } };
    },
  },
  updateOrbContext: {
    schema: { id: "string", priority: "number?", pinned: "boolean?", group: "string?" },
    preconditions: ["context item exists"],
    risk: "low", confirmation: "none", undo: "restore-orb-context",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.context",
    observableEffects: ["orb-context-changed"],
    execute(state, args) {
      let found = false;
      const orbContext = (state.orbContext || []).map((item) => {
        if (item.id !== args.id) return item;
        found = true;
        return {
          ...item,
          ...(Number.isFinite(args.priority) ? { priority: Math.max(0, Math.min(1, args.priority)) } : {}),
          ...(typeof args.pinned === "boolean" ? { pinned: args.pinned } : {}),
          ...(typeof args.group === "string" ? { group: args.group || null } : {}),
        };
      });
      if (!found) throw new Error("orb context item not found");
      return { state: { ...state, orbContext }, result: { type: "orb-context-updated", id: args.id, effects: ["orb-context-changed"] } };
    },
  },
  removeOrbContext: {
    schema: { id: "string" },
    preconditions: ["context item exists"],
    risk: "low", confirmation: "none", undo: "restore-orb-context",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.workingSet.context",
    observableEffects: ["orb-context-changed"],
    execute(state, args) {
      const orbContext = (state.orbContext || []).filter((item) => item.id !== args.id);
      if (orbContext.length === (state.orbContext || []).length) throw new Error("orb context item not found");
      return { state: { ...state, orbContext }, result: { type: "orb-context-removed", id: args.id, effects: ["orb-context-changed"] } };
    },
  },
  materializeOnStage: {
    schema: { items: "array", sceneId: "string", worldPoint: "object?" },
    preconditions: ["Scene is explicit", "material is preserved"],
    risk: "low", confirmation: "none", undo: "restore-scene-snapshot",
    surfaces: ["web", "companion"],
    persistenceEffect: "scene.items.append",
    observableEffects: ["scene-material-created"],
    execute(state, args) {
      const additions = (args.items || []).map((item, index) => ({
        ...clone(item),
        sceneId: args.sceneId,
        x: (Number(args.worldPoint?.x) || 0) + index * 24,
        y: (Number(args.worldPoint?.y) || 0) + index * 24,
        frameId: null,
      }));
      return { state: { ...state, sceneItems: [...(state.sceneItems || []), ...additions] }, result: { type: "scene-material", id: additions[0]?.id || null, objects: additions, effects: ["scene-material-created"] } };
    },
  },
  materializeInOutputFrame: {
    schema: { items: "array", sceneId: "string", frameId: "string" },
    preconditions: ["Output Frame exists", "material is preserved"],
    risk: "low", confirmation: "none", undo: "restore-scene-snapshot",
    surfaces: ["web", "companion"],
    persistenceEffect: "scene.items.append",
    observableEffects: ["frame-material-created"],
    execute(state, args) {
      const additions = (args.items || []).map((item) => ({ ...clone(item), sceneId: args.sceneId, frameId: args.frameId }));
      return { state: { ...state, sceneItems: [...(state.sceneItems || []), ...additions] }, result: { type: "frame-material", id: additions[0]?.id || null, objects: additions, effects: ["frame-material-created"] } };
    },
  },
  queueBranchMaterial: {
    schema: { items: "array", sourceId: "string?", idempotencyKey: "string" },
    preconditions: ["explicit GO before generation"],
    risk: "low", confirmation: "none", undo: "remove-queued-branch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.pendingBranches.append",
    observableEffects: ["branch-material-queued"],
    execute(state, args) {
      const prior = (state.pendingBranches || []).find((entry) => entry.idempotencyKey === args.idempotencyKey);
      if (prior) return { state, result: { type: "idempotent-replay", id: prior.id, effects: [] } };
      const branch = { id: args.idempotencyKey, idempotencyKey: args.idempotencyKey, sourceId: args.sourceId || null, items: clone(args.items || []) };
      return { state: { ...state, pendingBranches: [...(state.pendingBranches || []), branch] }, result: { type: "queued-branch", id: branch.id, branch, effects: ["branch-material-queued"] } };
    },
  },
  assignWorkerContext: {
    schema: { workerId: "string", items: "array" },
    preconditions: ["worker exists", "context is explicit"],
    risk: "low", confirmation: "none", undo: "restore-worker-context",
    surfaces: ["web", "companion"],
    persistenceEffect: "scene.orbInstances.update",
    observableEffects: ["worker-context-changed"],
    execute(state, args) {
      let found = false;
      const orbInstances = (state.orbInstances || []).map((worker) => {
        if (worker.id !== args.workerId) return worker;
        found = true;
        const byId = new Map((worker.context || []).map((item) => [item.id, item]));
        for (const item of args.items || []) if (item?.id) byId.set(item.id, clone(item));
        return { ...worker, context: [...byId.values()] };
      });
      if (!found) throw new Error("worker not found");
      return { state: { ...state, orbInstances }, result: { type: "worker-context", id: args.workerId, effects: ["worker-context-changed"] } };
    },
  },
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
  applyTasteLensDiff: {
    schema: { lensId: "string", expectedVersion: "number", diff: "object", acceptedOperationIds: "array", explicitSave: "boolean" },
    preconditions: ["Lens exists", "expected version matches", "diff base fingerprint matches", "persistent intent is explicit"],
    risk: "low", confirmation: "explicit-memory", undo: "restore-library-snapshot",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "library.objects.version",
    observableEffects: ["taste-lens-versioned", "library-changed"],
    execute(state, args, context) {
      const current = [...(state.objects || [])].reverse().find((entry) => entry.id === args.lensId && entry.kind === "lens");
      if (!current) throw new Error("Taste Lens not found");
      if (Number(args.expectedVersion) !== current.version) throw new Error("Taste Lens changed; refresh the proposed diff");
      if (args.explicitSave !== true) throw new Error("Persistent taste requires explicit save or remember intent");
      const applied = applyTasteLensDiff(current.perceptualModel, args.diff, {
        acceptedOperationIds: args.acceptedOperationIds,
        appliedAt: context.now,
      });
      const object = normalizeLibraryObject({
        ...current,
        version: current.version + 1,
        updatedAt: context.now,
        perceptualModel: applied.model,
      }, { now: context.now });
      return {
        state: appendObject(state, object),
        result: { ...result("lens", object, ["taste-lens-versioned", "library-changed"]), receipt: applied.receipt },
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

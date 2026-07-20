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
import {
  activatePearlCanvas,
  bindPearlCanvasContext,
  createPearlCanvasArtifact,
  deactivatePearlCanvas,
  deletePearlCanvasArtifacts,
  emptyPearlPageCanvas,
  pearlCanvasKey,
  selectPearlCanvasArtifacts,
  setPearlCanvasDestination,
  setPearlCanvasMode,
  undoPearlCanvas,
  updatePearlCanvasArtifact,
} from "./pearl-page-canvas.js";
import {
  addPearlTrack,
  emptyPearlSoundscape,
  pearlTrackAllowsOffline,
  removePearlTrack,
  setPearlActiveTrack,
  transitionPearlSoundscape,
  updatePearlSoundscape as updateSoundscapePreferences,
} from "./pearl-soundscape.js";
import {
  normalizeResultPearl,
  redirectResultPearl,
  resultPearlChatMessage,
  spawnResultPearl,
  undoResultPearl,
  updateResultPearl,
} from "./result-pearls.js";

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

function updatePageCanvas(state, args, update) {
  const key = pearlCanvasKey(args.pearlId, args.pageIdentity);
  const current = state.pageCanvases?.[key] || emptyPearlPageCanvas({
    pearlId: args.pearlId,
    pageIdentity: args.pageIdentity,
  });
  const canvas = update(current);
  return {
    key,
    canvas,
    state: {
      ...state,
      pageCanvases: { ...(state.pageCanvases || {}), [key]: canvas },
      activePageCanvasKey: canvas.active ? key : state.activePageCanvasKey === key ? null : state.activePageCanvasKey,
    },
  };
}

function updateSoundscape(state, pearlId, update) {
  const current = state.pearlSoundscapes?.[pearlId] || emptyPearlSoundscape(pearlId);
  const soundscape = update(current);
  return {
    soundscape,
    state: { ...state, pearlSoundscapes: { ...(state.pearlSoundscapes || {}), [pearlId]: soundscape } },
  };
}

function updateResult(state, resultId, update) {
  const current = state.resultPearls?.[resultId];
  if (!current) throw new Error("result Pearl not found");
  const object = update(normalizeResultPearl(current));
  return {
    object,
    state: { ...state, resultPearls: { ...(state.resultPearls || {}), [resultId]: object } },
  };
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
  activatePearlPageCanvas: {
    schema: { pearlId: "string", pageIdentity: "string" },
    preconditions: ["Pearl exists", "page identity is canonical and supported"],
    risk: "low", confirmation: "none", undo: "deactivate-page-canvas",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.upsert",
    observableEffects: ["pearl-page-canvas-activated"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, activatePearlCanvas);
      return { state: next.state, result: result("pearl-page-canvas", next.canvas, ["pearl-page-canvas-activated"]) };
    },
  },
  deactivatePearlPageCanvas: {
    schema: { pearlId: "string", pageIdentity: "string" },
    preconditions: ["Pearl page canvas exists"],
    risk: "low", confirmation: "none", undo: "reactivate-page-canvas",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.upsert",
    observableEffects: ["pearl-page-canvas-deactivated", "native-page-input-restored"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, deactivatePearlCanvas);
      return { state: next.state, result: result("pearl-page-canvas", next.canvas, ["pearl-page-canvas-deactivated", "native-page-input-restored"]) };
    },
  },
  setPearlCanvasInputMode: {
    schema: { pearlId: "string", pageIdentity: "string", mode: "string" },
    preconditions: ["Pearl page canvas can activate"],
    risk: "low", confirmation: "none", undo: "restore-canvas-mode",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.upsert",
    observableEffects: ["pearl-canvas-mode-changed"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => setPearlCanvasMode(canvas, args.mode));
      return { state: next.state, result: result("pearl-canvas-mode", next.canvas, ["pearl-canvas-mode-changed"]) };
    },
  },
  createPearlCanvasArtifact: {
    schema: { pearlId: "string", pageIdentity: "string", artifact: "object" },
    preconditions: ["artifact is bounded", "placement uses page or viewport coordinates"],
    risk: "low", confirmation: "none", undo: "delete-created-canvas-artifact",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.artifacts.append",
    observableEffects: ["pearl-canvas-artifact-created"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => createPearlCanvasArtifact(canvas, args.artifact));
      return { state: next.state, result: result("pearl-canvas-artifact", next.canvas.artifacts.at(-1), ["pearl-canvas-artifact-created"]) };
    },
  },
  updatePearlCanvasArtifact: {
    schema: { pearlId: "string", pageIdentity: "string", artifactId: "string", patch: "object" },
    preconditions: ["artifact exists"],
    risk: "low", confirmation: "none", undo: "restore-canvas-artifact",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.artifacts.update",
    observableEffects: ["pearl-canvas-artifact-updated"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => updatePearlCanvasArtifact(canvas, args.artifactId, args.patch));
      const artifact = next.canvas.artifacts.find((entry) => entry.id === args.artifactId);
      return { state: next.state, result: result("pearl-canvas-artifact", artifact, ["pearl-canvas-artifact-updated"]) };
    },
  },
  deletePearlCanvasArtifacts: {
    schema: { pearlId: "string", pageIdentity: "string", artifactIds: "array" },
    preconditions: ["artifacts exist"],
    risk: "medium", confirmation: "preview", undo: "restore-deleted-canvas-artifacts",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.artifacts.delete",
    observableEffects: ["pearl-canvas-artifacts-deleted"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => deletePearlCanvasArtifacts(canvas, args.artifactIds));
      return { state: next.state, result: result("pearl-canvas", next.canvas, ["pearl-canvas-artifacts-deleted"]) };
    },
  },
  selectPearlCanvasArtifacts: {
    schema: { pearlId: "string", pageIdentity: "string", artifactIds: "array" },
    preconditions: ["selection is bounded to current Pearl canvas"],
    risk: "low", confirmation: "none", undo: "restore-canvas-selection",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.selection.replace",
    observableEffects: ["pearl-canvas-selection-changed"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => selectPearlCanvasArtifacts(canvas, args.artifactIds));
      return { state: next.state, result: result("pearl-canvas-selection", next.canvas, ["pearl-canvas-selection-changed"]) };
    },
  },
  bindPearlCanvasContext: {
    schema: { pearlId: "string", pageIdentity: "string", entries: "array" },
    preconditions: ["context is explicit, local, and bounded"],
    risk: "low", confirmation: "none", undo: "remove-bound-canvas-context",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.context.merge",
    observableEffects: ["pearl-canvas-context-bound"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => bindPearlCanvasContext(canvas, args.entries));
      return { state: next.state, result: result("pearl-canvas-context", next.canvas, ["pearl-canvas-context-bound"]) };
    },
  },
  setPearlCanvasOutputDestination: {
    schema: { pearlId: "string", pageIdentity: "string", destination: "object" },
    preconditions: ["destination is typed and reviewable"],
    risk: "low", confirmation: "none", undo: "restore-output-destination",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.destination.replace",
    observableEffects: ["pearl-canvas-destination-changed"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, (canvas) => setPearlCanvasDestination(canvas, args.destination));
      return { state: next.state, result: result("pearl-output-destination", next.canvas, ["pearl-canvas-destination-changed"]) };
    },
  },
  placePearlCanvasOutput: {
    schema: { pearlId: "string", pageIdentity: "string", artifact: "object", destination: "object" },
    preconditions: ["output and placement are explicit", "native writes use separate approved insertion command"],
    risk: "low", confirmation: "none", undo: "delete-placed-output",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.artifacts.append",
    observableEffects: ["pearl-canvas-output-placed"],
    execute(state, args) {
      let next = updatePageCanvas(state, args, (canvas) => setPearlCanvasDestination(canvas, args.destination));
      next = updatePageCanvas(next.state, args, (canvas) => createPearlCanvasArtifact(canvas, { ...args.artifact, type: "output" }));
      return { state: next.state, result: result("pearl-canvas-output", next.canvas.artifacts.at(-1), ["pearl-canvas-output-placed"]) };
    },
  },
  undoPearlPageCanvas: {
    schema: { pearlId: "string", pageIdentity: "string" },
    preconditions: ["canvas checkpoint exists"],
    risk: "low", confirmation: "none", undo: "redo-from-retained-checkpoint",
    surfaces: ["companion", "extension"],
    persistenceEffect: "pageCanvases.restore-checkpoint",
    observableEffects: ["pearl-canvas-undone"],
    execute(state, args) {
      const next = updatePageCanvas(state, args, undoPearlCanvas);
      return { state: next.state, result: result("pearl-page-canvas", next.canvas, ["pearl-canvas-undone"]) };
    },
  },
  addPearlSoundscapeTrack: {
    schema: { pearlId: "string", track: "object" },
    preconditions: ["track audio and rights metadata are validated before mutation"],
    risk: "low", confirmation: "none", undo: "remove-added-soundscape-track",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.tracks.append",
    observableEffects: ["pearl-soundscape-track-added"],
    execute(state, args) {
      let added;
      const next = updateSoundscape(state, args.pearlId, (soundscape) => {
        added = addPearlTrack(soundscape, args.track);
        return added.soundscape;
      });
      return { state: next.state, result: { ...result("pearl-track", added.track, added.duplicate ? [] : ["pearl-soundscape-track-added"]), duplicate: added.duplicate } };
    },
  },
  removePearlSoundscapeTrack: {
    schema: { pearlId: "string", trackId: "string" },
    preconditions: ["track belongs to the current Pearl"],
    risk: "medium", confirmation: "preview", undo: "restore-removed-soundscape-track",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.tracks.delete",
    observableEffects: ["pearl-soundscape-track-removed"],
    execute(state, args) {
      const next = updateSoundscape(state, args.pearlId, (soundscape) => removePearlTrack(soundscape, args.trackId));
      return { state: next.state, result: result("pearl-soundscape", next.soundscape, ["pearl-soundscape-track-removed"]) };
    },
  },
  setPearlSoundscapeTrack: {
    schema: { pearlId: "string", trackId: "string" },
    preconditions: ["track belongs to the current Pearl"],
    risk: "low", confirmation: "none", undo: "restore-active-soundscape-track",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.activeTrackId.replace",
    observableEffects: ["pearl-soundscape-track-selected"],
    execute(state, args) {
      const next = updateSoundscape(state, args.pearlId, (soundscape) => setPearlActiveTrack(soundscape, args.trackId));
      return { state: next.state, result: result("pearl-soundscape", next.soundscape, ["pearl-soundscape-track-selected"]) };
    },
  },
  updatePearlSoundscape: {
    schema: { pearlId: "string", patch: "object" },
    preconditions: ["preferences are bounded"],
    risk: "low", confirmation: "none", undo: "restore-soundscape-preferences",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.preferences.update",
    observableEffects: ["pearl-soundscape-updated"],
    execute(state, args) {
      const next = updateSoundscape(state, args.pearlId, (soundscape) => updateSoundscapePreferences(soundscape, args.patch));
      return { state: next.state, result: result("pearl-soundscape", next.soundscape, ["pearl-soundscape-updated"]) };
    },
  },
  transitionPearlSoundscape: {
    schema: { pearlId: "string", action: "play|pause|stop", userGesture: "boolean?" },
    preconditions: ["playback follows browser autoplay policy"],
    risk: "low", confirmation: "none", undo: "restore-soundscape-playback",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.playback.replace",
    observableEffects: ["pearl-soundscape-playback-changed"],
    execute(state, args) {
      const next = updateSoundscape(state, args.pearlId, (soundscape) => transitionPearlSoundscape(soundscape, args.action, { userGesture: args.userGesture === true }));
      return { state: next.state, result: result("pearl-soundscape", next.soundscape, ["pearl-soundscape-playback-changed"]) };
    },
  },
  cachePearlTrackOffline: {
    schema: { pearlId: "string", trackId: "string", localBlobRef: "string", contentHash: "string", byteLength: "number" },
    preconditions: ["track license permits offline use", "download bytes pass audio validation and integrity checks"],
    risk: "medium", confirmation: "preview", undo: "delete-offline-audio-blob",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlSoundscapes.tracks.update",
    observableEffects: ["pearl-track-cached-offline"],
    execute(state, args) {
      const next = updateSoundscape(state, args.pearlId, (soundscape) => {
        const track = soundscape.tracks.find((entry) => entry.id === args.trackId);
        if (!track || !pearlTrackAllowsOffline(track)) throw new Error("this track license does not permit offline saving");
        return {
          ...soundscape,
          tracks: soundscape.tracks.map((entry) => entry.id === args.trackId ? {
            ...entry,
            localBlobRef: args.localBlobRef,
            contentHash: args.contentHash,
            byteLength: args.byteLength,
          } : entry),
          revision: soundscape.revision + 1,
          updatedAt: Date.now(),
        };
      });
      return { state: next.state, result: result("pearl-track-offline", next.soundscape.tracks.find((entry) => entry.id === args.trackId), ["pearl-track-cached-offline"]) };
    },
  },
  searchPearlAudioCatalog: {
    schema: { pearlId: "string", query: "string", provider: "string?" },
    preconditions: ["only the explicit search query may leave the device"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "none",
    observableEffects: ["pearl-audio-search-requested"],
    execute(state, args) {
      return {
        state,
        result: {
          type: "pearl-audio-search",
          id: null,
          pearlId: args.pearlId,
          query: String(args.query || "").slice(0, 120),
          provider: args.provider || "licensed",
          effects: ["pearl-audio-search-requested"],
        },
      };
    },
  },
  spawnResultPearl: {
    schema: { result: "object", idempotencyKey: "string" },
    preconditions: ["output identity, source references, Lens provenance, and disclosure receipt are present"],
    risk: "low", confirmation: "none", undo: "delete-spawned-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.upsert",
    observableEffects: ["result-pearl-spawned"],
    execute(state, args) {
      const existing = Object.values(state.resultPearls || {}).find((entry) =>
        entry.execution?.idempotencyKey === args.idempotencyKey || entry.id === args.result?.id
      );
      if (existing) return { state, result: result("result-pearl", existing, []) };
      const object = spawnResultPearl({
        ...args.result,
        execution: { ...(args.result.execution || {}), idempotencyKey: args.idempotencyKey },
      });
      return {
        state: { ...state, resultPearls: { ...(state.resultPearls || {}), [object.id]: object } },
        result: result("result-pearl", object, ["result-pearl-spawned"]),
      };
    },
  },
  placeResultPearl: {
    schema: { resultId: "string", placement: "object" },
    preconditions: ["placement was computed against the current viewport and obstacles"],
    risk: "low", confirmation: "none", undo: "restore-result-pearl-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.placement.replace",
    observableEffects: ["result-pearl-placed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { placement: args.placement }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-placed"]) };
    },
  },
  moveResultPearl: {
    schema: { resultId: "string", placement: "object" },
    preconditions: ["result Pearl exists and placement is inside the current page coordinate model"],
    risk: "low", confirmation: "none", undo: "undo-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.placement.replace",
    observableEffects: ["result-pearl-moved"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { placement: args.placement }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-moved"]) };
    },
  },
  undoResultPearl: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl has a checkpoint"],
    risk: "low", confirmation: "none", undo: "redo-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.checkpoint.restore",
    observableEffects: ["result-pearl-undone"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, undoResultPearl);
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-undone"]) };
    },
  },
  setResultPearlStatus: {
    schema: { resultId: "string", status: "streaming|ready|failed|opened|accepted|archived", text: "string?", failure: "object?", patch: "object?" },
    preconditions: ["result Pearl exists"],
    risk: "low", confirmation: "none", undo: "restore-result-pearl-status",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.status.update",
    observableEffects: ["result-pearl-status-changed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        ...(args.patch || {}),
        status: args.status,
        ...(args.text != null ? { text: args.text } : {}),
        ...(args.failure ? { failure: args.failure } : {}),
      }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-status-changed"]) };
    },
  },
  expandResultPearl: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl exists"],
    risk: "low", confirmation: "none", undo: "collapse-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.expanded.replace",
    observableEffects: ["result-pearl-expanded"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { expanded: true, status: object.status === "ready" ? "opened" : object.status, openedAt: Date.now() }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-expanded"]) };
    },
  },
  collapseResultPearl: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl exists"],
    risk: "low", confirmation: "none", undo: "expand-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.expanded.replace",
    observableEffects: ["result-pearl-collapsed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { expanded: false }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-collapsed"]) };
    },
  },
  openResultPearlInTab: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl exists; the surface adapter creates a nonce-bound tab handoff"],
    risk: "low", confirmation: "none", undo: "restore-result-destination",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.destination.replace",
    observableEffects: ["result-pearl-tab-requested"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => redirectResultPearl(object, { type: "new-tab" }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-tab-requested"]) };
    },
  },
  redirectResultPearl: {
    schema: { resultId: "string", destination: "object" },
    preconditions: ["destination is typed and validated"],
    risk: "low", confirmation: "none", undo: "restore-result-destination",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.destination.replace",
    observableEffects: ["result-pearl-redirected"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => redirectResultPearl(object, args.destination));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-redirected"]) };
    },
  },
  presentResultPearlAsChat: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl exists"],
    risk: "low", confirmation: "none", undo: "remove-linked-chat-message",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultChats.append",
    observableEffects: ["result-pearl-presented-as-chat"],
    execute(state, args) {
      const current = state.resultPearls?.[args.resultId];
      if (!current) throw new Error("result Pearl not found");
      const message = resultPearlChatMessage(current);
      const messages = [...(state.resultChats || []).filter((entry) => entry.id !== message.id), message];
      const redirected = updateResult(state, args.resultId, (object) => redirectResultPearl(object, { type: "chat", targetId: message.id }));
      return { state: { ...redirected.state, resultChats: messages }, result: result("result-chat-message", message, ["result-pearl-presented-as-chat"]) };
    },
  },
  createResultPlacementRegion: {
    schema: { resultId: "string", pearlId: "string", pageIdentity: "string", box: "object", coordinateSpace: "string?", kind: "canvas-textbox|canvas-region|companion-region" },
    preconditions: ["placement rectangle is explicit and bounded"],
    risk: "low", confirmation: "none", undo: "delete-created-result-region",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pageCanvases.artifacts.append,resultPearls.destination.replace",
    observableEffects: ["result-placement-region-created"],
    execute(state, args) {
      const current = state.resultPearls?.[args.resultId];
      if (!current) throw new Error("result Pearl not found");
      const artifactId = `result-region:${args.resultId}`;
      const canvas = updatePageCanvas(state, args, (value) => createPearlCanvasArtifact(value, {
        id: artifactId,
        type: "output",
        text: current.text,
        box: args.box,
        coordinateSpace: args.coordinateSpace,
        provenance: { kind: "result-pearl-placement", resultPearlId: args.resultId },
      }));
      const redirected = updateResult(canvas.state, args.resultId, (object) => redirectResultPearl(object, { type: args.kind, targetId: artifactId }));
      return { state: redirected.state, result: result("result-placement-region", redirected.object, ["result-placement-region-created"]) };
    },
  },
  selectResultPlacementRegion: {
    schema: { resultId: "string", pearlId: "string", pageIdentity: "string", artifactId: "string", kind: "canvas-textbox|canvas-region|companion-region" },
    preconditions: ["the selected canvas region exists in the same Pearl and page namespace"],
    risk: "low", confirmation: "none", undo: "restore-result-destination",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.destination.replace",
    observableEffects: ["result-placement-region-selected"],
    execute(state, args) {
      const key = pearlCanvasKey(args.pearlId, args.pageIdentity);
      const canvas = state.pageCanvases?.[key];
      const artifact = canvas?.artifacts?.find((entry) => entry.id === args.artifactId);
      if (!artifact || !["text", "output"].includes(artifact.type)) throw new Error("result placement region not found");
      const next = updateResult(state, args.resultId, (object) => redirectResultPearl(object, {
        type: args.kind,
        targetId: artifact.id,
      }));
      return { state: next.state, result: result("result-placement-region", next.object, ["result-placement-region-selected"]) };
    },
  },
  acceptResultPearl: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl is ready or opened"],
    risk: "low", confirmation: "none", undo: "restore-result-status",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.status.update",
    observableEffects: ["result-pearl-accepted"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { status: "accepted", acceptedAt: Date.now() }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-accepted"]) };
    },
  },
  archiveResultPearl: {
    schema: { resultId: "string", archived: "boolean?" },
    preconditions: ["result Pearl exists"],
    risk: "low", confirmation: "none", undo: "restore-result-archive-state",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.archived.update",
    observableEffects: ["result-pearl-archived"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { archived: args.archived !== false, status: args.archived === false ? "ready" : "archived" }));
      return { state: next.state, result: result("result-pearl", next.object, ["result-pearl-archived"]) };
    },
  },
  deleteResultPearl: {
    schema: { resultId: "string" },
    preconditions: ["result Pearl exists"],
    risk: "medium", confirmation: "preview", undo: "restore-result-pearl",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.delete",
    observableEffects: ["result-pearl-deleted"],
    execute(state, args) {
      if (!state.resultPearls?.[args.resultId]) throw new Error("result Pearl not found");
      const resultPearls = { ...state.resultPearls };
      const removed = resultPearls[args.resultId];
      delete resultPearls[args.resultId];
      return { state: { ...state, resultPearls }, result: result("result-pearl", removed, ["result-pearl-deleted"]) };
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

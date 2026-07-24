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
  buildPearlMutualObservations,
  createSemanticOrb,
  placeSemanticOrb,
  semanticOrbFromMaterial,
} from "./semantic-orbs.js";
import { applyOrganizeToPearl, organizePearlContents } from "./pearl-organize.js";
import { materializeCounterPearl } from "./pearl-counter.js";
import { buildGauntletEvaluationQuery } from "./pearl-gauntlet-eval.js";
import { buildInvestorRolePearlScaffold } from "./role-pearl-scaffold.js";
import { createOrbInstance, fuseWorkerProposals, MAX_ORB_WORKERS, splitOrbWorkers } from "./orb-swarm.js";
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
import {
  beginPlacementExecution,
  cancelPlacementRequest,
  completePlacementExecution,
  confirmPlacementRequest,
  createOutputRoutingRequest,
  failPlacementExecution,
  interpretPlacementAnswer,
} from "./output-routing.js";
import { compileAutomationPearl, reviseAutomationPearl } from "./automation-pearl.js";
import {
  approveAutomationContextPatch,
  createAutomationResearchPlan,
  proposeAutomationContextPatch,
  undoAutomationContextPatch,
} from "./automation-research.js";
import {
  consumePearlShareGrant,
  createPearlShareGrant,
  createPearlShareReview,
  revokePearlShareGrant,
  validatePearlPackage,
} from "./pearl-sharing.js";
import { applyPearlEntityPatch, createPearlEntity } from "./pearl-entity.js";
import {
  applyPearlAestheticPreset,
  defaultPearlAesthetic,
  normalizePearlAesthetic,
  patchPearlAesthetic,
} from "./pearl-aesthetic.js";
import { mutatePearlFunctionMoves } from "./pearl-function-moves.js";
import { createPearlStudioOpenRequest, createPearlStudioViewModel } from "./pearl-studio.js";
import {
  labelPearlVersion as labelPearlVersionState,
  listPearlVersions,
  restorePearlVersion as restorePearlVersionState,
  snapshotPearlVersion as snapshotPearlVersionState,
} from "./pearl-version-history.js";
import {
  advanceCognitivePlayback,
  applyCognitiveLayerPatch,
  cancelCognitivePlayback,
  composeCognitiveLayers,
  createCognitiveLayer,
  createPearlCognition,
  proposeCognitiveLayerPatch,
  resolveCognitiveUncertainty,
  startCognitivePlayback,
} from "./pearl-cognitive-layers.js";
import {
  applyPearlPrivacyPatch,
  createPearlPrivacyPolicy,
  guardPearlPrivacyAction,
  inheritPrivacyForDerivedPearl,
  pearlPrivacyObservation,
  proposePearlPrivacyPatch,
} from "./pearl-privacy-policy.js";

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
  if (!found) throw new Error("pearl not found");
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

function updatePearlCognition(state, pearlId, update) {
  const current = state.pearlEntities?.[pearlId];
  if (!current) throw new Error("canonical Pearl not found");
  const entity = createPearlEntity(current);
  if (entity.permissions.lockState === "locked") throw new Error("unlock this Pearl before editing cognitive layers");
  const cognition = createPearlCognition(update(entity.cognition, entity));
  const changed = applyPearlEntityPatch(entity, { cognition }, {
    expectedRevision: entity.revision,
    idempotencyKey: `cognition:${Date.now()}`,
    reason: "cognitive-layer-edit",
  });
  if (changed.conflict) throw new Error("Pearl changed while editing cognitive layers");
  return {
    object: changed.entity,
    state: { ...state, pearlEntities: { ...state.pearlEntities, [pearlId]: changed.entity } },
  };
}

function automationPearlFromEntity(value) {
  const entity = createPearlEntity(value);
  if (entity.kind !== "automation") return null;
  return {
    id: entity.id,
    stableId: entity.identity.stableId,
    version: Math.max(1, Number(entity.automation?.version) || entity.revision + 1),
    kind: "automation-pearl",
    identity: clone(entity.identity),
    material: { type: "automation-evidence", evidence: clone(entity.cognition.rawEvidence), verbatimPreserved: true },
    cognition: clone(entity.cognition),
    contextSchema: clone(entity.automation?.contextSchema),
    lenses: clone(entity.lenses),
    moves: clone(entity.moves),
    functions: clone(entity.functions),
    generationPlan: clone(entity.automation?.generationPlan || entity.generation.plan),
    outputSpecs: clone(entity.generation.outputSpecs),
    researchPlan: clone(entity.automation?.researchPlan),
    evaluation: clone(entity.automation?.evaluation),
    semanticDiff: clone(entity.automation?.semanticDiff),
    contextPatches: clone(entity.automation?.contextPatches || []),
    permissions: clone(entity.automation?.permissions || []),
    privacyPolicy: clone(entity.privacy.policy),
    provenance: clone(entity.provenance),
  };
}

function assertConfirmedResultPlacement(object, allowedTypes) {
  const routing = object?.routing;
  if (routing?.stage !== "executing" || routing.plan?.confirmed !== true) {
    throw new Error("confirmed PlacementPlan execution is required");
  }
  if (allowedTypes && !allowedTypes.includes(routing.plan.destination?.type)) {
    throw new Error("confirmed PlacementPlan destination mismatch");
  }
  return routing.plan;
}

const DOMAIN_PRIVACY_ACTIONS = Object.freeze({
  planAutomationResearch: "research",
  createPearlShareGrant: "share",
  consumePearlShareGrant: "handoff",
  installValidatedPearlPackage: "handoff",
});

function privacyPolicyForCommand(state, args, options = {}) {
  return options.privacyPolicy || args.privacyPolicy ||
    state.resultPearls?.[args.resultId]?.privacyPolicy ||
    state.automationPearls?.[args.pearlId]?.privacyPolicy ||
    state.pearlPrivacyPolicies?.[args.pearlId] ||
    args.pearl?.privacyPolicy ||
    args.package?.privacyPolicy ||
    null;
}

function privacyActionForCommand(name, state, args) {
  if (name === "beginOutputPlacement") {
    const type = state.resultPearls?.[args.resultId]?.routing?.plan?.destination?.type;
    if (["clipboard", "download", "pdf", "native-insert", "native-replace"].includes(type)) return "export";
    if (["web-scene", "output-frame"].includes(type)) return "handoff";
    return "local-placement";
  }
  return DOMAIN_PRIVACY_ACTIONS[name] || null;
}

function assertDomainPrivacy(name, state, args, options = {}) {
  const action = privacyActionForCommand(name, state, args);
  if (!action) return null;
  const policy = privacyPolicyForCommand(state, args, options);
  if (!policy) throw new Error(`PrivacyPolicy is required before ${action}`);
  const decision = guardPearlPrivacyAction(policy, action, options.privacyContext || {});
  if (!decision.allowed) {
    const error = new Error(decision.reason);
    error.code = decision.code;
    error.minimumPrivacyPatch = decision.minimumPatch;
    throw error;
  }
  if (decision.approvalRequired && options.disclosureApproved !== true && args.disclosureApproved !== true) {
    const error = new Error(`explicit ${action} disclosure approval is required`);
    error.code = "PRIVACY_APPROVAL_REQUIRED";
    throw error;
  }
  return decision;
}

export const DOMAIN_COMMANDS = Object.freeze({
  openOrbCreationPreview: {
    schema: { sceneId: "string", source: "object?", placement: "object?" },
    preconditions: ["Scene is explicit"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion"],
    persistenceEffect: "none",
    observableEffects: ["semantic-orb-preview-opened"],
    execute(state, args, context) {
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
      const hasOrganizedOrb = Boolean(
        args.orb
        && (
          args.orb.moves?.length
          || args.orb.functions?.length
          || args.orb.lenses?.length
          || args.orb.workingSet?.context?.length
          || args.orb.representation
        )
      );
      let orb;
      if (hasOrganizedOrb) {
        // Prefer explicit orb payload (forming pearls / encode) so Moves→Functions→Lenses survive.
        orb = createSemanticOrb({ ...(args.orb || {}), id, sceneId: args.sceneId, placement }, { now: context.now });
        if (args.material && !(orb.workingSet?.context || []).length) {
          const seeded = semanticOrbFromMaterial(args.material, {
            id, sceneId: args.sceneId, placement, now: context.now,
          });
          orb = createSemanticOrb({
            ...orb,
            workingSet: { ...orb.workingSet, context: seeded.workingSet.context },
            provenance: { ...(seeded.provenance || {}), ...(orb.provenance || {}) },
          }, { now: context.now });
        }
      } else if (args.material) {
        orb = semanticOrbFromMaterial(args.material, { id, sceneId: args.sceneId, placement, now: context.now });
      } else {
        orb = createSemanticOrb({ ...(args.orb || {}), id, sceneId: args.sceneId, placement }, { now: context.now });
      }
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
  createRolePearl: {
    schema: {
      sceneId: "string?",
      role: "string?",
      firm: "string?",
      name: "string?",
      utterance: "string?",
      placement: "object?",
      activate: "boolean?",
      openStudio: "boolean?",
      wear: "boolean?",
      materializeLibrary: "boolean?",
    },
    preconditions: ["Scene is explicit", "role or utterance implies investor scaffold"],
    risk: "low",
    confirmation: "none",
    undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["role-pearl-created", "semantic-orb-created"],
    execute(state, args, context) {
      const scaffold = buildInvestorRolePearlScaffold({
        utterance: args.utterance,
        role: args.role,
        firm: args.firm,
        name: args.name,
        now: context.now,
      });
      const id = String(context.idFactory());
      if ((state.semanticOrbs || []).some((orb) => orb.id === id)) {
        return { state, result: { type: "idempotent-replay", id, effects: [] } };
      }
      const placement = placeSemanticOrb(state.semanticOrbs, args.placement || {});
      const orb = createSemanticOrb({
        ...scaffold.pearl,
        id,
        sceneId: args.sceneId,
        placement,
      }, { now: context.now });
      return {
        state: {
          ...state,
          semanticOrbs: [...(state.semanticOrbs || []), orb],
          activeSemanticOrbId: args.activate === false ? state.activeSemanticOrbId || null : id,
        },
        result: {
          type: "role-pearl",
          id,
          object: orb,
          scaffold,
          openStudio: args.openStudio !== false,
          wear: args.wear !== false,
          materializeLibrary: args.materializeLibrary !== false,
          effects: ["role-pearl-created", "semantic-orb-created"],
        },
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
        throw new Error("pearl not found");
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
      if (!name) throw new Error("pearl name is required");
      const next = updateSemanticOrb(state, args.id, (orb) => ({
        ...orb,
        name: name.slice(0, 80),
        representation: { ...orb.representation, label: name.slice(0, 120) },
        updatedAt: new Date(context.now).toISOString(),
      }));
      return { state: next, result: { type: "semantic-orb-updated", id: args.id, effects: ["semantic-orb-updated"] } };
    },
  },
  patchSemanticOrbAesthetic: {
    schema: { id: "string", aesthetic: "object" },
    preconditions: ["orb exists", "aesthetic is explicit"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.aesthetic",
    observableEffects: ["pearl-aesthetic-changed", "semantic-orb-updated"],
    execute(state, args, context) {
      const aesthetic = normalizePearlAesthetic(args.aesthetic);
      const next = updateSemanticOrb(state, args.id, (orb) => ({
        ...orb,
        aesthetic,
        updatedAt: new Date(context.now).toISOString(),
      }));
      return {
        state: { ...next, companionAesthetic: aesthetic },
        result: {
          type: "pearl-aesthetic",
          id: args.id,
          object: { pearlId: args.id, aesthetic },
          effects: ["pearl-aesthetic-changed", "semantic-orb-updated"],
        },
      };
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
        if (contextItems.length === (orb.workingSet.context || []).length) throw new Error("pearl context item not found");
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
        if (lenses.length === (orb.workingSet.lenses || []).length) throw new Error("pearl Lens not found");
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
      if (args.childId === args.parentId) throw new Error("a pearl cannot contain itself");
      const byId = new Map((state.semanticOrbs || []).map((orb) => [orb.id, orb]));
      const child = byId.get(args.childId);
      const parent = byId.get(args.parentId);
      if (!child || !parent) throw new Error("pearl not found");
      let cursor = parent;
      while (cursor?.parentOrbId) {
        if (cursor.parentOrbId === child.id) throw new Error("pearl nesting must remain acyclic");
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
      if (!child) throw new Error("pearl not found");
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
    preconditions: ["at least two pearls exist"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created"],
    execute(state, args, context) {
      const ids = [...new Set(args.ids || [])];
      const sources = (state.semanticOrbs || []).filter((orb) => ids.includes(orb.id));
      if (sources.length < 2) throw new Error("at least two pearls are required");
      const id = context.idFactory();
      const placement = placeSemanticOrb(state.semanticOrbs, {
        x: sources.reduce((sum, orb) => sum + orb.placement.x, 0) / sources.length,
        y: sources.reduce((sum, orb) => sum + orb.placement.y, 0) / sources.length,
      });
      const byContext = new Map(sources.flatMap((orb) => orb.workingSet.context || []).map((item) => [item.id, item]));
      const byLens = new Map(sources.flatMap((orb) => orb.workingSet.lenses || []).map((lens) => [lens.id, lens]));
      const sourceIds = sources.map((orb) => orb.id);
      const merged = createSemanticOrb({
        id,
        sceneId: args.sceneId,
        name: args.name || sources.map((orb) => orb.name).join(" + "),
        placement,
        representation: {
          kind: "grouped-context",
          refs: sourceIds,
          label: args.name || "Merged pearl",
          preserveIndividuals: true,
          sourcePearlIds: sourceIds,
        },
        workingSet: { context: [...byContext.values()], lenses: [...byLens.values()] },
        lineage: sources.map((orb) => ({ orbId: orb.id, operation: "merge", preserved: true })),
        provenance: {
          merge: {
            mode: "preserve-individuals",
            sourcePearlIds: sourceIds,
            note: "Source pearls remain independent library pearls; this pearl is an additional composition.",
          },
        },
      }, { now: context.now });
      // Append-only: source pearls stay in semanticOrbs unchanged.
      return {
        state: { ...state, semanticOrbs: [...(state.semanticOrbs || []), merged] },
        result: {
          type: "semantic-orb",
          id,
          object: merged,
          preservedSourceIds: sourceIds,
          effects: ["semantic-orb-created", "semantic-orb-merge-preserved-sources"],
        },
      };
    },
  },
  composeSemanticOrbs: {
    schema: { ids: "array", name: "string?", sceneId: "string" },
    preconditions: ["at least two pearls exist", "composition order is explicit"],
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
          label: args.name || "Composed pearl",
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
  synthesizeSemanticOrbs: {
    schema: {
      ids: "array",
      name: "string?",
      sceneId: "string",
      mode: "mutual|directed?",
      instruction: "string?",
    },
    preconditions: ["at least two pearls exist"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created", "pearl-synthesis-created"],
    execute(state, args, context) {
      const ids = [...new Set(args.ids || [])];
      const sources = (state.semanticOrbs || []).filter((orb) => ids.includes(orb.id));
      if (sources.length < 2) throw new Error("at least two pearls are required");
      const ordered = ids.map((id) => sources.find((orb) => orb.id === id)).filter(Boolean);
      const { mode, instruction, observations, sourceIds } = buildPearlMutualObservations(ordered, {
        mode: args.mode,
        instruction: args.instruction,
      });
      const id = context.idFactory();
      const placement = placeSemanticOrb(state.semanticOrbs, {
        x: ordered.reduce((sum, orb) => sum + orb.placement.x, 0) / ordered.length,
        y: ordered.reduce((sum, orb) => sum + orb.placement.y, 0) / ordered.length + 48,
      });
      const defaultName = mode === "directed"
        ? `${ordered[0].name} on ${ordered[1].name}`
        : `${ordered.map((orb) => orb.name).join(" × ")} synthesis`;
      const synthesized = createSemanticOrb({
        id,
        sceneId: args.sceneId,
        name: args.name || defaultName,
        placement,
        representation: {
          kind: "synthesis",
          refs: sourceIds,
          label: args.name || "Mutual synthesis",
          preserveIndividuals: true,
          sourcePearlIds: sourceIds,
        },
        workingSet: {
          context: observations,
          lenses: [],
        },
        lineage: sourceIds.map((orbId) => ({ orbId, operation: "synthesize", mode, preserved: true })),
        provenance: {
          synthesis: {
            mode,
            instruction,
            sourcePearlIds: sourceIds,
            observationCount: observations.length,
            observations: observations.map((item) => ({
              id: item.id,
              fromPearlId: item.fromPearlId,
              aboutPearlId: item.aboutPearlId,
              text: item.text,
            })),
            note: "Source pearls remain independent; this pearl holds mutual/directed observations only.",
          },
        },
      }, { now: context.now });
      // Append-only: source pearls stay in semanticOrbs unchanged.
      return {
        state: { ...state, semanticOrbs: [...(state.semanticOrbs || []), synthesized] },
        result: {
          type: "semantic-orb",
          id,
          object: synthesized,
          preservedSourceIds: sourceIds,
          observations,
          mode,
          effects: ["semantic-orb-created", "pearl-synthesis-created", "semantic-orb-merge-preserved-sources"],
        },
      };
    },
  },
  organizePearl: {
    schema: { id: "string?", extraText: "string?", sceneId: "string?" },
    preconditions: ["pearl exists", "multimodal dump or layers present"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["pearl-organized", "semantic-orb-updated"],
    execute(state, args, context) {
      const id = args.id || state.activeSemanticOrbId;
      const source = (state.semanticOrbs || []).find((orb) => orb.id === id);
      if (!source) throw new Error("pearl not found to organize");
      const organized = organizePearlContents(source, { extraText: args.extraText });
      if (!organized.ok) throw new Error(organized.reason);
      const nextOrb = applyOrganizeToPearl(source, organized);
      nextOrb.updatedAt = new Date(context.now || Date.now()).toISOString();
      const semanticOrbs = (state.semanticOrbs || []).map((orb) => (orb.id === id ? createSemanticOrb(nextOrb) : orb));
      return {
        state: { ...state, semanticOrbs },
        result: {
          type: "pearl-organized",
          id,
          object: nextOrb,
          organization: organized.organization,
          preservedEvidenceCount: organized.preservedEvidence.length,
          removedRedundantCount: organized.removedRedundantCount,
          effects: ["pearl-organized", "semantic-orb-updated"],
        },
      };
    },
  },
  createCounterPearl: {
    schema: { id: "string", name: "string?", sceneId: "string", instruction: "string?" },
    preconditions: ["source pearl exists"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["semantic-orb-created", "pearl-counter-created"],
    execute(state, args, context) {
      const source = (state.semanticOrbs || []).find((orb) => orb.id === args.id);
      if (!source) throw new Error("source pearl not found");
      const material = materializeCounterPearl(state, source, {
        name: args.name,
        sceneId: args.sceneId || source.sceneId,
        instruction: args.instruction,
      }, context);
      return {
        state: material.state,
        result: {
          type: "semantic-orb",
          id: material.orb.id,
          object: material.orb,
          preservedSourceIds: [source.id],
          organization: material.spec.organization,
          effects: ["semantic-orb-created", "pearl-counter-created", "semantic-orb-merge-preserved-sources"],
        },
      };
    },
  },
  evaluateWithGauntlet: {
    schema: {
      material: "object?",
      text: "string?",
      title: "string?",
      url: "string?",
      instruction: "string?",
      workingMemory: "object?",
      packs: "array?",
    },
    preconditions: ["gauntlet packs present", "material disclosed"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "none",
    observableEffects: ["gauntlet-evaluation-prepared"],
    execute(state, args) {
      const packs = args.packs
        || args.workingMemory?.packs
        || null;
      const evaluation = buildGauntletEvaluationQuery({
        packs,
        workingMemory: args.workingMemory,
        material: args.material || {
          text: args.text,
          title: args.title,
          url: args.url,
        },
        instruction: args.instruction,
      });
      if (!evaluation.ok) throw new Error(evaluation.reason);
      return {
        state,
        result: {
          type: "gauntlet-evaluation",
          id: `eval:${Date.now()}`,
          object: evaluation,
          effects: ["gauntlet-evaluation-prepared"],
          requiresModel: true,
        },
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
      if (!source) throw new Error("pearl not found");
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
      if (!source) throw new Error("pearl not found");
      const parts = source.workingSet.context?.length
        ? source.workingSet.context
        : (source.childOrbIds || []).map((id) => ({ id, kind: "grouped-context", label: id }));
      if (!parts.length) throw new Error("pearl has nothing to split");
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
      if (!(state.semanticOrbs || []).some((orb) => orb.id === args.id)) throw new Error("pearl not found");
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
  createWorker: {
    schema: { parentId: "string", specs: "array", sceneId: "string?", limit: "number?" },
    preconditions: ["parent pearl exists", "worker specs are finite and role-bound"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.append",
    observableEffects: ["orb-workers-created", "semantic-orb-created"],
    execute(state, args, context) {
      const parentId = args.parentId || args.id;
      const parent = (state.semanticOrbs || []).find((orb) => orb.id === parentId);
      if (!parent) throw new Error("parent pearl not found");
      const rawSpecs = Array.isArray(args.specs) ? args.specs : [];
      if (!rawSpecs.length) throw new Error("worker specs are required");
      const limit = Math.max(1, Math.min(MAX_ORB_WORKERS, Number(args.limit) || MAX_ORB_WORKERS));
      const parentInstance = createOrbInstance({
        id: parent.id,
        role: "parent",
        context: parent.workingSet?.context || [],
        checkpoint: { pearlId: parent.id, revision: parent.revision || 0 },
      });
      const workers = splitOrbWorkers(parentInstance, rawSpecs.map((spec, index) => ({
        id: spec.id,
        role: spec.role || spec.goal || `worker-${index + 1}`,
        goal: spec.goal || spec.role || `Sub-agent ${index + 1}`,
        context: spec.context || parent.workingSet?.context || [],
        tools: spec.tools || [],
        model: spec.model || "auto",
        mutationScope: spec.mutationScope || null,
        budget: spec.budget,
      })), { limit });
      let occupied = [...(state.semanticOrbs || [])];
      const additions = workers.map((worker, index) => {
        const id = context.idFactory();
        const placement = placeSemanticOrb(occupied, {
          x: parent.placement.x + Math.cos((-Math.PI / 2) + index * ((Math.PI * 2) / workers.length)) * 88,
          y: parent.placement.y + Math.sin((-Math.PI / 2) + index * ((Math.PI * 2) / workers.length)) * 88,
        });
        const orb = createSemanticOrb({
          id,
          sceneId: args.sceneId || parent.sceneId,
          name: worker.goal || worker.role,
          placement,
          parentOrbId: parent.id,
          representation: { kind: "worker", refs: [worker.id], label: worker.role },
          workingSet: {
            context: clone(worker.context || []),
            lenses: [],
          },
          lineage: [...(parent.lineage || []), { orbId: parent.id, operation: "fission", workerId: worker.id }],
          createdAt: new Date(context.now).toISOString(),
          updatedAt: new Date(context.now).toISOString(),
        });
        occupied = [...occupied, orb];
        return { orb, worker: { ...worker, pearlId: id } };
      });
      const childIds = additions.map((entry) => entry.orb.id);
      const semanticOrbs = occupied.map((orb) => {
        if (orb.id !== parent.id) return orb;
        return createSemanticOrb({
          ...orb,
          childOrbIds: [...new Set([...(orb.childOrbIds || []), ...childIds])],
          updatedAt: new Date(context.now).toISOString(),
        });
      });
      const orbWorkers = {
        ...(state.orbWorkers || {}),
        [parent.id]: additions.map((entry) => entry.worker),
      };
      return {
        state: { ...state, semanticOrbs, orbWorkers, activeSemanticOrbId: parent.id },
        result: {
          type: "orb-workers",
          id: parent.id,
          objects: additions.map((entry) => entry.orb),
          workers: additions.map((entry) => entry.worker),
          effects: ["orb-workers-created", "semantic-orb-created"],
          powerFx: { kind: "fission", count: additions.length, pearlId: parent.id },
        },
      };
    },
  },
  mergeWorkers: {
    schema: { parentId: "string", workerIds: "array?" },
    preconditions: ["parent pearl has workers"],
    risk: "low", confirmation: "none", undo: "restore-semantic-orbs",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "scene.semanticOrbs.update",
    observableEffects: ["orb-workers-merged"],
    execute(state, args, context) {
      const parentId = args.parentId || args.id;
      const parent = (state.semanticOrbs || []).find((orb) => orb.id === parentId);
      if (!parent) throw new Error("parent pearl not found");
      const workers = (state.orbWorkers?.[parentId] || []).map((worker) => ({
        ...worker,
        status: worker.status || "completed",
        proposal: worker.proposal || { type: "observation", summary: worker.goal || worker.role },
      }));
      if (!workers.length) throw new Error("no workers to fuse");
      const selected = Array.isArray(args.workerIds) && args.workerIds.length
        ? workers.filter((worker) => args.workerIds.includes(worker.id) || args.workerIds.includes(worker.pearlId))
        : workers;
      const fusion = fuseWorkerProposals(selected);
      const removeIds = new Set(selected.map((worker) => worker.pearlId).filter(Boolean));
      const semanticOrbs = (state.semanticOrbs || [])
        .filter((orb) => !removeIds.has(orb.id))
        .map((orb) => {
          if (orb.id !== parentId) return orb;
          return createSemanticOrb({
            ...orb,
            childOrbIds: (orb.childOrbIds || []).filter((id) => !removeIds.has(id)),
            workingSet: {
              ...orb.workingSet,
              context: [
                ...(orb.workingSet?.context || []),
                ...fusion.accepted.map((proposal, index) => ({
                  id: `fused:${parentId}:${index}`,
                  kind: "worker-proposal",
                  label: proposal.type,
                  text: proposal.summary || proposal.type,
                })),
              ].slice(-40),
            },
            updatedAt: new Date(context.now).toISOString(),
          });
        });
      const remaining = workers.filter((worker) => !selected.includes(worker));
      const orbWorkers = { ...(state.orbWorkers || {}) };
      if (remaining.length) orbWorkers[parentId] = remaining;
      else delete orbWorkers[parentId];
      return {
        state: { ...state, semanticOrbs, orbWorkers, activeSemanticOrbId: parentId },
        result: {
          type: "orb-workers-merged",
          id: parentId,
          object: fusion,
          effects: ["orb-workers-merged"],
          powerFx: { kind: "fuse", count: selected.length, pearlId: parentId },
        },
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
  requestOutputPlacement: {
    schema: { resultId: "string", branches: "array?" },
    preconditions: ["generation completed into a persisted staged Result Pearl"],
    risk: "low", confirmation: "none", undo: "cancel-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.replace",
    observableEffects: ["output-destination-requested"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        routing: createOutputRoutingRequest(object, { branches: args.branches }),
        destination: { ...object.destination, confirmed: false },
      }));
      return { state: next.state, result: result("output-routing-request", next.object.routing, ["output-destination-requested"]) };
    },
  },
  interpretOutputPlacement: {
    schema: { resultId: "string", answer: "string", observation: "object?", branchIds: "array?" },
    preconditions: ["a routing request is pending", "live observation is bounded and local"],
    risk: "low", confirmation: "none", undo: "revise-placement-plan",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.plan.replace",
    observableEffects: ["output-placement-interpreted"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => {
        if (!object.routing) throw new Error("output destination has not been requested");
        const interpreted = interpretPlacementAnswer(args.answer, object.routing, args.observation || {}, { branchIds: args.branchIds });
        return updateResultPearl(object, { routing: interpreted.request });
      });
      return { state: next.state, result: result("placement-plan", next.object.routing, ["output-placement-interpreted"]) };
    },
  },
  confirmOutputPlacement: {
    schema: { resultId: "string", targetRevision: "number?" },
    preconditions: ["PlacementPlan is explicit and shown to the user"],
    risk: "medium", confirmation: "preview", undo: "undo-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.confirm",
    observableEffects: ["output-placement-confirmed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        routing: confirmPlacementRequest(object.routing, args.targetRevision),
      }));
      return { state: next.state, result: result("placement-plan", next.object.routing, ["output-placement-confirmed"]) };
    },
  },
  beginOutputPlacement: {
    schema: { resultId: "string" },
    preconditions: ["PlacementPlan is confirmed and idempotency key has not executed"],
    risk: "medium", confirmation: "none", undo: "undo-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.execute",
    observableEffects: ["output-placement-started"],
    execute(state, args) {
      let duplicate = false;
      const next = updateResult(state, args.resultId, (object) => {
        const begun = beginPlacementExecution(object.routing);
        duplicate = begun.duplicate;
        return updateResultPearl(object, { routing: begun.request });
      });
      return { state: next.state, result: result("placement-execution", { routing: next.object.routing, duplicate }, duplicate ? [] : ["output-placement-started"]) };
    },
  },
  completeOutputPlacement: {
    schema: { resultId: "string", effect: "object?" },
    preconditions: ["surface adapter completed the exact confirmed PlacementPlan"],
    risk: "low", confirmation: "none", undo: "undo-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.complete",
    observableEffects: ["output-placement-completed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        routing: completePlacementExecution(object.routing, args.effect),
        destination: { ...object.routing.plan.destination, confirmed: true },
      }));
      return { state: next.state, result: result("placement-execution", next.object.routing, ["output-placement-completed"]) };
    },
  },
  failOutputPlacement: {
    schema: { resultId: "string", error: "object?" },
    preconditions: ["surface adapter failed without mutating or retained an exact undo checkpoint"],
    risk: "low", confirmation: "none", undo: "retry-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.fail",
    observableEffects: ["output-placement-failed"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        routing: failPlacementExecution(object.routing, args.error),
      }));
      return { state: next.state, result: result("placement-execution", next.object.routing, ["output-placement-failed"]) };
    },
  },
  cancelOutputPlacement: {
    schema: { resultId: "string" },
    preconditions: ["staged Result Pearl remains persisted"],
    risk: "low", confirmation: "none", undo: "request-output-placement",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.routing.cancel",
    observableEffects: ["output-placement-cancelled"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, {
        routing: cancelPlacementRequest(object.routing),
        destination: { ...object.destination, confirmed: false },
      }));
      return { state: next.state, result: result("output-routing-request", next.object.routing, ["output-placement-cancelled"]) };
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
    risk: "low", confirmation: "none", undo: "close-inspection-tab",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "resultPearls.openedAt.update",
    observableEffects: ["result-pearl-tab-requested"],
    execute(state, args) {
      const next = updateResult(state, args.resultId, (object) => updateResultPearl(object, { openedAt: Date.now(), status: object.status === "ready" ? "opened" : object.status }));
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
      const next = updateResult(state, args.resultId, (object) => {
        assertConfirmedResultPlacement(object, [args.destination?.type]);
        return redirectResultPearl(object, args.destination);
      });
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
      assertConfirmedResultPlacement(current, ["chat"]);
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
      assertConfirmedResultPlacement(current, ["new-textbox", "companion-region", "user-region"]);
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
      assertConfirmedResultPlacement(state.resultPearls?.[args.resultId], ["existing-textbox"]);
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
  ensurePearlPrivacyPolicy: {
    schema: { pearlId: "string", policy: "object?" },
    preconditions: ["Pearl identity exists in the current profile namespace"],
    risk: "low", confirmation: "none", undo: "restore-privacy-policy",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPolicies.upsert",
    observableEffects: ["pearl-privacy-policy-ready"],
    execute(state, args) {
      const existing = state.pearlPrivacyPolicies?.[args.pearlId];
      const object = existing || createPearlPrivacyPolicy({ ...(args.policy || {}), pearlId: args.pearlId });
      return { state: { ...state, pearlPrivacyPolicies: { ...(state.pearlPrivacyPolicies || {}), [args.pearlId]: object } }, result: result("pearl-privacy-policy", object, ["pearl-privacy-policy-ready"]) };
    },
  },
  inspectPearlPrivacy: {
    schema: { pearlId: "string", actor: "object?" },
    preconditions: ["actor may inspect policy metadata"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "none",
    observableEffects: ["pearl-privacy-inspected"],
    execute(state, args) {
      const policy = state.pearlPrivacyPolicies?.[args.pearlId]
        || state.pearlEntities?.[args.pearlId]?.privacy?.policy
        || state.automationPearls?.[args.pearlId]?.privacyPolicy;
      if (!policy) throw new Error("Pearl PrivacyPolicy not found");
      const observation = pearlPrivacyObservation(policy, args.actor || {});
      return { state, result: result("pearl-privacy-observation", observation, ["pearl-privacy-inspected"]) };
    },
  },
  proposePearlPrivacyPatch: {
    schema: { pearlId: "string", patch: "object", expectedVersion: "number" },
    preconditions: ["policy patch is explicit and does not silently relax inherited constraints"],
    risk: "medium", confirmation: "preview", undo: "discard-privacy-patch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPatches.upsert",
    observableEffects: ["pearl-privacy-patch-proposed"],
    execute(state, args, context) {
      const entity = state.pearlEntities?.[args.pearlId];
      const policy = state.pearlPrivacyPolicies?.[args.pearlId] || entity?.privacy?.policy;
      if (!policy) throw new Error("Pearl PrivacyPolicy not found");
      if (policy.encryption.status !== "unlocked") throw new Error("unlock the encrypted profile before changing this PrivacyPolicy");
      if (args.patch?.encryption?.status && args.patch.encryption.status !== policy.encryption.status) {
        throw new Error("encryption lock state can only change at the verified vault boundary");
      }
      const proposal = proposePearlPrivacyPatch(policy, args.patch, { expectedVersion: args.expectedVersion });
      const pearlEntities = entity ? {
        ...state.pearlEntities,
        [args.pearlId]: createPearlEntity({
          ...entity,
          revision: entity.revision + 1,
          runtime: { ...entity.runtime, pendingApproval: { type: "privacy-patch", proposal } },
        }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, pearlPrivacyPatches: { ...(state.pearlPrivacyPatches || {}), [proposal.id]: proposal } }, result: result("pearl-privacy-patch", proposal, ["pearl-privacy-patch-proposed"]) };
    },
  },
  applyPearlPrivacyPatch: {
    schema: { pearlId: "string", proposalId: "string", confirmed: "boolean" },
    preconditions: ["exact policy diff is visible", "organization relaxations require verified admin"],
    risk: "high", confirmation: "preview", undo: "undo-pearl-privacy-patch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPolicies.update,pearlPrivacyCheckpoints.append",
    observableEffects: ["pearl-privacy-policy-updated"],
    execute(state, args, context) {
      const entity = state.pearlEntities?.[args.pearlId];
      const policy = state.pearlPrivacyPolicies?.[args.pearlId] || entity?.privacy?.policy;
      const proposal = state.pearlPrivacyPatches?.[args.proposalId]
        || (entity?.runtime?.pendingApproval?.proposal?.id === args.proposalId ? entity.runtime.pendingApproval.proposal : null);
      if (!policy || !proposal) throw new Error("Pearl PrivacyPolicy patch not found");
      if (policy.encryption.status !== "unlocked") throw new Error("unlock the encrypted profile before applying this PrivacyPolicy");
      const applied = applyPearlPrivacyPatch(policy, proposal, { confirmed: args.confirmed === true, adminVerified: context.serverAdminVerified === true });
      return {
        state: {
          ...state,
          pearlPrivacyPolicies: { ...(state.pearlPrivacyPolicies || {}), [args.pearlId]: applied.policy },
          pearlPrivacyPatches: { ...(state.pearlPrivacyPatches || {}), [proposal.id]: applied.proposal },
          pearlPrivacyCheckpoints: { ...(state.pearlPrivacyCheckpoints || {}), [args.pearlId]: [...(state.pearlPrivacyCheckpoints?.[args.pearlId] || []), applied.checkpoint].slice(-100) },
          pearlEntities: entity ? {
            ...state.pearlEntities,
            [args.pearlId]: createPearlEntity({
              ...entity,
              privacyPolicy: applied.policy,
              revision: entity.revision + 1,
              runtime: { ...entity.runtime, pendingApproval: null },
            }),
          } : state.pearlEntities,
        },
        result: result("pearl-privacy-policy", applied.policy, ["pearl-privacy-policy-updated"]),
      };
    },
  },
  lockPearlPrivacy: {
    schema: { pearlId: "string", locked: "boolean" },
    preconditions: ["secure vault completed the corresponding key lock or unlock"],
    risk: "medium", confirmation: "none", undo: "restore-key-state",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPolicies.encryption.status",
    observableEffects: ["pearl-privacy-lock-changed"],
    execute(state, args, context) {
      const entity = state.pearlEntities?.[args.pearlId];
      const policy = state.pearlPrivacyPolicies?.[args.pearlId] || entity?.privacy?.policy;
      if (!policy) throw new Error("Pearl PrivacyPolicy not found");
      if (args.locked === false && context.vaultUnlockVerified !== true) throw new Error("verified vault unlock is required");
      const object = createPearlPrivacyPolicy({ ...policy, version: policy.version + 1, encryption: { ...policy.encryption, status: args.locked === false ? "unlocked" : "locked" } });
      const pearlEntities = entity ? {
        ...state.pearlEntities,
        [args.pearlId]: createPearlEntity({ ...entity, revision: entity.revision + 1, privacyPolicy: object }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, pearlPrivacyPolicies: { ...(state.pearlPrivacyPolicies || {}), [args.pearlId]: object } }, result: result("pearl-privacy-policy", object, ["pearl-privacy-lock-changed"]) };
    },
  },
  rotatePearlOrganizationKey: {
    schema: { pearlId: "string", organizationEnvelopeId: "string", organizationKeyVersion: "number" },
    preconditions: ["verified organization admin", "new envelope is integrity-checked before old grant revocation"],
    risk: "high", confirmation: "preview", undo: "restore-previous-envelope-until-revocation",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPolicies.encryption.rotate",
    observableEffects: ["pearl-organization-key-rotated"],
    execute(state, args, context) {
      if (context.serverAdminVerified !== true) throw new Error("verified organization admin is required");
      const policy = state.pearlPrivacyPolicies?.[args.pearlId];
      if (!policy?.acl.organizationId) throw new Error("organization PrivacyPolicy not found");
      const object = createPearlPrivacyPolicy({
        ...policy,
        version: policy.version + 1,
        encryption: { ...policy.encryption, organizationEnvelopeId: args.organizationEnvelopeId, organizationKeyVersion: args.organizationKeyVersion, rotationState: "current" },
      });
      return { state: { ...state, pearlPrivacyPolicies: { ...state.pearlPrivacyPolicies, [args.pearlId]: object } }, result: result("pearl-privacy-policy", object, ["pearl-organization-key-rotated"]) };
    },
  },
  inheritDerivedPearlPrivacy: {
    schema: { derived: "object", sourcePolicies: "array", organizationPolicy: "object?" },
    preconditions: ["derived policy uses the most restrictive source, context, Lens, and organization constraints"],
    risk: "low", confirmation: "none", undo: "delete-derived-pearl",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "pearlPrivacyPolicies.upsert",
    observableEffects: ["derived-pearl-privacy-inherited"],
    execute(state, args) {
      const derived = inheritPrivacyForDerivedPearl(args.derived, args.sourcePolicies, args.organizationPolicy);
      return { state: { ...state, pearlPrivacyPolicies: { ...(state.pearlPrivacyPolicies || {}), [derived.id]: derived.privacyPolicy } }, result: result("pearl-privacy-policy", derived.privacyPolicy, ["derived-pearl-privacy-inherited"]) };
    },
  },
  compileAutomationPearl: {
    schema: { evidence: "array|string", inference: "object?", id: "string?" },
    preconditions: ["prompt evidence is bounded and treated as untrusted", "verbatim evidence is preserved"],
    risk: "low", confirmation: "review", undo: "delete-automation-pearl-draft",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "automationPearls.upsert",
    observableEffects: ["automation-pearl-compiled", "automation-semantic-diff-required"],
    execute(state, args) {
      const object = compileAutomationPearl(args.evidence, args.inference, { id: args.id });
      return {
        state: { ...state, automationPearls: { ...(state.automationPearls || {}), [object.id]: object } },
        result: result("automation-pearl", object, ["automation-pearl-compiled", "automation-semantic-diff-required"]),
      };
    },
  },
  reviseAutomationPearl: {
    schema: { pearlId: "string", patch: "object", expectedVersion: "number" },
    preconditions: ["semantic diff was reviewed", "evidence lineage remains immutable"],
    risk: "low", confirmation: "none", undo: "restore-automation-pearl-checkpoint",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "automationPearls.update",
    observableEffects: ["automation-pearl-revised"],
    execute(state, args) {
      const current = state.automationPearls?.[args.pearlId] || automationPearlFromEntity(state.pearlEntities?.[args.pearlId]);
      if (!current) throw new Error("automation Pearl not found");
      const object = reviseAutomationPearl(current, args.patch, { expectedVersion: args.expectedVersion });
      return { state: { ...state, automationPearls: { ...(state.automationPearls || {}), [object.id]: object }, pearlEntities: { ...(state.pearlEntities || {}), [object.id]: createPearlEntity(object) } }, result: result("automation-pearl", object, ["automation-pearl-revised"]) };
    },
  },
  planAutomationResearch: {
    schema: { pearlId: "string", plan: "object" },
    preconditions: ["public query context is separated", "private disclosure is explicitly approved when present"],
    risk: "medium", confirmation: "disclosure", undo: "cancel-research-plan",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "automationResearchPlans.upsert",
    observableEffects: ["automation-research-planned"],
    execute(state, args) {
      if (!state.automationPearls?.[args.pearlId] && !automationPearlFromEntity(state.pearlEntities?.[args.pearlId])) throw new Error("automation Pearl not found");
      const object = createAutomationResearchPlan({ ...args.plan, pearlId: args.pearlId });
      return { state: { ...state, automationResearchPlans: { ...(state.automationResearchPlans || {}), [object.id]: object } }, result: result("automation-research-plan", object, ["automation-research-planned"]) };
    },
  },
  proposeAutomationContextPatch: {
    schema: { pearlId: "string", research: "object", claims: "array" },
    preconditions: ["research result contains verified citable sources", "proposal is read-only"],
    risk: "low", confirmation: "review", undo: "discard-context-patch",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "automationContextPatches.upsert",
    observableEffects: ["automation-context-patch-proposed"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      const pearl = state.automationPearls?.[args.pearlId] || automationPearlFromEntity(entity);
      if (!pearl) throw new Error("automation Pearl not found");
      const patch = proposeAutomationContextPatch(pearl, args.research, args.claims);
      const pearlEntities = entity ? {
        ...state.pearlEntities,
        [args.pearlId]: createPearlEntity({ ...entity, revision: entity.revision + 1, runtime: { ...entity.runtime, pendingApproval: { type: "automation-context-patch", proposal: patch } } }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, automationContextPatches: { ...(state.automationContextPatches || {}), [patch.id]: patch } }, result: result("automation-context-patch", patch, ["automation-context-patch-proposed"]) };
    },
  },
  approveAutomationContextPatch: {
    schema: { pearlId: "string", patchId: "string", approved: "boolean" },
    preconditions: ["exact context diff and source evidence are visible"],
    risk: "medium", confirmation: "preview", undo: "undo-automation-context-patch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "automationPearls.context.update,automationContextPatches.status.update",
    observableEffects: ["automation-context-patch-applied"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      const pearl = state.automationPearls?.[args.pearlId] || automationPearlFromEntity(entity);
      const patch = state.automationContextPatches?.[args.patchId]
        || (entity?.runtime?.pendingApproval?.proposal?.id === args.patchId ? entity.runtime.pendingApproval.proposal : null);
      if (!pearl || !patch) throw new Error("automation context patch not found");
      const applied = approveAutomationContextPatch(pearl, patch, { approved: args.approved === true });
      return {
        state: {
          ...state,
          automationPearls: { ...(state.automationPearls || {}), [pearl.id]: applied.pearl },
          automationContextPatches: { ...(state.automationContextPatches || {}), [patch.id]: applied.patch },
          pearlEntities: {
            ...(state.pearlEntities || {}),
            [pearl.id]: createPearlEntity({ ...applied.pearl, revision: (entity?.revision || 0) + 1, runtime: { ...(entity?.runtime || {}), pendingApproval: null } }),
          },
        },
        result: result("automation-pearl", applied.pearl, ["automation-context-patch-applied"]),
      };
    },
  },
  undoAutomationContextPatch: {
    schema: { pearlId: "string", patchId: "string" },
    preconditions: ["context patch checkpoint exists"],
    risk: "low", confirmation: "none", undo: "reapply-context-patch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "automationPearls.context.restore",
    observableEffects: ["automation-context-patch-undone"],
    execute(state, args) {
      const pearl = state.automationPearls?.[args.pearlId] || automationPearlFromEntity(state.pearlEntities?.[args.pearlId]);
      if (!pearl) throw new Error("automation Pearl not found");
      const object = undoAutomationContextPatch(pearl, args.patchId);
      return { state: { ...state, automationPearls: { ...(state.automationPearls || {}), [pearl.id]: object }, pearlEntities: { ...(state.pearlEntities || {}), [pearl.id]: createPearlEntity(object) } }, result: result("automation-pearl", object, ["automation-context-patch-undone"]) };
    },
  },
  preparePearlShare: {
    schema: { pearl: "object", selection: "object?" },
    preconditions: ["share scope is exact", "sensitive-data classification runs locally"],
    risk: "medium", confirmation: "preview", undo: "discard-share-review",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlShareReviews.upsert",
    observableEffects: ["pearl-share-review-prepared"],
    execute(state, args) {
      const review = createPearlShareReview(args.pearl, args.selection);
      const entity = state.pearlEntities?.[review.pearlId];
      const pearlEntities = entity ? {
        ...state.pearlEntities,
        [review.pearlId]: createPearlEntity({ ...entity, revision: entity.revision + 1, sharing: { ...entity.sharing, pendingReview: review } }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, pearlShareReviews: { ...(state.pearlShareReviews || {}), [review.pearlId]: review } }, result: result("pearl-share-review", review, ["pearl-share-review-prepared"]) };
    },
  },
  createPearlShareGrant: {
    schema: { package: "object", options: "object" },
    preconditions: ["package signature, scope, and privacy review are valid", "opaque link identifier is server-generated"],
    risk: "medium", confirmation: "preview", undo: "revoke-pearl-share",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "pearlShareGrants.upsert",
    observableEffects: ["pearl-share-grant-created"],
    execute(state, args) {
      const grant = createPearlShareGrant(args.package, args.options);
      const pearlId = args.package?.manifest?.contracts?.pearlId;
      const entity = state.pearlEntities?.[pearlId];
      const pearlEntities = entity ? {
        ...state.pearlEntities,
        [pearlId]: createPearlEntity({ ...entity, revision: entity.revision + 1, sharing: { ...entity.sharing, grants: [...entity.sharing.grants, grant], pendingReview: null } }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, pearlShareGrants: { ...(state.pearlShareGrants || {}), [grant.id]: grant } }, result: result("pearl-share-grant", grant, ["pearl-share-grant-created"]) };
    },
  },
  consumePearlShareGrant: {
    schema: { grantId: "string", claims: "object", now: "number?" },
    preconditions: ["server authorization, rate limit, expiry, and recipient binding passed atomically"],
    risk: "medium", confirmation: "none", undo: "decline-received-pearl",
    surfaces: ["web", "server", "extension"],
    persistenceEffect: "pearlShareGrants.consume,receivedPearls.stage",
    observableEffects: ["pearl-share-received"],
    execute(state, args) {
      const grant = state.pearlShareGrants?.[args.grantId];
      const consumed = consumePearlShareGrant(grant, args.claims, args.now);
      return {
        state: {
          ...state,
          pearlShareGrants: { ...state.pearlShareGrants, [grant.id]: consumed.grant },
          pearlShareReceipts: [...(state.pearlShareReceipts || []), consumed.receipt],
        },
        result: result("pearl-share-receipt", consumed.receipt, ["pearl-share-received"]),
      };
    },
  },
  revokePearlShareGrant: {
    schema: { grantId: "string", actorId: "string" },
    preconditions: ["actor owns the share grant"],
    risk: "medium", confirmation: "preview", undo: "create-new-share-grant",
    surfaces: ["web", "server", "companion", "extension"],
    persistenceEffect: "pearlShareGrants.revoke",
    observableEffects: ["pearl-share-revoked"],
    execute(state, args) {
      const ownerEntity = Object.values(state.pearlEntities || {}).find((entry) => entry.sharing?.grants?.some((grant) => grant.id === args.grantId));
      const grant = state.pearlShareGrants?.[args.grantId] || ownerEntity?.sharing?.grants?.find((entry) => entry.id === args.grantId);
      const object = revokePearlShareGrant(grant, args.actorId);
      const pearlEntities = ownerEntity ? {
        ...state.pearlEntities,
        [ownerEntity.id]: createPearlEntity({ ...ownerEntity, revision: ownerEntity.revision + 1, sharing: { ...ownerEntity.sharing, grants: ownerEntity.sharing.grants.map((entry) => entry.id === object.id ? object : entry) } }),
      } : state.pearlEntities;
      return { state: { ...state, pearlEntities, pearlShareGrants: { ...(state.pearlShareGrants || {}), [grant.id]: object } }, result: result("pearl-share-grant", object, ["pearl-share-revoked"]) };
    },
  },
  installValidatedPearlPackage: {
    schema: { package: "object", validationReceipt: "object", localPearlId: "string", confirmed: "boolean" },
    preconditions: ["signature, schema, dependencies, tests, and declarative-data checks passed", "recipient explicitly accepted"],
    risk: "medium", confirmation: "preview", undo: "uninstall-pearl-package",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "installedPearlPackages.upsert",
    observableEffects: ["pearl-package-installed"],
    async execute(state, args) {
      if (args.confirmed !== true) throw new Error("validated Pearl package acceptance is required");
      const receipt = args.validationReceipt || {};
      if (!receipt.signerPublicKeyJwk || receipt.keyId !== args.package?.manifest?.signature?.keyId) {
        throw new Error("trusted Pearl package signer receipt is required");
      }
      const publicKey = await globalThis.crypto.subtle.importKey(
        "jwk",
        receipt.signerPublicKeyJwk,
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      const validation = await validatePearlPackage(args.package, { publicKey });
      if (receipt.contentHash && receipt.contentHash !== validation.contentHash) {
        throw new Error("Pearl package validation receipt does not match package content");
      }
      const validatedReceipt = {
        valid: true,
        contentHash: validation.contentHash,
        keyId: args.package.manifest.signature.keyId,
        artifacts: validation.artifacts,
        verifiedAt: Date.now(),
      };
      const key = `${args.package.manifest.namespace}/${args.package.manifest.name}`;
      const existing = state.installedPearlPackages?.[key];
      if (existing?.package?.manifest?.contentHash === args.package.manifest.contentHash) return { state, result: result("pearl-package-install", existing, []) };
      const object = {
        package: clone(args.package),
        validationReceipt: validatedReceipt,
        localPearlId: args.localPearlId,
        previousVersion: existing?.package?.manifest?.version || null,
        installedAt: Date.now(),
      };
      const component = (name) => args.package.artifacts?.find((entry) => entry.component === name)?.snapshot;
      const installedEntity = createPearlEntity({
        id: args.localPearlId,
        kind: "shared",
        identity: component("identity"),
        cognition: component("cognition"),
        privacyPolicy: component("privacyPolicy"),
        sharing: { package: args.package, installation: object, receipts: [validatedReceipt] },
        provenance: args.package.manifest.provenance,
      });
      return {
        state: {
          ...state,
          pearlEntities: { ...(state.pearlEntities || {}), [installedEntity.id]: installedEntity },
          installedPearlPackages: { ...(state.installedPearlPackages || {}), [key]: object },
        },
        result: result("pearl-package-install", { ...object, entity: installedEntity }, ["pearl-package-installed"]),
      };
    },
  },
  addPearlCognitiveLayer: {
    schema: { pearlId: "string", layer: "object", confirmed: "boolean?" },
    preconditions: ["source evidence and uncertainty are explicit", "semantic additions are reviewed"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.layers.append",
    observableEffects: ["pearl-cognitive-layer-added"],
    execute(state, args) {
      if (args.confirmed !== true) throw new Error("cognitive layer addition confirmation is required");
      let added;
      const next = updatePearlCognition(state, args.pearlId, (cognition, entity) => {
        added = createCognitiveLayer(args.layer, { privacyPolicy: entity.privacy.effectivePolicy });
        if (cognition.layers.some((entry) => entry.id === added.id)) throw new Error("cognitive layer id already exists");
        return { ...cognition, layers: [...cognition.layers, added], semanticOrder: [...cognition.semanticOrder, added.id] };
      });
      return { state: next.state, result: result("cognitive-layer", added, ["pearl-cognitive-layer-added"]) };
    },
  },
  mutatePearlCognitiveLayer: {
    schema: { pearlId: "string", layerId: "string", operation: "string", value: "object?", to: "number?", confirmed: "boolean?" },
    preconditions: ["layout and semantic order remain separate", "semantic mutations are explicit"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.mutate",
    observableEffects: ["pearl-cognitive-layer-mutated"],
    execute(state, args, context) {
      const semantic = args.operation !== "layout";
      if (semantic && args.confirmed !== true) throw new Error("semantic cognitive mutation confirmation is required");
      let affected = [];
      const next = updatePearlCognition(state, args.pearlId, (cognition) => {
        const layer = cognition.layers.find((entry) => entry.id === args.layerId);
        if (!layer) throw new Error("cognitive layer not found");
        let layers = [...cognition.layers];
        let semanticOrder = [...cognition.semanticOrder];
        if (args.operation === "layout") {
          layers = layers.map((entry) => entry.id === layer.id ? createCognitiveLayer({ ...entry, layout: { ...entry.layout, ...clone(args.value || {}) }, revision: entry.revision + 1 }) : entry);
          affected = [layer.id];
        } else if (args.operation === "reorder") {
          semanticOrder = semanticOrder.filter((id) => id !== layer.id);
          semanticOrder.splice(Math.max(0, Math.min(semanticOrder.length, Number(args.to) || 0)), 0, layer.id);
          layers = layers.map((entry) => createCognitiveLayer({ ...entry, semantic: { ...entry.semantic, order: semanticOrder.indexOf(entry.id) }, revision: entry.id === layer.id ? entry.revision + 1 : entry.revision }));
          affected = [layer.id];
        } else if (args.operation === "nest") {
          layers = layers.map((entry) => entry.id === layer.id ? createCognitiveLayer({ ...entry, semantic: { ...entry.semantic, parentId: args.value?.parentId || null }, revision: entry.revision + 1 }) : entry);
          affected = [layer.id];
        } else if (args.operation === "link") {
          layers = layers.map((entry) => entry.id === layer.id ? createCognitiveLayer({ ...entry, semantic: { ...entry.semantic, links: [...entry.semantic.links, clone(args.value)] }, revision: entry.revision + 1 }) : entry);
          affected = [layer.id];
        } else if (["duplicate", "fork"].includes(args.operation)) {
          const copy = createCognitiveLayer({
            ...layer,
            id: args.value?.id || context.idFactory(),
            stableId: args.operation === "fork" ? layer.stableId : undefined,
            revision: 0,
            identity: { ...layer.identity, name: args.value?.name || `${layer.identity.name} ${args.operation === "fork" ? "fork" : "copy"}` },
            provenance: { source: args.operation, sourceLayerId: layer.id, sourceRevision: layer.revision },
          });
          layers.push(copy);
          semanticOrder.splice(semanticOrder.indexOf(layer.id) + 1, 0, copy.id);
          affected = [layer.id, copy.id];
        } else if (args.operation === "split") {
          if (layer.kind !== "function" || !(layer.definition.graph?.nodes || []).length) throw new Error("only a composed Function layer can be split");
          const splits = layer.definition.graph.nodes.map((node, index) => createCognitiveLayer({
            id: context.idFactory(),
            kind: "function",
            name: `${layer.identity.name} · ${index + 1}`,
            graph: { nodes: [clone(node)], edges: [] },
            evidenceRefs: layer.uncertainty.evidenceRefs,
            confidence: layer.uncertainty.confidence,
            rationale: "Explicit split from a composed Function.",
            authorship: "user-authored",
            status: layer.uncertainty.status,
            provenance: { source: "split", sourceLayerId: layer.id, sourceRevision: layer.revision },
            privacyPolicy: layer.privacyPolicy,
          }));
          layers = [...layers.filter((entry) => entry.id !== layer.id), ...splits];
          const at = semanticOrder.indexOf(layer.id);
          semanticOrder.splice(at, 1, ...splits.map((entry) => entry.id));
          affected = [layer.id, ...splits.map((entry) => entry.id)];
        } else if (args.operation === "remove") {
          layers = layers.filter((entry) => entry.id !== layer.id).map((entry) => entry.semantic.parentId === layer.id ? createCognitiveLayer({ ...entry, semantic: { ...entry.semantic, parentId: null } }) : entry);
          semanticOrder = semanticOrder.filter((id) => id !== layer.id);
          affected = [layer.id];
        } else {
          throw new Error("unsupported cognitive layer mutation");
        }
        return { ...cognition, layers, semanticOrder };
      });
      return { state: next.state, result: result("cognitive-layer-mutation", { pearlId: args.pearlId, operation: args.operation, affected }, ["pearl-cognitive-layer-mutated"]) };
    },
  },
  composePearlCognitiveLayers: {
    schema: { pearlId: "string", leftId: "string", rightId: "string", options: "object?", confirmed: "boolean?" },
    preconditions: ["operands are canonical typed layers", "bridge Moves remain visible"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.compose",
    observableEffects: ["pearl-cognitive-layers-composed", "pearl-bridge-moves-visible"],
    execute(state, args) {
      let composition;
      const current = createPearlEntity(state.pearlEntities?.[args.pearlId]);
      const left = current.cognition.layers.find((entry) => entry.id === args.leftId);
      const right = current.cognition.layers.find((entry) => entry.id === args.rightId);
      if (!left || !right) throw new Error("choose two cognitive layers to compose");
      composition = composeCognitiveLayers(left, right, { ...(args.options || {}), privacyPolicy: current.privacy.effectivePolicy });
      if (composition.preview.requiresConfirmation && args.confirmed !== true) {
        return { state, result: result("cognitive-composition-preview", composition.preview, ["pearl-cognitive-composition-proposed"]) };
      }
      const next = updatePearlCognition(state, args.pearlId, (cognition) => ({
        ...cognition,
        layers: [...cognition.layers, ...composition.bridges, composition.object],
        semanticOrder: [...cognition.semanticOrder, ...composition.bridges.map((entry) => entry.id), composition.object.id],
      }));
      return { state: next.state, result: result("cognitive-composition", composition, ["pearl-cognitive-layers-composed", ...(composition.bridges.length ? ["pearl-bridge-moves-visible"] : [])]) };
    },
  },
  proposePearlCognitivePatch: {
    schema: { pearlId: "string", layerId: "string", patch: "object", rationale: "string?" },
    preconditions: ["AI edits are reviewable diffs with evidence"],
    risk: "low", confirmation: "none", undo: "discard-cognitive-patch",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlCognitivePatches.upsert",
    observableEffects: ["pearl-cognitive-patch-proposed"],
    execute(state, args) {
      const entity = createPearlEntity(state.pearlEntities?.[args.pearlId]);
      const proposal = proposeCognitiveLayerPatch(entity.cognition, args.layerId, args.patch, { rationale: args.rationale });
      return {
        state: { ...state, pearlCognitivePatches: { ...(state.pearlCognitivePatches || {}), [proposal.id]: proposal } },
        result: result("cognitive-patch", proposal, ["pearl-cognitive-patch-proposed"]),
      };
    },
  },
  applyPearlCognitivePatch: {
    schema: { pearlId: "string", proposalId: "string", confirmed: "boolean" },
    preconditions: ["proposal revision still matches", "semantic changes are confirmed"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.patch",
    observableEffects: ["pearl-cognitive-patch-applied"],
    execute(state, args) {
      const proposal = state.pearlCognitivePatches?.[args.proposalId];
      if (!proposal) throw new Error("cognitive patch proposal not found");
      const next = updatePearlCognition(state, args.pearlId, (cognition) => applyCognitiveLayerPatch(cognition, proposal, args.confirmed));
      return { state: next.state, result: result("cognitive-patch", proposal, ["pearl-cognitive-patch-applied"]) };
    },
  },
  resolvePearlCognitiveUncertainty: {
    schema: { pearlId: "string", layerId: "string", resolution: "object", confirmed: "boolean" },
    preconditions: ["resolution preserves source evidence", "user confirms executable/shareable status"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.uncertainty",
    observableEffects: ["pearl-cognitive-uncertainty-resolved"],
    execute(state, args) {
      if (args.confirmed !== true) throw new Error("uncertainty resolution confirmation is required");
      const next = updatePearlCognition(state, args.pearlId, (cognition) => resolveCognitiveUncertainty(cognition, args.layerId, args.resolution));
      return { state: next.state, result: result("cognitive-uncertainty", { pearlId: args.pearlId, layerId: args.layerId }, ["pearl-cognitive-uncertainty-resolved"]) };
    },
  },
  startPearlCognitivePlayback: {
    schema: { pearlId: "string", functionLayerId: "string", inputs: "object?", lensIds: "array?", roleId: "string?", branchId: "string?" },
    preconditions: ["Function uncertainty is resolved", "inputs and policy validate"],
    risk: "medium", confirmation: "review", undo: "cancel-cognitive-playback",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.activeExecution",
    observableEffects: ["pearl-cognitive-playback-started"],
    execute(state, args, context) {
      const next = updatePearlCognition(state, args.pearlId, (cognition, entity) => startCognitivePlayback(cognition, args.functionLayerId, {
        ...args,
        id: context.idFactory(),
        pearlRevision: entity.revision,
      }));
      return { state: next.state, result: result("cognitive-playback", next.object.cognition.activeExecution, ["pearl-cognitive-playback-started"]) };
    },
  },
  advancePearlCognitivePlayback: {
    schema: { pearlId: "string", effect: "object?" },
    preconditions: ["current Move effect receipt is observable"],
    risk: "low", confirmation: "none", undo: "restore-playback-checkpoint",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.activeExecution.cursor",
    observableEffects: ["pearl-cognitive-playback-advanced"],
    execute(state, args) {
      const next = updatePearlCognition(state, args.pearlId, (cognition) => advanceCognitivePlayback(cognition, args.effect));
      return { state: next.state, result: result("cognitive-playback", next.object.cognition.activeExecution, ["pearl-cognitive-playback-advanced"]) };
    },
  },
  cancelPearlCognitivePlayback: {
    schema: { pearlId: "string" },
    preconditions: ["active execution checkpoint is retained"],
    risk: "low", confirmation: "none", undo: "retry-from-playback-checkpoint",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.cognition.activeExecution.cancel",
    observableEffects: ["pearl-cognitive-playback-cancelled"],
    execute(state, args) {
      const next = updatePearlCognition(state, args.pearlId, (cognition) => cancelCognitivePlayback(cognition));
      return { state: next.state, result: result("cognitive-playback", next.object.cognition.activeExecution, ["pearl-cognitive-playback-cancelled"]) };
    },
  },
  openPearlStudio: {
    schema: { pearlId: "string", representation: "string?", scrollPosition: "number?", sourceSurface: "string?" },
    preconditions: ["Pearl exists in the canonical entity store", "profile is unlocked"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlStudioSessions.upsert",
    observableEffects: ["pearl-studio-opening"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("canonical Pearl not found");
      if (entity.permissions?.lockState === "locked") throw new Error("unlock this Pearl before opening Studio");
      const request = createPearlStudioOpenRequest(entity, args);
      const viewModel = createPearlStudioViewModel(entity, args);
      return {
        state: { ...state, pearlStudioSessions: { ...(state.pearlStudioSessions || {}), [request.id]: request } },
        result: result("pearl-studio-open", { request, viewModel }, ["pearl-studio-opening"]),
      };
    },
  },
  editPearlEntity: {
    schema: { pearlId: "string", patch: "object", expectedRevision: "number", idempotencyKey: "string" },
    preconditions: ["edit is canonical", "expected revision matches", "profile is unlocked"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.compareAndSwap",
    observableEffects: ["pearl-entity-edited"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("canonical Pearl not found");
      const changed = applyPearlEntityPatch(entity, args.patch, {
        expectedRevision: args.expectedRevision,
        idempotencyKey: args.idempotencyKey,
        reason: "studio-edit",
      });
      if (changed.conflict) return { state: { ...state, pearlConflicts: [...(state.pearlConflicts || []), changed.conflict] }, result: result("pearl-conflict", changed.conflict, ["pearl-edit-conflict"]) };
      return {
        state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: changed.entity } },
        result: result("pearl-entity", changed.entity, ["pearl-entity-edited"]),
      };
    },
  },
  reorderPearlFunctionMoves: {
    schema: {
      pearlId: "string",
      functionId: "string?",
      functionName: "string?",
      fromIndex: "number?",
      toIndex: "number?",
      from: "string?",
      to: "string?",
      move: "string?",
      moveName: "string?",
      expectedRevision: "number?",
      idempotencyKey: "string?",
    },
    preconditions: ["function has ordered moves", "indices resolve"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension", "studio", "gesture", "director"],
    persistenceEffect: "pearlEntities.v1.functions.moves.order",
    observableEffects: ["pearl-function-moves-reordered", "pearl-entity-edited"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("canonical Pearl not found");
      const mutated = mutatePearlFunctionMoves(entity, {
        operation: "reorder",
        functionId: args.functionId,
        functionName: args.functionName,
        fromIndex: args.fromIndex,
        toIndex: args.toIndex,
        from: args.from,
        to: args.to,
        move: args.move,
        moveName: args.moveName,
      });
      if (!mutated.ok) throw new Error(mutated.reason || "Could not reorder Function moves");
      const changed = applyPearlEntityPatch(entity, mutated.patch, {
        expectedRevision: args.expectedRevision ?? entity.revision,
        idempotencyKey: args.idempotencyKey || `reorder-fn-moves:${args.pearlId}:${Date.now()}`,
        reason: "reorder-function-moves",
      });
      if (changed.conflict) {
        return {
          state: { ...state, pearlConflicts: [...(state.pearlConflicts || []), changed.conflict] },
          result: result("pearl-conflict", changed.conflict, ["pearl-edit-conflict"]),
        };
      }
      return {
        state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: changed.entity } },
        result: result("pearl-function-moves", {
          id: mutated.functionId,
          pearlId: args.pearlId,
          functionId: mutated.functionId,
          functionName: mutated.functionName,
          moves: mutated.moves,
          entity: changed.entity,
        }, ["pearl-function-moves-reordered", "pearl-entity-edited"]),
      };
    },
  },
  decomposePearlFunctionMove: {
    schema: {
      pearlId: "string",
      functionId: "string?",
      functionName: "string?",
      moveIndex: "number?",
      move: "string?",
      moveName: "string?",
      from: "string?",
      expectedRevision: "number?",
      idempotencyKey: "string?",
    },
    preconditions: ["target move has decomposable description"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension", "studio", "director"],
    persistenceEffect: "pearlEntities.v1.functions.moves.decompose",
    observableEffects: ["pearl-function-move-decomposed", "pearl-entity-edited"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("canonical Pearl not found");
      const mutated = mutatePearlFunctionMoves(entity, {
        operation: "decompose",
        functionId: args.functionId,
        functionName: args.functionName,
        moveIndex: args.moveIndex,
        move: args.move,
        moveName: args.moveName,
        from: args.from,
      });
      if (!mutated.ok) throw new Error(mutated.reason || "Could not decompose that Move");
      const changed = applyPearlEntityPatch(entity, mutated.patch, {
        expectedRevision: args.expectedRevision ?? entity.revision,
        idempotencyKey: args.idempotencyKey || `decompose-fn-move:${args.pearlId}:${Date.now()}`,
        reason: "decompose-function-move",
      });
      if (changed.conflict) {
        return {
          state: { ...state, pearlConflicts: [...(state.pearlConflicts || []), changed.conflict] },
          result: result("pearl-conflict", changed.conflict, ["pearl-edit-conflict"]),
        };
      }
      return {
        state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: changed.entity } },
        result: result("pearl-function-moves", {
          id: mutated.functionId,
          pearlId: args.pearlId,
          functionId: mutated.functionId,
          functionName: mutated.functionName,
          moves: mutated.moves,
          decomposedFrom: mutated.decomposedFrom,
          entity: changed.entity,
        }, ["pearl-function-move-decomposed", "pearl-entity-edited"]),
      };
    },
  },
  setPearlAesthetic: {
    schema: {
      pearlId: "string?",
      preset: "string?",
      colors: "object?",
      material: "object?",
      light: "object?",
      surrounding: "string?",
      label: "string?",
      reset: "boolean?",
      companionOnly: "boolean?",
      expectedRevision: "number?",
      idempotencyKey: "string?",
    },
    preconditions: ["aesthetic patch is bounded"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.v1.aesthetic",
    observableEffects: ["pearl-aesthetic-changed"],
    execute(state, args, context) {
      const resolveAesthetic = (base) => {
        if (args.reset) return defaultPearlAesthetic();
        if (args.preset && !args.colors && !args.material && !args.light && !args.surrounding) {
          return applyPearlAestheticPreset(base, args.preset);
        }
        return patchPearlAesthetic(base || defaultPearlAesthetic(), {
          preset: args.preset,
          label: args.label,
          colors: args.colors,
          material: args.material,
          light: args.light,
          surrounding: args.surrounding,
        });
      };
      const pearlId = args.companionOnly ? null : (args.pearlId || state.activePearlId);
      if (!pearlId || !state.pearlEntities?.[pearlId]) {
        const aesthetic = normalizePearlAesthetic(resolveAesthetic(state.companionAesthetic));
        return {
          state: { ...state, companionAesthetic: aesthetic },
          result: {
            type: "companion-aesthetic",
            id: "companion",
            object: aesthetic,
            effects: ["pearl-aesthetic-changed", "companion-aesthetic-changed"],
          },
        };
      }
      const entity = createPearlEntity(state.pearlEntities[pearlId]);
      const nextAesthetic = normalizePearlAesthetic(resolveAesthetic(entity.aesthetic));
      const changed = applyPearlEntityPatch(entity, { aesthetic: nextAesthetic }, {
        expectedRevision: args.expectedRevision ?? entity.revision,
        idempotencyKey: args.idempotencyKey || `aesthetic:${pearlId}:${Date.now()}`,
        reason: "aesthetic-edit",
      });
      if (changed.conflict) {
        return {
          state: { ...state, pearlConflicts: [...(state.pearlConflicts || []), changed.conflict] },
          result: result("pearl-conflict", changed.conflict, ["pearl-edit-conflict"]),
        };
      }
      let nextState = {
        ...state,
        companionAesthetic: nextAesthetic,
        pearlEntities: { ...state.pearlEntities, [pearlId]: changed.entity },
      };
      if ((state.semanticOrbs || []).some((orb) => orb.id === pearlId)) {
        nextState = updateSemanticOrb(nextState, pearlId, (orb) => ({
          ...orb,
          aesthetic: nextAesthetic,
          updatedAt: new Date(context.now).toISOString(),
        }));
      }
      return {
        state: nextState,
        result: {
          type: "pearl-aesthetic",
          id: pearlId,
          object: { pearlId, aesthetic: changed.entity.aesthetic },
          effects: ["pearl-aesthetic-changed", "companion-aesthetic-changed"],
        },
      };
    },
  },
  setPearlStudioRepresentation: {
    schema: { pearlId: "string", representation: "string", expectedRevision: "number", idempotencyKey: "string" },
    preconditions: ["representation is relevant to this Pearl"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.representation.mode",
    observableEffects: ["pearl-studio-represented"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      const view = createPearlStudioViewModel(entity, { representation: args.representation });
      if (!view.representations.includes(args.representation)) throw new Error("representation is not relevant to this Pearl");
      const changed = applyPearlEntityPatch(entity, {
        representation: { ...entity.representation, mode: args.representation },
      }, { expectedRevision: args.expectedRevision, idempotencyKey: args.idempotencyKey, reason: "studio-representation" });
      if (changed.conflict) return { state: { ...state, pearlConflicts: [...(state.pearlConflicts || []), changed.conflict] }, result: result("pearl-conflict", changed.conflict, ["pearl-edit-conflict"]) };
      return { state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: changed.entity } }, result: result("pearl-entity", changed.entity, ["pearl-studio-represented"]) };
    },
  },
  undoPearlEntityEdit: {
    schema: { pearlId: "string" },
    preconditions: ["a canonical checkpoint exists"],
    risk: "low", confirmation: "none", undo: "redo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.restoreCheckpoint",
    observableEffects: ["pearl-entity-undo"],
    execute(state, args) {
      const entity = createPearlEntity(state.pearlEntities?.[args.pearlId]);
      const checkpoint = entity.history.checkpoints.at(-1);
      if (!checkpoint) throw new Error("no Pearl checkpoint is available");
      const restored = createPearlEntity({
        ...entity,
        ...checkpoint.snapshot,
        revision: entity.revision + 1,
        history: { ...entity.history, checkpoints: entity.history.checkpoints.slice(0, -1) },
        updatedAt: Date.now(),
      });
      return {
        state: {
          ...state,
          pearlEntities: { ...state.pearlEntities, [args.pearlId]: restored },
          pearlRedo: { ...(state.pearlRedo || {}), [args.pearlId]: entity },
        },
        result: result("pearl-entity", restored, ["pearl-entity-undo"]),
      };
    },
  },
  redoPearlEntityEdit: {
    schema: { pearlId: "string" },
    preconditions: ["an undo snapshot exists"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension"],
    persistenceEffect: "pearlEntities.restoreRedo",
    observableEffects: ["pearl-entity-redo"],
    execute(state, args) {
      const redo = state.pearlRedo?.[args.pearlId];
      const current = state.pearlEntities?.[args.pearlId];
      if (!redo || !current) throw new Error("no Pearl redo is available");
      const restored = createPearlEntity({ ...redo, revision: current.revision + 1, updatedAt: Date.now() });
      const pearlRedo = { ...(state.pearlRedo || {}) };
      delete pearlRedo[args.pearlId];
      return { state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: restored }, pearlRedo }, result: result("pearl-entity", restored, ["pearl-entity-redo"]) };
    },
  },
  browsePearlHistory: {
    schema: { pearlId: "string" },
    preconditions: ["Pearl exists"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension", "studio"],
    persistenceEffect: "none",
    observableEffects: ["pearl-history-observed"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("Pearl not found");
      const history = listPearlVersions(entity);
      return { state, result: result("pearl-history", history, ["pearl-history-observed"]) };
    },
  },
  snapshotPearlVersion: {
    schema: { pearlId: "string", label: "string", idempotencyKey: "string?" },
    preconditions: ["Pearl exists", "label is explicit"],
    risk: "low", confirmation: "none", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension", "studio"],
    persistenceEffect: "pearlEntities.history.checkpoints",
    observableEffects: ["pearl-version-named"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("Pearl not found");
      const snapped = snapshotPearlVersionState(entity, args.label, {
        source: "domain-command",
        idempotencyKey: args.idempotencyKey,
      });
      return {
        state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: snapped.entity } },
        result: result("pearl-version", snapped.version || snapped.checkpoint, ["pearl-version-named"]),
      };
    },
  },
  labelPearlVersion: {
    schema: { pearlId: "string", checkpointId: "string", label: "string" },
    preconditions: ["checkpoint exists", "label is explicit"],
    risk: "low", confirmation: "none", undo: "none",
    surfaces: ["web", "companion", "extension", "studio"],
    persistenceEffect: "pearlEntities.history.checkpoints",
    observableEffects: ["pearl-version-labeled"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("Pearl not found");
      const next = labelPearlVersionState(entity, args.checkpointId, args.label);
      return {
        state: { ...state, pearlEntities: { ...state.pearlEntities, [args.pearlId]: next } },
        result: result("pearl-version", { id: args.checkpointId, label: args.label }, ["pearl-version-labeled"]),
      };
    },
  },
  restorePearlVersion: {
    schema: { pearlId: "string", checkpointId: "string", confirmed: "boolean?" },
    preconditions: ["checkpoint exists"],
    risk: "medium", confirmation: "preview", undo: "undo-pearl-entity-edit",
    surfaces: ["web", "companion", "extension", "studio"],
    persistenceEffect: "pearlEntities.restoreVersion",
    observableEffects: ["pearl-version-restored"],
    execute(state, args) {
      const entity = state.pearlEntities?.[args.pearlId];
      if (!entity) throw new Error("Pearl not found");
      const restored = restorePearlVersionState(entity, args.checkpointId, { source: "domain-command" });
      return {
        state: {
          ...state,
          pearlEntities: { ...state.pearlEntities, [args.pearlId]: restored.entity },
          pearlRedo: { ...(state.pearlRedo || {}), [args.pearlId]: createPearlEntity(entity) },
        },
        result: {
          type: "pearl-entity",
          id: restored.entity.id,
          object: restored.entity,
          effects: ["pearl-version-restored"],
          restoredFrom: restored.restoredFrom,
        },
      };
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
    vaultUnlockVerified: options.vaultUnlockVerified === true,
    serverAdminVerified: options.serverAdminVerified === true,
  };
  assertDomainPrivacy(name, before, args || {}, options);
  const execution = await command.execute(before, clone(args || {}), context);
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

import { createPearlPrivacyPolicy, effectivePearlPrivacyPolicy } from "./pearl-privacy-policy.js";
import { createPearlCognition } from "./pearl-cognitive-layers.js";

export const PEARL_ENTITY_VERSION = 1;
export const PEARL_ENTITY_KINDS = Object.freeze(["primary", "semantic", "result", "automation", "page-canvas", "shared", "studio"]);
export const PEARL_RUNTIME_PHASES = Object.freeze(["idle", "listening", "observing", "planning", "executing", "streaming", "awaiting-destination", "awaiting-confirmation", "blocked", "failed", "locked"]);
export const PEARL_ENTITY_MAX_CHECKPOINTS = 100;
export const PEARL_ENTITY_MAX_EVENTS = 500;

const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 120_000) => String(value ?? "").slice(0, limit);
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function array(value, limit = 500) {
  return (Array.isArray(value) ? value : []).slice(0, limit).map(clone);
}

function inferKind(value) {
  if (PEARL_ENTITY_KINDS.includes(value.kind)) return value.kind;
  if (value.kind === "semantic-orb" || value.workingSet) return "semantic";
  if (value.kind === "automation-pearl" || value.functions && value.material?.evidence) return "automation";
  if (value.resultId || value.outputId || value.status === "streaming" || value.destination) return "result";
  if (value.artifacts && value.pageIdentity) return "page-canvas";
  return "primary";
}

function canonicalIdentity(value, pearlId) {
  const source = value.identity || {};
  return {
    id: pearlId,
    stableId: bounded(value.stableId || source.stableId || pearlId, 220),
    name: bounded(source.name || value.name || "Untitled Pearl", 180),
    description: bounded(source.description || value.description || "", 2_000),
    purpose: bounded(source.purpose || value.purpose || "", 1_000),
    ownerProfileId: bounded(source.ownerProfileId || value.ownerProfileId || "local-profile", 220),
  };
}

function canonicalWorkingSet(value) {
  const source = value.workingSet || {};
  return {
    context: array(source.context || value.context || value.sourceRefs, 500),
    selectedIds: array(source.selectedIds || value.selectedIds, 500),
    boundedObservation: clone(source.boundedObservation || value.boundedObservation || null),
    disclosureReceiptIds: array(source.disclosureReceiptIds || (value.disclosureReceipt?.id ? [value.disclosureReceipt.id] : []), 500),
    pageIdentity: bounded(source.pageIdentity || value.pageIdentity || "", 1_000) || null,
    tabId: Number.isInteger(source.tabId ?? value.tabId) ? (source.tabId ?? value.tabId) : null,
    frameId: Number.isInteger(source.frameId ?? value.frameId) ? (source.frameId ?? value.frameId) : null,
  };
}

function canonicalRepresentation(value, kind) {
  const source = value.representation || {};
  return {
    kind: source.kind || kind,
    mode: source.mode || (kind === "result" ? "document" : kind === "page-canvas" ? "spatial" : "pearl"),
    materialVariant: source.materialVariant || (kind === "result" ? "result" : "primary"),
    material: clone(value.material || source.material || null),
    placement: clone(value.placement || source.placement || null),
    expanded: Boolean(value.expanded ?? source.expanded),
    scrollPosition: Math.max(0, Number(source.scrollPosition || value.scrollPosition) || 0),
  };
}

export function createPearlEntity(value = {}) {
  const pearlId = bounded(value.id || value.pearlId || id("pearl"), 220);
  const kind = inferKind(value);
  const directPolicy = value.privacyPolicy || value.privacy?.policy || createPearlPrivacyPolicy({ pearlId });
  const inheritedPolicies = array(value.inheritedPrivacyPolicies || value.privacy?.inherited, 100);
  const effectivePolicy = effectivePearlPrivacyPolicy([directPolicy, ...inheritedPolicies], { pearlId });
  const revision = Math.max(0, Number(value.revision) || 0);
  const legacyLayers = [
    ...(value.primitives || []).map((entry) => ({ ...entry, kind: "primitive" })),
    ...(value.roles || []).map((entry) => ({ ...entry, kind: "role" })),
    ...(value.lenses || value.workingSet?.lenses || []).map((entry) => ({ ...entry, kind: "lens" })),
    ...(value.moves || value.workingSet?.moves || []).map((entry) => ({ ...entry, kind: "move" })),
    ...(value.functions || value.workingSet?.functions || []).map((entry) => ({ ...entry, kind: "function" })),
  ];
  const cognition = createPearlCognition(value.cognition || {
    layers: legacyLayers,
    rawEvidence: value.material?.evidence || value.evidence || [],
    sourceMapping: value.semanticDiff?.mapping || value.sourceMapping || {},
  }, { privacyPolicy: effectivePolicy });
  const legacyView = (layer) => ({
    id: layer.id,
    stableId: layer.stableId,
    version: layer.version,
    revision: layer.revision,
    kind: layer.kind,
    name: layer.identity.name,
    description: layer.identity.description,
    ...clone(layer.definition),
    uncertainty: clone(layer.uncertainty),
    provenance: clone(layer.provenance),
  });
  return {
    schemaVersion: PEARL_ENTITY_VERSION,
    id: pearlId,
    kind,
    revision,
    identity: canonicalIdentity(value, pearlId),
    representation: canonicalRepresentation(value, kind),
    workingSet: canonicalWorkingSet(value),
    lenses: cognition.layers.filter((entry) => entry.kind === "lens").map(legacyView),
    moves: cognition.layers.filter((entry) => entry.kind === "move").map(legacyView),
    functions: cognition.layers.filter((entry) => entry.kind === "function").map(legacyView),
    cognition,
    automation: clone(value.automation || (kind === "automation" ? {
      contextSchema: value.contextSchema,
      generationPlan: value.generationPlan,
      researchPlan: value.researchPlan,
      evaluation: value.evaluation,
      semanticDiff: value.semanticDiff,
      evidence: value.material?.evidence,
      contextPatches: value.contextPatches,
      permissions: value.permissions,
      version: value.version,
    } : null)),
    generation: {
      plan: clone(value.generation?.plan || value.generationPlan || null),
      outputSpecs: array(value.generation?.outputSpecs || value.outputSpecs || (value.outputSpec ? [value.outputSpec] : []), 100),
      candidates: array(value.generation?.candidates || value.candidates || value.outputs, 200),
      activeRunId: value.generation?.activeRunId || value.execution?.runId || null,
    },
    results: array(value.results || value.resultPearls || (kind === "result" ? [{
      id: pearlId,
      outputId: value.outputId,
      text: value.text,
      status: value.status,
      branch: value.branch,
      destination: value.destination,
      provenance: value.provenance,
    }] : []), 200),
    canvas: clone(value.canvas || (kind === "page-canvas" ? value : value.pageCanvas) || null),
    soundscape: clone(value.soundscape || value.pearlSoundscape || null),
    privacy: {
      policy: createPearlPrivacyPolicy({ ...directPolicy, pearlId }),
      inheritedPolicyIds: inheritedPolicies.map((entry) => entry.id),
      effectivePolicy,
    },
    sharing: {
      package: clone(value.sharing?.package || value.package || null),
      grants: array(value.sharing?.grants || value.shareGrants, 500),
      receipts: array(value.sharing?.receipts || value.shareReceipts, 500),
      pendingReview: clone(value.sharing?.pendingReview || null),
      installation: clone(value.sharing?.installation || null),
      updateChannel: clone(value.sharing?.updateChannel || null),
    },
    provenance: clone(value.provenance || {}),
    lineage: array(value.lineage, 1_000),
    relationships: {
      parentPearlId: value.relationships?.parentPearlId || (kind === "result" && value.pearlId !== pearlId ? value.pearlId : null),
      childPearlIds: array(value.relationships?.childPearlIds, 500),
      relatedPearlIds: array(value.relationships?.relatedPearlIds, 500),
      nestedPearlIds: array(value.relationships?.nestedPearlIds || value.children, 500),
    },
    history: {
      checkpoints: array(value.history?.checkpoints || value.checkpoints || (value.checkpoint ? [value.checkpoint] : []), PEARL_ENTITY_MAX_CHECKPOINTS),
      events: array(value.history?.events || value.events, PEARL_ENTITY_MAX_EVENTS),
      undoCursor: Math.max(0, Number(value.history?.undoCursor) || 0),
    },
    permissions: {
      acl: clone(value.permissions?.acl || effectivePolicy.acl),
      keyState: clone(value.permissions?.keyState || effectivePolicy.encryption),
      lockState: value.permissions?.lockState || effectivePolicy.encryption.status,
    },
    tasks: {
      workers: array(value.tasks?.workers || value.workers, 100),
      queue: array(value.tasks?.queue || value.queue, 500),
      activeTaskId: value.tasks?.activeTaskId || null,
    },
    outputRouting: clone(value.outputRouting || value.routing || null),
    runtime: {
      phase: PEARL_RUNTIME_PHASES.includes(value.runtime?.phase || value.phase)
        ? value.runtime?.phase || value.phase
        : effectivePolicy.encryption.status === "locked" ? "locked" : "idle",
      activeSurface: value.runtime?.activeSurface || null,
      cursorMode: value.runtime?.cursorMode === true,
      pendingApproval: clone(value.runtime?.pendingApproval || null),
      lastEffectReceiptId: value.runtime?.lastEffectReceiptId || null,
      error: clone(value.runtime?.error || value.failure || null),
    },
    createdAt: Number(value.createdAt) || Date.now(),
    updatedAt: Number(value.updatedAt) || Date.now(),
  };
}

export function migratePearlEntity(value, options = {}) {
  if (!value || typeof value !== "object") throw new Error("Pearl migration requires an object");
  if (value.schemaVersion > PEARL_ENTITY_VERSION) throw new Error("Pearl was created by a newer incompatible version");
  const migrated = createPearlEntity(value);
  return {
    entity: migrated,
    receipt: {
      type: "pearl-entity-migration",
      id: options.id || id("migration"),
      pearlId: migrated.id,
      from: value.schemaVersion || value.version || 0,
      to: PEARL_ENTITY_VERSION,
      sourceKind: value.kind || inferKind(value),
      preservedStableId: migrated.identity.stableId,
      at: Date.now(),
    },
  };
}

export function checkpointPearlEntity(entityInput, reason, metadata = {}) {
  const entity = createPearlEntity(entityInput);
  const checkpoint = {
    id: id("pearl-checkpoint"),
    revision: entity.revision,
    reason: bounded(reason, 180),
    snapshot: {
      identity: clone(entity.identity),
      representation: clone(entity.representation),
      workingSet: clone(entity.workingSet),
      lenses: clone(entity.lenses),
      moves: clone(entity.moves),
      functions: clone(entity.functions),
      cognition: clone(entity.cognition),
      automation: clone(entity.automation),
      generation: clone(entity.generation),
      results: clone(entity.results),
      canvas: clone(entity.canvas),
      soundscape: clone(entity.soundscape),
      privacy: clone(entity.privacy),
      sharing: clone(entity.sharing),
      lineage: clone(entity.lineage),
      relationships: clone(entity.relationships),
      permissions: clone(entity.permissions),
      outputRouting: clone(entity.outputRouting),
    },
    metadata: clone(metadata),
    at: Date.now(),
  };
  return {
    entity: {
      ...entity,
      history: { ...entity.history, checkpoints: [...entity.history.checkpoints, checkpoint].slice(-PEARL_ENTITY_MAX_CHECKPOINTS) },
    },
    checkpoint,
  };
}

export function applyPearlEntityPatch(entityInput, patch, options = {}) {
  const entity = createPearlEntity(entityInput);
  if (options.expectedRevision != null && entity.revision !== options.expectedRevision) {
    return {
      entity,
      conflict: {
        type: "pearl-revision-conflict",
        expectedRevision: options.expectedRevision,
        actualRevision: entity.revision,
        proposedPatch: clone(patch),
      },
    };
  }
  const checkpointed = checkpointPearlEntity(entity, options.reason || "canonical-patch", { idempotencyKey: options.idempotencyKey });
  const next = createPearlEntity({
    ...checkpointed.entity,
    ...clone(patch),
    id: entity.id,
    stableId: entity.identity.stableId,
    revision: entity.revision + 1,
    history: checkpointed.entity.history,
    updatedAt: Date.now(),
  });
  return { entity: next, checkpoint: checkpointed.checkpoint, conflict: null };
}

export function pearlEntityObservation(entityInput, options = {}) {
  const entity = createPearlEntity(entityInput);
  const authorized = options.authorizedSections || [
    "identity", "representation", "workingSet", "lenses", "moves", "functions", "cognition", "automation", "generation",
    "results", "canvas", "soundscape", "privacy", "sharing", "lineage", "relationships", "permissions", "tasks", "outputRouting", "runtime",
  ];
  return {
    schemaVersion: PEARL_ENTITY_VERSION,
    pearlId: entity.id,
    revision: entity.revision,
    kind: entity.kind,
    sections: Object.fromEntries(authorized.filter((key) => key in entity).map((key) => [key, clone(entity[key])])),
    unavailable: (options.requestedSections || []).filter((key) => !authorized.includes(key)).map((key) => ({
      section: key,
      reason: entity.permissions.lockState === "locked" ? "locked" : "not-authorized-or-not-observable",
    })),
    observedAt: Date.now(),
  };
}

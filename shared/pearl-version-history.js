/**
 * Google Docs–style Pearl version history: browse, name, and restore
 * without destroying intermediate checkpoints.
 */
import { createPearlEntity, checkpointPearlEntity, PEARL_ENTITY_MAX_CHECKPOINTS } from "./pearl-entity.js";

export const PEARL_VERSION_HISTORY_VERSION = 1;

const clone = (value) => (value == null ? value : structuredClone(value));
const bounded = (value, limit = 180) => String(value ?? "").slice(0, limit);

function checkpointPreview(checkpoint) {
  const identity = checkpoint?.snapshot?.identity || {};
  const results = checkpoint?.snapshot?.results || [];
  const text = results[0]?.text || identity.description || "";
  return {
    name: identity.name || "Untitled Pearl",
    textPreview: bounded(String(text).replace(/\s+/g, " ").trim(), 160),
  };
}

/**
 * Ordered newest-first list of restorable versions plus the live tip.
 */
export function listPearlVersions(entityInput) {
  const entity = createPearlEntity(entityInput);
  const checkpoints = [...(entity.history?.checkpoints || [])]
    .slice()
    .reverse()
    .map((checkpoint, index) => ({
      id: checkpoint.id,
      kind: checkpoint.metadata?.named ? "named" : "automatic",
      revision: checkpoint.revision,
      label: checkpoint.metadata?.label || checkpoint.reason || `Version ${entity.history.checkpoints.length - index}`,
      reason: checkpoint.reason || "",
      at: checkpoint.at,
      named: checkpoint.metadata?.named === true,
      preview: checkpointPreview(checkpoint),
      restorable: true,
      current: false,
    }));
  return {
    version: PEARL_VERSION_HISTORY_VERSION,
    pearlId: entity.id,
    revision: entity.revision,
    current: {
      id: `current:${entity.id}:${entity.revision}`,
      kind: "current",
      revision: entity.revision,
      label: entity.identity.name || "Current",
      reason: "live",
      at: entity.updatedAt,
      named: false,
      preview: {
        name: entity.identity.name,
        textPreview: bounded(String(entity.results?.[0]?.text || entity.identity.description || "").replace(/\s+/g, " ").trim(), 160),
      },
      restorable: false,
      current: true,
    },
    versions: checkpoints,
    count: checkpoints.length,
  };
}

export function findPearlCheckpoint(entityInput, checkpointId) {
  const entity = createPearlEntity(entityInput);
  if (!checkpointId) return null;
  return entity.history.checkpoints.find((entry) => entry.id === checkpointId) || null;
}

/**
 * Name an existing checkpoint (Docs "Name this version").
 */
export function labelPearlVersion(entityInput, checkpointId, label) {
  const entity = createPearlEntity(entityInput);
  const name = bounded(label, 120).trim();
  if (!name) throw new Error("version label is required");
  const checkpoints = entity.history.checkpoints.map((entry) => {
    if (entry.id !== checkpointId) return entry;
    return {
      ...entry,
      metadata: { ...entry.metadata, label: name, named: true },
      reason: entry.reason || name,
    };
  });
  if (!checkpoints.some((entry) => entry.id === checkpointId)) {
    throw new Error("version checkpoint not found");
  }
  return createPearlEntity({
    ...entity,
    history: { ...entity.history, checkpoints },
    updatedAt: Date.now(),
  });
}

/**
 * Explicitly snapshot the live Pearl as a named version.
 */
export function snapshotPearlVersion(entityInput, label, options = {}) {
  const name = bounded(label || options.reason || "Named version", 120).trim();
  if (!name) throw new Error("version label is required");
  const { entity, checkpoint } = checkpointPearlEntity(entityInput, name, {
    named: true,
    label: name,
    source: options.source || "companion",
    idempotencyKey: options.idempotencyKey || null,
  });
  return { entity, checkpoint, version: listPearlVersions(entity).versions.find((entry) => entry.id === checkpoint.id) };
}

/**
 * Restore a prior checkpoint into a new revision while retaining full history.
 * Docs-style: restore never deletes intermediate versions.
 */
export function restorePearlVersion(entityInput, checkpointId, options = {}) {
  const entity = createPearlEntity(entityInput);
  const checkpoint = findPearlCheckpoint(entity, checkpointId);
  if (!checkpoint?.snapshot) throw new Error("version checkpoint not found");
  const labeled = checkpoint.metadata?.label || checkpoint.reason || checkpoint.id;
  const before = checkpointPearlEntity(entity, options.reason || `before-restore:${labeled}`, {
    source: options.source || "companion",
    restoreTargetId: checkpoint.id,
  });
  const restored = createPearlEntity({
    ...before.entity,
    ...clone(checkpoint.snapshot),
    id: entity.id,
    kind: entity.kind,
    revision: entity.revision + 1,
    identity: {
      ...clone(checkpoint.snapshot.identity),
      id: entity.id,
      stableId: entity.identity.stableId,
      ownerProfileId: entity.identity.ownerProfileId,
    },
    history: {
      ...before.entity.history,
      checkpoints: [
        ...before.entity.history.checkpoints,
        {
          id: `pearl-checkpoint:restored:${Date.now()}`,
          revision: entity.revision + 1,
          reason: bounded(`restored from ${labeled}`, 180),
          snapshot: clone(checkpoint.snapshot),
          metadata: {
            named: false,
            restoredFrom: checkpoint.id,
            restoredLabel: labeled,
            source: options.source || "companion",
          },
          at: Date.now(),
        },
      ].slice(-PEARL_ENTITY_MAX_CHECKPOINTS),
      events: before.entity.history.events,
      undoCursor: before.entity.history.undoCursor,
    },
    updatedAt: Date.now(),
  });
  return {
    entity: restored,
    restoredFrom: {
      id: checkpoint.id,
      label: labeled,
      revision: checkpoint.revision,
      at: checkpoint.at,
    },
  };
}

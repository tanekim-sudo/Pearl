import { createPearlEntity, migratePearlEntity } from "./pearl-entity.js";

export const PEARL_STORE_VERSION = 1;
export const PEARL_STORE_KEY = "pearlEntities.v1";

const clone = (value) => value == null ? value : structuredClone(value);

export function migrateLegacyPearlState(state = {}) {
  const candidates = [
    ...(state.pearlEntities ? Object.values(state.pearlEntities) : []),
    ...(state.semanticOrbs || []),
    ...Object.values(state.resultPearls || {}),
    ...Object.values(state.pearlPageCanvases || state.pageCanvases || {}),
    ...Object.values(state.automationPearls || {}),
    ...(state.primaryPearl ? [state.primaryPearl] : []),
  ];
  const entities = {};
  const receipts = [];
  for (const candidate of candidates) {
    try {
      const migrated = migratePearlEntity(candidate);
      const existing = entities[migrated.entity.id];
      if (!existing || migrated.entity.revision >= existing.revision) {
        entities[migrated.entity.id] = migrated.entity;
      }
      receipts.push(migrated.receipt);
    } catch (error) {
      receipts.push({
        type: "pearl-entity-migration-failure",
        sourceId: candidate?.id || candidate?.pearlId || null,
        code: "INVALID_LEGACY_PEARL",
        recoverable: true,
        at: Date.now(),
      });
    }
  }
  return {
    version: PEARL_STORE_VERSION,
    entities,
    activePearlId: entities[state.activePearlId || state.activeSemanticOrbId]
      ? state.activePearlId || state.activeSemanticOrbId
      : Object.keys(entities)[0] || null,
    receipts,
    migratedAt: Date.now(),
  };
}

export function compareAndSwapPearl(store, pearlId, expectedRevision, update) {
  const current = store.entities?.[pearlId];
  if (!current) throw new Error("Pearl not found");
  if (current.revision !== expectedRevision) {
    return {
      store,
      conflict: {
        type: "pearl-store-revision-conflict",
        pearlId,
        expectedRevision,
        actualRevision: current.revision,
        current: clone(current),
      },
    };
  }
  const nextEntity = createPearlEntity(typeof update === "function" ? update(clone(current)) : update);
  if (nextEntity.id !== pearlId) throw new Error("Pearl identity cannot change during compare-and-swap");
  if (nextEntity.revision <= current.revision) throw new Error("Pearl revision must increase during compare-and-swap");
  return {
    store: { ...store, entities: { ...store.entities, [pearlId]: nextEntity }, updatedAt: Date.now() },
    entity: nextEntity,
    conflict: null,
  };
}

export function removePearlFromStore(store, pearlId, options = {}) {
  if (!store.entities?.[pearlId]) return { store, removed: null };
  const entities = { ...store.entities };
  const removed = entities[pearlId];
  delete entities[pearlId];
  const tombstones = options.tombstone !== false
    ? [...(store.tombstones || []), {
        pearlId,
        revision: removed.revision,
        policyId: removed.privacy.policy.id,
        deletedAt: Date.now(),
        propagate: removed.privacy.effectivePolicy.retention.propagateDeletion,
      }].slice(-1_000)
    : store.tombstones || [];
  return {
    store: {
      ...store,
      entities,
      tombstones,
      activePearlId: store.activePearlId === pearlId ? Object.keys(entities)[0] || null : store.activePearlId,
      updatedAt: Date.now(),
    },
    removed,
  };
}

export function pearlStoreSnapshot(store) {
  return {
    version: PEARL_STORE_VERSION,
    entities: clone(store.entities || {}),
    activePearlId: store.activePearlId || null,
    tombstones: clone(store.tombstones || []),
    updatedAt: store.updatedAt || Date.now(),
  };
}

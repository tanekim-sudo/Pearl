export const ORB_INTERACTION_VERSION = 1;

export const ORB_DROP_TARGETS = Object.freeze([
  "orb",
  "context-orbit",
  "stage",
  "output-frame",
  "candidate-constellation",
  "worker-orb",
]);

const clone = (value) => structuredClone(value);

export function normalizeContextOrbit(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.id)
    .map((entry, index) => ({
      id: String(entry.id),
      kind: entry.kind || "material",
      priority: Math.max(0, Math.min(1, Number.isFinite(entry.priority) ? entry.priority : 1 - index * 0.08)),
      pinned: Boolean(entry.pinned),
      group: entry.group || null,
      provenance: clone(entry.provenance || null),
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || a.id.localeCompare(b.id));
}

export function contextPriorityFromDistance(distance, radius = 160) {
  const normalized = 1 - Math.max(0, Math.min(Number(distance) || 0, radius)) / Math.max(1, radius);
  return Math.round(normalized * 1000) / 1000;
}

export function updateContextOrbit(entries, operation) {
  const current = normalizeContextOrbit(entries);
  if (operation.type === "remove") return current.filter((entry) => entry.id !== operation.id);
  if (operation.type === "add") {
    const without = current.filter((entry) => entry.id !== operation.entry.id);
    return normalizeContextOrbit([...without, operation.entry]);
  }
  return normalizeContextOrbit(current.map((entry) => entry.id === operation.id ? {
    ...entry,
    ...(operation.type === "pin" ? { pinned: operation.value !== false } : {}),
    ...(operation.type === "group" ? { group: operation.group || null } : {}),
    ...(operation.type === "priority" ? { priority: operation.priority } : {}),
  } : entry));
}

export function normalizeLensAtmosphere(rings = []) {
  const seen = new Set();
  return (Array.isArray(rings) ? rings : []).flatMap((ring, index) => {
    if (!ring?.id || seen.has(ring.id)) return [];
    seen.add(ring.id);
    return [{
      id: String(ring.id),
      order: Number.isFinite(ring.order) ? ring.order : index,
      strength: Math.max(0, Math.min(1, Number.isFinite(ring.strength) ? ring.strength : 1)),
      contextPolicy: ring.contextPolicy || (ring.id === "lens-new-chat" ? "empty" : "bounded"),
      composedFrom: [...new Set(ring.composedFrom || [])],
    }];
  }).sort((a, b) => a.order - b.order).map((ring, order) => ({ ...ring, order }));
}

export function composeLensRings(left, right, id) {
  const rings = normalizeLensAtmosphere([left, right]);
  if (rings.some((ring) => ring.contextPolicy === "empty")) {
    return { id: id || "lens-new-chat", order: 0, strength: 1, contextPolicy: "empty", composedFrom: [] };
  }
  return {
    id: id || `lens-compose:${rings.map((ring) => ring.id).join("+")}`,
    order: Math.min(...rings.map((ring) => ring.order)),
    strength: Math.round((rings.reduce((sum, ring) => sum + ring.strength, 0) / Math.max(1, rings.length)) * 1000) / 1000,
    contextPolicy: "bounded",
    composedFrom: rings.map((ring) => ring.id),
  };
}

export function resolveOrbGesture({ source, target, modifiers = {}, ambiguity = [] }) {
  if (!source) return { type: "chooser", preserving: true, choices: ["add-context", "create-output", "handoff"] };
  if (ambiguity.length > 1) return { type: "chooser", preserving: true, choices: ambiguity };
  switch (target?.kind) {
    case "orb":
    case "context-orbit":
      return { type: "context-add", command: "addOrbContext", preserving: true, reversible: true };
    case "stage":
      return { type: "stage-materialize", command: "materializeOnStage", preserving: true, reversible: true };
    case "output-frame":
      return { type: "frame-materialize", command: "materializeInOutputFrame", preserving: true, reversible: true };
    case "candidate-constellation":
      return { type: "candidate-branch", command: "queueBranchMaterial", preserving: true, reversible: true };
    case "worker-orb":
      return { type: "worker-context", command: "assignWorkerContext", preserving: true, reversible: true };
    default:
      return modifiers.outward
        ? { type: "creation-preview", command: "openOrbCreationPreview", preserving: true, reversible: true }
        : { type: "chooser", preserving: true, choices: ["context", "move", "function", "lens", "frame", "package", "research"] };
  }
}

export function createSemanticRewind(entries = []) {
  return {
    version: ORB_INTERACTION_VERSION,
    cursor: entries.length,
    entries: clone(entries),
  };
}

export function rewindSemanticHistory(history, to) {
  const cursor = Math.max(0, Math.min(Number(to) || 0, history.entries.length));
  const active = history.entries.slice(0, cursor);
  const inverses = history.entries.slice(cursor).reverse().map((entry) => entry.inverse).filter(Boolean);
  return { ...history, cursor, active, inverses };
}

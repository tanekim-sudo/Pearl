export const SEMANTIC_ORB_VERSION = 1;
export const SEMANTIC_ORB_KIND = "semantic-orb";
export const SEMANTIC_ORB_RADIUS = 24;
export const SEMANTIC_ORB_REPRESENTATION_KINDS = Object.freeze([
  "empty",
  "material",
  "selection",
  "move",
  "function",
  "lens",
  "candidate",
  "branch",
  "query",
  "transcript",
  "external-capture",
  "grouped-context",
  "scene",
  "worker",
]);

const clone = (value) => value == null ? value : structuredClone(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const timeValue = (value) => typeof value === "function" ? value() : Number.isFinite(value) ? value : Date.now();

export function createSemanticOrb(value = {}, options = {}) {
  const id = String(value.id || options.idFactory?.() || "");
  if (!id) throw new Error("SemanticOrb id is required");
  const representation = value.representation || {};
  const representationKind = SEMANTIC_ORB_REPRESENTATION_KINDS.includes(representation.kind)
    ? representation.kind
    : "empty";
  return {
    ...clone(value),
    version: SEMANTIC_ORB_VERSION,
    id,
    kind: SEMANTIC_ORB_KIND,
    sceneId: value.sceneId || null,
    name: String(value.name || representation.label || "Untitled orb"),
    placement: {
      x: finite(value.placement?.x ?? value.x),
      y: finite(value.placement?.y ?? value.y),
      radius: Math.max(16, Math.min(44, finite(value.placement?.radius, SEMANTIC_ORB_RADIUS))),
    },
    representation: {
      kind: representationKind,
      refs: [...new Set((representation.refs || []).filter(Boolean).map(String))],
      label: representation.label || value.name || null,
      snapshot: clone(representation.snapshot || null),
    },
    workingSet: {
      context: clone(value.workingSet?.context || []),
      lenses: clone(value.workingSet?.lenses || []),
      selections: clone(value.workingSet?.selections || []),
      branches: clone(value.workingSet?.branches || []),
      checkpoints: clone(value.workingSet?.checkpoints || []),
    },
    parentOrbId: value.parentOrbId || null,
    childOrbIds: [...new Set((value.childOrbIds || []).filter(Boolean).map(String))],
    lineage: clone(value.lineage || []),
    provenance: clone(value.provenance || null),
    archived: value.archived === true,
    createdAt: value.createdAt || new Date(timeValue(options.now)).toISOString(),
    updatedAt: value.updatedAt || new Date(timeValue(options.now)).toISOString(),
  };
}

export function normalizeSemanticOrbs(values = []) {
  const byId = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    try {
      const orb = createSemanticOrb(value);
      if (!byId.has(orb.id)) byId.set(orb.id, orb);
    } catch {
      // Invalid legacy records remain outside the semantic-orb collection.
    }
  }
  return [...byId.values()];
}

export function semanticOrbFromMaterial(material, options = {}) {
  if (!material) throw new Error("material is required");
  const sourceId = String(material.id || options.sourceId || "");
  const sourceKind = String(material.kind || material.type || options.kind || "material").toLowerCase();
  const representationKind = SEMANTIC_ORB_REPRESENTATION_KINDS.includes(sourceKind)
    ? sourceKind
    : sourceKind.includes("transcript")
      ? "transcript"
      : sourceKind.includes("candidate")
        ? "candidate"
        : "material";
  const label = material.name || material.label || material.text || material.quote || options.name || "Untitled orb";
  return createSemanticOrb({
    id: options.id,
    sceneId: options.sceneId || material.sceneId || null,
    name: String(label).slice(0, 80),
    placement: options.placement,
    representation: {
      kind: representationKind,
      refs: sourceId ? [sourceId] : [],
      label: String(label).slice(0, 120),
      snapshot: sourceId ? null : clone(material),
    },
    workingSet: {
      context: [{
        ...clone(material),
        id: sourceId || `material:${options.id}`,
        kind: sourceKind,
        priority: 1,
        pinned: true,
      }],
    },
    provenance: {
      sourceId: sourceId || null,
      sourceKind,
      capturedAt: new Date(timeValue(options.now)).toISOString(),
    },
  }, options);
}

export function placeSemanticOrb(existing = [], desired = {}, options = {}) {
  const radius = Math.max(16, finite(options.radius, SEMANTIC_ORB_RADIUS));
  const clearance = Math.max(4, finite(options.clearance, 12));
  const origin = { x: finite(desired.x), y: finite(desired.y) };
  const visible = normalizeSemanticOrbs(existing).filter((orb) => !orb.archived);
  const free = (point) => visible.every((orb) => {
    const otherRadius = finite(orb.placement.radius, SEMANTIC_ORB_RADIUS);
    return Math.hypot(point.x - orb.placement.x, point.y - orb.placement.y) >= radius + otherRadius + clearance;
  });
  if (free(origin)) return origin;
  for (let index = 1; index <= 96; index += 1) {
    const angle = index * 2.399963229728653;
    const distance = (radius * 2 + clearance) * Math.sqrt(index);
    const candidate = {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
    };
    if (free(candidate)) return candidate;
  }
  return { x: origin.x + visible.length * (radius + clearance), y: origin.y };
}

export function clusterSemanticOrbs(orbs = [], { zoom = 1, cellSize = 150 } = {}) {
  const visible = normalizeSemanticOrbs(orbs).filter((orb) => !orb.archived);
  if (zoom >= 0.7 && visible.length <= 18) {
    return visible.map((orb) => ({ id: orb.id, x: orb.placement.x, y: orb.placement.y, count: 1, orbIds: [orb.id] }));
  }
  const size = Math.max(72, cellSize / Math.max(0.25, zoom));
  const cells = new Map();
  for (const orb of visible) {
    const key = `${Math.round(orb.placement.x / size)}:${Math.round(orb.placement.y / size)}`;
    const cell = cells.get(key) || { id: `orb-cluster:${key}`, x: 0, y: 0, count: 0, orbIds: [] };
    cell.x += orb.placement.x;
    cell.y += orb.placement.y;
    cell.count += 1;
    cell.orbIds.push(orb.id);
    cells.set(key, cell);
  }
  return [...cells.values()].map((cell) => ({
    ...cell,
    x: cell.x / cell.count,
    y: cell.y / cell.count,
  }));
}

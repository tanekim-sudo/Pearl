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
  "synthesis",
  "counter",
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
    name: String(value.name || representation.label || "Untitled pearl"),
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
      ...(representation.preserveIndividuals === true ? { preserveIndividuals: true } : {}),
      ...(Array.isArray(representation.sourcePearlIds)
        ? { sourcePearlIds: [...new Set(representation.sourcePearlIds.filter(Boolean).map(String))] }
        : {}),
      ...(representation.composition && typeof representation.composition === "object"
        ? { composition: clone(representation.composition) }
        : {}),
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
    aesthetic: value.aesthetic && typeof value.aesthetic === "object" ? clone(value.aesthetic) : null,
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
  const label = material.name || material.label || material.text || material.quote || options.name || "Untitled pearl";
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

/** Compact metadata a pearl can "notice" about another without model calls. */
export function summarizeSemanticOrbForSynthesis(orb) {
  if (!orb) return null;
  const context = Array.isArray(orb.workingSet?.context) ? orb.workingSet.context : [];
  const lenses = Array.isArray(orb.workingSet?.lenses) ? orb.workingSet.lenses : [];
  const contextLabels = context
    .slice(0, 6)
    .map((item) => String(item?.label || item?.name || item?.quote || item?.text || item?.id || "").trim())
    .filter(Boolean)
    .map((label) => label.slice(0, 120));
  const lensNames = lenses
    .map((lens) => String(lens?.name || lens?.label || lens?.id || "").trim())
    .filter(Boolean)
    .map((name) => name.slice(0, 80));
  return {
    id: String(orb.id),
    name: String(orb.name || orb.representation?.label || orb.id),
    kind: orb.representation?.kind || "empty",
    label: orb.representation?.label || null,
    contextCount: context.length,
    lensCount: lenses.length,
    contextLabels,
    lensNames,
    childCount: Array.isArray(orb.childOrbIds) ? orb.childOrbIds.length : 0,
  };
}

/**
 * Deterministic mutual / directed observations between pearls.
 * Sources are never mutated — callers append the returned synthesis pearl only.
 */
export function buildPearlMutualObservations(sources = [], options = {}) {
  const orbs = (Array.isArray(sources) ? sources : []).filter(Boolean);
  if (orbs.length < 2) throw new Error("at least two pearls are required");
  const mode = options.mode === "directed" ? "directed" : "mutual";
  const instruction = String(options.instruction || "").trim().slice(0, 400);
  const pairs = [];
  if (mode === "directed") {
    pairs.push([orbs[0], orbs[1]]);
  } else {
    const limit = Math.min(orbs.length, 4);
    for (let i = 0; i < limit; i += 1) {
      for (let j = 0; j < limit; j += 1) {
        if (i === j) continue;
        pairs.push([orbs[i], orbs[j]]);
      }
    }
  }
  const observations = pairs.map(([observer, subject], index) => {
    const from = summarizeSemanticOrbForSynthesis(observer);
    const about = summarizeSemanticOrbForSynthesis(subject);
    const lensClause = from.lensNames.length
      ? `Through ${from.lensNames.slice(0, 3).join(", ")}, `
      : from.contextCount
        ? `From its ${from.contextCount} context item${from.contextCount === 1 ? "" : "s"}, `
        : "From its capsule shape, ";
    const aboutBits = [];
    aboutBits.push(`it holds a ${about.kind} representation`);
    if (about.lensNames.length) aboutBits.push(`lenses: ${about.lensNames.slice(0, 3).join(", ")}`);
    if (about.contextLabels.length) aboutBits.push(`salient material: ${about.contextLabels.slice(0, 3).join("; ")}`);
    else if (about.contextCount) aboutBits.push(`${about.contextCount} context item${about.contextCount === 1 ? "" : "s"}`);
    if (about.childCount) aboutBits.push(`${about.childCount} nested pearl${about.childCount === 1 ? "" : "s"}`);
    if (instruction) aboutBits.push(`under instruction “${instruction}”`);
    const text = `${from.name} notices about ${about.name}: ${lensClause}${aboutBits.join("; ")}.`;
    return {
      id: `observation:${from.id}->${about.id}:${index}`,
      kind: "pearl-observation",
      type: "text",
      fromPearlId: from.id,
      aboutPearlId: about.id,
      fromName: from.name,
      aboutName: about.name,
      mode,
      text,
      label: `${from.name} → ${about.name}`,
      priority: 1,
      pinned: true,
      summary: { from, about },
    };
  });
  return { mode, instruction: instruction || null, observations, sourceIds: orbs.map((orb) => String(orb.id)) };
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

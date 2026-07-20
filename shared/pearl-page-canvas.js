export const PEARL_PAGE_CANVAS_VERSION = 1;
export const PEARL_CANVAS_QUOTAS = Object.freeze({
  artifacts: 500,
  points: 100_000,
  bytes: 5_000_000,
  checkpoints: 20,
  context: 200,
});
export const PEARL_CANVAS_MODES = Object.freeze([
  "native",
  "select-type",
  "pen",
  "highlighter",
  "eraser",
  "lasso",
  "image",
  "dom-select",
  "voice",
]);
export const PEARL_OUTPUT_DESTINATIONS = Object.freeze([
  "canvas-textbox",
  "native-insert",
  "native-replace",
  "new-tab",
  "web-scene",
  "chat",
  "clipboard",
  "download",
  "pdf",
]);

const clone = (value) => structuredClone(value);
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bounded = (value, limit = 4_000) => String(value ?? "").slice(0, limit);
const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
};
function artifactHash(artifact) {
  const value = stableJson(artifact);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `artifact:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}
function artifactSnapshotRef(artifact, snapshots) {
  const base = artifactHash(artifact);
  const serialized = stableJson(artifact);
  let ref = base;
  let collision = 0;
  while (snapshots[ref] && stableJson(snapshots[ref]) !== serialized) {
    collision += 1;
    ref = `${base}:${collision}`;
  }
  snapshots[ref] ||= clone(artifact);
  return ref;
}
function quotaError(message) {
  const error = new Error(message);
  error.code = "PEARL_CANVAS_QUOTA";
  error.recoverable = true;
  return error;
}

export function canonicalPageIdentity(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Pearl canvas is unavailable on protected browser pages");
  const pathname = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return `${url.origin}${pathname}`;
}

export function pearlCanvasKey(pearlId, pageIdentity) {
  if (!pearlId || !pageIdentity) throw new Error("Pearl and page identity are required");
  return `${bounded(pearlId, 180)}::${bounded(pageIdentity, 1_000)}`;
}

export function emptyPearlPageCanvas(input = {}) {
  return {
    version: PEARL_PAGE_CANVAS_VERSION,
    pearlId: bounded(input.pearlId, 180),
    pageIdentity: bounded(input.pageIdentity, 1_000),
    active: Boolean(input.active),
    mode: PEARL_CANVAS_MODES.includes(input.mode) ? input.mode : "native",
    artifacts: [],
    selectedIds: [],
    context: [],
    destination: { type: "canvas-textbox", targetId: null, scope: "selected-output" },
    checkpoints: [],
    artifactSnapshots: {},
    revision: 0,
    updatedAt: Date.now(),
  };
}

export function normalizeCanvasArtifact(value = {}) {
  const type = ["text", "ink", "highlight", "image", "output"].includes(value.type) ? value.type : "text";
  const box = {
    x: finite(value.box?.x ?? value.x),
    y: finite(value.box?.y ?? value.y),
    width: Math.max(1, finite(value.box?.width ?? value.width, type === "text" ? 180 : 1)),
    height: Math.max(1, finite(value.box?.height ?? value.height, type === "text" ? 72 : 1)),
  };
  return {
    id: bounded(value.id || id(`canvas-${type}`), 220),
    type,
    box,
    coordinateSpace: value.coordinateSpace === "viewport" ? "viewport" : "document",
    text: type === "text" || type === "output" ? bounded(value.text, 120_000) : "",
    points: ["ink", "highlight"].includes(type)
      ? (value.points || []).slice(0, 20_000).map((point) => ({ x: finite(point.x), y: finite(point.y), pressure: Math.max(0, Math.min(1, finite(point.pressure, .5))) }))
      : [],
    source: type === "image" ? bounded(value.source, 8_000_000) : "",
    mime: type === "image" ? bounded(value.mime || "image/png", 80) : "",
    style: {
      color: bounded(value.style?.color || (type === "highlight" ? "rgba(233,213,126,.34)" : "#2a2c2b"), 80),
      width: Math.max(.5, Math.min(48, finite(value.style?.width, type === "highlight" ? 14 : 2))),
      opacity: Math.max(.05, Math.min(1, finite(value.style?.opacity, type === "highlight" ? .38 : 1))),
    },
    provenance: value.provenance ? clone(value.provenance) : null,
    createdAt: finite(value.createdAt, Date.now()),
    updatedAt: finite(value.updatedAt, Date.now()),
  };
}

export function normalizePearlPageCanvas(value = {}) {
  const base = emptyPearlPageCanvas(value);
  const artifacts = (value.artifacts || []).slice(0, PEARL_CANVAS_QUOTAS.artifacts + 1).map(normalizeCanvasArtifact);
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const artifactSnapshots = { ...(value.artifactSnapshots || {}) };
  const checkpoints = (value.checkpoints || []).slice(-PEARL_CANVAS_QUOTAS.checkpoints).map((entry) => {
    if (Array.isArray(entry.artifactRefs)) return clone(entry);
    const refs = (entry.artifacts || []).map((artifact) => {
      const normalized = normalizeCanvasArtifact(artifact);
      return artifactSnapshotRef(normalized, artifactSnapshots);
    });
    const migrated = { ...clone(entry), artifactRefs: refs };
    delete migrated.artifacts;
    return migrated;
  });
  const normalized = {
    ...base,
    ...clone(value),
    version: PEARL_PAGE_CANVAS_VERSION,
    mode: PEARL_CANVAS_MODES.includes(value.mode) ? value.mode : "native",
    artifacts,
    artifactSnapshots,
    checkpoints,
    selectedIds: [...new Set(value.selectedIds || [])].filter((entry) => artifactIds.has(entry)),
    context: (value.context || []).slice(0, PEARL_CANVAS_QUOTAS.context).map((entry) => ({
      id: bounded(entry.id || id("canvas-context"), 220),
      kind: bounded(entry.kind || "material", 80),
      ref: bounded(entry.ref || entry.id, 500),
      summary: bounded(entry.summary, 500),
      provenance: entry.provenance ? clone(entry.provenance) : null,
    })),
    destination: PEARL_OUTPUT_DESTINATIONS.includes(value.destination?.type)
      ? { type: value.destination.type, targetId: value.destination.targetId || null, scope: value.destination.scope || "selected-output" }
      : base.destination,
    revision: Math.max(0, finite(value.revision)),
    updatedAt: finite(value.updatedAt, Date.now()),
  };
  assertPearlCanvasQuota(normalized);
  return normalized;
}

export function pearlCanvasUsage(state) {
  const artifacts = state.artifacts || [];
  return {
    artifacts: artifacts.length,
    points: artifacts.reduce((sum, artifact) => sum + (artifact.points?.length || 0), 0),
    checkpoints: state.checkpoints?.length || 0,
    bytes: new TextEncoder().encode(stableJson({
      artifacts,
      context: state.context || [],
      checkpoints: state.checkpoints || [],
      artifactSnapshots: state.artifactSnapshots || {},
    })).byteLength,
  };
}

export function assertPearlCanvasQuota(state) {
  const usage = pearlCanvasUsage(state);
  if (usage.artifacts > PEARL_CANVAS_QUOTAS.artifacts) throw quotaError("Pearl canvas artifact quota reached");
  if (usage.points > PEARL_CANVAS_QUOTAS.points) throw quotaError("Pearl canvas point quota reached");
  if (usage.checkpoints > PEARL_CANVAS_QUOTAS.checkpoints) throw quotaError("Pearl canvas checkpoint quota reached");
  if (usage.bytes > PEARL_CANVAS_QUOTAS.bytes) throw quotaError("Pearl canvas storage quota reached");
  return usage;
}

function checkpoint(state, label) {
  const artifactSnapshots = { ...(state.artifactSnapshots || {}) };
  const artifactRefs = state.artifacts.map((artifact) => artifactSnapshotRef(artifact, artifactSnapshots));
  const snapshot = {
    id: id("canvas-checkpoint"),
    label: bounded(label, 120),
    at: Date.now(),
    mode: state.mode,
    artifactRefs,
    selectedIds: [...state.selectedIds],
    destination: clone(state.destination),
  };
  const checkpoints = [...state.checkpoints, snapshot].slice(-PEARL_CANVAS_QUOTAS.checkpoints);
  const liveRefs = new Set(checkpoints.flatMap((entry) => entry.artifactRefs || []));
  const compactSnapshots = Object.fromEntries(Object.entries(artifactSnapshots).filter(([hash]) => liveRefs.has(hash)));
  return { checkpoints, artifactSnapshots: compactSnapshots };
}

function change(state, patch, label) {
  const current = normalizePearlPageCanvas(state);
  const history = checkpoint(current, label);
  return normalizePearlPageCanvas({
    ...current,
    ...patch,
    ...history,
    revision: current.revision + 1,
    updatedAt: Date.now(),
  });
}

export function activatePearlCanvas(state) {
  return change(state, { active: true }, "activate");
}

export function deactivatePearlCanvas(state) {
  return change(state, { active: false, mode: "native", selectedIds: [] }, "deactivate");
}

export function setPearlCanvasMode(state, mode) {
  if (!PEARL_CANVAS_MODES.includes(mode)) throw new Error("unsupported Pearl canvas input mode");
  return change(state, { active: true, mode }, `mode:${mode}`);
}

export function createPearlCanvasArtifact(state, artifact) {
  const current = normalizePearlPageCanvas(state);
  const normalized = normalizeCanvasArtifact(artifact);
  if (normalized.type === "image" && !/^pearl-blob:[a-f0-9]{64}$/i.test(normalized.source)) {
    throw quotaError("Pearl canvas images must use a content-addressed local blob");
  }
  if (current.artifacts.some((entry) => entry.id === normalized.id)) return current;
  return change(current, {
    artifacts: [...current.artifacts, normalized],
    selectedIds: [normalized.id],
  }, `create:${normalized.id}`);
}

export function updatePearlCanvasArtifact(state, artifactId, patch) {
  const current = normalizePearlPageCanvas(state);
  if (!current.artifacts.some((entry) => entry.id === artifactId)) throw new Error("Pearl canvas artifact not found");
  return change(current, {
    artifacts: current.artifacts.map((entry) => entry.id === artifactId
      ? normalizeCanvasArtifact({ ...entry, ...clone(patch), id: entry.id, updatedAt: Date.now() })
      : entry),
  }, `update:${artifactId}`);
}

export function deletePearlCanvasArtifacts(state, artifactIds) {
  const ids = new Set(artifactIds || []);
  const current = normalizePearlPageCanvas(state);
  return change(current, {
    artifacts: current.artifacts.filter((entry) => !ids.has(entry.id)),
    selectedIds: current.selectedIds.filter((entry) => !ids.has(entry)),
  }, `delete:${[...ids].sort().join(",")}`);
}

export function selectPearlCanvasArtifacts(state, artifactIds) {
  const current = normalizePearlPageCanvas(state);
  const existing = new Set(current.artifacts.map((entry) => entry.id));
  return change(current, { selectedIds: [...new Set(artifactIds || [])].filter((entry) => existing.has(entry)) }, "select");
}

export function bindPearlCanvasContext(state, entries) {
  const current = normalizePearlPageCanvas(state);
  const byId = new Map(current.context.map((entry) => [entry.id, entry]));
  for (const entry of entries || []) byId.set(entry.id, entry);
  return change(current, { context: [...byId.values()].slice(-200) }, "bind-context");
}

export function setPearlCanvasDestination(state, destination) {
  if (!PEARL_OUTPUT_DESTINATIONS.includes(destination?.type)) throw new Error("unsupported Pearl output destination");
  return change(state, {
    destination: {
      type: destination.type,
      targetId: destination.targetId || null,
      scope: destination.scope || "selected-output",
    },
  }, `destination:${destination.type}`);
}

export function undoPearlCanvas(state) {
  const current = normalizePearlPageCanvas(state);
  const previous = current.checkpoints.at(-1);
  if (!previous) return current;
  return normalizePearlPageCanvas({
    ...current,
    mode: previous.mode,
    artifacts: (previous.artifactRefs || []).map((hash) => current.artifactSnapshots[hash]).filter(Boolean),
    selectedIds: previous.selectedIds,
    destination: previous.destination,
    checkpoints: current.checkpoints.slice(0, -1),
    revision: current.revision + 1,
    updatedAt: Date.now(),
  });
}

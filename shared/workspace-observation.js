import { contentFingerprint } from "./lens-grammar.js";

export const WORKSPACE_OBSERVATION_VERSION = 1;
export const OBSERVATION_SCOPES = Object.freeze([
  "selection",
  "viewport",
  "stage",
  "frame",
  "orb-context",
  "paper",
  "ai-space",
  "workspace",
  "visibleTab",
]);
export const OBSERVATION_LIMITS = Object.freeze({ objects: 1000, exactText: 120_000, depth: 20, summary: 500 });
const SCOPES = new Set(OBSERVATION_SCOPES);
const SECRET = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|authorization|cookie|bearer\s+[a-z0-9._-]+)\b/gi;
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function assertPlain(value, path = "observation", depth = 0, seen = new WeakSet()) {
  if (depth > OBSERVATION_LIMITS.depth) throw new Error(`${path} exceeds maximum depth`);
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (typeof value !== "object" || value instanceof Date) throw new Error(`${path} must contain plain data`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) throw new Error(`${path} contains an unsafe key`);
    assertPlain(value[key], `${path}.${key}`, depth + 1, seen);
  }
  seen.delete(value);
}

const bounded = (value, max = OBSERVATION_LIMITS.summary) => String(value ?? "").replace(SECRET, "[REDACTED]").slice(0, max);
const box = (value = {}) => ({
  minx: Number(value.minx ?? value.x) || 0,
  miny: Number(value.miny ?? value.y) || 0,
  maxx: Number(value.maxx ?? ((value.x || 0) + (value.w || value.width || 0))) || 0,
  maxy: Number(value.maxy ?? ((value.y || 0) + (value.h || value.height || 0))) || 0,
});
const intersects = (a, b) => a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny;

export function viewportWorldBounds(camera = {}, viewport = {}) {
  const scale = Math.max(0.01, Number(camera.scale) || 1);
  const x = -(Number(camera.x) || 0) / scale;
  const y = -(Number(camera.y) || 0) / scale;
  return { minx: x, miny: y, maxx: x + (Number(viewport.width) || 0) / scale, maxy: y + (Number(viewport.height) || 0) / scale };
}

function normalizeObject(value = {}, index, context) {
  const objectBox = box(value.box || value);
  const selected = context.selected.has(value.id);
  const highlighted = context.highlighted.has(value.id);
  const visible = intersects(objectBox, context.viewportBounds);
  const text = bounded(value.exactText ?? value.text ?? value.expandedText ?? value.preview ?? "", OBSERVATION_LIMITS.exactText);
  return {
    id: bounded(value.id || `object-${index + 1}`, 256),
    version: Math.max(1, Number(value.version) || 1),
    domain: bounded(value.domain || (value.nodeKind ? "ai" : "paper"), 40),
    kind: bounded(value.kind || value.type || value.nodeKind || "object", 80),
    summary: bounded(value.summary || text || value.label || value.name),
    exactText: value.private || value.system || value.hiddenInput ? "" : text,
    box: objectBox,
    zIndex: Number(value.zIndex ?? index) || 0,
    visibility: { inViewport: visible, clipped: false, occluded: !!value.occluded },
    selected,
    highlighted,
    groupIds: (value.groupIds || [value.groupId].filter(Boolean)).slice(0, 20).map((entry) => bounded(entry, 256)),
    parentId: bounded(value.parentId, 256) || null,
    sourceIds: [...(value.sourceIds || []), ...(value.sourceNodeIds || [])].slice(0, 50).map((entry) => bounded(entry, 256)),
    outputRef: value.outputRef ? structuredClone(value.outputRef) : null,
    historyRefs: (value.historyRefs || []).slice(0, 50).map((entry) => structuredClone(entry)),
    taste: value.tasteFeedback?.decision || value.feedback?.decision || null,
    sceneId: bounded(value.sceneId, 256) || null,
    frameId: bounded(value.frameId, 256) || null,
  };
}

export function createWorkspaceObservation(value = {}) {
  assertPlain(value);
  const scope = SCOPES.has(value.scope) ? value.scope : "viewport";
  if (scope === "visibleTab" && value.userGesture !== true) throw new Error("visible tab observation requires an explicit user gesture");
  const camera = {
    x: Number(value.camera?.x) || 0,
    y: Number(value.camera?.y) || 0,
    scale: Math.max(0.01, Number(value.camera?.scale) || 1),
  };
  const viewport = { width: Math.max(0, Number(value.viewport?.width) || 0), height: Math.max(0, Number(value.viewport?.height) || 0) };
  const viewportBounds = viewportWorldBounds(camera, viewport);
  const selected = new Set([...(value.selectedIds || []), ...(value.highlightedIds || [])]);
  const highlighted = new Set(value.highlightedIds || []);
  const normalized = (value.objects || []).map((object, index) => normalizeObject(object, index, { selected, highlighted, viewportBounds }));
  const contextIds = new Set(value.contextIds || []);
  let eligible;
  if (scope === "selection") eligible = normalized.filter((object) => object.selected || object.highlighted);
  else if (scope === "viewport" || scope === "visibleTab") eligible = normalized.filter((object) => object.visibility.inViewport);
  else if (scope === "frame" || scope === "paper") {
    const frameId = value.frameId || value.focus?.frameId || value.pageRef?.id;
    eligible = frameId
      ? normalized.filter((object) => object.frameId === frameId)
      : scope === "paper"
        ? normalized
        : normalized.filter((object) => Boolean(object.frameId));
  } else if (scope === "stage") eligible = normalized.filter((object) => !object.frameId);
  else if (scope === "orb-context") eligible = normalized.filter((object) => contextIds.has(object.id) || object.domain === "orb-context");
  else if (scope === "ai-space") eligible = normalized.filter((object) => object.domain === "ai");
  else eligible = normalized;
  eligible = [...eligible].sort((a, b) =>
    Number(b.selected || b.highlighted) - Number(a.selected || a.highlighted)
    || a.zIndex - b.zIndex
    || a.id.localeCompare(b.id));
  const included = eligible.slice(0, OBSERVATION_LIMITS.objects);
  const omitted = eligible.slice(OBSERVATION_LIMITS.objects);
  const edges = (value.edges || []).filter((edge) =>
    included.some((object) => object.id === edge.fromId) && included.some((object) => object.id === edge.toId)
  ).slice(0, 4000).map((edge) => ({
    id: bounded(edge.id || `${edge.fromId}->${edge.toId}`, 256),
    fromId: bounded(edge.fromId, 256),
    toId: bounded(edge.toId, 256),
    kind: bounded(edge.kind || "relationship", 80),
  }));
  const revision = bounded(value.stateRevision || contentFingerprint({
    objects: normalized.map((object) => [object.id, object.version, object.box, object.summary]),
    edges,
    camera,
  }), 256);
  const observation = {
    kind: "workspace-observation",
    version: WORKSPACE_OBSERVATION_VERSION,
    id: bounded(value.id || globalThis.crypto?.randomUUID?.() || `observation-${Date.now()}`, 256),
    scope,
    stateRevision: revision,
    capturedAt: Number(value.capturedAt) || Date.now(),
    pageRef: value.pageRef ? { id: bounded(value.pageRef.id, 256), version: Math.max(1, Number(value.pageRef.version) || 1) } : null,
    camera,
    viewport,
    viewportWorldBounds: viewportBounds,
    objects: included,
    edges,
    selectionIds: included.filter((object) => object.selected).map((object) => object.id),
    focus: value.focus ? structuredClone(value.focus) : null,
    openEditor: value.openEditor ? structuredClone(value.openEditor) : null,
    raster: value.raster ? { status: "ephemeral", mime: bounded(value.raster.mime, 80), retained: false } : null,
    omissions: {
      total: omitted.length,
      reasons: omitted.length ? [{ reason: "object-limit", count: omitted.length }] : [],
      omittedSelected: omitted.filter((object) => object.selected || object.highlighted).length,
    },
    source: {
      surface: bounded(value.source?.surface || "web", 40),
      authorizedScope: bounded(value.source?.authorizedScope || scope, 80),
      userGesture: value.userGesture === true,
    },
  };
  observation.fingerprint = contentFingerprint({
    scope,
    stateRevision: revision,
    objects: included.map((object) => ({ id: object.id, version: object.version, box: object.box, exactText: object.exactText })),
    edges,
  });
  return Object.freeze(observation);
}

export function sceneRelationships(observation) {
  const objects = observation.objects || [];
  const relationships = [];
  for (let leftIndex = 0; leftIndex < objects.length; leftIndex += 1) {
    const left = objects[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < objects.length; rightIndex += 1) {
      const right = objects[rightIndex];
      const leftCenter = { x: (left.box.minx + left.box.maxx) / 2, y: (left.box.miny + left.box.maxy) / 2 };
      const rightCenter = { x: (right.box.minx + right.box.maxx) / 2, y: (right.box.miny + right.box.maxy) / 2 };
      if (intersects(left.box, right.box)) relationships.push({ kind: "overlaps", fromId: left.id, toId: right.id });
      else {
        const dx = rightCenter.x - leftCenter.x;
        const dy = rightCenter.y - leftCenter.y;
        if (Math.abs(dx) > Math.abs(dy)) relationships.push({ kind: dx > 0 ? "right-of" : "left-of", fromId: right.id, toId: left.id });
        else relationships.push({ kind: dy > 0 ? "below" : "above", fromId: right.id, toId: left.id });
      }
    }
  }
  return relationships.slice(0, 4000);
}

export function revalidateObservationTarget(observation, targetId, currentRevision, currentObjects = []) {
  const target = observation.objects.find((object) => object.id === targetId);
  if (!target) return { status: "missing", target: null };
  if (String(currentRevision) === String(observation.stateRevision)) return { status: "current", target };
  const current = currentObjects.find((object) => object.id === targetId);
  if (!current) return { status: "stale-missing", target: null, requiresReplan: true };
  const currentBox = box(current.box || current);
  const materiallyChanged = current.version !== target.version
    || Math.hypot(currentBox.minx - target.box.minx, currentBox.miny - target.box.miny) > 40;
  return materiallyChanged
    ? { status: "stale-changed", target: current, requiresReplan: true }
    : { status: "re-resolved", target: current, requiresReplan: false };
}

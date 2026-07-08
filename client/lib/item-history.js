/** @typedef {'expand'|'saved-as-function'} OperatorStageKind */

export const ITEM_HISTORY_KEY = "lens.item.history.v1";

/** Only operator applications are worth tracking — no transfers, edits, or motion. */
export const OPERATOR_STAGE_KINDS = new Set(["expand", "saved-as-function"]);

const REPLAYABLE_TYPES = new Set([
  "text",
  "sticky",
  "callout",
  "code",
  "math",
  "stroke",
  "image",
  "diagram",
  "table",
  "voice",
  "video",
]);

export function isReplayableItem(it) {
  return !!it && it.type !== "link" && isPaperSideItem(it) && REPLAYABLE_TYPES.has(it.type);
}

export function isOperatorStageKind(kind) {
  return OPERATOR_STAGE_KINDS.has(kind);
}

export function shouldRecordHistory(kind) {
  return isOperatorStageKind(kind);
}

function isPaperSideItem(it) {
  return it && it.side !== "ai";
}

export function createHistoryEvent(kind, meta = {}) {
  return { t: Date.now(), kind, ...meta };
}

export function truncatePreview(text, max = 120) {
  const s = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** World-space bbox from a stored snapshot. */
export function snapshotWorldBBox(snap) {
  if (!snap) return null;
  if (snap.type === "stroke" && snap.points?.length) {
    const xs = snap.points.map((p) => p.x);
    const ys = snap.points.map((p) => p.y);
    return {
      minx: Math.min(...xs),
      miny: Math.min(...ys),
      maxx: Math.max(...xs),
      maxy: Math.max(...ys),
    };
  }
  const w =
    snap.w ||
    (snap.type === "image" ? 200 : snap.type === "voice" ? 260 : snap.type === "video" ? 280 : 360);
  const h =
    snap.h ||
    (snap.type === "image"
      ? 150
      : snap.type === "voice"
        ? 56
        : snap.type === "video"
          ? 158
          : 120);
  const x = snap.x ?? 0;
  const y = snap.y ?? 0;
  return { minx: x, miny: y, maxx: x + w, maxy: y + h };
}

export function itemSnapshot(it) {
  if (!it) return null;
  const snap = { id: it.id, type: it.type };
  if (it.text != null) snap.text = it.text;
  if (it.x != null) snap.x = it.x;
  if (it.y != null) snap.y = it.y;
  if (it.w != null) snap.w = it.w;
  if (it.h != null) snap.h = it.h;
  if (it.points) snap.points = it.points;
  if (it.src) snap.src = it.src;
  if (it.color) snap.color = it.color;
  if (it.width != null) snap.width = it.width;
  if (it.highlight) snap.highlight = it.highlight;
  if (it.marker) snap.marker = it.marker;
  if (it.bornFrom) snap.bornFrom = it.bornFrom;
  if (it.via) snap.via = it.via;
  if (it.variant) snap.variant = it.variant;
  return snap;
}

export function loadItemHistoryLog() {
  try {
    const raw = localStorage.getItem(ITEM_HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveItemHistoryLog(log) {
  try {
    localStorage.setItem(ITEM_HISTORY_KEY, JSON.stringify(log));
  } catch {
    /* quota */
  }
}

export function appendItemHistory(log, itemId, event) {
  if (!itemId || !event) return log || {};
  return {
    ...(log || {}),
    [itemId]: [...((log || {})[itemId] || []), event],
  };
}

function normalizeRawEvent(ev) {
  if (!ev) return null;
  return {
    t: ev.t || ev.at || Date.now(),
    kind: ev.kind,
    opId: ev.opId,
    opName: ev.opName,
    moveRef: ev.moveRef,
    functionName: ev.functionName,
    outputPreview: ev.outputPreview,
  };
}

function isTrackedStage(ev) {
  if (!ev || !isOperatorStageKind(ev.kind)) return false;
  if (ev.kind === "expand" && !ev.opName) return false;
  if (ev.kind === "saved-as-function" && !ev.functionName && !ev.opName) return false;
  return true;
}

function dedupeOperatorStages(events) {
  const out = [];
  for (const ev of events) {
    const label = ev.opName || ev.functionName || ev.kind;
    const prev = out[out.length - 1];
    if (prev && (prev.opName || prev.functionName) === label && prev.kind === ev.kind) continue;
    out.push(ev);
  }
  return out;
}

/** Infer a single operator stage from item.via when no log exists yet. */
function synthesizeOperatorStages(item) {
  if (!item?.via?.name) return [];
  return [
    {
      t: item.bornAt || Date.now(),
      kind: "expand",
      opName: item.via.name,
      opId: item.via.id,
      outputPreview: truncatePreview(item.text, 80),
    },
  ];
}

function eventsForItem(itemId, ctx) {
  const { item, historyLog } = ctx;
  const fromLog = (historyLog?.[itemId] || []).map(normalizeRawEvent).filter(isTrackedStage);
  const fromItem = (item?.history || []).map(normalizeRawEvent).filter(isTrackedStage);
  const merged = dedupeOperatorStages([...fromItem, ...fromLog].sort((a, b) => a.t - b.t));
  if (merged.length) return merged;
  return synthesizeOperatorStages(item);
}

function itemTitle(item) {
  return (
    (item?.text || "").trim().split("\n")[0].slice(0, 48) ||
    (item?.type === "stroke" ? "a drawing" : item?.type === "image" ? "an image" : "an object")
  );
}

/**
 * Crisp operator-stage list for an object — no transfers, motion, or birth theater.
 * @returns {{ itemId: string, title: string, stages: object[] } | null}
 */
export function buildOperatorStages(itemId, ctx) {
  const { item } = ctx;
  if (!item || !isReplayableItem(item)) return null;

  const raw = eventsForItem(itemId, ctx);
  const stages = raw.map((ev, i) => ({
    id: `${itemId}-stage-${i}-${ev.kind}`,
    kind: ev.kind,
    opName: ev.opName || ev.functionName || ev.kind,
    opId: ev.opId,
    outputPreview: ev.outputPreview ? truncatePreview(ev.outputPreview, 100) : null,
    t: ev.t,
  }));

  return { itemId, title: itemTitle(item), stages };
}

/** @deprecated Use buildOperatorStages */
export function buildItemTimeline(itemId, ctx) {
  const result = buildOperatorStages(itemId, ctx);
  if (!result) return null;
  return {
    itemId: result.itemId,
    title: result.title,
    steps: result.stages.map((s, i) => ({
      id: s.id,
      kind: s.kind,
      caption: s.opName,
      opName: s.opName,
      outputPreview: s.outputPreview,
      arrived: i === result.stages.length - 1,
    })),
  };
}

/** One abstract pipeline step from a recorded operator stage. */
export function historyEventToPerceptualStep(ev) {
  if (ev?.kind === "expand" && ev.opName) {
    return {
      name: ev.opName,
      description: ev.opName,
      moveRef: ev.moveRef || { kind: "primitive", name: ev.opName, id: ev.opId || undefined },
    };
  }
  return null;
}

/** Convert operator stages into portable capture steps. */
export function timelineToPerceptualSteps(timelineOrStages) {
  const stages = timelineOrStages?.stages || timelineOrStages?.steps || [];
  if (!stages.length) return [];
  const steps = [];
  const seen = new Set();
  for (const stage of stages) {
    const perceptual = historyEventToPerceptualStep(stage);
    if (!perceptual) continue;
    const key = `${perceptual.name}:${perceptual.moveRef?.id || perceptual.moveRef?.name || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(perceptual);
  }
  return steps;
}

/**
 * Build capture-ready perceptual steps from an item's operator lineage.
 * @returns {{ canCapture: boolean, steps?: object[], defaultName?: string, captureMeta?: object, reason?: string }}
 */
export function buildPerceptualCaptureFromItem(itemId, ctx) {
  const stagesResult = buildOperatorStages(itemId, ctx);
  if (!stagesResult) return { canCapture: false, reason: "not a capturable mark" };

  const steps = timelineToPerceptualSteps(stagesResult);
  if (!steps.length) {
    return { canCapture: false, reason: "no operators yet — apply a lens first" };
  }

  const moveNames = steps.map((s) => s.name);
  const shortChain = moveNames.slice(0, 4).join(" → ") + (moveNames.length > 4 ? " → …" : "");
  const title = stagesResult.title || "a thought";
  const defaultName =
    title && title !== "an object"
      ? `${title}: ${shortChain}`.slice(0, 72)
      : `thread: ${shortChain}`.slice(0, 72);

  return {
    canCapture: true,
    steps,
    defaultName,
    captureMeta: {
      provenance: "history-capture",
      moveChain: steps.map((s) => s.moveRef || { name: s.name }),
      stepCount: steps.length,
      sourceItemId: itemId,
    },
  };
}

export function mergeItemHistoryEvents(item, historyLog) {
  const fromLog = historyLog?.[item?.id] || [];
  const fromItem = item?.history || [];
  return [...fromItem, ...fromLog]
    .map(normalizeRawEvent)
    .filter(isTrackedStage)
    .sort((a, b) => (a.t || 0) - (b.t || 0));
}

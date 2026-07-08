/** @typedef {'born'|'transfer-to-ai'|'expand'|'transfer-to-paper'|'edit'|'voice-session'|'highlight-transfer'|'saved-as-function'} HistoryKind */

export const ITEM_HISTORY_KEY = "lens.item.history.v1";

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

/** Minimal serializable snapshot for replay ghosts. */
/** World-space bbox from a stored snapshot (for history replay when live item moved). */
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

export function replayStepDuration(kind) {
  switch (kind) {
    case "born":
      return 800;
    case "transfer-to-ai":
    case "transfer-to-paper":
    case "highlight-transfer":
    case "saved-as-function":
      return 1100;
    case "expand":
      return 1000;
    case "voice-session":
      return 1200;
    case "edit":
      return 700;
    default:
      return 900;
  }
}

function captionForBorn(item) {
  if (item.type === "stroke") return "drawn on paper";
  if (item.type === "image") return "placed on paper";
  if (item.instructionText) return "drawn with voice";
  return "created on paper";
}

function normalizeRawEvent(ev) {
  if (!ev) return null;
  return {
    t: ev.t || ev.at || Date.now(),
    kind: ev.kind,
    caption: ev.caption,
    itemSnapshot: ev.itemSnapshot || null,
    aiNodeId: ev.aiNodeId,
    opId: ev.opId,
    opName: ev.opName,
    moveRef: ev.moveRef,
    targetLayer: ev.targetLayer,
    functionName: ev.functionName,
    inputPreview: ev.inputPreview,
    outputPreview: ev.outputPreview,
    textSnapshot: ev.textSnapshot,
    textDiff: ev.textDiff,
    sessionId: ev.sessionId,
    transcript: ev.transcript,
  };
}

function synthesizeTimeline(itemId, ctx) {
  const { item, aiNodes, pages } = ctx;
  const events = [];
  const t0 = item.bornAt || Date.now();

  events.push({
    t: t0,
    kind: "born",
    itemSnapshot: itemSnapshot(item),
    caption: captionForBorn(item),
  });

  if (item.via?.name) {
    events.push({
      t: t0 + 1,
      kind: "expand",
      opName: item.via.name,
      itemSnapshot: itemSnapshot(item),
      inputPreview: truncatePreview(item.text, 80),
      outputPreview: truncatePreview(item.text, 80),
      caption: `through “${item.via.name}”`,
    });
  }

  const sessionId = item.paperSessionId || item.recordingSessionId;
  if (sessionId) {
    const page = (pages || []).find((p) => p.id === (item.pageId || "default"));
    const session = page?.sessions?.find((s) => s.id === sessionId);
    events.push({
      t: session?.endedAt || session?.startedAt || t0 + 2,
      kind: "voice-session",
      sessionId,
      transcript: truncatePreview(session?.transcript, 160),
      caption: session?.transcript ? "voice session" : "linked to voice",
    });
  }

  const sourceNodes = (aiNodes || []).filter(
    (n) => n.sourceIds?.includes(itemId) && (n.nodeKind === "source" || n.nodeKind === "session")
  );
  let offset = 10;
  for (const sourceNode of sourceNodes) {
    events.push({
      t: t0 + offset,
      kind: "transfer-to-ai",
      aiNodeId: sourceNode.id,
      inputPreview: truncatePreview(sourceNode.preview, 80),
      caption: "sent to AI",
    });
    offset += 5;
    const expanded = (aiNodes || []).filter(
      (n) => n.parentId === sourceNode.id && n.nodeKind === "expanded"
    );
    for (const exp of expanded) {
      events.push({
        t: t0 + offset,
        kind: "expand",
        opName: exp.opLabel || exp.label || "expand",
        aiNodeId: exp.id,
        inputPreview: truncatePreview(sourceNode.preview || exp.preview, 80),
        outputPreview: truncatePreview(exp.expandedText, 120),
        caption: exp.opLabel ? `“${exp.opLabel}” in AI` : "expanded in AI",
      });
      offset += 5;
    }
  }

  return events.sort((a, b) => a.t - b.t);
}

function eventsForItem(itemId, ctx) {
  const { item, historyLog } = ctx;
  const fromLog = (historyLog?.[itemId] || []).map(normalizeRawEvent).filter(Boolean);
  const fromItem = (item?.history || []).map(normalizeRawEvent).filter(Boolean);
  const merged = [...fromItem, ...fromLog].sort((a, b) => a.t - b.t);
  if (merged.length) return merged;
  return synthesizeTimeline(itemId, ctx);
}

function stepCaption(ev) {
  if (ev.caption) return ev.caption;
  switch (ev.kind) {
    case "born":
      return "where it began";
    case "transfer-to-ai":
      return "sent to AI";
    case "transfer-to-paper":
      return "returned to paper";
    case "expand":
      return ev.opName ? `through “${ev.opName}”` : "transformed";
    case "edit":
      return "edited on paper";
    case "voice-session":
      return "voice session";
    case "highlight-transfer":
      return ev.targetLayer === "functions"
        ? "highlighted → steps"
        : ev.targetLayer === "structures"
          ? "highlighted → symbol"
        : ev.targetLayer === "paper"
          ? "highlighted → paper"
          : "highlighted → AI";
    case "saved-as-function":
      return ev.functionName ? `saved as “${ev.functionName}”` : "saved as function";
    default:
      return "step";
  }
}

/** Perceptual moves distilled from history — reapplicable on any new material. */
const HISTORY_PERCEPTUAL_MOVES = {
  "highlight-transfer": {
    name: "highlight explore",
    description: "Pull highlighted material into the void and expand it.",
    moveRef: { kind: "move", name: "highlight explore" },
  },
  "transfer-to-ai": {
    name: "send to void",
    description: "Gather material into the AI exploration layer.",
    moveRef: { kind: "move", name: "send to void" },
  },
  "transfer-to-paper": {
    name: "return to paper",
    description: "Land expanded thought back on the paper surface.",
    moveRef: { kind: "move", name: "return to paper" },
  },
  edit: {
    name: "refine on paper",
    description: "Edit and refine the mark in place.",
    moveRef: { kind: "move", name: "refine on paper" },
  },
  "voice-session": {
    name: "voice session",
    description: "Shape the mark through a live voice-and-ink session.",
    moveRef: { kind: "move", name: "voice session" },
  },
};

/** One abstract pipeline step from a recorded history event. */
export function historyEventToPerceptualStep(ev) {
  if (!ev?.kind || ev.kind === "born" || ev.kind === "saved-as-function") return null;

  if (ev.kind === "expand" && ev.opName) {
    return {
      name: ev.opName,
      description: `Perceptual expansion: ${ev.opName}`,
      moveRef: ev.moveRef || { kind: "primitive", name: ev.opName, id: ev.opId || undefined },
    };
  }

  const preset = HISTORY_PERCEPTUAL_MOVES[ev.kind];
  if (preset) {
    return { ...preset };
  }

  return null;
}

/** Convert a replay timeline into portable capture steps (skips birth-only threads). */
export function timelineToPerceptualSteps(timeline) {
  if (!timeline?.steps?.length) return [];
  const steps = [];
  const seen = new Set();
  for (const step of timeline.steps) {
    const perceptual = historyEventToPerceptualStep(step);
    if (!perceptual) continue;
    const key = `${perceptual.name}:${perceptual.moveRef?.id || perceptual.moveRef?.name || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(perceptual);
  }
  return steps;
}

/**
 * Build capture-ready perceptual steps from an item's full lineage log.
 * @returns {{ canCapture: boolean, steps?: object[], defaultName?: string, captureMeta?: object, reason?: string }}
 */
export function buildPerceptualCaptureFromItem(itemId, ctx) {
  const timeline = buildItemTimeline(itemId, ctx);
  if (!timeline) return { canCapture: false, reason: "not a capturable mark" };

  const steps = timelineToPerceptualSteps(timeline);
  if (!steps.length) {
    return { canCapture: false, reason: "no perceptual moves yet — explore or transform first" };
  }

  const moveNames = steps.map((s) => s.name);
  const shortChain = moveNames.slice(0, 4).join(" → ") + (moveNames.length > 4 ? " → …" : "");
  const title = timeline.title || "a thought";
  const defaultName =
    title && title !== "a thought"
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

/**
 * Build replay timeline for a paper object.
 * @returns {{ itemId: string, title: string, steps: object[] } | null}
 */
export function buildItemTimeline(itemId, ctx) {
  const { item } = ctx;
  if (!item || !isReplayableItem(item)) return null;

  const rawEvents = eventsForItem(itemId, ctx);
  if (!rawEvents.length) return null;

  const steps = rawEvents.map((ev, i) => {
    const snap = ev.itemSnapshot || itemSnapshot(item);
    const prior = i > 0 ? rawEvents[i - 1].itemSnapshot || null : null;
    return {
      id: `${itemId}-${i}-${ev.kind}`,
      t: ev.t,
      kind: ev.kind,
      caption: stepCaption(ev),
      itemSnapshot: snap,
      priorSnapshot: prior,
      itemIds: [itemId],
      focusId: itemId,
      aiNodeId: ev.aiNodeId,
      opName: ev.opName,
      inputPreview: ev.inputPreview,
      outputPreview: ev.outputPreview || ev.textSnapshot,
      textSnapshot: ev.textSnapshot,
      transcript: ev.transcript,
      arrived: i === rawEvents.length - 1,
    };
  });

  const title =
    (item.text || "").trim().split("\n")[0].slice(0, 48) ||
    (item.type === "stroke" ? "a drawing" : item.type === "image" ? "an image" : "an object");

  return { itemId, title, steps };
}

export function mergeItemHistoryEvents(item, historyLog) {
  const fromLog = historyLog?.[item?.id] || [];
  const fromItem = item?.history || [];
  return [...fromItem, ...fromLog].sort((a, b) => (a.t || a.at || 0) - (b.t || b.at || 0));
}

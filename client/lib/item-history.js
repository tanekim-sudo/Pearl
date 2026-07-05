/** @typedef {'born'|'transfer-to-ai'|'expand'|'transfer-to-paper'|'edit'|'voice-session'|'highlight-transfer'} HistoryKind */

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
    opName: ev.opName,
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
      return "highlighted → AI";
    default:
      return "step";
  }
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

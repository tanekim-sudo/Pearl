import { PAPER_WIDTH, PAPER_HEIGHT, describeStroke } from "../client/lib/paper.js";

export const SKETCH_BUNDLE_MIME = "application/lens-sketch-bundle";

/** Tags applied to board items created while a recording session is active. */
export function recordingItemTags(recordingSession) {
  if (!recordingSession?.recording) return {};
  return {
    paperSessionId: recordingSession.id,
    recordingSessionId: recordingSession.id,
  };
}

export function registerRecordingItem(recordingSession, itemId) {
  if (!recordingSession?.recording || !itemId) return;
  if (!recordingSession.itemIds) recordingSession.itemIds = [];
  if (!recordingSession.itemIds.includes(itemId)) {
    recordingSession.itemIds.push(itemId);
  }
}

export function itemBelongsToSession(item, sessionId) {
  if (!sessionId || !item) return false;
  return item.paperSessionId === sessionId || item.recordingSessionId === sessionId;
}

/** Metadata patch applied to all items created during a saved recording session. */
export function buildItemSessionPatch(session) {
  const patch = { paperSessionId: session.id };
  if (session.transcript?.trim()) {
    patch.instructionText = session.transcript.trim();
  }
  return patch;
}

function strokeToSessionStroke(it) {
  return {
    id: it.id,
    color: it.color,
    width: it.width,
    marker: !!it.marker,
    highlight: !!it.highlight,
    points: it.points,
    instructionText: it.instructionText,
  };
}

/** Build a transferable sketch bundle from a selection (and optional saved/live session). */
export function gatherSketchBundle({ selectedIds = [], pageItems = [], sessions = [], liveSession = null }) {
  const selected = pageItems.filter((it) => selectedIds.includes(it.id));
  if (!selected.length) return null;

  const sessionIds = [
    ...new Set(selected.map((it) => it.paperSessionId || it.recordingSessionId).filter(Boolean)),
  ];

  let session = null;
  if (sessionIds.length === 1) {
    const sid = sessionIds[0];
    session = sessions.find((s) => s.id === sid) || null;
    if (!session && liveSession?.id === sid && liveSession.recording) {
      session = liveSession.toSession(null);
    }
  } else if (
    liveSession?.recording &&
    selected.some((it) => it.recordingSessionId === liveSession.id || it.paperSessionId === liveSession.id)
  ) {
    session = liveSession.toSession(null);
  }

  let strokeIds = selected.filter((it) => it.type === "stroke").map((it) => it.id);
  let itemIds = selected.filter((it) => it.type !== "stroke" && it.type !== "link").map((it) => it.id);

  if (session?.id) {
    const sessionItems = pageItems.filter((it) => itemBelongsToSession(it, session.id));
    strokeIds = [
      ...new Set([
        ...strokeIds,
        ...sessionItems.filter((it) => it.type === "stroke").map((it) => it.id),
        ...(session.strokes || []).map((s) => s.id),
      ]),
    ];
    itemIds = [
      ...new Set([
        ...itemIds,
        ...sessionItems.filter((it) => it.type !== "stroke" && it.type !== "link").map((it) => it.id),
        ...(session.itemIds || []),
      ]),
    ];
  }

  const voiceText =
    session?.transcript?.trim() ||
    [...new Set(selected.map((it) => it.instructionText).filter(Boolean))].join(" · ");

  const hasStrokes = strokeIds.length > 0 || selected.some((it) => it.type === "stroke");
  const hasVoice = !!voiceText;
  if (!session && !hasVoice && !hasStrokes) return null;

  const bundleItems = pageItems.filter((it) => strokeIds.includes(it.id) || itemIds.includes(it.id));
  const strokes =
    session?.strokes?.length
      ? session.strokes
      : bundleItems.filter((it) => it.type === "stroke").map(strokeToSessionStroke);

  return {
    type: "sketch-bundle",
    sessionId: session?.id || null,
    strokeIds,
    itemIds,
    audioUrl: session?.audioUrl || null,
    transcript: voiceText || null,
    voiceSegments: session?.voiceSegments || [],
    annotations: session?.annotations || [],
    strokes,
    paperSize: session?.paperSize || { width: PAPER_WIDTH, height: PAPER_HEIGHT },
  };
}

export function bundleAsSession(bundle) {
  if (!bundle) return null;
  return {
    id: bundle.sessionId,
    transcript: bundle.transcript,
    voiceSegments: bundle.voiceSegments || [],
    annotations: bundle.annotations || [],
    strokes: bundle.strokes || [],
  };
}

export function bundleLabel(bundle) {
  const t = bundle?.transcript?.trim();
  if (t) return t.length > 32 ? t.slice(0, 32) + "…" : t;
  if (bundle?.strokeIds?.length) return "sketch + voice";
  return "sketch bundle";
}

export function buildSketchBundlePrompt(bundle, pageItems = []) {
  const session = bundleAsSession(bundle);
  const strokeLines = (session?.strokes || [])
    .map((s) => `- ${describeStroke(s)}`)
    .join("\n");
  const itemLines = pageItems
    .filter((it) => it.type !== "stroke" && it.type !== "link")
    .map((it) => {
      if (it.type === "text" && it.text?.trim()) return `- text block: "${it.text.trim().slice(0, 120)}"`;
      if (it.type === "image") return `- image at (${Math.round(it.x)},${Math.round(it.y)})`;
      if (it.text?.trim()) return `- ${it.type}: "${it.text.trim().slice(0, 80)}"`;
      return `- ${it.type} item`;
    })
    .join("\n");
  const voiceLines = (session?.voiceSegments || [])
    .filter((v) => v.text?.trim())
    .map((v) => `[${v.startMs}–${v.endMs}ms] ${v.text}`)
    .join("\n");
  const annotLines = (session?.annotations || [])
    .map(
      (a) =>
        `- strokes ${a.strokeIds.join(", ")} ↔ voice #${a.voiceSegmentIndex}: "${a.instruction}"`
    )
    .join("\n");

  return `You are reading a multimodal notebook page (${PAPER_WIDTH}×${PAPER_HEIGHT}px).

Voice transcript (explains everything drawn during this session):
${session?.transcript || "(none)"}

Voice segments (timestamped):
${voiceLines || "(none)"}

Recorded strokes:
${strokeLines || "(none)"}

Other items created during session:
${itemLines || "(none)"}

Voice↔stroke associations:
${annotLines || "(none)"}

Interpret what the user drew and said. The voice recording is the explanation for all spatial marks and items. Be concise but insightful.`;
}

export function selectionHasSketchBundle(selectedIds, pageItems, sessions, liveSession) {
  return !!gatherSketchBundle({ selectedIds, pageItems, sessions, liveSession });
}

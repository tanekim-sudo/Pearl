/**
 * Scene / Output Frame interaction rules for first-use clarity:
 * objects appear from intent, drag moves (unless explicit duplicate), delete removes.
 */

/** True only when the URL explicitly requests the Output Frame surface. */
export function wantsOutputFrameFromSearch(search = "") {
  const query = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || "").replace(/^\?/, ""));
  if (["legacy", "workspace"].includes(query.get("frame"))) return true;
  return [...query.keys()].some((key) => /(?:audit|frame|brush|learn)/i.test(key));
}

/** Whether a DataTransfer should be accepted on the Scene stage. */
export function shouldAcceptSceneStageTransfer(types = []) {
  const list = Array.from(types || []);
  return list.includes("application/x-lens-object")
    || list.includes("Files")
    || list.includes("text/plain")
    || list.includes("text/uri-list");
}

/**
 * Build a stage material from pasted/dropped text or an extracted file body.
 * Deterministic — no model required.
 */
export function materialFromIngestedText({
  text = "",
  label = null,
  filename = null,
  mime = "text/plain",
  sourceKind = "paste",
  id = null,
} = {}) {
  const body = String(text || "").trim();
  if (!body) return null;
  const name = String(label || filename || body.slice(0, 48) || "Imported material").trim();
  return {
    id: id || `ingest:${sourceKind}:${Date.now()}`,
    type: "text",
    kind: "text",
    materialKind: "text",
    label: name.slice(0, 80),
    name: name.slice(0, 80),
    text: body.slice(0, 200_000),
    mime: mime || "text/plain",
    provenance: {
      kind: sourceKind === "file" ? "local-file-drop" : "local-text-ingest",
      filename: filename || null,
      importedAt: Date.now(),
      private: true,
    },
  };
}

/**
 * Strip companion command phrases so pasted corpora remain when the user
 * appends “find forming pearls” after a chat dump. Short command-only text
 * returns empty so the runtime falls through to clipboard / orb context.
 */
export function extractFormingPearlCorpus(commandText = "") {
  const value = String(commandText || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const stripped = value
    .replace(/\b(?:import|discover|find)\b.+\b(?:forming )?pearls?\b/gi, " ")
    .replace(/\bpearls that were already forming\b/gi, " ")
    .replace(/\b(?:turn|make|convert)\b.+\b(?:into|as)\b.+\b(?:at most )?five pearls?\b/gi, " ")
    .replace(/\b(?:chat|docs?|drafts?|transcript)\b.+\b(?:into|as) (?:at most )?five pearls?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length >= 40 ? stripped : "";
}

/**
 * Resolve a drop onto the Scene stage.
 * Same-scene materials move by default. Alt/Option duplicates. External material materializes once.
 * Semantic orbs already on the scene are ignored here (pointer drag moves them).
 */
export function resolveSceneMaterialDrop({
  source = null,
  sceneId = null,
  sceneItemIds = [],
  altKey = false,
  worldPoint = { x: 0, y: 0 },
} = {}) {
  if (!source || typeof source !== "object") {
    return { action: "ignore", reason: "missing-source" };
  }
  if (source.kind === "semantic-orb" || source.representation) {
    return { action: "ignore", reason: "semantic-orb-uses-pointer-move" };
  }
  const sourceId = source.id || null;
  const alreadyOnScene = Boolean(
    sourceId
    && sceneItemIds.includes(sourceId)
    && (!source.sceneId || !sceneId || source.sceneId === sceneId)
  );
  if (alreadyOnScene && !altKey) {
    return {
      action: "move",
      id: sourceId,
      worldPoint: {
        x: Number(worldPoint?.x) || 0,
        y: Number(worldPoint?.y) || 0,
      },
    };
  }
  return {
    action: "materialize",
    item: source,
    worldPoint: {
      x: Number(worldPoint?.x) || 0,
      y: Number(worldPoint?.y) || 0,
    },
    duplicate: alreadyOnScene && altKey,
  };
}

/** Whether companion/runtime actions may open the Output Frame without user chrome intent. */
export function shouldAutoOpenOutputFrameOnCommand() {
  return false;
}

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
  return [...query.keys()].some((key) => /(?:audit|tour|brush|learn)/i.test(key));
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

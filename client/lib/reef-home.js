/**
 * Reef — the user's home dashboard of all pearls.
 * Routing lands here for `/`, `/library`, and `/toolbox`.
 */

export const REEF_HOME_PATHS = Object.freeze(["/", "/library", "/toolbox"]);

export function isReefHomePath(path = "/") {
  const normalized = String(path || "/").replace(/\/+$/, "") || "/";
  return REEF_HOME_PATHS.includes(normalized);
}

/** Collect every non-archived pearl across scenes for the Reef home dashboard. */
export function collectReefPearls(scenes = []) {
  const pearls = [];
  for (const scene of scenes) {
    for (const orb of scene.semanticOrbs || []) {
      if (orb?.archived) continue;
      pearls.push({
        id: orb.id,
        name: orb.name || orb.identity?.name || "Pearl",
        sceneId: scene.id,
        sceneName: scene.name || "Scene",
        kind: orb.kind || "semantic",
        aesthetic: orb.aesthetic || null,
      });
    }
  }
  return pearls;
}
